'use client';

import {
  PaymentProvider,
  TripPaymentStatus,
  TripRequestExecutionStatus,
  TripRequestStatus,
  TripStatus,
} from '@saferidepro/shared-types';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '../../../../lib/api-client';
import { Button } from '../../../../components/ui/button';
import { OperationalAccessCard } from '../../../../components/ui/operational-access-card';
import { ToastStack, type ToastItem } from '../../../../components/ui/toast-stack';
import { useAutoRefresh } from '../../../../hooks/use-auto-refresh';
import { useAuth } from '../../../../modules/auth/hooks/use-auth';
import { getOperationalAccessState } from '../../../../modules/auth/lib/operational-context';
import {
  confirmCashPayment,
  createPaymentCheckoutLink,
  refreshPaymentStatus,
  reportCashPaymentIssue,
} from '../../../../modules/payments/lib/payment-api';
import { useRealtimeEventStream } from '../../../../modules/realtime/hooks/use-realtime-event-stream';
import {
  acceptTripRequest,
  listIncomingTripRequests,
  markTripRequestAsNoShow,
  rejectTripRequest,
} from '../../../../modules/trip-requests/lib/trip-request-api';
import type { TripRequestRecord } from '../../../../modules/trip-requests/types/trip-request';
import { TripsListPagination } from '../../../../modules/trips/components/trips-list-pagination';
import { TripsRequestsWorkspace } from '../../../../modules/trips/components/trips-requests-workspace';
import { TripsWorkspaceSkeleton } from '../../../../modules/trips/components/trips-workspace-skeleton';
import styles from './page.module.css';

const DEFAULT_NO_SHOW_NOTE = 'El pasajero no se presento al punto acordado.';
const PAGE_SIZE = 6;

type RequestStatusFilter =
  | TripRequestStatus.Pending
  | TripRequestStatus.Accepted
  | TripRequestStatus.NoShow
  | TripRequestStatus.Rejected
  | TripRequestStatus.Cancelled;

type PaymentFilter = 'pending' | 'paid' | 'cash-pending' | 'paypal-pending';
type RequestSortOption = 'activity-desc' | 'created-desc' | 'departure-asc' | 'departure-desc' | 'payment-desc';

const REQUEST_STATUS_FILTERS: ReadonlyArray<{
  key: RequestStatusFilter;
  label: string;
}> = [
  { key: TripRequestStatus.Pending, label: 'Pendientes' },
  { key: TripRequestStatus.Accepted, label: 'Aceptadas' },
  { key: TripRequestStatus.NoShow, label: 'Ausencias' },
  { key: TripRequestStatus.Rejected, label: 'Rechazadas' },
  { key: TripRequestStatus.Cancelled, label: 'Canceladas' },
];

const PAYMENT_FILTERS: ReadonlyArray<{
  key: PaymentFilter;
  label: string;
}> = [
  { key: 'pending', label: 'Pago pendiente' },
  { key: 'paid', label: 'Pago confirmado' },
  { key: 'cash-pending', label: 'Efectivo por confirmar' },
  { key: 'paypal-pending', label: 'PayPal pendiente' },
];

function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

function canAcceptIncomingRequest(request: TripRequestRecord): boolean {
  return (
    request.status === TripRequestStatus.Pending &&
    request.tripStatus === TripStatus.Published &&
    request.tripAvailableSeats > 0
  );
}

function canRejectIncomingRequest(request: TripRequestRecord): boolean {
  return (
    request.status === TripRequestStatus.Pending &&
    (request.tripStatus === TripStatus.Published || request.tripStatus === TripStatus.Full)
  );
}

function canMarkRequestAsNoShow(request: TripRequestRecord): boolean {
  return (
    request.status === TripRequestStatus.Accepted &&
    (request.executionStatus === null
      || request.executionStatus === TripRequestExecutionStatus.AcceptedPendingBoarding) &&
    (request.tripStatus === TripStatus.InProgress || request.tripStatus === TripStatus.Completed)
  );
}

function matchesPaymentFilter(request: TripRequestRecord, filter: PaymentFilter): boolean {
  const payment = request.payment;

  if (!payment) {
    return false;
  }

  switch (filter) {
    case 'pending':
      return payment.status === TripPaymentStatus.Pending;
    case 'paid':
      return payment.status === TripPaymentStatus.Paid;
    case 'cash-pending':
      return (
        payment.provider === PaymentProvider.Cash &&
        payment.status === TripPaymentStatus.Pending
      );
    case 'paypal-pending':
      return (
        payment.provider === PaymentProvider.Paypal &&
        payment.status === TripPaymentStatus.Pending
      );
    default:
      return true;
  }
}

function getRequestActivityTimestamp(request: TripRequestRecord): number {
  return Math.max(
    new Date(request.createdAt).getTime(),
    request.reviewedAt ? new Date(request.reviewedAt).getTime() : 0,
    request.cancelledAt ? new Date(request.cancelledAt).getTime() : 0,
    request.executionStatusUpdatedAt ? new Date(request.executionStatusUpdatedAt).getTime() : 0,
    request.payment?.updatedAt ? new Date(request.payment.updatedAt).getTime() : 0,
  );
}

function sortRequests(
  requests: TripRequestRecord[],
  sortBy: RequestSortOption = 'activity-desc',
): TripRequestRecord[] {
  const priorityByStatus: Record<TripRequestStatus, number> = {
    [TripRequestStatus.Pending]: 0,
    [TripRequestStatus.Accepted]: 1,
    [TripRequestStatus.NoShow]: 2,
    [TripRequestStatus.Rejected]: 3,
    [TripRequestStatus.Cancelled]: 4,
  };

  return [...requests].sort((left, right) => {
    switch (sortBy) {
      case 'created-desc':
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      case 'departure-asc':
        return new Date(left.tripDepartureAt).getTime() - new Date(right.tripDepartureAt).getTime();
      case 'departure-desc':
        return new Date(right.tripDepartureAt).getTime() - new Date(left.tripDepartureAt).getTime();
      case 'payment-desc':
        return (
          new Date(right.payment?.updatedAt ?? right.createdAt).getTime() -
          new Date(left.payment?.updatedAt ?? left.createdAt).getTime()
        );
      case 'activity-desc':
      default: {
        const activityDiff = getRequestActivityTimestamp(right) - getRequestActivityTimestamp(left);

        if (activityDiff !== 0) {
          return activityDiff;
        }
      }
    }

    const statusPriority = priorityByStatus[left.status] - priorityByStatus[right.status];

    if (statusPriority !== 0) {
      return statusPriority;
    }

    const departureDiff =
      new Date(left.tripDepartureAt).getTime() - new Date(right.tripDepartureAt).getTime();

    if (departureDiff !== 0) {
      return departureDiff;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

function matchesSearchFilter(request: TripRequestRecord, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    request.tripOriginLabel,
    request.tripDestinationLabel,
    request.passengerFullName,
    request.driverFullName,
    request.payment?.provider,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery));
}

function isWithinDepartureRange(
  request: TripRequestRecord,
  dateFrom: string,
  dateTo: string,
): boolean {
  const departureTimestamp = new Date(request.tripDepartureAt).getTime();
  const fromTimestamp = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
  const toTimestamp = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;

  if (fromTimestamp !== null && departureTimestamp < fromTimestamp) {
    return false;
  }

  if (toTimestamp !== null && departureTimestamp > toTimestamp) {
    return false;
  }

  return true;
}

function getLatestRequestPerPassengerTrip(
  requests: TripRequestRecord[],
): TripRequestRecord[] {
  const latestRequests = new Map<string, TripRequestRecord>();

  requests.forEach((request) => {
    const key = `${request.tripId}:${request.passengerMembershipId}`;
    const currentRequest = latestRequests.get(key);

    if (
      !currentRequest ||
      new Date(request.createdAt).getTime() > new Date(currentRequest.createdAt).getTime()
    ) {
      latestRequests.set(key, request);
    }
  });

  return Array.from(latestRequests.values());
}

export default function DriverTripRequestsPage() {
  const { authSession, isHydrated, refreshSession } = useAuth();
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);
  const [incomingRequests, setIncomingRequests] = useState<TripRequestRecord[]>([]);
  const [noShowNotes, setNoShowNotes] = useState<Record<string, string>>({});
  const [selectedStatuses, setSelectedStatuses] = useState<RequestStatusFilter[]>([
    TripRequestStatus.Pending,
    TripRequestStatus.Accepted,
  ]);
  const [selectedPayments, setSelectedPayments] = useState<PaymentFilter[]>([]);
  const [queryFilter, setQueryFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [sortBy, setSortBy] = useState<RequestSortOption>('activity-desc');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [isMutatingRequestId, setIsMutatingRequestId] = useState<string | null>(null);
  const [isMutatingPaymentId, setIsMutatingPaymentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeRefreshPendingRef = useRef(false);
  const realtimeRefreshRunningRef = useRef(false);

  const pushToast = useCallback((title: string, description: string, tone: ToastItem['tone']) => {
    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id: `driver-requests-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        tone,
      },
    ]);
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  }, []);

  const loadRequests = useCallback(async (accessToken: string) => {
    const items = await listIncomingTripRequests(accessToken);
    setIncomingRequests(items);
  }, []);

  const refreshRequests = useCallback(async (showSpinner = false) => {
    if (!authSession) {
      return;
    }

    if (showSpinner) {
      setIsRefreshingData(true);
    }

    try {
      await loadRequests(authSession.accessToken);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(getApiErrorMessage(error, 'No fue posible sincronizar las solicitudes.'));
    } finally {
      if (showSpinner) {
        setIsRefreshingData(false);
      }
    }
  }, [authSession, loadRequests, refreshSession]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!authSession || !operationalAccess.hasOperationalMembership) {
      setIncomingRequests([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const run = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        await loadRequests(authSession.accessToken);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiError && error.status === 403) {
          await refreshSession().catch(() => undefined);
        }

        setErrorMessage(
          getApiErrorMessage(error, 'No fue posible cargar las solicitudes de viaje.'),
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      isMounted = false;
    };
  }, [
    authSession,
    isHydrated,
    loadRequests,
    operationalAccess.hasOperationalMembership,
    refreshSession,
  ]);

  useAutoRefresh(
    async () => {
      await refreshRequests();
    },
    {
      enabled: Boolean(authSession && isHydrated && operationalAccess.hasOperationalMembership),
      refreshOnVisible: true,
    },
  );

  const scheduleRealtimeRefresh = useCallback(() => {
    if (realtimeRefreshTimeoutRef.current) {
      clearTimeout(realtimeRefreshTimeoutRef.current);
    }

    realtimeRefreshTimeoutRef.current = setTimeout(() => {
      if (realtimeRefreshRunningRef.current) {
        realtimeRefreshPendingRef.current = true;
        return;
      }

      realtimeRefreshRunningRef.current = true;

      void refreshRequests().finally(() => {
        realtimeRefreshRunningRef.current = false;

        if (realtimeRefreshPendingRef.current) {
          realtimeRefreshPendingRef.current = false;
          scheduleRealtimeRefresh();
        }
      });
    }, 250);
  }, [refreshRequests]);

  useEffect(() => {
    return () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
    };
  }, []);

  useRealtimeEventStream({
    accessToken: authSession?.accessToken,
    enabled: Boolean(authSession && operationalAccess.hasOperationalMembership),
    onEvent: (event) => {
      if (event.type === 'trip.changed' || event.type === 'trip-request.changed') {
        scheduleRealtimeRefresh();
      }
    },
  });

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    pushToast('No fue posible completar la accion', errorMessage, 'error');
    setErrorMessage(null);
  }, [errorMessage, pushToast]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    pushToast('Solicitud actualizada', successMessage, 'success');
    setSuccessMessage(null);
  }, [pushToast, successMessage]);

  const toggleStatusFilter = (status: RequestStatusFilter) => {
    setPage(1);
    setSelectedStatuses((currentStatuses) =>
      currentStatuses.includes(status)
        ? currentStatuses.filter((item) => item !== status)
        : [...currentStatuses, status],
    );
  };

  const togglePaymentFilter = (paymentFilter: PaymentFilter) => {
    setPage(1);
    setSelectedPayments((currentFilters) =>
      currentFilters.includes(paymentFilter)
        ? currentFilters.filter((item) => item !== paymentFilter)
        : [...currentFilters, paymentFilter],
    );
  };

  const clearFilters = () => {
    setSelectedStatuses([TripRequestStatus.Pending, TripRequestStatus.Accepted]);
    setSelectedPayments([]);
    setQueryFilter('');
    setDateFromFilter('');
    setDateToFilter('');
    setSortBy('activity-desc');
    setPage(1);
  };

  const filteredRequests = useMemo(() => {
    const nextRequests = getLatestRequestPerPassengerTrip(incomingRequests).filter((request) => {
      const matchesStatus =
        selectedStatuses.length === 0 || selectedStatuses.includes(request.status as RequestStatusFilter);
      const matchesPayment =
        selectedPayments.length === 0
        || selectedPayments.some((paymentFilter) => matchesPaymentFilter(request, paymentFilter));
      const matchesQuery = matchesSearchFilter(request, queryFilter);
      const matchesDate = isWithinDepartureRange(request, dateFromFilter, dateToFilter);

      return matchesStatus && matchesPayment && matchesQuery && matchesDate;
    });

    return sortRequests(nextRequests, sortBy);
  }, [dateFromFilter, dateToFilter, incomingRequests, queryFilter, selectedPayments, selectedStatuses, sortBy]);

  const paginatedRequests = useMemo(
    () => filteredRequests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredRequests, page],
  );

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));

    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [filteredRequests.length, page]);

  const pendingCount = useMemo(
    () => incomingRequests.filter((request) => request.status === TripRequestStatus.Pending).length,
    [incomingRequests],
  );

  const awaitingCashConfirmationCount = useMemo(
    () =>
      incomingRequests.filter(
        (request) =>
          request.payment?.provider === PaymentProvider.Cash
          && request.payment.status === TripPaymentStatus.Pending
          && request.status === TripRequestStatus.Accepted,
      ).length,
    [incomingRequests],
  );

  const handleIncomingRequestAction = async (
    requestId: string,
    action: 'accept' | 'reject',
  ) => {
    if (!authSession) {
      return;
    }

    setIsMutatingRequestId(requestId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response =
        action === 'accept'
          ? await acceptTripRequest(authSession.accessToken, requestId)
          : await rejectTripRequest(authSession.accessToken, requestId);

      await refreshRequests();
      setSuccessMessage(response.message);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(
        getApiErrorMessage(
          error,
          action === 'accept'
            ? 'No fue posible aceptar la solicitud.'
            : 'No fue posible rechazar la solicitud.',
        ),
      );
      await refreshRequests();
    } finally {
      setIsMutatingRequestId(null);
    }
  };

  const handleNoShowNoteChange = (requestId: string, value: string) => {
    setNoShowNotes((currentNotes) => ({
      ...currentNotes,
      [requestId]: value,
    }));
  };

  const handleMarkNoShow = async (requestId: string) => {
    if (!authSession) {
      return;
    }

    setIsMutatingRequestId(requestId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const reviewNote = (noShowNotes[requestId] ?? DEFAULT_NO_SHOW_NOTE).trim();
      const response = await markTripRequestAsNoShow(
        authSession.accessToken,
        requestId,
        reviewNote,
      );

      await refreshRequests();
      setSuccessMessage(response.message);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(getApiErrorMessage(error, 'No fue posible registrar la ausencia.'));
      await refreshRequests();
    } finally {
      setIsMutatingRequestId(null);
    }
  };

  const handleConfirmCashPayment = async (paymentId: string) => {
    if (!authSession) {
      return;
    }

    setIsMutatingPaymentId(paymentId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await confirmCashPayment(authSession.accessToken, paymentId);
      await refreshRequests();
      setSuccessMessage(response.message);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No fue posible confirmar el pago.'));
      await refreshRequests();
    } finally {
      setIsMutatingPaymentId(null);
    }
  };

  const handleReportCashPaymentIssue = async (paymentId: string) => {
    if (!authSession) {
      return;
    }

    setIsMutatingPaymentId(paymentId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await reportCashPaymentIssue(
        authSession.accessToken,
        paymentId,
        'El pasajero no cumplio con el pago en efectivo acordado.',
      );
      await refreshRequests();
      setSuccessMessage(response.message);
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No fue posible reportar la novedad.'));
      await refreshRequests();
    } finally {
      setIsMutatingPaymentId(null);
    }
  };

  const handleRefreshPaymentStatus = async (paymentId: string) => {
    if (!authSession) {
      return;
    }

    setIsMutatingPaymentId(paymentId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await refreshPaymentStatus(authSession.accessToken, paymentId);
      await refreshRequests();
      setSuccessMessage(response.message);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(getApiErrorMessage(error, 'No fue posible actualizar el pago.'));
      await refreshRequests();
    } finally {
      setIsMutatingPaymentId(null);
    }
  };

  const handleCreatePaymentCheckout = async (paymentId: string) => {
    if (!authSession) {
      return;
    }

    setIsMutatingPaymentId(paymentId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await createPaymentCheckoutLink(authSession.accessToken, paymentId);
      await refreshRequests();
      setSuccessMessage(response.message);

      if (response.checkoutUrl) {
        const newWindow = window.open(response.checkoutUrl, '_blank', 'noopener,noreferrer');

        if (!newWindow) {
          window.location.href = response.checkoutUrl;
        }
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(getApiErrorMessage(error, 'No fue posible preparar el enlace de pago.'));
      await refreshRequests();
    } finally {
      setIsMutatingPaymentId(null);
    }
  };

  if (isLoading) {
    return (
      <section className={styles.loadingShell}>
        <article className={styles.loadingCard}>
          <TripsWorkspaceSkeleton variant="requests" />
        </article>
      </section>
    );
  }

  if (!operationalAccess.hasOperationalMembership && operationalAccess.title && operationalAccess.message) {
    return (
      <>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <section className={styles.pageShell}>
          <article className={styles.lockedCard}>
            <div className={styles.lockedHeader}>
              <div>
                <p className={styles.kicker}>Solicitudes</p>
                <h1 className={styles.pageTitle}>Aprobacion no disponible</h1>
              </div>
            </div>
            <OperationalAccessCard
              message={operationalAccess.message}
              title={operationalAccess.title}
            />
          </article>
        </section>
      </>
    );
  }

  return (
    <section className={styles.pageShell}>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <main className={styles.content}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Conductor</p>
            <h1 className={styles.pageTitle}>Aprobar solicitudes</h1>
            <p className={styles.heroLead}>
              Revisa las solicitudes entrantes, aprueba a tus pasajeros y gestiona la disponibilidad de tus viajes.
            </p>
          </div>

          <div className={styles.heroActions}>
            <Link className={styles.secondaryLink} href="/viajes">
              Volver a mis viajes
            </Link>
            <Button
              disabled={isRefreshingData}
              onClick={() => void refreshRequests(true)}
              variant="secondary"
            >
              {isRefreshingData ? 'Actualizando...' : 'Actualizar'}
            </Button>
          </div>
        </section>

        <section className={styles.topboard}>
          <div className={styles.metricsRow}>
            <div className={styles.metricCard}>
              <span>Pendientes</span>
              <strong>{pendingCount}</strong>
            </div>
            <div className={styles.metricCard}>
              <span>Efectivo por confirmar</span>
              <strong>{awaitingCashConfirmationCount}</strong>
            </div>
            <div className={styles.metricCard}>
              <span>Resultados filtrados</span>
              <strong>{filteredRequests.length}</strong>
            </div>
          </div>

          <div className={styles.filtersToolbar}>
            <div className={styles.filterGroups}>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel} htmlFor="request-query-filter">Buscar</label>
                <input
                  className={styles.filterInput}
                  id="request-query-filter"
                  onChange={(event) => {
                    setQueryFilter(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Ruta o pasajero"
                  type="search"
                  value={queryFilter}
                />
              </div>

              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Estado</span>
                <div className={styles.filterOptions}>
                  {REQUEST_STATUS_FILTERS.map((filter) => (
                    <button
                      key={filter.key}
                      className={`${styles.filterPill} ${selectedStatuses.includes(filter.key) ? styles.filterPillActive : ''}`}
                      onClick={() => toggleStatusFilter(filter.key)}
                      type="button"
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.filterGroup}>
                <label className={styles.filterLabel} htmlFor="request-date-from">Desde</label>
                <input
                  className={styles.filterInput}
                  id="request-date-from"
                  onChange={(event) => {
                    setDateFromFilter(event.target.value);
                    setPage(1);
                  }}
                  type="date"
                  value={dateFromFilter}
                />
              </div>

              <div className={styles.filterGroup}>
                <label className={styles.filterLabel} htmlFor="request-date-to">Hasta</label>
                <input
                  className={styles.filterInput}
                  id="request-date-to"
                  onChange={(event) => {
                    setDateToFilter(event.target.value);
                    setPage(1);
                  }}
                  type="date"
                  value={dateToFilter}
                />
              </div>

              <div className={styles.filterGroup}>
                <label className={styles.filterLabel} htmlFor="request-sort">Orden</label>
                <select
                  className={styles.filterSelect}
                  id="request-sort"
                  onChange={(event) => {
                    setSortBy(event.target.value as RequestSortOption);
                    setPage(1);
                  }}
                  value={sortBy}
                >
                  <option value="activity-desc">Actividad reciente</option>
                  <option value="created-desc">Solicitudes recientes</option>
                  <option value="departure-asc">Salida cercana</option>
                  <option value="departure-desc">Salida lejana</option>
                  <option value="payment-desc">Pago actualizado</option>
                </select>
              </div>

              <div className={styles.filterGroup}>
                <span className={styles.filterLabel}>Pago</span>
                <div className={styles.filterOptions}>
                  {PAYMENT_FILTERS.map((filter) => (
                    <button
                      key={filter.key}
                      className={`${styles.filterPill} ${selectedPayments.includes(filter.key) ? styles.filterPillActive : ''}`}
                      onClick={() => togglePaymentFilter(filter.key)}
                      type="button"
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {(
              selectedStatuses.length !== 2 ||
              selectedPayments.length > 0 ||
              queryFilter ||
              dateFromFilter ||
              dateToFilter ||
              sortBy !== 'activity-desc'
            ) ? (
              <button className={styles.clearButton} onClick={clearFilters} type="button">
                Restablecer filtros
              </button>
            ) : null}
          </div>
        </section>

        <div className={styles.mainStage}>
            <div className={styles.workspaceHeader}>
              <div>
                <h2>Solicitudes recibidas</h2>
                <p>
                  {filteredRequests.length === incomingRequests.length
                    ? `Tienes ${incomingRequests.length} solicitudes en esta bandeja.`
                    : `Mostrando ${filteredRequests.length} de ${incomingRequests.length} solicitudes.`}
                </p>
              </div>
            </div>

            <TripsRequestsWorkspace
              canAcceptIncomingRequest={canAcceptIncomingRequest}
              canCancelOwnRequest={() => false}
              canMarkRequestAsNoShow={canMarkRequestAsNoShow}
              canRejectIncomingRequest={canRejectIncomingRequest}
              defaultNoShowNote={DEFAULT_NO_SHOW_NOTE}
              incomingRequests={paginatedRequests}
              incomingRequestsCountOverride={filteredRequests.length}
              isMutatingPaymentId={isMutatingPaymentId}
              isMutatingRequestId={isMutatingRequestId}
              isRefreshingData={isRefreshingData}
              myRequests={[]}
              onCancelMyRequest={() => undefined}
              onConfirmCashPayment={(paymentId) => void handleConfirmCashPayment(paymentId)}
              onCreatePaymentCheckout={(paymentId) => void handleCreatePaymentCheckout(paymentId)}
              onExploreTrips={() => undefined}
              onIncomingRequestAction={(requestId, action) =>
                void handleIncomingRequestAction(requestId, action)}
              onMarkNoShow={(requestId) => void handleMarkNoShow(requestId)}
              onNoShowNoteChange={handleNoShowNoteChange}
              onRefreshPaymentStatus={(paymentId) => void handleRefreshPaymentStatus(paymentId)}
              onReportCashPaymentIssue={(paymentId) =>
                void handleReportCashPaymentIssue(paymentId)}
              noShowNotes={noShowNotes}
              showActiveRidePanel={false}
              showIncomingRequestsSection
              showMyRequestsSection={false}
            />

            <TripsListPagination
              onPageChange={setPage}
              page={page}
              pageSize={PAGE_SIZE}
              totalItems={filteredRequests.length}
            />
        </div>
      </main>
    </section>
  );
}
