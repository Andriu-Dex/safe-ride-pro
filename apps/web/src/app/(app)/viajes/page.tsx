'use client';

import {
  CancellationTiming,
  DriverLicenseStatus,
  DriverVerificationStatus,
  isOperationalMembership,
  OperationalSanctionType,
  selectOperationalMembership,
  TripRequestExecutionStatus,
  TripRequestStatus,
  TripStatus,
  VehicleType,
} from '@saferidepro/shared-types';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { OperationalAccessCard } from '../../../components/ui/operational-access-card';
import { StatusPill } from '../../../components/ui/status-pill';
import { ToastStack, type ToastItem } from '../../../components/ui/toast-stack';
import { useAutoRefresh } from '../../../hooks/use-auto-refresh';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
import { getOperationalAccessState } from '../../../modules/auth/lib/operational-context';
import { useRealtimeEventStream } from '../../../modules/realtime/hooks/use-realtime-event-stream';
import {
  getDriverLicenseAlertMessage,
  getDriverStatusLabel,
  getDriverStatusTone,
} from '../../../modules/driver/lib/driver-status';
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
import { useDriverTripLiveTracking } from '../../../modules/trips/hooks/use-driver-trip-live-tracking';
import {
  canStartTripNow,
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
  getAdministrativeRiskTone,
  getTrustRestrictions,
  getVisibleReputationStateLabel,
  getVisibleReputationTone,
} from '../../../modules/users/lib/trust-labels';
import type { TrustSummary } from '../../../modules/users/types/trust-summary';
import {
  TripsControlSidebar,
  type TripsReadinessItem,
  type TripsWorkspaceOption,
  type TripsWorkspaceSection,
} from '../../../modules/trips/components/trips-control-sidebar';
import { TripsWorkspaceSkeleton } from '../../../modules/trips/components/trips-workspace-skeleton';
import {
  EMPTY_REQUEST_DRAFT,
  type TripRequestDraft,
} from '../../../modules/trips/components/trips-workspace.types';

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
  const { authSession, isHydrated, refreshSession } = useAuth();
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);
  const [vehicleOverview, setVehicleOverview] = useState<VehicleOverview | null>(null);
  const [trustSummary, setTrustSummary] = useState<TrustSummary | null>(null);
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
  const [activeWorkspace, setActiveWorkspace] = useState<TripsWorkspaceSection>('operation');
  const [tripErrorMessage, setTripErrorMessage] = useState<string | null>(null);
  const [tripSuccessMessage, setTripSuccessMessage] = useState<string | null>(null);
  const [requestErrorMessage, setRequestErrorMessage] = useState<string | null>(null);
  const [requestSuccessMessage, setRequestSuccessMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [trackingVersionByTripId, setTrackingVersionByTripId] = useState<Record<string, number>>({});
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
    const [vehicleData, trustSummaryData, myTripsData, availableTripsData, myTripRequestsData, incomingTripRequestsData] = await Promise.all([
      getVehicleOverview(accessToken),
      getCurrentUserTrustSummary(accessToken),
      listMyTrips(accessToken, filters),
      listAvailableTrips(accessToken, filters),
      listMyTripRequests(accessToken),
      listIncomingTripRequests(accessToken),
    ]);

    setVehicleOverview(vehicleData);
    setTrustSummary(trustSummaryData);
    setMyTrips(myTripsData);
    setAvailableTrips(availableTripsData);
    setMyRequests(myTripRequestsData);
    setIncomingRequests(incomingTripRequestsData);
  }, []);

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
      setMyTrips([]);
      setAvailableTrips([]);
      setIncomingRequests([]);
      setMyRequests([]);
      setTrackingVersionByTripId({});
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

  const realtimeStatus = useRealtimeEventStream({
    accessToken: authSession?.accessToken,
    enabled: Boolean(authSession && operationalAccess.hasOperationalMembership),
    onEvent: (event) => {
      if (event.type === 'trip.changed' || event.type === 'trip-request.changed') {
        scheduleRealtimeRefresh();
      }

      if (event.type === 'trip-live-tracking.updated') {
        setTrackingVersionByTripId((currentState) => ({
          ...currentState,
          [event.tripId]: (currentState[event.tripId] ?? 0) + 1,
        }));
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
    value: string,
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
    setIsMutatingRequestId(trip.id);
    setRequestErrorMessage(null);
    setRequestSuccessMessage(null);

    try {
      const response = await createTripRequest(authSession.accessToken, {
        tripId: trip.id,
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
  const visibleAvailableTrips = availableTrips.filter(
    (trip) => trip.driverMembershipId !== defaultMembershipId,
  );
  const activeFiltersCount = countActiveFilters(tripFilters);
  const activeFilterLabels = buildTripFilterLabels(tripFilters);
  const activeMyTripsCount = myTrips.filter(
    (trip) => trip.status !== TripStatus.Completed && trip.status !== TripStatus.Cancelled,
  ).length;
  const totalRequestsCount = incomingRequests.length + myRequests.length;
  const actionableIncomingRequestsCount = incomingRequests.filter(
    (request) =>
      canAcceptIncomingRequest(request)
      || canRejectIncomingRequest(request)
      || canMarkRequestAsNoShow(request),
  ).length;
  const discoverableTripsWithSeatsCount = visibleAvailableTrips.filter(
    (trip) => trip.status === TripStatus.Published && trip.availableSeats > 0,
  ).length;
  const realtimeStatusLabel =
    realtimeStatus === 'connected'
      ? 'Tiempo real activo'
      : realtimeStatus === 'connecting' || realtimeStatus === 'reconnecting'
        ? 'Reconectando'
        : realtimeStatus === 'error'
          ? 'Tiempo real inestable'
          : 'Tiempo real en pausa';
  const realtimeStatusTone = realtimeStatus === 'connected'
    ? 'success'
    : realtimeStatus === 'error'
      ? 'warning'
      : 'neutral';
  const workspaceOptions: TripsWorkspaceOption[] = [
    {
      id: 'operation',
      label: 'Operacion',
      description: 'Conduce y gestiona tus viajes activos.',
      metric: `${activeMyTripsCount} activos`,
    },
    {
      id: 'requests',
      label: 'Solicitudes',
      description: 'Responde solicitudes entrantes y seguimiento propio.',
      metric: `${totalRequestsCount} registros`,
    },
    {
      id: 'discover',
      label: 'Explorar',
      description: 'Busca cupos y solicita viaje con filtros.',
      metric: `${discoverableTripsWithSeatsCount} con cupos`,
    },
  ];
  const readinessItems: TripsReadinessItem[] = [
    {
      id: 'driver-profile',
      label: 'Perfil de conductor',
      detail: driverStatus === DriverVerificationStatus.Approved
        ? 'Aprobado para operar.'
        : 'Pendiente de aprobacion o actualizacion.',
      tone: driverStatus === DriverVerificationStatus.Approved ? 'success' : 'warning',
    },
    {
      id: 'active-vehicle',
      label: 'Vehiculo activo',
      detail: activeVehicles.length > 0
        ? `${activeVehicles.length} disponible(s) para viajes.`
        : 'No tienes vehiculos activos todavia.',
      tone: activeVehicles.length > 0 ? 'success' : 'warning',
    },
    {
      id: 'license',
      label: 'Licencia',
      detail: licenseStatus === DriverLicenseStatus.Expired
        ? 'Requiere renovacion para conducir.'
        : driverLicenseAlertMessage ?? 'Vigente y verificada.',
      tone: licenseStatus === DriverLicenseStatus.Expired ? 'warning' : 'success',
    },
    {
      id: 'driver-restrictions',
      label: 'Permiso para conducir',
      detail: trustRestrictions.blocksDriver
        ? trustRestrictions.message ?? 'Existe una restriccion temporal activa.'
        : 'Sin restricciones para conducir.',
      tone: trustRestrictions.blocksDriver ? 'warning' : 'success',
    },
    {
      id: 'passenger-restrictions',
      label: 'Permiso para solicitar',
      detail: trustRestrictions.blocksPassenger
        ? trustRestrictions.message ?? 'No puedes enviar solicitudes por ahora.'
        : 'Puedes enviar solicitudes con normalidad.',
      tone: trustRestrictions.blocksPassenger ? 'warning' : 'success',
    },
  ];
  const readinessReadyCount = readinessItems.filter((item) => item.tone === 'success').length;
  const readinessCompletion = Math.round((readinessReadyCount / readinessItems.length) * 100);
  const activeDriverTrip =
    [...myTrips]
      .filter((trip) => trip.status === TripStatus.InProgress)
      .sort(
        (left, right) =>
          new Date(left.departureAt).getTime() - new Date(right.departureAt).getTime(),
      )[0] ?? null;
  const driverCaptureState = useDriverTripLiveTracking({
    accessToken: authSession?.accessToken,
    tripId: activeDriverTrip?.id ?? null,
    enabled: Boolean(authSession && activeDriverTrip),
  });

  if (isLoading) {
    return (
      <section className="loading-state compact-loading-state">
        <div className="loading-card">
          <div aria-hidden="true" className="loading-pulse" />
          <h1 className="panel-title">Preparando viajes y solicitudes</h1>
          <p className="panel-text">
            Estamos cargando tus viajes, los cupos disponibles y las solicitudes vinculadas.
          </p>
        </div>
      </section>
    );
  }

  if (!operationalAccess.hasOperationalMembership && operationalAccess.title && operationalAccess.message) {
    return (
      <section className="journey-shell">
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <section className="journey-hero journey-hero-blocked">
          <div className="journey-hero-copy">
            <p className="section-label">Centro de movilidad</p>
            <h1 className="journey-hero-title">Viajes</h1>
          </div>
          <div className="journey-hero-actions">
            <StatusPill label="Operacion bloqueada" tone="warning" />
          </div>
        </section>
        <section className="empty-state">
          <OperationalAccessCard
            message={operationalAccess.message}
            title={operationalAccess.title}
          />
        </section>
      </section>
    );
  }

  return (
    <section className="journey-shell">
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <section className="journey-hero">
        <div className="journey-hero-copy">
          <p className="section-label">Centro de movilidad</p>
          <h1 className="journey-hero-title">Viajes</h1>
        </div>
        <div className="journey-hero-actions">
          <Button
            disabled={isRefreshingData}
            onClick={() => void refreshTripsData(true)}
            variant="secondary"
          >
            {isRefreshingData ? 'Actualizando...' : 'Actualizar'}
          </Button>
        </div>
      </section>

      <section className="journey-hero-status-strip" aria-label="Estado operacional del conductor">
        <StatusPill label={realtimeStatusLabel} tone={realtimeStatusTone} />
        <StatusPill
          label={getDriverStatusLabel(driverStatus)}
          tone={getDriverStatusTone(driverStatus)}
        />
        {trustSummary ? (
          <StatusPill
            label={getVisibleReputationStateLabel(trustSummary.visibleReputationState)}
            tone={getVisibleReputationTone(trustSummary.visibleReputationState)}
          />
        ) : null}
        {trustSummary ? (
          <StatusPill
            label={getAdministrativeRiskStateLabel(trustSummary.administrativeRiskState)}
            tone={getAdministrativeRiskTone(trustSummary.administrativeRiskState)}
          />
        ) : null}
        {activeFiltersCount > 0 ? (
          <span className="topbar-badge">{activeFiltersCount} filtros</span>
        ) : null}
      </section>

      <section className="journey-kpi-grid">
        <article className="journey-kpi-card journey-kpi-card-operation">
          <span className="journey-kpi-label">Operacion</span>
          <strong className="journey-kpi-value">{activeMyTripsCount}</strong>
          <p className="journey-kpi-text">{myTrips.length} registrados</p>
        </article>
        <article className="journey-kpi-card journey-kpi-card-requests">
          <span className="journey-kpi-label">Solicitudes</span>
          <strong className="journey-kpi-value">{totalRequestsCount}</strong>
          <p className="journey-kpi-text">
            {actionableIncomingRequestsCount} por atender
          </p>
        </article>
        <article className="journey-kpi-card journey-kpi-card-discover">
          <span className="journey-kpi-label">Explorar</span>
          <strong className="journey-kpi-value">{visibleAvailableTrips.length}</strong>
          <p className="journey-kpi-text">{discoverableTripsWithSeatsCount} con cupos</p>
        </article>
      </section>

      <section className="journey-layout">
        <TripsControlSidebar
          activeWorkspace={activeWorkspace}
          canCreateTrips={canCreateTrips}
          onCreateTrip={() => router.push('/viajes/nuevo')}
          onDiscoverTrips={() => setActiveWorkspace('discover')}
          onWorkspaceChange={setActiveWorkspace}
          readinessCompletion={readinessCompletion}
          readinessItems={readinessItems}
          workspaceOptions={workspaceOptions}
        />

        <div className="journey-main">
          <section className="journey-main-surface">

            <div
              className={`journey-workspace-stage journey-workspace-stage-${activeWorkspace}`}
              key={activeWorkspace}
            >

            {activeWorkspace === 'operation' ? (
              <TripsOperationWorkspace
                accessToken={authSession?.accessToken}
                blocksDriver={trustRestrictions.blocksDriver}
                canCreateTrips={canCreateTrips}
                driverCaptureState={driverCaptureState}
                incomingRequests={incomingRequests}
                isMutatingRequestId={isMutatingRequestId}
                isMutatingTripId={isMutatingTripId}
                isRefreshingData={isRefreshingData}
                licenseStatus={licenseStatus}
                myTrips={myTrips}
                onNavigateToCreateTrip={() => router.push('/viajes/nuevo')}
                onNoShowNoteChange={handleNoShowNoteChange}
                onOpenRequests={() => setActiveWorkspace('requests')}
                onMarkPassengerBoarded={(requestId) => void handleMarkPassengerBoarded(requestId)}
                onMarkPassengerDroppedOff={(requestId) =>
                  void handleMarkPassengerDroppedOff(requestId)}
                onMarkNoShow={(requestId) => void handleMarkNoShow(requestId)}
                onTripAction={(tripId, action, options) => void handleTripAction(tripId, action, options)}
                onTripClosureNoteChange={handleTripClosureNoteChange}
                noShowNotes={noShowNotes}
                realtimeStatusLabel={realtimeStatusLabel}
                realtimeStatusTone={realtimeStatusTone}
                tripClosureNotes={tripClosureNotes}
                trackingVersionByTripId={trackingVersionByTripId}
              />
            ) : null}

            {activeWorkspace === 'requests' ? (
              <TripsRequestsWorkspace
                accessToken={authSession?.accessToken}
                canAcceptIncomingRequest={canAcceptIncomingRequest}
                canCancelOwnRequest={canCancelOwnRequest}
                canMarkRequestAsNoShow={canMarkRequestAsNoShow}
                canRejectIncomingRequest={canRejectIncomingRequest}
                defaultNoShowNote={DEFAULT_NO_SHOW_NOTE}
                incomingRequests={incomingRequests}
                isMutatingRequestId={isMutatingRequestId}
                isRefreshingData={isRefreshingData}
                myRequests={myRequests}
                noShowNotes={noShowNotes}
                onCancelMyRequest={(requestId) => void handleCancelMyRequest(requestId)}
                onExploreTrips={() => setActiveWorkspace('discover')}
                onIncomingRequestAction={(requestId, action) =>
                  void handleIncomingRequestAction(requestId, action)}
                onMarkNoShow={(requestId) => void handleMarkNoShow(requestId)}
                onNoShowNoteChange={handleNoShowNoteChange}
                realtimeStatusLabel={realtimeStatusLabel}
                realtimeStatusTone={realtimeStatusTone}
                trackingVersionByTripId={trackingVersionByTripId}
              />
            ) : null}

            {activeWorkspace === 'discover' ? (
              <TripsDiscoverWorkspace
                activeFilterLabels={activeFilterLabels}
                activeFiltersCount={activeFiltersCount}
                canCreateRequestForTrip={canCreateRequestForTrip}
                discoverableTripsWithSeatsCount={discoverableTripsWithSeatsCount}
                filterFormValues={filterFormValues}
                isFiltering={isFiltering}
                isMutatingRequestId={isMutatingRequestId}
                isPassengerOperationBlocked={trustRestrictions.blocksPassenger}
                isRefreshingData={isRefreshingData}
                myRequests={myRequests}
                onApplyFilters={handleApplyFilters}
                onCreateRequest={(trip) => void handleCreateRequest(trip)}
                onFilterChange={handleFilterChange}
                onOpenRequests={() => setActiveWorkspace('requests')}
                onRequestDraftChange={handleRequestDraftChange}
                onResetFilters={handleResetFilters}
                requestDrafts={requestDrafts}
                visibleAvailableTrips={visibleAvailableTrips}
              />
            ) : null}

            </div>
          </section>
        </div>
      </section>
    </section>
  );
}

