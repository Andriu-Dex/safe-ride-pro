'use client';

import Link from 'next/link';
import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  isOperationalMembership,
  PaymentProvider,
  selectOperationalMembership,
  TripRequestExecutionStatus,
  TripRequestStatus,
  TripStatus,
} from '@saferidepro/shared-types';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

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
    const [vehicleData, trustSummaryData, myTripsData, availableTripsData, myTripRequestsData, incomingTripRequestsData, institutionSettingsData] = await Promise.all([
      getVehicleOverview(accessToken),
      getCurrentUserTrustSummary(accessToken),
      listMyTrips(accessToken, filters),
      listAvailableTrips(accessToken, filters),
      listMyTripRequests(accessToken),
      listIncomingTripRequests(accessToken),
      currentMembership?.institutionId
        ? getInstitutionSettings(accessToken, currentMembership.institutionId)
        : Promise.resolve(null),
    ]);

    setVehicleOverview(vehicleData);
    setTrustSummary(trustSummaryData);
    setReservationSettings(institutionSettingsData?.settings ?? null);
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
    action: 'publish' | 'start' | 'complete' | 'cancel',
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
              : await cancelTrip(authSession.accessToken, tripId);

      await reloadData();
      setTripSuccessMessage(response.message);
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
    const paymentProvider =
      draft.paymentProvider === PaymentProvider.Cash &&
      reservationSettings?.allowCashPayments === false &&
      reservationSettings.allowPaypalPayments
        ? PaymentProvider.Paypal
        : draft.paymentProvider === PaymentProvider.Paypal &&
            reservationSettings?.allowPaypalPayments === false &&
            reservationSettings.allowCashPayments
          ? PaymentProvider.Cash
          : draft.paymentProvider;
    setIsMutatingRequestId(trip.id);
    setRequestErrorMessage(null);
    setRequestSuccessMessage(null);

    try {
      const response = await createTripRequest(authSession.accessToken, {
        tripId: trip.id,
        paymentProvider,
        acceptReservationCommitment: draft.acceptReservationCommitment,
        requestMessage: draft.requestMessage || undefined,
        requestedPickupLatitude: draft.requestedPickupLatitude
          ? Number.parseFloat(draft.requestedPickupLatitude)
          : undefined,
        requestedPickupLongitude: draft.requestedPickupLongitude
          ? Number.parseFloat(draft.requestedPickupLongitude)
          : undefined,
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
          window.location.assign(checkoutResponse.checkoutUrl);
          return;
        }
      }

      await reloadData();
      setRequestSuccessMessage(response.message);
      setRequestDrafts((currentDrafts) => ({
        ...currentDrafts,
        [trip.id]: EMPTY_REQUEST_DRAFT,
      }));
    } catch (error) {
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
          reservationSettings.allowPaypalPayments
        ) {
          nextPaymentProvider = PaymentProvider.Paypal;
          hasChanges = true;
        }

        if (
          nextPaymentProvider === PaymentProvider.Paypal &&
          !reservationSettings.allowPaypalPayments &&
          reservationSettings.allowCashPayments
        ) {
          nextPaymentProvider = PaymentProvider.Cash;
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
        getApiErrorMessage(error, 'No fue posible registrar el no-show.'),
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
          window.location.href = response.checkoutUrl;
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
  const visibleAvailableTrips = availableTrips.filter(
    (trip) => trip.driverMembershipId !== defaultMembershipId,
  );
  const activeFiltersCount = countActiveFilters(tripFilters);
  const activeFilterLabels = buildTripFilterLabels(tripFilters);
  const activeViewTitle =
    showDriverWorkspace
      ? 'Mis viajes'
      : passengerWorkspace === 'discover'
        ? 'Viajes disponibles'
        : 'Mis solicitudes';
  const shouldShowFiltersSidebar =
    !showDriverWorkspace && passengerWorkspace === 'discover';

  if (isLoading) {
    return (
      <section className={styles.loadingShell}>
        <article className={styles.loadingCard}>
          <div aria-hidden="true" className={styles.loadingPulse} />
          <h1 className={styles.loadingTitle}>Cargando viajes</h1>
          <p className={styles.loadingText}>
            Estamos preparando tu actividad, solicitudes y cupos disponibles.
          </p>
        </article>
      </section>
    );
  }

  if (!operationalAccess.hasOperationalMembership && operationalAccess.title && operationalAccess.message) {
    return (
      <>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <section className={styles.lockedShell}>
          <article className={styles.lockedCard}>
            <div className={styles.lockedHeader}>
              <div>
                <p className={styles.kicker}>Viajes</p>
                <h1 className={styles.lockedTitle}>Operacion no disponible</h1>
              </div>
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
        </section>
      </>
    );
  }

  return (
    <section className={styles.pageShell}>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <main className={styles.tripsShell}>
        <section className={`${styles.topbar} ${styles.reveal}`}>
          <div className={styles.topbarCopy}>
            <p className={styles.kicker}>Viajes</p>
            <h1 className={styles.topbarTitle}>{activeViewTitle}</h1>
          </div>

          <div className={styles.topbarActions}>
            {showDriverWorkspace ? (
              <Button disabled={!canCreateTrips} onClick={() => router.push('/viajes/nuevo')}>
                Crear viaje
              </Button>
            ) : null}
            <Button
              disabled={isRefreshingData}
              onClick={() => void refreshTripsData(true)}
              variant="secondary"
            >
              {isRefreshingData ? 'Actualizando...' : 'Actualizar'}
            </Button>
          </div>
        </section>

        {(showDriverWorkspace && (!canCreateTrips || driverLicenseAlertMessage || trustRestrictions.blocksDriver)) ||
        (!showDriverWorkspace && trustRestrictions.blocksPassenger) ? (
          <article className={`${styles.noticeInline} ${styles.revealSoft}`}>
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

        <section className={`${styles.workspaceLayout} ${styles.reveal}`}>
          <aside className={styles.sidebar}>
            <nav className={styles.viewNav} aria-label="Vistas de viajes">
              {showDriverWorkspace ? (
                <>
                  <button
                    className={[
                      styles.viewNavButton,
                      styles.viewNavButtonActive,
                    ].join(' ')}
                    onClick={() => undefined}
                    type="button"
                  >
                    Mis viajes
                  </button>
                  <button
                    className={[
                      styles.viewNavButton,
                    ].join(' ')}
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
                      styles.viewNavButton,
                      passengerWorkspace === 'discover' ? styles.viewNavButtonActive : '',
                    ].join(' ')}
                    onClick={() => setPassengerWorkspace('discover')}
                    type="button"
                  >
                    Ver viajes
                  </button>
                  <button
                    className={[
                      styles.viewNavButton,
                      passengerWorkspace === 'requests' ? styles.viewNavButtonActive : '',
                    ].join(' ')}
                    onClick={() => setPassengerWorkspace('requests')}
                    type="button"
                  >
                    Mis solicitudes
                  </button>
                </>
              )}
            </nav>

            {shouldShowFiltersSidebar ? (
              <div className={styles.filterSidebar}>
                <div className={styles.filterSidebarHeader}>
                  <strong>Filtros</strong>
                  {activeFiltersCount > 0 ? (
                    <button
                      className={styles.filterResetLink}
                      onClick={handleResetFilters}
                      type="button"
                    >
                      Limpiar
                    </button>
                  ) : null}
                </div>

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
            ) : (
              <div className={styles.sidebarSupport}>
                {showDriverWorkspace ? (
                  <>
                    <strong>Conduccion</strong>
                    <p>
                      Gestiona tus viajes publicados, revisa solicitudes y abre nuevos trayectos
                      solo cuando tu contexto este habilitado.
                    </p>
                    <div className={styles.sidebarSupportActions}>
                      <Link className={styles.sidebarLink} href="/viajes/aprobar-solicitudes">
                        Solicitudes
                      </Link>
                      <Link className={styles.sidebarLink} href="/conductor">
                        Conductor
                      </Link>
                      <Link className={styles.sidebarLink} href="/vehiculos">
                        Vehiculos
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <strong>Solicitudes</strong>
                    <p>
                      Revisa el estado de tus reservas, pagos y cancelaciones desde una sola vista.
                    </p>
                  </>
                )}
              </div>
            )}
          </aside>

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
                onNavigateToCreateTrip={() => router.push('/viajes/nuevo')}
                onNoShowNoteChange={handleNoShowNoteChange}
                onOpenRequests={() => router.push('/viajes/aprobar-solicitudes')}
                onMarkPassengerBoarded={(requestId) => void handleMarkPassengerBoarded(requestId)}
                onMarkPassengerDroppedOff={(requestId) =>
                  void handleMarkPassengerDroppedOff(requestId)}
                onMarkNoShow={(requestId) => void handleMarkNoShow(requestId)}
                onTripAction={(tripId, action, options) => void handleTripAction(tripId, action, options)}
                onTripClosureNoteChange={handleTripClosureNoteChange}
                noShowNotes={noShowNotes}
                tripClosureNotes={tripClosureNotes}
              />
            ) : (
              <>
                {passengerWorkspace === 'discover' ? (
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
                    reservationSettings={reservationSettings}
                    onApplyFilters={handleApplyFilters}
                    onCreateRequest={(trip) => void handleCreateRequest(trip)}
                    onFilterChange={handleFilterChange}
                    onOpenRequests={() => setPassengerWorkspace('requests')}
                    onRequestDraftChange={handleRequestDraftChange}
                    onResetFilters={handleResetFilters}
                    requestDrafts={requestDrafts}
                    visibleAvailableTrips={visibleAvailableTrips}
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
                    onConfirmCashPayment={(paymentId) => void handleConfirmCashPayment(paymentId)}
                    onCreatePaymentCheckout={(paymentId) => void handleCreatePaymentCheckout(paymentId)}
                    onReportCashPaymentIssue={(paymentId) =>
                      void handleReportCashPaymentIssue(paymentId)}
                    noShowNotes={noShowNotes}
                    onCancelMyRequest={(requestId) => void handleCancelMyRequest(requestId)}
                    onExploreTrips={() => setPassengerWorkspace('discover')}
                    onIncomingRequestAction={(requestId, action) =>
                      void handleIncomingRequestAction(requestId, action)}
                    onMarkNoShow={(requestId) => void handleMarkNoShow(requestId)}
                    onNoShowNoteChange={handleNoShowNoteChange}
                    onRefreshPaymentStatus={(paymentId) => void handleRefreshPaymentStatus(paymentId)}
                    showIncomingRequestsSection={false}
                    showMyRequestsSection
                  />
                )}
              </>
            )}
            </div>
          </div>
        </section>
      </main>
    </section>
  );
}

