'use client';

import Link from 'next/link';
import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  isOperationalMembership,
  PaymentProvider,
  selectOperationalMembership,
  TripPaymentStatus,
  TripRequestExecutionStatus,
  TripRequestStatus,
  TripStatus,
} from '@saferidepro/shared-types';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { OperationalAccessCard } from '../../../components/ui/operational-access-card';
import { StatusPill } from '../../../components/ui/status-pill';
import { ToastStack, type ToastItem } from '../../../components/ui/toast-stack';
import { useAutoRefresh } from '../../../hooks/use-auto-refresh';
import { useAppExperienceMode } from '../../../modules/auth/hooks/use-app-experience-mode';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
import { getOperationalAccessState } from '../../../modules/auth/lib/operational-context';
import { getInstitutionSettings } from '../../../modules/institutions/lib/institution-api';
import { useRealtimeEventStream } from '../../../modules/realtime/hooks/use-realtime-event-stream';
import {
  getDriverLicenseAlertMessage,
  getDriverStatusLabel,
} from '../../../modules/driver/lib/driver-status';
import {
  capturePayment,
  confirmCashPayment,
  createPaymentCheckoutLink,
  reportCashPaymentIssue,
  refreshPaymentStatus,
} from '../../../modules/payments/lib/payment-api';
import {
  acceptTripRequest,
  cancelTripRequest,
  createTripRequest,
  listIncomingTripRequests,
  listMyTripRequests,
  markTripRequestBoarded,
  markTripRequestDroppedOff,
  markTripRequestAsNoShow,
  rejectTripRequest,
} from '../../../modules/trip-requests/lib/trip-request-api';
import {
  getTripRequestCancellationTimingLabel,
  getTripRequestStatusLabel,
  getTripRequestStatusTone,
} from '../../../modules/trip-requests/lib/trip-request-labels';
import type { TripRequestRecord } from '../../../modules/trip-requests/types/trip-request';
import {
  cancelTrip,
  completeTripWithClosure,
  deleteDraftTrip,
  listAvailableTrips,
  listMyTrips,
  publishTrip,
  startTrip,
} from '../../../modules/trips/lib/trip-api';
import {
  getTripAvailabilityFilterLabel,
  getTripRouteModeLabel,
} from '../../../modules/trips/lib/trip-labels';
import type {
  TripFilters,
  TripRecord,
} from '../../../modules/trips/types/trip';
import { getVehicleOverview } from '../../../modules/vehicles/lib/vehicle-api';
import { getVehicleTypeLabel } from '../../../modules/vehicles/lib/vehicle-labels';
import type { VehicleOverview } from '../../../modules/vehicles/types/vehicle';
import { getCurrentUserTrustSummary } from '../../../modules/users/lib/user-api';
import {
  getAdministrativeRiskStateLabel,
  getTrustRestrictions,
} from '../../../modules/users/lib/trust-labels';
import type { TrustSummary } from '../../../modules/users/types/trust-summary';
import type { InstitutionSettingsRecord } from '../../../modules/institutions/types/institution-settings';
import { getWallet } from '../../../modules/wallet/lib/wallet-api';
import type { WalletRecord } from '../../../modules/wallet/types/wallet';
import { TripsWorkspaceSkeleton } from '../../../modules/trips/components/trips-workspace-skeleton';
import { TripFiltersPanel } from '../../../modules/trips/components/trip-filters-panel';
import {
  EMPTY_REQUEST_DRAFT,
  type TripRequestDraft,
} from '../../../modules/trips/components/trips-workspace.types';
import styles from './page.module.css';

const TripsOperationWorkspace = dynamic(
  () => import('../../../modules/trips/components/trips-operation-workspace').then((module) => module.TripsOperationWorkspace),
  {
    loading: () => <TripsWorkspaceSkeleton variant="operation" />,
  },
);

const TripsRequestsWorkspace = dynamic(
  () => import('../../../modules/trips/components/trips-requests-workspace').then((module) => module.TripsRequestsWorkspace),
  {
    loading: () => <TripsWorkspaceSkeleton variant="requests" />,
  },
);

const TripsDiscoverWorkspace = dynamic(
  () => import('../../../modules/trips/components/trips-discover-workspace').then((module) => module.TripsDiscoverWorkspace),
  {
    loading: () => <TripsWorkspaceSkeleton variant="discover" />,
  },
);

const EMPTY_TRIP_FILTERS: TripFilters = {
  origin: undefined,
  destination: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  timeFrom: undefined,
  timeTo: undefined,
  routeMode: undefined,
  vehicleType: undefined,
  availability: undefined,
};

const DEFAULT_NO_SHOW_NOTE = 'El pasajero no se presento al punto acordado.';

type PassengerWorkspace = 'discover' | 'requests';
type DriverTripStatusFilter = 'draft' | 'published' | 'full' | 'in_progress' | 'completed' | 'cancelled';
type DriverTripSortOption = 'recent' | 'departure-asc' | 'departure-desc' | 'created-asc';

type DriverWorkspaceFilters = {
  query: string;
  statuses: DriverTripStatusFilter[];
  dateFrom: string;
  dateTo: string;
  onlyWithPendingRequests: boolean;
  sortBy: DriverTripSortOption;
};

const EMPTY_DRIVER_WORKSPACE_FILTERS: DriverWorkspaceFilters = {
  query: '',
  statuses: ['draft', 'published', 'full', 'in_progress'],
  dateFrom: '',
  dateTo: '',
  onlyWithPendingRequests: false,
  sortBy: 'recent',
};

const PAYMENT_COMPLETED_CHANNEL = 'saferidepro:payment-completed';
const PAYMENT_COMPLETED_STORAGE_KEY = 'saferidepro:payment-completed-event';

const DRIVER_TRIP_STATUS_OPTIONS: Array<{ value: DriverTripStatusFilter; label: string }> = [
  { value: 'draft', label: 'Borrador' },
  { value: 'published', label: 'Publicado' },
  { value: 'full', label: 'Lleno' },
  { value: 'in_progress', label: 'En curso' },
  { value: 'completed', label: 'Finalizado' },
  { value: 'cancelled', label: 'Cancelado' },
];

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-EC');
}

function countActiveFilters(filters: TripFilters): number {
  return Object.values(filters).filter(Boolean).length;
}

function buildTripFilterLabels(filters: TripFilters): string[] {
  const labels: string[] = [];

  if (filters.origin) {
    labels.push(`Origen: ${filters.origin}`);
  }

  if (filters.destination) {
    labels.push(`Destino: ${filters.destination}`);
  }

  if (filters.dateFrom) {
    labels.push(`Desde: ${filters.dateFrom}`);
  }

  if (filters.dateTo) {
    labels.push(`Hasta: ${filters.dateTo}`);
  }

  if (filters.timeFrom) {
    labels.push(`Hora desde: ${filters.timeFrom}`);
  }

  if (filters.timeTo) {
    labels.push(`Hora hasta: ${filters.timeTo}`);
  }

  if (filters.routeMode) {
    labels.push(getTripRouteModeLabel(filters.routeMode));
  }

  if (filters.vehicleType) {
    labels.push(`Tipo: ${getVehicleTypeLabel(filters.vehicleType)}`);
  }

  if (filters.availability) {
    labels.push(getTripAvailabilityFilterLabel(filters.availability));
  }

  return labels;
}

function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

function getTripCreationBlockMessage({
  activeVehiclesCount,
  blocksDriver,
  driverStatus,
  licenseStatus,
}: {
  activeVehiclesCount: number;
  blocksDriver: boolean;
  driverStatus: DriverVerificationStatus;
  licenseStatus: DriverLicenseStatus;
}) {
  if (driverStatus !== DriverVerificationStatus.Approved) {
    return 'Tu solicitud de conductor debe estar aprobada antes de crear viajes.';
  }

  if (licenseStatus === DriverLicenseStatus.Expired) {
    return 'Actualiza tu licencia antes de crear viajes.';
  }

  if (activeVehiclesCount === 0) {
    return 'Primero registra y activa un vehículo.';
  }

  if (blocksDriver) {
    return 'Tu cuenta tiene una restricción activa para operar como conductor.';
  }

  return 'Revisa tu perfil de conductor antes de crear viajes.';
}

function resolveAvailablePaymentProvider(
  requestedProvider: PaymentProvider,
  settings: InstitutionSettingsRecord | null,
  wallet: WalletRecord | null,
  trip: TripRecord,
): PaymentProvider | null {
  const canUseCash = settings?.allowCashPayments ?? true;
  const canUsePaypal = settings?.allowPaypalPayments ?? true;
  const canUseWallet =
    (settings?.allowWalletPayments ?? true) &&
    Boolean(wallet) &&
    (wallet?.account.availableBalance ?? 0) >= getTripRequestAmount(trip);

  if (requestedProvider === PaymentProvider.Cash && canUseCash) {
    return PaymentProvider.Cash;
  }

  if (requestedProvider === PaymentProvider.Paypal && canUsePaypal) {
    return PaymentProvider.Paypal;
  }

  if (requestedProvider === PaymentProvider.Wallet && canUseWallet) {
    return PaymentProvider.Wallet;
  }

  if (canUseWallet) {
    return PaymentProvider.Wallet;
  }

  if (canUseCash) {
    return PaymentProvider.Cash;
  }

  if (canUsePaypal) {
    return PaymentProvider.Paypal;
  }

  return null;
}

function getTripRequestAmount(trip: TripRecord): number {
  return trip.basePriceReference + (trip.detourSurchargeReference ?? 0);
}

function getTripStatusFilterLabel(status: DriverTripStatusFilter): string {
  switch (status) {
    case 'draft':
      return 'Borrador';
    case 'published':
      return 'Publicado';
    case 'full':
      return 'Lleno';
    case 'in_progress':
      return 'En curso';
    case 'completed':
      return 'Finalizado';
    case 'cancelled':
      return 'Cancelado';
    default:
      return 'Todos';
  }
}

function getDriverSortLabel(sortBy: DriverTripSortOption): string {
  switch (sortBy) {
    case 'departure-asc':
      return 'Salida mas cercana';
    case 'departure-desc':
      return 'Salida mas lejana';
    case 'created-asc':
      return 'Mas antiguos primero';
    default:
      return 'Ultima actividad primero';
  }
}

function emitPaymentCompletedEvent(paymentId: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const payload = {
    paymentId,
    occurredAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(PAYMENT_COMPLETED_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage may be blocked by the browser.
  }

  try {
    const channel = new BroadcastChannel(PAYMENT_COMPLETED_CHANNEL);
    channel.postMessage(payload);
    channel.close();
  } catch {
    // BroadcastChannel is not available in every browser context.
  }
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

function canCancelOwnRequest(request: TripRequestRecord): boolean {
  return (
    (request.status === TripRequestStatus.Pending || request.status === TripRequestStatus.Accepted) &&
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

function canCreateRequestForTrip(trip: TripRecord, hasActiveRequest: boolean): boolean {
  return (
    !hasActiveRequest &&
    trip.status === TripStatus.Published &&
    trip.availableSeats > 0
  );
}

export default function TripsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authSession, isHydrated, refreshSession } = useAuth();
  const { isDriverExperienceActive } = useAppExperienceMode(authSession?.user);
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);
  const currentMembership =
    operationalAccess.operationalMembership ?? operationalAccess.selectedMembership;
  const [vehicleOverview, setVehicleOverview] = useState<VehicleOverview | null>(null);
  const [trustSummary, setTrustSummary] = useState<TrustSummary | null>(null);
  const [reservationSettings, setReservationSettings] =
    useState<InstitutionSettingsRecord | null>(null);
  const [wallet, setWallet] = useState<WalletRecord | null>(null);
  const [myTrips, setMyTrips] = useState<TripRecord[]>([]);
  const [availableTrips, setAvailableTrips] = useState<TripRecord[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<TripRequestRecord[]>([]);
  const [myRequests, setMyRequests] = useState<TripRequestRecord[]>([]);
  const [tripFilters, setTripFilters] = useState<TripFilters>(EMPTY_TRIP_FILTERS);
  const [filterFormValues, setFilterFormValues] = useState<TripFilters>(EMPTY_TRIP_FILTERS);
  const [requestDrafts, setRequestDrafts] = useState<Record<string, TripRequestDraft>>({});
  const [noShowNotes, setNoShowNotes] = useState<Record<string, string>>({});
  const [tripClosureNotes, setTripClosureNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [isMutatingTripId, setIsMutatingTripId] = useState<string | null>(null);
  const [isMutatingRequestId, setIsMutatingRequestId] = useState<string | null>(null);
  const [isMutatingPaymentId, setIsMutatingPaymentId] = useState<string | null>(null);
  const paymentCaptureInFlightRef = useRef<string | null>(null);
  const [passengerWorkspace, setPassengerWorkspace] = useState<PassengerWorkspace>('discover');
  const [tripErrorMessage, setTripErrorMessage] = useState<string | null>(null);
  const [tripSuccessMessage, setTripSuccessMessage] = useState<string | null>(null);
  const [requestErrorMessage, setRequestErrorMessage] = useState<string | null>(null);
  const [requestSuccessMessage, setRequestSuccessMessage] = useState<string | null>(null);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string | null>(null);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [driverWorkspaceFilters, setDriverWorkspaceFilters] = useState<DriverWorkspaceFilters>(
    EMPTY_DRIVER_WORKSPACE_FILTERS,
  );
  const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeRefreshPendingRef = useRef(false);
  const realtimeRefreshRunningRef = useRef(false);

  const pushToast = useCallback((title: string, description: string, tone: ToastItem['tone']) => {
    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id: `trip-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        tone,
      },
    ]);
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  }, []);

  const loadTripsData = useCallback(async (accessToken: string, filters: TripFilters) => {
    const [vehicleData, trustSummaryData, myTripsData, availableTripsData, myTripRequestsData, incomingTripRequestsData, institutionSettingsData, walletData] = await Promise.all([
      getVehicleOverview(accessToken),
      getCurrentUserTrustSummary(accessToken),
      listMyTrips(accessToken, filters),
      listAvailableTrips(accessToken, filters),
      listMyTripRequests(accessToken),
      listIncomingTripRequests(accessToken),
      currentMembership?.institutionId
        ? getInstitutionSettings(accessToken, currentMembership.institutionId)
        : Promise.resolve(null),
      getWallet(accessToken).catch(() => null),
    ]);

    setVehicleOverview(vehicleData);
    setTrustSummary(trustSummaryData);
    setReservationSettings(institutionSettingsData?.settings ?? null);
    setWallet(walletData);
    setMyTrips(myTripsData);
    setAvailableTrips(availableTripsData);
    setMyRequests(myTripRequestsData);
    setIncomingRequests(incomingTripRequestsData);
  }, [currentMembership?.institutionId]);

  const refreshTripsData = useCallback(async (showSpinner = false) => {
    if (!authSession) {
      return;
    }

    if (showSpinner) {
      setIsRefreshingData(true);
    }

    try {
      await loadTripsData(authSession.accessToken, tripFilters);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setTripErrorMessage(getApiErrorMessage(error, 'No fue posible sincronizar la informacion de viajes.'));
    } finally {
      if (showSpinner) {
        setIsRefreshingData(false);
      }
    }
  }, [authSession, loadTripsData, refreshSession, tripFilters]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!authSession || !operationalAccess.hasOperationalMembership) {
      setVehicleOverview(null);
      setTrustSummary(null);
      setReservationSettings(null);
      setWallet(null);
      setMyTrips([]);
      setAvailableTrips([]);
      setIncomingRequests([]);
      setMyRequests([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);
      setTripErrorMessage(null);
      setRequestErrorMessage(null);

      try {
        await loadTripsData(authSession.accessToken, tripFilters);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiError && error.status === 403) {
          await refreshSession().catch(() => undefined);
        }

        const message = error instanceof ApiError
          ? error.message
          : 'No fue posible cargar la informacion de viajes.';
        setTripErrorMessage(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [
    authSession,
    isHydrated,
    loadTripsData,
    operationalAccess.hasOperationalMembership,
    refreshSession,
    tripFilters,
  ]);

  useAutoRefresh(
    async () => {
      await refreshTripsData();
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

      void refreshTripsData().finally(() => {
        realtimeRefreshRunningRef.current = false;

        if (realtimeRefreshPendingRef.current) {
          realtimeRefreshPendingRef.current = false;
          scheduleRealtimeRefresh();
        }
      });
    }, 250);
  }, [refreshTripsData]);

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
    if (!authSession || typeof window === 'undefined') {
      return;
    }

    const handlePaymentCompleted = () => {
      setPassengerWorkspace('requests');
      void refreshTripsData();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === PAYMENT_COMPLETED_STORAGE_KEY && event.newValue) {
        handlePaymentCompleted();
      }
    };

    let channel: BroadcastChannel | null = null;

    try {
      channel = new BroadcastChannel(PAYMENT_COMPLETED_CHANNEL);
      channel.onmessage = handlePaymentCompleted;
    } catch {
      channel = null;
    }

    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
      channel?.close();
    };
  }, [authSession, refreshTripsData]);

  useEffect(() => {
    if (!tripErrorMessage) {
      return;
    }

    pushToast('Operacion de viaje no completada', tripErrorMessage, 'error');
    setTripErrorMessage(null);
  }, [pushToast, tripErrorMessage]);

  useEffect(() => {
    if (!tripSuccessMessage) {
      return;
    }

    pushToast('Viaje actualizado', tripSuccessMessage, 'success');
    setTripSuccessMessage(null);
  }, [pushToast, tripSuccessMessage]);

  useEffect(() => {
    if (!requestErrorMessage) {
      return;
    }

    pushToast('Solicitud no completada', requestErrorMessage, 'error');
    setRequestErrorMessage(null);
  }, [pushToast, requestErrorMessage]);

  useEffect(() => {
    if (!requestSuccessMessage) {
      return;
    }

    pushToast('Solicitud actualizada', requestSuccessMessage, 'success');
    setRequestSuccessMessage(null);
  }, [pushToast, requestSuccessMessage]);

  useEffect(() => {
    if (!paymentErrorMessage) {
      return;
    }

    pushToast('Pago no completado', paymentErrorMessage, 'error');
    setPaymentErrorMessage(null);
  }, [paymentErrorMessage, pushToast]);

  useEffect(() => {
    if (!paymentSuccessMessage) {
      return;
    }

    pushToast('Pago actualizado', paymentSuccessMessage, 'success');
    setPaymentSuccessMessage(null);
  }, [paymentSuccessMessage, pushToast]);

  useEffect(() => {
    const paymentId = searchParams.get('paymentId');
    const paymentProvider = searchParams.get('paymentProvider');
    const paymentToken = searchParams.get('token');
    const paymentResult = searchParams.get('paymentResult');

    if (!paymentId && !paymentResult) {
      return;
    }

    if (paymentProvider === 'paypal' && paymentId && paymentToken && authSession) {
      const captureKey = `${paymentId}:${paymentToken}`;

      if (paymentCaptureInFlightRef.current === captureKey) {
        return;
      }

      paymentCaptureInFlightRef.current = captureKey;
      setIsMutatingPaymentId(paymentId);

      void capturePayment(authSession.accessToken, paymentId)
        .then(async (response) => {
          emitPaymentCompletedEvent(response.payment.id);
          setPassengerWorkspace('requests');
          await refreshTripsData();
          setPaymentSuccessMessage(response.message);
        })
        .catch(async (error) => {
          if (error instanceof ApiError && error.status === 403) {
            await refreshSession().catch(() => undefined);
          }

          setPaymentErrorMessage(
            getApiErrorMessage(error, 'No fue posible confirmar el pago con PayPal.'),
          );
          await refreshTripsData();
        })
        .finally(() => {
          setIsMutatingPaymentId(null);
          paymentCaptureInFlightRef.current = null;
          router.replace('/viajes');
        });

      return;
    }

    if (paymentResult === 'cancel') {
      pushToast(
        'Pago cancelado',
        'El flujo de PayPal fue cancelado antes de confirmar el pago.',
        'info',
      );
    } else if (paymentResult === 'error') {
      pushToast(
        'Pago no completado',
        'El intento de pago termino con error. Puedes generar otro enlace o intentarlo de nuevo.',
        'error',
      );
    }

    router.replace('/viajes');
  }, [authSession, pushToast, refreshSession, refreshTripsData, router, searchParams]);

  useEffect(() => {
    const requestedPassengerView = searchParams.get('passengerView');

    if (requestedPassengerView === 'requests') {
      setPassengerWorkspace('requests');
    } else if (requestedPassengerView === 'discover') {
      setPassengerWorkspace('discover');
    }
  }, [searchParams]);

  const handleFilterChange = (field: keyof TripFilters, value: string) => {
    setFilterFormValues((currentFilters) => ({
      ...currentFilters,
      [field]: value === '' ? undefined : value,
    }));
  };

  const handleApplyFilters = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsFiltering(true);
    setTripErrorMessage(null);

    try {
      setTripFilters(filterFormValues);
    } finally {
      setIsFiltering(false);
    }
  };

  const handleResetFilters = () => {
    setFilterFormValues(EMPTY_TRIP_FILTERS);
    setTripFilters(EMPTY_TRIP_FILTERS);
  };

  const reloadData = async () => {
    await refreshTripsData();
  };

  const handleTripAction = async (
    tripId: string,
    action: 'publish' | 'start' | 'complete' | 'cancel' | 'delete',
    options?: {
      closureNote?: string;
    },
  ) => {
    if (!authSession) {
      return;
    }

    setIsMutatingTripId(tripId);
    setTripErrorMessage(null);
    setTripSuccessMessage(null);

    try {
      const response =
        action === 'complete'
          ? await completeTripWithClosure(authSession.accessToken, tripId, options?.closureNote)
          : action === 'publish'
            ? await publishTrip(authSession.accessToken, tripId)
          : action === 'start'
            ? await startTrip(authSession.accessToken, tripId)
            : action === 'delete'
              ? await deleteDraftTrip(authSession.accessToken, tripId)
              : await cancelTrip(authSession.accessToken, tripId);

      await reloadData();
      setTripSuccessMessage(response.message);

      if (action === 'start') {
        router.push(`/viajes/${tripId}/seguimiento`);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setTripErrorMessage(getApiErrorMessage(error, 'No fue posible actualizar el viaje.'));
      await refreshTripsData();
    } finally {
      setIsMutatingTripId(null);
    }
  };

  const handleRequestDraftChange = (
    tripId: string,
    field: keyof TripRequestDraft,
    value: string | boolean,
  ) => {
    setRequestDrafts((currentDrafts) => ({
      ...currentDrafts,
      [tripId]: {
        ...(currentDrafts[tripId] ?? EMPTY_REQUEST_DRAFT),
        [field]: value,
      },
    }));
  };

  const handleCreateRequest = async (trip: TripRecord) => {
    if (!authSession) {
      return;
    }

    const draft = requestDrafts[trip.id] ?? EMPTY_REQUEST_DRAFT;
    const paymentProvider = resolveAvailablePaymentProvider(
      draft.paymentProvider,
      reservationSettings,
      wallet,
      trip,
    );

    if (!paymentProvider) {
      setRequestErrorMessage('No hay una forma de pago disponible para este viaje.');
      return;
    }

    setIsMutatingRequestId(trip.id);
    setRequestErrorMessage(null);
    setRequestSuccessMessage(null);

    const paypalWindow =
      paymentProvider === PaymentProvider.Paypal
        ? window.open('about:blank', '_blank')
        : null;

    if (paypalWindow) {
      paypalWindow.opener = null;
    }

    try {
      const response = await createTripRequest(authSession.accessToken, {
        tripId: trip.id,
        paymentProvider,
        acceptReservationCommitment: draft.acceptReservationCommitment,
        requestMessage: draft.requestMessage || undefined,
        requestedDropoffLatitude: draft.requestedDropoffLatitude
          ? Number.parseFloat(draft.requestedDropoffLatitude)
          : undefined,
        requestedDropoffLongitude: draft.requestedDropoffLongitude
          ? Number.parseFloat(draft.requestedDropoffLongitude)
          : undefined,
      });

      if (
        paymentProvider === PaymentProvider.Paypal &&
        response.tripRequest.payment?.id
      ) {
        const checkoutResponse = await createPaymentCheckoutLink(
          authSession.accessToken,
          response.tripRequest.payment.id,
        );

        if (checkoutResponse.checkoutUrl) {
          if (paypalWindow) {
            paypalWindow.location.href = checkoutResponse.checkoutUrl;
          } else {
            setPaymentErrorMessage('El navegador bloqueo la ventana de PayPal.');
          }
        }
      }

      await reloadData();
      setRequestSuccessMessage(response.message);
      setRequestDrafts((currentDrafts) => ({
        ...currentDrafts,
        [trip.id]: EMPTY_REQUEST_DRAFT,
      }));
    } catch (error) {
      paypalWindow?.close();

      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setRequestErrorMessage(getApiErrorMessage(error, 'No fue posible enviar la solicitud de viaje.'));
      await refreshTripsData();
    } finally {
      setIsMutatingRequestId(null);
    }
  };

  useEffect(() => {
    if (!reservationSettings) {
      return;
    }

    setRequestDrafts((currentDrafts) => {
      let hasChanges = false;
      const nextDrafts: Record<string, TripRequestDraft> = {};

      Object.entries(currentDrafts).forEach(([tripId, draft]) => {
        let nextPaymentProvider = draft.paymentProvider;

        if (
          nextPaymentProvider === PaymentProvider.Cash &&
          !reservationSettings.allowCashPayments &&
          (reservationSettings.allowWalletPayments || reservationSettings.allowPaypalPayments)
        ) {
          nextPaymentProvider = reservationSettings.allowWalletPayments
            ? PaymentProvider.Wallet
            : PaymentProvider.Paypal;
          hasChanges = true;
        }

        if (
          nextPaymentProvider === PaymentProvider.Paypal &&
          !reservationSettings.allowPaypalPayments &&
          (reservationSettings.allowWalletPayments || reservationSettings.allowCashPayments)
        ) {
          nextPaymentProvider = reservationSettings.allowWalletPayments
            ? PaymentProvider.Wallet
            : PaymentProvider.Cash;
          hasChanges = true;
        }

        if (
          nextPaymentProvider === PaymentProvider.Wallet &&
          !reservationSettings.allowWalletPayments &&
          (reservationSettings.allowCashPayments || reservationSettings.allowPaypalPayments)
        ) {
          nextPaymentProvider = reservationSettings.allowCashPayments
            ? PaymentProvider.Cash
            : PaymentProvider.Paypal;
          hasChanges = true;
        }

        nextDrafts[tripId] =
          nextPaymentProvider === draft.paymentProvider
            ? draft
            : {
                ...draft,
                paymentProvider: nextPaymentProvider,
              };
      });

      return hasChanges ? nextDrafts : currentDrafts;
    });
  }, [reservationSettings]);

  const handleIncomingRequestAction = async (
    requestId: string,
    action: 'accept' | 'reject',
  ) => {
    if (!authSession) {
      return;
    }

    setIsMutatingRequestId(requestId);
    setRequestErrorMessage(null);
    setRequestSuccessMessage(null);

    try {
      const response = action === 'accept'
        ? await acceptTripRequest(authSession.accessToken, requestId)
        : await rejectTripRequest(authSession.accessToken, requestId);

      await reloadData();
      setRequestSuccessMessage(response.message);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setRequestErrorMessage(getApiErrorMessage(error, 'No fue posible actualizar la solicitud.'));
      await refreshTripsData();
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

  const handleTripClosureNoteChange = (tripId: string, value: string) => {
    setTripClosureNotes((currentNotes) => ({
      ...currentNotes,
      [tripId]: value,
    }));
  };

  const handleMarkNoShow = async (requestId: string) => {
    if (!authSession) {
      return;
    }

    const reviewNote = (noShowNotes[requestId] ?? DEFAULT_NO_SHOW_NOTE).trim();

    setIsMutatingRequestId(requestId);
    setRequestErrorMessage(null);
    setRequestSuccessMessage(null);

    try {
      const response = await markTripRequestAsNoShow(
        authSession.accessToken,
        requestId,
        reviewNote,
      );

      await reloadData();
      setRequestSuccessMessage(response.message);
      setNoShowNotes((currentNotes) => ({
        ...currentNotes,
        [requestId]: DEFAULT_NO_SHOW_NOTE,
      }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setRequestErrorMessage(
        getApiErrorMessage(error, 'No fue posible registrar la ausencia.'),
      );
      await refreshTripsData();
    } finally {
      setIsMutatingRequestId(null);
    }
  };

  const handleMarkPassengerBoarded = async (requestId: string) => {
    if (!authSession) {
      return;
    }

    setIsMutatingRequestId(requestId);
    setRequestErrorMessage(null);
    setRequestSuccessMessage(null);

    try {
      const response = await markTripRequestBoarded(authSession.accessToken, requestId);
      await reloadData();
      setRequestSuccessMessage(response.message);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setRequestErrorMessage(
        getApiErrorMessage(error, 'No fue posible marcar el abordaje del pasajero.'),
      );
      await refreshTripsData();
    } finally {
      setIsMutatingRequestId(null);
    }
  };

  const handleMarkPassengerDroppedOff = async (requestId: string) => {
    if (!authSession) {
      return;
    }

    setIsMutatingRequestId(requestId);
    setRequestErrorMessage(null);
    setRequestSuccessMessage(null);

    try {
      const response = await markTripRequestDroppedOff(authSession.accessToken, requestId);
      await reloadData();
      setRequestSuccessMessage(response.message);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setRequestErrorMessage(
        getApiErrorMessage(error, 'No fue posible marcar la finalizacion del pasajero.'),
      );
      await refreshTripsData();
    } finally {
      setIsMutatingRequestId(null);
    }
  };

  const handleCancelMyRequest = async (requestId: string) => {
    if (!authSession) {
      return;
    }

    setIsMutatingRequestId(requestId);
    setRequestErrorMessage(null);
    setRequestSuccessMessage(null);

    try {
      const response = await cancelTripRequest(authSession.accessToken, requestId);
      await reloadData();
      setRequestSuccessMessage(response.message);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setRequestErrorMessage(getApiErrorMessage(error, 'No fue posible cancelar la solicitud.'));
      await refreshTripsData();
    } finally {
      setIsMutatingRequestId(null);
    }
  };

  const handleCreatePaymentCheckout = async (paymentId: string) => {
    if (!authSession) {
      return;
    }

    setIsMutatingPaymentId(paymentId);
    setPaymentErrorMessage(null);
    setPaymentSuccessMessage(null);

    try {
      const response = await createPaymentCheckoutLink(authSession.accessToken, paymentId);
      await reloadData();
      setPaymentSuccessMessage(response.message);

      if (response.checkoutUrl) {
        const newWindow = window.open(response.checkoutUrl, '_blank', 'noopener,noreferrer');

        if (!newWindow) {
          setPaymentErrorMessage('El navegador bloqueo la ventana de PayPal.');
        }
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setPaymentErrorMessage(
        getApiErrorMessage(error, 'No fue posible preparar el enlace de pago.'),
      );
      await refreshTripsData();
    } finally {
      setIsMutatingPaymentId(null);
    }
  };

  const handleRefreshPaymentStatus = async (paymentId: string) => {
    if (!authSession) {
      return;
    }

    setIsMutatingPaymentId(paymentId);
    setPaymentErrorMessage(null);
    setPaymentSuccessMessage(null);

    try {
      const response = await refreshPaymentStatus(authSession.accessToken, paymentId);
      if (response.payment.status === TripPaymentStatus.Paid) {
        emitPaymentCompletedEvent(response.payment.id);
        setPassengerWorkspace('requests');
      }
      await reloadData();
      setPaymentSuccessMessage(response.message);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setPaymentErrorMessage(
        getApiErrorMessage(error, 'No fue posible actualizar el estado del pago.'),
      );
      await refreshTripsData();
    } finally {
      setIsMutatingPaymentId(null);
    }
  };

  const handleConfirmCashPayment = async (paymentId: string) => {
    if (!authSession) {
      return;
    }

    setIsMutatingPaymentId(paymentId);
    setPaymentErrorMessage(null);
    setPaymentSuccessMessage(null);

    try {
      const response = await confirmCashPayment(authSession.accessToken, paymentId);

      await reloadData();
      setPaymentSuccessMessage(response.message);
    } catch (error) {
      setPaymentErrorMessage(getApiErrorMessage(error, 'No fue posible confirmar el pago.'));
      await refreshTripsData();
    } finally {
      setIsMutatingPaymentId(null);
    }
  };

  const handleReportCashPaymentIssue = async (paymentId: string) => {
    if (!authSession) {
      return;
    }

    setIsMutatingPaymentId(paymentId);
    setPaymentErrorMessage(null);
    setPaymentSuccessMessage(null);

    try {
      const response = await reportCashPaymentIssue(
        authSession.accessToken,
        paymentId,
        'El pasajero no cumplio con el pago en efectivo acordado.',
      );

      await reloadData();
      setPaymentSuccessMessage(response.message);
    } catch (error) {
      setPaymentErrorMessage(getApiErrorMessage(error, 'No fue posible reportar la novedad.'));
      await refreshTripsData();
    } finally {
      setIsMutatingPaymentId(null);
    }
  };

  const handleCreateTripNavigation = () => {
    if (canCreateTrips) {
      router.push('/viajes/nuevo');
      return;
    }

    pushToast(
      'No puedes crear viajes todavía',
      getTripCreationBlockMessage({
        activeVehiclesCount: activeVehicles.length,
        blocksDriver: trustRestrictions.blocksDriver,
        driverStatus,
        licenseStatus,
      }),
      'info',
    );
  };

  const defaultMembership = selectOperationalMembership(authSession?.user.memberships);
  const defaultMembershipId =
    defaultMembership && isOperationalMembership(defaultMembership)
      ? defaultMembership.id
      : undefined;
  const driverStatus =
    vehicleOverview?.membership?.effectiveDriverVerificationStatus
    ?? vehicleOverview?.membership?.driverVerificationStatus
    ?? DriverVerificationStatus.NotRequested;
  const licenseStatus = vehicleOverview?.membership?.licenseStatus ?? DriverLicenseStatus.Missing;
  const hasDriverMode = driverStatus === DriverVerificationStatus.Approved;
  const activeVehicles = (vehicleOverview?.vehicles ?? []).filter((vehicle) => vehicle.isActive);
  const trustRestrictions = getTrustRestrictions(trustSummary);
  const canCreateTrips =
    driverStatus === DriverVerificationStatus.Approved &&
    activeVehicles.length > 0 &&
    !trustRestrictions.blocksDriver;
  const driverLicenseAlertMessage = getDriverLicenseAlertMessage(
    licenseStatus,
    vehicleOverview?.membership?.licenseExpiresInDays,
  );
  const showDriverWorkspace = isDriverExperienceActive && hasDriverMode;
  const pendingRequestTripIds = useMemo(() => {
    const tripIds = new Set<string>();

    incomingRequests.forEach((request) => {
      if (request.status === TripRequestStatus.Pending) {
        tripIds.add(request.tripId);
      }
    });

    return tripIds;
  }, [incomingRequests]);
  const filteredDriverTrips = useMemo(() => {
    const normalizedQuery = driverWorkspaceFilters.query.trim().toLowerCase();
    const fromTimestamp = driverWorkspaceFilters.dateFrom
      ? new Date(`${driverWorkspaceFilters.dateFrom}T00:00:00`).getTime()
      : null;
    const toTimestamp = driverWorkspaceFilters.dateTo
      ? new Date(`${driverWorkspaceFilters.dateTo}T23:59:59.999`).getTime()
      : null;

    const nextTrips = myTrips.filter((trip) => {
      const normalizedStatus = trip.status.toLowerCase() as DriverTripStatusFilter;

      if (!driverWorkspaceFilters.statuses.includes(normalizedStatus)) {
        return false;
      }

      if (
        normalizedQuery &&
        ![
          trip.originLabel,
          trip.destinationLabel,
          trip.vehicleDisplayName,
          trip.vehiclePlate,
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery)
      ) {
        return false;
      }

      const departureTimestamp = new Date(trip.departureAt).getTime();

      if (fromTimestamp !== null && departureTimestamp < fromTimestamp) {
        return false;
      }

      if (toTimestamp !== null && departureTimestamp > toTimestamp) {
        return false;
      }

      if (driverWorkspaceFilters.onlyWithPendingRequests && !pendingRequestTripIds.has(trip.id)) {
        return false;
      }

      return true;
    });

    nextTrips.sort((leftTrip, rightTrip) => {
      switch (driverWorkspaceFilters.sortBy) {
        case 'departure-asc':
          return new Date(leftTrip.departureAt).getTime() - new Date(rightTrip.departureAt).getTime();
        case 'departure-desc':
          return new Date(rightTrip.departureAt).getTime() - new Date(leftTrip.departureAt).getTime();
        case 'created-asc':
          return new Date(leftTrip.createdAt).getTime() - new Date(rightTrip.createdAt).getTime();
        default:
          return (
            new Date(rightTrip.updatedAt ?? rightTrip.createdAt).getTime() -
            new Date(leftTrip.updatedAt ?? leftTrip.createdAt).getTime()
          );
      }
    });

    return nextTrips;
  }, [driverWorkspaceFilters, myTrips, pendingRequestTripIds]);
  const visibleAvailableTrips = availableTrips.filter(
    (trip) => trip.driverMembershipId !== defaultMembershipId,
  );
  const activeFiltersCount = countActiveFilters(tripFilters);
  const activeFilterLabels = buildTripFilterLabels(tripFilters);
  const driverActiveFilterLabels = [
    driverWorkspaceFilters.statuses.length < 6
      ? `Estados: ${driverWorkspaceFilters.statuses.map(getTripStatusFilterLabel).join(', ')}`
      : null,
    driverWorkspaceFilters.query.trim()
      ? `Buscar: ${driverWorkspaceFilters.query.trim()}`
      : null,
    driverWorkspaceFilters.dateFrom
      ? `Desde: ${driverWorkspaceFilters.dateFrom}`
      : null,
    driverWorkspaceFilters.dateTo
      ? `Hasta: ${driverWorkspaceFilters.dateTo}`
      : null,
    driverWorkspaceFilters.onlyWithPendingRequests
      ? 'Con solicitudes pendientes'
      : null,
    driverWorkspaceFilters.sortBy !== 'recent'
      ? `Orden: ${getDriverSortLabel(driverWorkspaceFilters.sortBy)}`
      : null,
  ].filter((label): label is string => Boolean(label));
  const activeViewTitle =
    showDriverWorkspace
      ? 'Mis viajes'
      : passengerWorkspace === 'discover'
        ? 'Viajes disponibles'
        : 'Mis solicitudes';
  const shouldShowFiltersSidebar =
    !showDriverWorkspace && passengerWorkspace === 'discover';
  const shouldShowDriverSidebar = showDriverWorkspace;

  if (isLoading) {
    return (
      <section className={styles.page}>
        <div className={styles.loadingShell}>
          <article className={styles.loadingCard}>
            <div aria-hidden="true" className={styles.loadingPulse} />
            <h1 className={styles.loadingTitle}>Cargando viajes</h1>
            <p className={styles.loadingText}>
              Estamos preparando tu actividad, solicitudes y cupos disponibles.
            </p>
          </article>
        </div>
      </section>
    );
  }

  if (!operationalAccess.hasOperationalMembership && operationalAccess.title && operationalAccess.message) {
    return (
      <section className={styles.page}>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <div className={styles.lockedShell}>
          <article className={styles.lockedCard}>
            <div className={styles.lockedHeader}>
              <p className={styles.kicker}>Viajes</p>
              <h1 className={styles.lockedTitle}>Operacion no disponible</h1>
              <div className={styles.lockedActions}>
                <StatusPill label="Operacion bloqueada" tone="warning" />
              </div>
            </div>
            <div className={styles.lockedBody}>
              <OperationalAccessCard
                message={operationalAccess.message}
                title={operationalAccess.title}
              />
            </div>
          </article>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <header className={styles.heroHeader}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Viajes</p>
          <h1 className={styles.heroTitle}>{activeViewTitle}</h1>
        </div>

        <div className={styles.heroActions}>
          {showDriverWorkspace ? (
            <button className={styles.heroBtnPrimary} onClick={handleCreateTripNavigation} type="button">
              Crear viaje
            </button>
          ) : null}
          <button
            className={styles.heroBtnSecondary}
            disabled={isRefreshingData}
            onClick={() => void refreshTripsData(true)}
            type="button"
          >
            {isRefreshingData ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </header>

      <div className={styles.content}>
        {(showDriverWorkspace && (!canCreateTrips || driverLicenseAlertMessage || trustRestrictions.blocksDriver)) ||
        (!showDriverWorkspace && trustRestrictions.blocksPassenger) ? (
          <article className={styles.noticeCard}>
            <div className={styles.noticeCopy}>
              <strong>
                {showDriverWorkspace
                  ? 'Revisa tu contexto de conductor'
                  : 'Tu acceso como pasajero tiene una restriccion'}
              </strong>
              <p>
                {showDriverWorkspace
                  ? trustRestrictions.blocksDriver
                    ? trustRestrictions.message ?? 'Tu operacion como conductor tiene una restriccion activa.'
                    : driverLicenseAlertMessage
                      ? driverLicenseAlertMessage
                      : activeVehicles.length === 0
                        ? 'Necesitas al menos un vehiculo activo para publicar viajes.'
                        : 'Tu perfil de conductor requiere revision.'
                  : trustRestrictions.message ?? 'Existe una restriccion activa sobre tu operacion como pasajero.'}
              </p>
            </div>
            <div className={styles.noticeActions}>
              {showDriverWorkspace ? (
                <>
                  <Link className={styles.inlineLink} href="/conductor">
                    Conductor
                  </Link>
                  <Link className={styles.inlineLink} href="/vehiculos">
                    Vehiculos
                  </Link>
                </>
              ) : (
                <Link className={styles.inlineLink} href="/confianza">
                  Confianza
                </Link>
              )}
            </div>
          </article>
        ) : null}

        <nav className={styles.dashboardTabs} aria-label="Vistas de viajes">
            {showDriverWorkspace ? (
              <>
                <button
                className={[styles.dashboardTab, styles.dashboardTabActive].join(' ')}
                onClick={() => undefined}
                type="button"
              >
                Mis viajes
              </button>
              <button
                className={styles.dashboardTab}
                onClick={() => router.push('/viajes/aprobar-solicitudes')}
                type="button"
              >
                Aprobar solicitudes
              </button>
            </>
          ) : (
            <>
              <button
                className={[
                  styles.dashboardTab,
                  passengerWorkspace === 'discover' ? styles.dashboardTabActive : '',
                ].join(' ')}
                onClick={() => setPassengerWorkspace('discover')}
                type="button"
              >
                Ver viajes
              </button>
              <button
                className={[
                  styles.dashboardTab,
                  passengerWorkspace === 'requests' ? styles.dashboardTabActive : '',
                ].join(' ')}
                onClick={() => setPassengerWorkspace('requests')}
                type="button"
              >
                Mis solicitudes
              </button>
            </>
          )}
        </nav>

        {shouldShowFiltersSidebar || shouldShowDriverSidebar ? (
          <section className={styles.workspaceLayout}>
            {shouldShowDriverSidebar ? (
              <details className={styles.filterSidebar}>
                <summary className={styles.filterSidebarHeader}>
                  <strong>
                    Gestión de lista
                    {driverActiveFilterLabels.length > 0 && ` (${driverActiveFilterLabels.length} filtros activos)`}
                  </strong>
                  {driverActiveFilterLabels.length ? (
                    <button
                      className={styles.filterResetLink}
                      onClick={(e) => {
                        e.preventDefault();
                        setDriverWorkspaceFilters(EMPTY_DRIVER_WORKSPACE_FILTERS);
                      }}
                      type="button"
                    >
                      Limpiar
                    </button>
                  ) : null}
                </summary>
                <div className={styles.filterSidebarContent}>
                  {driverActiveFilterLabels.length ? (
                    <div className={styles.filterPills}>
                      {driverActiveFilterLabels.map((label) => (
                        <span key={label} className={styles.filterPill}>
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className={styles.driverFiltersContainer}>
                    <div className={styles.driverFilterGroup}>
                      <label className={styles.driverFilterLabel} htmlFor="driver-trip-search">
                        Buscar viaje
                      </label>
                      <input
                        id="driver-trip-search"
                        className={styles.driverFilterInput}
                        onChange={(event) =>
                          setDriverWorkspaceFilters((currentFilters) => ({
                            ...currentFilters,
                            query: event.target.value,
                          }))}
                        placeholder="Origen, destino, vehiculo o placa"
                        type="search"
                        value={driverWorkspaceFilters.query}
                      />
                    </div>

                    <div className={styles.driverFilterGroup}>
                      <span className={styles.driverFilterLabel}>Estado</span>
                      <div className={styles.driverStatusChecks}>
                        {DRIVER_TRIP_STATUS_OPTIONS.map((option) => (
                          <label className={styles.driverFilterCheck} key={option.value}>
                            <input
                              checked={driverWorkspaceFilters.statuses.includes(option.value)}
                              onChange={(event) =>
                                setDriverWorkspaceFilters((currentFilters) => {
                                  const nextStatuses = event.target.checked
                                    ? [...currentFilters.statuses, option.value]
                                    : currentFilters.statuses.filter((status) => status !== option.value);

                                  return {
                                    ...currentFilters,
                                    statuses: nextStatuses.length ? nextStatuses : [option.value],
                                  };
                                })}
                              type="checkbox"
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className={styles.driverFilterGroup}>
                      <label className={styles.driverFilterLabel} htmlFor="driver-trip-date-from">
                        Fecha desde
                      </label>
                      <input
                        id="driver-trip-date-from"
                        className={styles.driverFilterInput}
                        onChange={(event) =>
                          setDriverWorkspaceFilters((currentFilters) => ({
                            ...currentFilters,
                            dateFrom: event.target.value,
                          }))}
                        type="date"
                        value={driverWorkspaceFilters.dateFrom}
                      />
                    </div>
                    <div className={styles.driverFilterGroup}>
                      <label className={styles.driverFilterLabel} htmlFor="driver-trip-date-to">
                        Fecha hasta
                      </label>
                      <input
                        id="driver-trip-date-to"
                        className={styles.driverFilterInput}
                        onChange={(event) =>
                          setDriverWorkspaceFilters((currentFilters) => ({
                            ...currentFilters,
                            dateTo: event.target.value,
                          }))}
                        type="date"
                        value={driverWorkspaceFilters.dateTo}
                      />
                    </div>

                    <div className={styles.driverFilterGroup}>
                      <label className={styles.driverFilterLabel} htmlFor="driver-trip-sort">
                        Ordenar por
                      </label>
                      <select
                        id="driver-trip-sort"
                        className={styles.driverFilterSelect}
                        onChange={(event) =>
                          setDriverWorkspaceFilters((currentFilters) => ({
                            ...currentFilters,
                            sortBy: event.target.value as DriverTripSortOption,
                          }))}
                        value={driverWorkspaceFilters.sortBy}
                      >
                        <option value="recent">Ultima actividad primero</option>
                        <option value="created-asc">Mas antiguos primero</option>
                        <option value="departure-asc">Salida mas cercana</option>
                        <option value="departure-desc">Salida mas lejana</option>
                      </select>
                    </div>

                    <div className={styles.driverFilterCheckContainer}>
                      <label className={styles.driverFilterCheck}>
                        <input
                          checked={driverWorkspaceFilters.onlyWithPendingRequests}
                          onChange={(event) =>
                            setDriverWorkspaceFilters((currentFilters) => ({
                              ...currentFilters,
                              onlyWithPendingRequests: event.target.checked,
                            }))}
                          type="checkbox"
                        />
                        <span>Solo viajes con solicitudes pendientes</span>
                      </label>
                    </div>
                  </div>

                  <div className={styles.driverFilterSummary}>
                    <strong>{filteredDriverTrips.length}</strong>
                    <span>viajes visibles</span>
                  </div>
                </div>
              </details>
            ) : (
              <details className={styles.filterSidebar}>
                <summary className={styles.filterSidebarHeader}>
                  <strong>
                    Filtros
                    {activeFiltersCount > 0 && ` (${activeFiltersCount} activos)`}
                  </strong>
                  {activeFiltersCount > 0 ? (
                    <button
                      className={styles.filterResetLink}
                      onClick={(e) => {
                        e.preventDefault();
                        handleResetFilters();
                      }}
                      type="button"
                    >
                      Limpiar
                    </button>
                  ) : null}
                </summary>
                <div className={styles.filterSidebarContent}>
                  {activeFilterLabels.length ? (
                    <div className={styles.filterPills}>
                      {activeFilterLabels.map((label) => (
                        <span key={label} className={styles.filterPill}>
                          {label}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <TripFiltersPanel
                    isSubmitting={isFiltering}
                    onApply={handleApplyFilters}
                    onChange={handleFilterChange}
                    onReset={handleResetFilters}
                    values={filterFormValues}
                  />
                </div>
              </details>
            )}

            <div className={styles.workspaceSurface}>
              <div className={styles.workspaceStage}>
                {shouldShowDriverSidebar ? (
                  <TripsOperationWorkspace
                    blocksDriver={trustRestrictions.blocksDriver}
                    canCreateTrips={canCreateTrips}
                    incomingRequests={incomingRequests}
                    isMutatingRequestId={isMutatingRequestId}
                    isMutatingTripId={isMutatingTripId}
                    isRefreshingData={isRefreshingData}
                    licenseStatus={licenseStatus}
                    myTrips={filteredDriverTrips}
                    noShowNotes={noShowNotes}
                    onMarkNoShow={(requestId) => void handleMarkNoShow(requestId)}
                    onMarkPassengerBoarded={(requestId) => void handleMarkPassengerBoarded(requestId)}
                    onMarkPassengerDroppedOff={(requestId) =>
                      void handleMarkPassengerDroppedOff(requestId)}
                    onNavigateToCreateTrip={handleCreateTripNavigation}
                    onNoShowNoteChange={handleNoShowNoteChange}
                    onBlockedAction={(title, description) => pushToast(title, description, 'info')}
                    onOpenRequests={() => router.push('/viajes/aprobar-solicitudes')}
                    onTripAction={(tripId, action, options) =>
                      void handleTripAction(tripId, action, options)}
                    onTripClosureNoteChange={handleTripClosureNoteChange}
                    showClosureItems={false}
                    showCommandCenter={false}
                    tripClosureNotes={tripClosureNotes}
                  />
                ) : (
                  <TripsDiscoverWorkspace
                      activeFilterLabels={activeFilterLabels}
                      activeFiltersCount={activeFiltersCount}
                      canCreateRequestForTrip={canCreateRequestForTrip}
                      filterFormValues={filterFormValues}
                      isFiltering={isFiltering}
                      isMutatingRequestId={isMutatingRequestId}
                      isPassengerOperationBlocked={trustRestrictions.blocksPassenger}
                      isRefreshingData={isRefreshingData}
                      myRequests={myRequests}
                      onApplyFilters={handleApplyFilters}
                      onCreateRequest={(trip) => void handleCreateRequest(trip)}
                      onFilterChange={handleFilterChange}
                      onOpenRequests={() => setPassengerWorkspace('requests')}
                      onBlockedAction={(title, description) => pushToast(title, description, 'info')}
                      onRequestDraftChange={handleRequestDraftChange}
                      onResetFilters={handleResetFilters}
                      requestDrafts={requestDrafts}
                      reservationSettings={reservationSettings}
                      wallet={wallet}
                      visibleAvailableTrips={visibleAvailableTrips}
                  />
                )}
              </div>
            </div>
          </section>
        ) : (
          <div className={styles.workspaceSurface}>
            <div className={styles.workspaceStage}>
              {showDriverWorkspace ? (
                <TripsOperationWorkspace
                  blocksDriver={trustRestrictions.blocksDriver}
                  canCreateTrips={canCreateTrips}
                  incomingRequests={incomingRequests}
                  isMutatingRequestId={isMutatingRequestId}
                  isMutatingTripId={isMutatingTripId}
                  isRefreshingData={isRefreshingData}
                  licenseStatus={licenseStatus}
                  myTrips={myTrips}
                  noShowNotes={noShowNotes}
                  onMarkNoShow={(requestId) => void handleMarkNoShow(requestId)}
                  onMarkPassengerBoarded={(requestId) => void handleMarkPassengerBoarded(requestId)}
                  onMarkPassengerDroppedOff={(requestId) =>
                    void handleMarkPassengerDroppedOff(requestId)}
                  onNavigateToCreateTrip={handleCreateTripNavigation}
                  onNoShowNoteChange={handleNoShowNoteChange}
                  onBlockedAction={(title, description) => pushToast(title, description, 'info')}
                  onOpenRequests={() => router.push('/viajes/aprobar-solicitudes')}
                  onTripAction={(tripId, action, options) =>
                    void handleTripAction(tripId, action, options)}
                  onTripClosureNoteChange={handleTripClosureNoteChange}
                  showClosureItems={false}
                  showCommandCenter={false}
                  tripClosureNotes={tripClosureNotes}
                />
              ) : (
                    <TripsRequestsWorkspace
                      canAcceptIncomingRequest={canAcceptIncomingRequest}
                      canCancelOwnRequest={canCancelOwnRequest}
                      canMarkRequestAsNoShow={canMarkRequestAsNoShow}
                      canRejectIncomingRequest={canRejectIncomingRequest}
                      defaultNoShowNote={DEFAULT_NO_SHOW_NOTE}
                      incomingRequests={[]}
                      isMutatingPaymentId={isMutatingPaymentId}
                      isMutatingRequestId={isMutatingRequestId}
                      isRefreshingData={isRefreshingData}
                      myRequests={myRequests}
                      noShowNotes={noShowNotes}
                      onCancelMyRequest={(requestId) => void handleCancelMyRequest(requestId)}
                      onConfirmCashPayment={(paymentId) => void handleConfirmCashPayment(paymentId)}
                      onCreatePaymentCheckout={(paymentId) => void handleCreatePaymentCheckout(paymentId)}
                      onExploreTrips={() => setPassengerWorkspace('discover')}
                      onIncomingRequestAction={(requestId, action) =>
                        void handleIncomingRequestAction(requestId, action)}
                      onMarkNoShow={(requestId) => void handleMarkNoShow(requestId)}
                      onNoShowNoteChange={handleNoShowNoteChange}
                      onRefreshPaymentStatus={(paymentId) => void handleRefreshPaymentStatus(paymentId)}
                      onReportCashPaymentIssue={(paymentId) =>
                        void handleReportCashPaymentIssue(paymentId)}
                      showIncomingRequestsSection={false}
                      showMyRequestsSection
                    />
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
