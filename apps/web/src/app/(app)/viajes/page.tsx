'use client';

import {
  CancellationTiming,
  DriverLicenseStatus,
  DriverVerificationStatus,
  TripRequestStatus,
  TripRouteMode,
  TripStatus,
  VehicleType,
} from '@saferidepro/shared-types';
import { useEffect, useState } from 'react';

import { ApiError } from '../../../lib/api-client';
import { Button } from '../../../components/ui/button';
import { InfoCard } from '../../../components/ui/info-card';
import { InputField } from '../../../components/ui/input-field';
import { StatusPill } from '../../../components/ui/status-pill';
import { TextareaField } from '../../../components/ui/textarea-field';
import { useAutoRefresh } from '../../../hooks/use-auto-refresh';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
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
import {
  cancelTrip,
  completeTrip,
  createTrip,
  listAvailableTrips,
  listMyTrips,
  publishTrip,
  startTrip,
} from '../../../modules/trips/lib/trip-api';
import {
  canStartTripNow,
  getCancellationTimingLabel,
  getCancellationTimingTone,
  getTripRouteModeLabel,
  getTripStartAvailabilityMessage,
  getTripStatusLabel,
  getTripStatusTone,
} from '../../../modules/trips/lib/trip-labels';
import type { TripFilters, TripRecord } from '../../../modules/trips/types/trip';
import { getVehicleOverview } from '../../../modules/vehicles/lib/vehicle-api';
import { getLuggagePolicyLabel, getVehicleTypeLabel } from '../../../modules/vehicles/lib/vehicle-labels';
import type { VehicleOverview } from '../../../modules/vehicles/types/vehicle';

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
  routeMode: undefined,
  vehicleType: undefined,
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

function toIsoString(localDateTime: string): string {
  return new Date(localDateTime).toISOString();
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-EC');
}

function countActiveFilters(filters: TripFilters): number {
  return Object.values(filters).filter(Boolean).length;
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
  const { authSession, isHydrated } = useAuth();
  const [vehicleOverview, setVehicleOverview] = useState<VehicleOverview | null>(null);
  const [myTrips, setMyTrips] = useState<TripRecord[]>([]);
  const [availableTrips, setAvailableTrips] = useState<TripRecord[]>([]);
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
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [isMutatingTripId, setIsMutatingTripId] = useState<string | null>(null);
  const [isMutatingRequestId, setIsMutatingRequestId] = useState<string | null>(null);
  const [tripErrorMessage, setTripErrorMessage] = useState<string | null>(null);
  const [tripSuccessMessage, setTripSuccessMessage] = useState<string | null>(null);
  const [requestErrorMessage, setRequestErrorMessage] = useState<string | null>(null);
  const [requestSuccessMessage, setRequestSuccessMessage] = useState<string | null>(null);

  const loadTripsData = async (accessToken: string, filters: TripFilters) => {
    const [vehicleData, myTripsData, availableTripsData, myTripRequestsData, incomingTripRequestsData] = await Promise.all([
      getVehicleOverview(accessToken),
      listMyTrips(accessToken, filters),
      listAvailableTrips(accessToken, filters),
      listMyTripRequests(accessToken),
      listIncomingTripRequests(accessToken),
    ]);

    setVehicleOverview(vehicleData);
    setMyTrips(myTripsData);
    setAvailableTrips(availableTripsData);
    setMyRequests(myTripRequestsData);
    setIncomingRequests(incomingTripRequestsData);
  };

  const refreshTripsData = async (showSpinner = false) => {
    if (!authSession) {
      return;
    }

    if (showSpinner) {
      setIsRefreshingData(true);
    }

    try {
      await loadTripsData(authSession.accessToken, tripFilters);
    } catch (error) {
      setTripErrorMessage(getApiErrorMessage(error, 'No fue posible sincronizar la informacion de viajes.'));
    } finally {
      if (showSpinner) {
        setIsRefreshingData(false);
      }
    }
  };

  useEffect(() => {
    if (!isHydrated || !authSession) {
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
  }, [authSession, isHydrated, tripFilters]);

  useAutoRefresh(
    async () => {
      await refreshTripsData();
    },
    {
      enabled: Boolean(authSession && isHydrated),
      intervalMs: 20_000,
    },
  );

  const handleTripFormChange = (field: keyof typeof EMPTY_TRIP_FORM, value: string) => {
    setTripForm((currentForm) => ({
      ...currentForm,
      [field]: value,
      ...(field === 'routeMode' && value === TripRouteMode.DirectRoute
        ? { detourSurchargeReference: '0' }
        : {}),
    }));
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
      setTripSuccessMessage(response.message);
      setTripForm(EMPTY_TRIP_FORM);
    } catch (error) {
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
      setRequestErrorMessage(getApiErrorMessage(error, 'No fue posible cancelar la solicitud.'));
      await refreshTripsData();
    } finally {
      setIsMutatingRequestId(null);
    }
  };

  const defaultMembershipId = authSession?.user.memberships.find((membership) => membership.isDefault)?.id
    ?? authSession?.user.memberships[0]?.id;
  const driverStatus =
    vehicleOverview?.membership?.effectiveDriverVerificationStatus
    ?? vehicleOverview?.membership?.driverVerificationStatus
    ?? DriverVerificationStatus.NotRequested;
  const licenseStatus = vehicleOverview?.membership?.licenseStatus ?? DriverLicenseStatus.Missing;
  const activeVehicles = (vehicleOverview?.vehicles ?? []).filter((vehicle) => vehicle.isActive);
  const canCreateTrips = driverStatus === DriverVerificationStatus.Approved && activeVehicles.length > 0;
  const driverLicenseAlertMessage = getDriverLicenseAlertMessage(
    licenseStatus,
    vehicleOverview?.membership?.licenseExpiresInDays,
  );
  const visibleAvailableTrips = availableTrips.filter(
    (trip) => trip.driverMembershipId !== defaultMembershipId,
  );
  const activeFiltersCount = countActiveFilters(tripFilters);

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

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar-title">Viajes</h1>
          <p className="topbar-subtitle">
            Administra tus viajes como conductor y revisa las solicitudes disponibles dentro de tu institucion.
          </p>
        </div>
        <div className="topbar-actions">
          <Button
            disabled={isRefreshingData}
            onClick={() => void refreshTripsData(true)}
            variant="secondary"
          >
            {isRefreshingData ? 'Actualizando...' : 'Actualizar'}
          </Button>
          {activeFiltersCount > 0 ? (
            <span className="topbar-badge">{activeFiltersCount} filtros activos</span>
          ) : null}
          <StatusPill
            label={getDriverStatusLabel(driverStatus)}
            tone={getDriverStatusTone(driverStatus)}
          />
        </div>
      </header>

      <section className="content-grid">
        <div className="metrics-grid">
          <InfoCard
            description="Incluye borradores, publicados, viajes en curso y viajes ya cerrados."
            label="Mis viajes"
            value={`${myTrips.length}`}
          />
          <InfoCard
            description="Estos son los viajes publicados por otros usuarios de tu misma institucion."
            label="Viajes disponibles"
            value={`${visibleAvailableTrips.length}`}
          />
          <InfoCard
            description="Reune solicitudes recibidas como conductor y solicitudes que hiciste como pasajero."
            label="Solicitudes activas"
            value={`${incomingRequests.length + myRequests.length}`}
          />
        </div>

        <TripFiltersPanel
          isSubmitting={isFiltering}
          onApply={handleApplyFilters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
          values={filterFormValues}
        />

        {!canCreateTrips ? (
          <div className="form-helper">
            {licenseStatus === DriverLicenseStatus.Expired
              ? 'Tu licencia vencio. Debes renovarla antes de crear, publicar o iniciar viajes.'
              : 'Para crear viajes necesitas tener estado de conductor aprobado y al menos un vehiculo activo.'}
          </div>
        ) : null}

        {driverLicenseAlertMessage ? (
          <div className="form-helper">
            {driverLicenseAlertMessage}
          </div>
        ) : null}

        {tripErrorMessage ? <div className="form-error">{tripErrorMessage}</div> : null}
        {tripSuccessMessage ? <div className="form-success">{tripSuccessMessage}</div> : null}
        {requestErrorMessage ? <div className="form-error">{requestErrorMessage}</div> : null}
        {requestSuccessMessage ? <div className="form-success">{requestSuccessMessage}</div> : null}

        <div className="page-grid page-grid-wide">
          <TripCreationForm
            disabled={!canCreateTrips}
            errorMessage={null}
            isSubmitting={isCreatingTrip}
            onChange={handleTripFormChange}
            onSubmit={handleCreateTrip}
            successMessage={null}
            values={tripForm}
            vehicles={activeVehicles}
          />

          <article className="panel panel-stack">
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

                  return (
                  <div key={trip.id} className="list-card">
                    <div className="list-card-header">
                      <strong>{trip.originLabel} -&gt; {trip.destinationLabel}</strong>
                      <StatusPill
                        label={getTripStatusLabel(trip.status)}
                        tone={getTripStatusTone(trip.status)}
                      />
                    </div>
                    <p className="panel-text">
                      {formatDateTime(trip.departureAt)} | {trip.vehicleDisplayName} | {trip.vehiclePlate}
                    </p>
                    <p className="panel-text">
                      {getTripRouteModeLabel(trip.routeMode)} | Cupos {trip.availableSeats}/{trip.seatCount}
                    </p>
                    <p className="panel-text">
                      Tipo: {getVehicleTypeLabel(trip.vehicleTypeSnapshot)} | Equipaje: {getLuggagePolicyLabel(trip.luggagePolicySnapshot)}
                    </p>
                    {trip.status === TripStatus.Cancelled && trip.cancellationTiming ? (
                      <div className="button-row">
                        <StatusPill
                          label={getCancellationTimingLabel(trip.cancellationTiming) ?? 'Cancelacion'}
                          tone={getCancellationTimingTone(trip.cancellationTiming)}
                        />
                      </div>
                    ) : null}
                    {licenseStatus === DriverLicenseStatus.Expired &&
                    (trip.status === TripStatus.Draft ||
                      trip.status === TripStatus.Published ||
                      trip.status === TripStatus.Full) ? (
                      <p className="panel-text">
                        No puedes publicar ni iniciar este viaje mientras tu licencia siga vencida.
                      </p>
                    ) : null}
                    {(trip.status === TripStatus.Published || trip.status === TripStatus.Full) &&
                    startAvailabilityMessage ? (
                      <p className="panel-text">
                        {startAvailabilityMessage}
                      </p>
                    ) : null}
                    <div className="button-row">
                      {trip.status === TripStatus.Draft ? (
                        <Button
                          disabled={isMutatingTripId === trip.id || licenseStatus === DriverLicenseStatus.Expired}
                          onClick={() => void handleTripAction(trip.id, 'publish')}
                          variant="primary"
                        >
                          Publicar
                        </Button>
                      ) : null}
                      {(trip.status === TripStatus.Published || trip.status === TripStatus.Full) ? (
                        <Button
                          disabled={
                            isMutatingTripId === trip.id ||
                            licenseStatus === DriverLicenseStatus.Expired ||
                            !canStartTripNow(trip.departureAt, trip.estimatedArrivalAt)
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
                      {trip.status !== TripStatus.Completed &&
                      trip.status !== TripStatus.InProgress &&
                      trip.status !== TripStatus.Cancelled ? (
                        <Button
                          disabled={isMutatingTripId === trip.id}
                          onClick={() => void handleTripAction(trip.id, 'cancel')}
                          variant="ghost"
                        >
                          Cancelar
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <p className="panel-text">
                No hay viajes propios con los filtros actuales. Puedes limpiar los filtros o crear uno nuevo.
              </p>
            )}
          </article>
        </div>

        <div className="page-grid page-grid-wide">
          <article className="panel panel-stack">
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
                    {request.status === TripRequestStatus.Pending &&
                    request.tripStatus === TripStatus.Full ? (
                      <p className="panel-text">
                        El viaje ya completo sus cupos. Puedes rechazar esta solicitud o esperar a que se libere uno.
                      </p>
                    ) : null}
                    {request.status === TripRequestStatus.Pending &&
                    request.tripStatus !== TripStatus.Published &&
                    request.tripStatus !== TripStatus.Full ? (
                      <p className="panel-text">
                        Esta solicitud quedo desactualizada porque el viaje cambio de estado. La vista se sincronizara automaticamente.
                      </p>
                    ) : null}
                    {request.status === TripRequestStatus.Cancelled && request.cancellationTiming ? (
                      <div className="button-row">
                        <StatusPill
                          label={
                            getTripRequestCancellationTimingLabel(request.cancellationTiming) ??
                            'Cancelacion'
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

          <article className="panel panel-stack">
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
                            getTripRequestCancellationTimingLabel(request.cancellationTiming) ??
                            'Cancelacion'
                          }
                          tone={
                            request.cancellationTiming === CancellationTiming.Late
                              ? 'warning'
                              : 'neutral'
                          }
                        />
                      </div>
                    ) : null}
                    {(request.status === TripRequestStatus.Pending ||
                      request.status === TripRequestStatus.Accepted) &&
                    !canCancelOwnRequest(request) ? (
                      <p className="panel-text">
                        Esta solicitud ya no puede cancelarse porque el viaje cambio de estado y la pantalla se actualizara automaticamente.
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
        </div>

        <article className="panel panel-stack">
          <div className="section-heading">
            <h2 className="panel-title">Viajes disponibles en tu institucion</h2>
            <p className="section-heading-meta">{visibleAvailableTrips.length} resultados</p>
          </div>
          {visibleAvailableTrips.length ? (
            <div className="list-stack">
              {visibleAvailableTrips.map((trip) => {
                const draft = requestDrafts[trip.id] ?? EMPTY_REQUEST_DRAFT;
                const hasActiveRequest = myRequests.some(
                  (request) =>
                    request.tripId === trip.id &&
                    (request.status === TripRequestStatus.Pending ||
                      request.status === TripRequestStatus.Accepted),
                );
                const canSubmitRequest = canCreateRequestForTrip(trip, hasActiveRequest);

                return (
                  <div key={trip.id} className="list-card list-card-strong">
                    <div className="list-card-header">
                      <strong>{trip.originLabel} -&gt; {trip.destinationLabel}</strong>
                      <StatusPill
                        label={getTripStatusLabel(trip.status)}
                        tone={getTripStatusTone(trip.status)}
                      />
                    </div>
                    <p className="panel-text">
                      Conductor: {trip.driverFullName} | Salida: {formatDateTime(trip.departureAt)}
                    </p>
                    <p className="panel-text">
                      {getTripRouteModeLabel(trip.routeMode)} | Cupos {trip.availableSeats}/{trip.seatCount}
                    </p>
                    <p className="panel-text">
                      Tipo: {getVehicleTypeLabel(trip.vehicleTypeSnapshot)} | Precio base: ${trip.basePriceReference.toFixed(2)}
                    </p>
                    {trip.detourSurchargeReference ? (
                      <p className="panel-text">
                        Recargo por desvio: ${trip.detourSurchargeReference.toFixed(2)}
                      </p>
                    ) : null}
                    {trip.status === TripStatus.Full ? (
                      <p className="panel-text">
                        Este viaje ya completo sus cupos. Si se libera uno, podras solicitarlo al actualizar la vista.
                      </p>
                    ) : null}

                    {trip.routeMode === TripRouteMode.PlannedDetour ? (
                      <div className="form-grid form-grid-4 compact-grid">
                        <InputField
                          label="Lat. recogida"
                          onChange={(event) => handleRequestDraftChange(trip.id, 'requestedPickupLatitude', event.target.value)}
                          type="number"
                          value={draft.requestedPickupLatitude}
                        />
                        <InputField
                          label="Long. recogida"
                          onChange={(event) => handleRequestDraftChange(trip.id, 'requestedPickupLongitude', event.target.value)}
                          type="number"
                          value={draft.requestedPickupLongitude}
                        />
                        <InputField
                          label="Lat. destino"
                          onChange={(event) => handleRequestDraftChange(trip.id, 'requestedDropoffLatitude', event.target.value)}
                          type="number"
                          value={draft.requestedDropoffLatitude}
                        />
                        <InputField
                          label="Long. destino"
                          onChange={(event) => handleRequestDraftChange(trip.id, 'requestedDropoffLongitude', event.target.value)}
                          type="number"
                          value={draft.requestedDropoffLongitude}
                        />
                      </div>
                    ) : null}

                    <TextareaField
                      label="Mensaje para el conductor"
                      onChange={(event) => handleRequestDraftChange(trip.id, 'requestMessage', event.target.value)}
                      placeholder="Comentario opcional para el conductor"
                      rows={3}
                      value={draft.requestMessage}
                    />

                    <div className="button-row">
                      <Button
                        disabled={!canSubmitRequest || isMutatingRequestId === trip.id}
                        onClick={() => void handleCreateRequest(trip)}
                      >
                        {hasActiveRequest
                          ? 'Ya solicitaste este viaje'
                          : trip.status === TripStatus.Full
                            ? 'Sin cupos disponibles'
                            : 'Solicitar cupo'}
                      </Button>
                    </div>
                  </div>
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
    </>
  );
}
