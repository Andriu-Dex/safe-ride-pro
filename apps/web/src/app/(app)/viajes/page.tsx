'use client';

import {
  CancellationTiming,
  DriverLicenseStatus,
  DriverVerificationStatus,
  isOperationalMembership,
  OperationalSanctionType,
  selectOperationalMembership,
  TripRequestStatus,
  TripRouteMode,
  TripStatus,
  VehicleType,
} from '@saferidepro/shared-types';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { DisclosurePanel } from '../../../components/ui/disclosure-panel';
import { InputField } from '../../../components/ui/input-field';
import { OperationalAccessCard } from '../../../components/ui/operational-access-card';
import { StatusPill } from '../../../components/ui/status-pill';
import { TextareaField } from '../../../components/ui/textarea-field';
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
  markTripRequestAsNoShow,
  rejectTripRequest,
} from '../../../modules/trip-requests/lib/trip-request-api';
import {
  getTripRequestCancellationTimingLabel,
  getTripRequestStatusLabel,
  getTripRequestStatusTone,
} from '../../../modules/trip-requests/lib/trip-request-labels';
import type { TripRequestRecord } from '../../../modules/trip-requests/types/trip-request';
import { TripCreationForm } from '../../../modules/trips/components/trip-creation-form';
import { TripFiltersPanel } from '../../../modules/trips/components/trip-filters-panel';
import { TripOverviewCard } from '../../../modules/trips/components/trip-overview-card';
import {
  cancelTrip,
  completeTrip,
  createTrip,
  getLatestTripRouteTemplate,
  listAvailableTrips,
  listMyTrips,
  publishTrip,
  startTrip,
} from '../../../modules/trips/lib/trip-api';
import {
  canStartTripNow,
  getTripAvailabilityFilterLabel,
  getCancellationTimingLabel,
  getCancellationTimingTone,
  getTripCompletionOverdueMessage,
  getTripRouteModeLabel,
  getTripStartAvailabilityMessage,
} from '../../../modules/trips/lib/trip-labels';
import type {
  LatestTripRouteTemplate,
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

const EMPTY_TRIP_FORM = {
  vehicleId: '',
  routeMode: TripRouteMode.DirectRoute,
  originLabel: '',
  destinationLabel: '',
  originLatitude: '',
  originLongitude: '',
  destinationLatitude: '',
  destinationLongitude: '',
  departureAt: '',
  estimatedArrivalAt: '',
  seatCount: '1',
  basePriceReference: '0',
  detourSurchargeReference: '0',
  notes: '',
};

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

type TripRequestDraft = {
  requestMessage: string;
  requestedPickupLatitude: string;
  requestedPickupLongitude: string;
  requestedDropoffLatitude: string;
  requestedDropoffLongitude: string;
};

const EMPTY_REQUEST_DRAFT: TripRequestDraft = {
  requestMessage: '',
  requestedPickupLatitude: '',
  requestedPickupLongitude: '',
  requestedDropoffLatitude: '',
  requestedDropoffLongitude: '',
};

const DEFAULT_NO_SHOW_NOTE = 'El pasajero no se presento al punto acordado.';

type TripsWorkspaceSection = 'operation' | 'requests' | 'discover';

function toIsoString(localDateTime: string): string {
  return new Date(localDateTime).toISOString();
}

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
  const { authSession, isHydrated, refreshSession } = useAuth();
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);
  const [vehicleOverview, setVehicleOverview] = useState<VehicleOverview | null>(null);
  const [trustSummary, setTrustSummary] = useState<TrustSummary | null>(null);
  const [myTrips, setMyTrips] = useState<TripRecord[]>([]);
  const [availableTrips, setAvailableTrips] = useState<TripRecord[]>([]);
  const [latestRouteTemplate, setLatestRouteTemplate] = useState<LatestTripRouteTemplate | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<TripRequestRecord[]>([]);
  const [myRequests, setMyRequests] = useState<TripRequestRecord[]>([]);
  const [tripForm, setTripForm] = useState(EMPTY_TRIP_FORM);
  const [tripFilters, setTripFilters] = useState<TripFilters>(EMPTY_TRIP_FILTERS);
  const [filterFormValues, setFilterFormValues] = useState<TripFilters>(EMPTY_TRIP_FILTERS);
  const [requestDrafts, setRequestDrafts] = useState<Record<string, TripRequestDraft>>({});
  const [noShowNotes, setNoShowNotes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);
  const [isLoadingLatestRoute, setIsLoadingLatestRoute] = useState(false);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [isMutatingTripId, setIsMutatingTripId] = useState<string | null>(null);
  const [isMutatingRequestId, setIsMutatingRequestId] = useState<string | null>(null);
  const [activeWorkspace, setActiveWorkspace] = useState<TripsWorkspaceSection>('operation');
  const [isCreateTripPanelOpen, setIsCreateTripPanelOpen] = useState(false);
  const [tripErrorMessage, setTripErrorMessage] = useState<string | null>(null);
  const [tripSuccessMessage, setTripSuccessMessage] = useState<string | null>(null);
  const [requestErrorMessage, setRequestErrorMessage] = useState<string | null>(null);
  const [requestSuccessMessage, setRequestSuccessMessage] = useState<string | null>(null);
  const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeRefreshPendingRef = useRef(false);
  const realtimeRefreshRunningRef = useRef(false);

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

  const loadLatestRouteTemplate = useCallback(async (accessToken: string) => {
    setIsLoadingLatestRoute(true);

    try {
      const latestRoute = await getLatestTripRouteTemplate(accessToken);
      setLatestRouteTemplate(latestRoute);
    } catch {
      setLatestRouteTemplate(null);
    } finally {
      setIsLoadingLatestRoute(false);
    }
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
      setLatestRouteTemplate(null);
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

  useEffect(() => {
    if (!isHydrated || !authSession || !operationalAccess.hasOperationalMembership) {
      setLatestRouteTemplate(null);
      return;
    }

    void loadLatestRouteTemplate(authSession.accessToken);
  }, [authSession, isHydrated, loadLatestRouteTemplate, operationalAccess.hasOperationalMembership]);

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
    },
  });

  const handleTripFormChange = (field: keyof typeof EMPTY_TRIP_FORM, value: string) => {
    setTripForm((currentForm) => ({
      ...currentForm,
      [field]: value,
      ...(field === 'routeMode' && value === TripRouteMode.DirectRoute
        ? { detourSurchargeReference: '0' }
        : {}),
    }));
  };

  const handleUseLatestRoute = () => {
    if (!latestRouteTemplate) {
      return;
    }

    const suggestedVehicle = activeVehicles.some(
      (vehicle) => vehicle.id === latestRouteTemplate.vehicleId,
    )
      ? latestRouteTemplate.vehicleId
      : '';

    setTripForm((currentForm) => ({
      ...currentForm,
      vehicleId: suggestedVehicle,
      routeMode: latestRouteTemplate.routeMode,
      originLabel: latestRouteTemplate.originLabel,
      destinationLabel: latestRouteTemplate.destinationLabel,
      originLatitude: latestRouteTemplate.originLatitude.toFixed(6),
      originLongitude: latestRouteTemplate.originLongitude.toFixed(6),
      destinationLatitude: latestRouteTemplate.destinationLatitude.toFixed(6),
      destinationLongitude: latestRouteTemplate.destinationLongitude.toFixed(6),
      seatCount: String(latestRouteTemplate.seatCount),
      basePriceReference: String(latestRouteTemplate.basePriceReference),
      detourSurchargeReference: String(latestRouteTemplate.detourSurchargeReference ?? 0),
      notes: latestRouteTemplate.notes ?? '',
      departureAt: currentForm.departureAt,
      estimatedArrivalAt: currentForm.estimatedArrivalAt,
    }));
    setTripSuccessMessage(
      suggestedVehicle
        ? 'Se cargo tu ultima ruta. Ajusta fecha, hora o detalles antes de crear el nuevo viaje.'
        : 'Se cargo tu ultima ruta, pero necesitas elegir un vehiculo activo antes de crear el viaje.',
    );
    setTripErrorMessage(null);
  };

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

  const handleCreateTrip = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authSession) {
      return;
    }

    setIsCreatingTrip(true);
    setTripErrorMessage(null);
    setTripSuccessMessage(null);

    try {
      const response = await createTrip(authSession.accessToken, {
        vehicleId: tripForm.vehicleId,
        routeMode: tripForm.routeMode,
        originLabel: tripForm.originLabel,
        destinationLabel: tripForm.destinationLabel,
        originLatitude: Number.parseFloat(tripForm.originLatitude),
        originLongitude: Number.parseFloat(tripForm.originLongitude),
        destinationLatitude: Number.parseFloat(tripForm.destinationLatitude),
        destinationLongitude: Number.parseFloat(tripForm.destinationLongitude),
        departureAt: toIsoString(tripForm.departureAt),
        estimatedArrivalAt: toIsoString(tripForm.estimatedArrivalAt),
        seatCount: Number.parseInt(tripForm.seatCount, 10),
        basePriceReference: Number.parseFloat(tripForm.basePriceReference),
        detourSurchargeReference:
          tripForm.routeMode === TripRouteMode.PlannedDetour
            ? Number.parseFloat(tripForm.detourSurchargeReference || '0')
            : undefined,
        notes: tripForm.notes || undefined,
      });

      await reloadData();
      await loadLatestRouteTemplate(authSession.accessToken);
      setTripSuccessMessage(response.message);
      setTripForm(EMPTY_TRIP_FORM);
      setIsCreateTripPanelOpen(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setTripErrorMessage(getApiErrorMessage(error, 'No fue posible crear el viaje.'));
    } finally {
      setIsCreatingTrip(false);
    }
  };

  const handleTripAction = async (
    tripId: string,
    action: 'publish' | 'start' | 'complete' | 'cancel',
  ) => {
    if (!authSession) {
      return;
    }

    setIsMutatingTripId(tripId);
    setTripErrorMessage(null);
    setTripSuccessMessage(null);

    try {
      const actionMap = {
        publish: publishTrip,
        start: startTrip,
        complete: completeTrip,
        cancel: cancelTrip,
      } as const;

      const response = await actionMap[action](authSession.accessToken, tripId);
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
  const pendingMyRequestsCount = myRequests.filter(
    (request) =>
      request.status === TripRequestStatus.Pending
      || request.status === TripRequestStatus.Accepted,
  ).length;
  const discoverableTripsWithSeatsCount = visibleAvailableTrips.filter(
    (trip) => trip.status === TripStatus.Published && trip.availableSeats > 0,
  ).length;

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
      <section className="trips-workspace-content">
        <section className="trips-command-bar">
          <div className="trips-command-copy">
            <p className="section-label">Centro de movilidad</p>
            <h1 className="trips-command-title">Viajes</h1>
            <p className="panel-text">
              Administra tus viajes como conductor y revisa las solicitudes disponibles dentro de tu institucion.
            </p>
          </div>
          <div className="trips-command-actions">
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
    <>
      <section className="trips-command-bar">
        <div className="trips-command-copy">
          <p className="section-label">Centro de movilidad</p>
          <h1 className="trips-command-title">Viajes</h1>
          <p className="panel-text">
            Organiza la operacion diaria en tres frentes: conducir, responder solicitudes y buscar cupos.
          </p>
        </div>
        <div className="trips-command-actions">
          <Button
            disabled={isRefreshingData}
            onClick={() => void refreshTripsData(true)}
            variant="secondary"
          >
            {isRefreshingData ? 'Actualizando...' : 'Actualizar'}
          </Button>
          <StatusPill
            label={
              realtimeStatus === 'connected'
                ? 'Tiempo real activo'
                : realtimeStatus === 'connecting' || realtimeStatus === 'reconnecting'
                  ? 'Reconectando'
                  : realtimeStatus === 'error'
                    ? 'Tiempo real inestable'
                    : 'Tiempo real en pausa'
            }
            tone={
              realtimeStatus === 'connected'
                ? 'success'
                : realtimeStatus === 'error'
                  ? 'warning'
                  : 'neutral'
            }
          />
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
        </div>
      </section>

      <section className="trips-kpi-grid">
        <article className="trips-kpi-card trips-kpi-card-operation">
          <span className="trips-kpi-label">Operacion</span>
          <strong className="trips-kpi-value">{activeMyTripsCount}</strong>
          <p className="trips-kpi-text">de {myTrips.length} viajes en actividad</p>
        </article>
        <article className="trips-kpi-card trips-kpi-card-requests">
          <span className="trips-kpi-label">Solicitudes</span>
          <strong className="trips-kpi-value">{totalRequestsCount}</strong>
          <p className="trips-kpi-text">
            {actionableIncomingRequestsCount} por atender · {pendingMyRequestsCount} pendientes
          </p>
        </article>
        <article className="trips-kpi-card trips-kpi-card-discover">
          <span className="trips-kpi-label">Explorar</span>
          <strong className="trips-kpi-value">{visibleAvailableTrips.length}</strong>
          <p className="trips-kpi-text">{discoverableTripsWithSeatsCount} con cupos disponibles</p>
        </article>
      </section>

      <section aria-label="Secciones de viajes" className="trips-workspace-switch">
        <button
          aria-pressed={activeWorkspace === 'operation'}
          className={[
            'trips-workspace-tab',
            activeWorkspace === 'operation' ? 'trips-workspace-tab-active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => setActiveWorkspace('operation')}
          type="button"
        >
          <span>Operacion</span>
          <small>{activeMyTripsCount} activos</small>
        </button>
        <button
          aria-pressed={activeWorkspace === 'requests'}
          className={[
            'trips-workspace-tab',
            activeWorkspace === 'requests' ? 'trips-workspace-tab-active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => setActiveWorkspace('requests')}
          type="button"
        >
          <span>Solicitudes</span>
          <small>{totalRequestsCount} registros</small>
        </button>
        <button
          aria-pressed={activeWorkspace === 'discover'}
          className={[
            'trips-workspace-tab',
            activeWorkspace === 'discover' ? 'trips-workspace-tab-active' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => setActiveWorkspace('discover')}
          type="button"
        >
          <span>Explorar</span>
          <small>{discoverableTripsWithSeatsCount} con cupos</small>
        </button>
      </section>

      <section className="content-grid trips-workspace-content">
        <div className="trips-alert-stack">
          {tripErrorMessage ? <div className="form-error">{tripErrorMessage}</div> : null}
          {tripSuccessMessage ? <div className="form-success">{tripSuccessMessage}</div> : null}
          {requestErrorMessage ? <div className="form-error">{requestErrorMessage}</div> : null}
          {requestSuccessMessage ? <div className="form-success">{requestSuccessMessage}</div> : null}

          {!canCreateTrips ? (
            <div className="form-helper">
              {trustRestrictions.blocksDriver
                ? trustRestrictions.message ?? 'Tu membresia tiene una restriccion activa para operar como conductor.'
                : licenseStatus === DriverLicenseStatus.Expired
                ? 'Tu licencia vencio. Debes renovarla antes de crear, publicar o iniciar viajes.'
                : 'Para crear viajes necesitas tener estado de conductor aprobado y al menos un vehiculo activo.'}
            </div>
          ) : null}

          {trustRestrictions.blocksPassenger ? (
            <div className="form-helper">
              {trustRestrictions.message ?? 'Tu membresia tiene una restriccion activa para solicitar viajes.'}
            </div>
          ) : null}

          {trustSummary
          && !trustRestrictions.blocksDriver
          && !trustRestrictions.blocksPassenger
          && trustSummary.riskSignals.length ? (
            <div className="form-helper">{trustSummary.riskSignals[0]}</div>
          ) : null}

          {driverLicenseAlertMessage ? (
            <div className="form-helper">{driverLicenseAlertMessage}</div>
          ) : null}
        </div>

        {activeWorkspace === 'operation' ? (
          <section className="trips-workspace-grid trips-operation-stack">
            <article className="panel panel-stack trips-stream-panel">
              <div className="section-heading">
                <h2 className="panel-title">Mis viajes</h2>
                <p className="section-heading-meta">{myTrips.length} resultados</p>
              </div>
              {myTrips.length ? (
                <div className="list-stack">
                  {myTrips.map((trip) => {
                    const startAvailabilityMessage = getTripStartAvailabilityMessage(
                      trip.departureAt,
                      trip.estimatedArrivalAt,
                    );
                    const completionOverdueMessage = getTripCompletionOverdueMessage(
                      trip.status,
                      trip.estimatedArrivalAt,
                    );

                    return (
                      <TripOverviewCard
                        key={trip.id}
                        helperContent={
                          <>
                            {trip.status === TripStatus.Cancelled && trip.cancellationTiming ? (
                              <StatusPill
                                label={getCancellationTimingLabel(trip.cancellationTiming) ?? 'Cancelacion'}
                                tone={getCancellationTimingTone(trip.cancellationTiming)}
                              />
                            ) : null}
                            {licenseStatus === DriverLicenseStatus.Expired
                            && (trip.status === TripStatus.Draft
                              || trip.status === TripStatus.Published
                              || trip.status === TripStatus.Full) ? (
                                <p className="panel-text">
                                  No puedes publicar ni iniciar este viaje mientras tu licencia siga vencida.
                                </p>
                              ) : null}
                            {(trip.status === TripStatus.Published || trip.status === TripStatus.Full)
                            && startAvailabilityMessage ? (
                              <p className="panel-text">{startAvailabilityMessage}</p>
                            ) : null}
                            {completionOverdueMessage ? (
                              <p className="panel-text">
                                {completionOverdueMessage} Revísalo cuanto antes para evitar inconsistencias operativas.
                              </p>
                            ) : null}
                          </>
                        }
                        trip={trip}
                      >
                        <div className="button-row">
                          {trip.status === TripStatus.Draft ? (
                            <Button
                              disabled={
                                isMutatingTripId === trip.id
                                || licenseStatus === DriverLicenseStatus.Expired
                                || trustRestrictions.blocksDriver
                              }
                              onClick={() => void handleTripAction(trip.id, 'publish')}
                              variant="primary"
                            >
                              Publicar
                            </Button>
                          ) : null}
                          {(trip.status === TripStatus.Published || trip.status === TripStatus.Full) ? (
                            <Button
                              disabled={
                                isMutatingTripId === trip.id
                                || licenseStatus === DriverLicenseStatus.Expired
                                || trustRestrictions.blocksDriver
                                || !canStartTripNow(trip.departureAt, trip.estimatedArrivalAt)
                              }
                              onClick={() => void handleTripAction(trip.id, 'start')}
                              title={startAvailabilityMessage ?? undefined}
                              variant="secondary"
                            >
                              Iniciar
                            </Button>
                          ) : null}
                          {trip.status === TripStatus.InProgress ? (
                            <Button
                              disabled={isMutatingTripId === trip.id}
                              onClick={() => void handleTripAction(trip.id, 'complete')}
                              variant="secondary"
                            >
                              Finalizar
                            </Button>
                          ) : null}
                          {trip.status !== TripStatus.Completed
                          && trip.status !== TripStatus.InProgress
                          && trip.status !== TripStatus.Cancelled ? (
                            <Button
                              disabled={isMutatingTripId === trip.id}
                              onClick={() => void handleTripAction(trip.id, 'cancel')}
                              variant="ghost"
                            >
                              Cancelar
                            </Button>
                          ) : null}
                        </div>
                      </TripOverviewCard>
                    );
                  })}
                </div>
              ) : (
                <p className="panel-text">
                  No hay viajes propios con los filtros actuales. Crea uno nuevo o limpia filtros.
                </p>
              )}
            </article>

            <DisclosurePanel
              className="trip-create-disclosure"
              defaultOpen={false}
              onOpenChange={setIsCreateTripPanelOpen}
              open={isCreateTripPanelOpen}
              description="Registra viajes nuevos cuando tengas vehiculo activo y estado aprobado."
              meta={
                isLoadingLatestRoute
                  ? 'Cargando referencia'
                  : latestRouteTemplate
                    ? 'Incluye ultima ruta'
                    : canCreateTrips
                      ? 'Nuevo borrador'
                      : 'Bloqueado'
              }
              title="Crear viaje"
            >
              <TripCreationForm
                disabled={!canCreateTrips}
                errorMessage={null}
                isSubmitting={isCreatingTrip}
                latestRouteTemplate={latestRouteTemplate}
                onChange={handleTripFormChange}
                onSubmit={handleCreateTrip}
                onUseLatestRoute={handleUseLatestRoute}
                successMessage={null}
                values={tripForm}
                vehicles={activeVehicles}
              />
            </DisclosurePanel>
          </section>
        ) : null}

        {activeWorkspace === 'requests' ? (
          <section className="trips-workspace-grid">
            <article className="panel panel-stack trips-stream-panel">
              <div className="section-heading">
                <h2 className="panel-title">Solicitudes recibidas</h2>
                <p className="section-heading-meta">{incomingRequests.length} resultados</p>
              </div>
              {incomingRequests.length ? (
                <div className="list-stack">
                  {incomingRequests.map((request) => (
                    <div key={request.id} className="list-card">
                      <div className="list-card-header">
                        <strong>{request.passengerFullName}</strong>
                        <StatusPill
                          label={getTripRequestStatusLabel(request.status)}
                          tone={getTripRequestStatusTone(request.status)}
                        />
                      </div>
                      <p className="panel-text">
                        Viaje: {request.tripOriginLabel} -&gt; {request.tripDestinationLabel}
                      </p>
                      <p className="panel-text">Salida: {formatDateTime(request.tripDepartureAt)}</p>
                      {request.requestMessage ? (
                        <p className="panel-text">Mensaje: {request.requestMessage}</p>
                      ) : null}
                      {request.status === TripRequestStatus.Pending
                      && request.tripStatus === TripStatus.Full ? (
                        <p className="panel-text">
                          El viaje ya completo sus cupos. Puedes rechazar esta solicitud o esperar un cupo libre.
                        </p>
                      ) : null}
                      {request.status === TripRequestStatus.Pending
                      && request.tripStatus !== TripStatus.Published
                      && request.tripStatus !== TripStatus.Full ? (
                        <p className="panel-text">
                          Esta solicitud quedo desactualizada porque el viaje cambio de estado.
                        </p>
                      ) : null}
                      {request.status === TripRequestStatus.Cancelled && request.cancellationTiming ? (
                        <div className="button-row">
                          <StatusPill
                            label={
                              getTripRequestCancellationTimingLabel(request.cancellationTiming)
                              ?? 'Cancelacion'
                            }
                            tone={
                              request.cancellationTiming === CancellationTiming.Late
                                ? 'warning'
                                : 'neutral'
                            }
                          />
                        </div>
                      ) : null}
                      {canMarkRequestAsNoShow(request) ? (
                        <TextareaField
                          label="Nota no-show"
                          onChange={(event) =>
                            handleNoShowNoteChange(request.id, event.target.value)
                          }
                          placeholder="Describe brevemente que el pasajero no se presento."
                          rows={2}
                          value={noShowNotes[request.id] ?? DEFAULT_NO_SHOW_NOTE}
                        />
                      ) : null}
                      <div className="button-row">
                        {canAcceptIncomingRequest(request) ? (
                          <Button
                            disabled={isMutatingRequestId === request.id}
                            onClick={() => void handleIncomingRequestAction(request.id, 'accept')}
                          >
                            Aceptar
                          </Button>
                        ) : null}
                        {canRejectIncomingRequest(request) ? (
                          <Button
                            disabled={isMutatingRequestId === request.id}
                            onClick={() => void handleIncomingRequestAction(request.id, 'reject')}
                            variant="secondary"
                          >
                            Rechazar
                          </Button>
                        ) : null}
                        {canMarkRequestAsNoShow(request) ? (
                          <Button
                            disabled={isMutatingRequestId === request.id}
                            onClick={() => void handleMarkNoShow(request.id)}
                            variant="ghost"
                          >
                            Registrar no-show
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="panel-text">Todavia no hay solicitudes entrantes para tus viajes.</p>
              )}
            </article>

            <article className="panel panel-stack trips-stream-panel">
              <div className="section-heading">
                <h2 className="panel-title">Mis solicitudes</h2>
                <p className="section-heading-meta">{myRequests.length} resultados</p>
              </div>
              {myRequests.length ? (
                <div className="list-stack">
                  {myRequests.map((request) => (
                    <div key={request.id} className="list-card">
                      <div className="list-card-header">
                        <strong>{request.tripOriginLabel} -&gt; {request.tripDestinationLabel}</strong>
                        <StatusPill
                          label={getTripRequestStatusLabel(request.status)}
                          tone={getTripRequestStatusTone(request.status)}
                        />
                      </div>
                      <p className="panel-text">Conductor: {request.driverFullName}</p>
                      <p className="panel-text">Salida: {formatDateTime(request.tripDepartureAt)}</p>
                      {request.reviewNote ? (
                        <p className="panel-text">Revision: {request.reviewNote}</p>
                      ) : null}
                      {request.status === TripRequestStatus.Cancelled && request.cancellationTiming ? (
                        <div className="button-row">
                          <StatusPill
                            label={
                              getTripRequestCancellationTimingLabel(request.cancellationTiming)
                              ?? 'Cancelacion'
                            }
                            tone={
                              request.cancellationTiming === CancellationTiming.Late
                                ? 'warning'
                                : 'neutral'
                            }
                          />
                        </div>
                      ) : null}
                      {(request.status === TripRequestStatus.Pending
                        || request.status === TripRequestStatus.Accepted)
                      && !canCancelOwnRequest(request) ? (
                        <p className="panel-text">
                          Esta solicitud ya no puede cancelarse porque el viaje cambio de estado.
                        </p>
                      ) : null}
                      {canCancelOwnRequest(request) ? (
                        <div className="button-row">
                          <Button
                            disabled={isMutatingRequestId === request.id}
                            onClick={() => void handleCancelMyRequest(request.id)}
                            variant="ghost"
                          >
                            Cancelar solicitud
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="panel-text">Aun no has enviado solicitudes de viaje.</p>
              )}
            </article>
          </section>
        ) : null}

        {activeWorkspace === 'discover' ? (
          <section className="trips-discover-stack">
            <DisclosurePanel
              defaultOpen={activeFiltersCount > 0}
              description="Filtra rapido por ruta, fecha y cupos para acotar resultados."
              meta={activeFiltersCount > 0 ? `${activeFiltersCount} activos` : 'Opcional'}
              title="Ajustar busqueda"
            >
              <TripFiltersPanel
                isSubmitting={isFiltering}
                onApply={handleApplyFilters}
                onChange={handleFilterChange}
                onReset={handleResetFilters}
                values={filterFormValues}
              />
            </DisclosurePanel>

            <article className="panel panel-stack trip-search-summary-panel trips-summary-compact">
              <div className="section-heading">
                <h2 className="panel-title">Lectura rapida</h2>
                <p className="section-heading-meta">
                  {visibleAvailableTrips.length} visibles · {discoverableTripsWithSeatsCount} con cupos
                </p>
              </div>
              {activeFilterLabels.length ? (
                <div className="chip-row trip-filter-chip-row">
                  {activeFilterLabels.map((label) => (
                    <span key={label} className="status-pill status-pill-neutral">
                      {label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="panel-text">Sin filtros activos. Estas viendo todo el universo disponible.</p>
              )}
            </article>

            <article className="panel panel-stack trips-stream-panel">
              <div className="section-heading">
                <h2 className="panel-title">Viajes disponibles</h2>
                <p className="section-heading-meta">{visibleAvailableTrips.length} resultados</p>
              </div>
              {visibleAvailableTrips.length ? (
                <div className="list-stack">
                  {visibleAvailableTrips.map((trip) => {
                    const draft = requestDrafts[trip.id] ?? EMPTY_REQUEST_DRAFT;
                    const hasActiveRequest = myRequests.some(
                      (request) =>
                        request.tripId === trip.id
                        && (request.status === TripRequestStatus.Pending
                          || request.status === TripRequestStatus.Accepted),
                    );
                    const canSubmitRequest = canCreateRequestForTrip(trip, hasActiveRequest);
                    const isPassengerOperationBlocked = trustRestrictions.blocksPassenger;

                    return (
                      <TripOverviewCard
                        key={trip.id}
                        emphasis
                        helperContent={
                          trip.status === TripStatus.Full ? (
                            <p className="panel-text">
                              Este viaje ya completo sus cupos. Si se libera uno, podras solicitarlo al actualizar la vista.
                            </p>
                          ) : null
                        }
                        showDriver
                        trip={trip}
                      >
                        {trip.routeMode === TripRouteMode.PlannedDetour ? (
                          <div className="form-grid form-grid-4 compact-grid">
                            <InputField
                              label="Lat. recogida"
                              onChange={(event) =>
                                handleRequestDraftChange(trip.id, 'requestedPickupLatitude', event.target.value)
                              }
                              type="number"
                              value={draft.requestedPickupLatitude}
                            />
                            <InputField
                              label="Long. recogida"
                              onChange={(event) =>
                                handleRequestDraftChange(trip.id, 'requestedPickupLongitude', event.target.value)
                              }
                              type="number"
                              value={draft.requestedPickupLongitude}
                            />
                            <InputField
                              label="Lat. destino"
                              onChange={(event) =>
                                handleRequestDraftChange(trip.id, 'requestedDropoffLatitude', event.target.value)
                              }
                              type="number"
                              value={draft.requestedDropoffLatitude}
                            />
                            <InputField
                              label="Long. destino"
                              onChange={(event) =>
                                handleRequestDraftChange(trip.id, 'requestedDropoffLongitude', event.target.value)
                              }
                              type="number"
                              value={draft.requestedDropoffLongitude}
                            />
                          </div>
                        ) : null}

                        <TextareaField
                          label="Mensaje para el conductor"
                          onChange={(event) =>
                            handleRequestDraftChange(trip.id, 'requestMessage', event.target.value)
                          }
                          placeholder="Comentario opcional para el conductor"
                          rows={3}
                          value={draft.requestMessage}
                        />

                        <div className="button-row">
                          <Button
                            disabled={
                              !canSubmitRequest
                              || isMutatingRequestId === trip.id
                              || isPassengerOperationBlocked
                            }
                            onClick={() => void handleCreateRequest(trip)}
                          >
                            {hasActiveRequest
                              ? 'Ya solicitaste este viaje'
                              : isPassengerOperationBlocked
                                ? 'Solicitud restringida'
                                : trip.status === TripStatus.Full
                                  ? 'Sin cupos disponibles'
                                  : 'Solicitar cupo'}
                          </Button>
                        </div>
                      </TripOverviewCard>
                    );
                  })}
                </div>
              ) : (
                <p className="panel-text">
                  No hay viajes disponibles con los filtros actuales dentro de tu institucion.
                </p>
              )}
            </article>
          </section>
        ) : null}
      </section>
    </>
  );
}
