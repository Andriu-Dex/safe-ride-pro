import {
  DriverLicenseStatus,
  getTripPostClosureSummary,
  TripRequestStatus,
  TripStatus,
} from '@saferidepro/shared-types';

import { Button } from '../../../components/ui/button';
import { DisclosurePanel } from '../../../components/ui/disclosure-panel';
import { StatusPill } from '../../../components/ui/status-pill';
import {
  canStartTripNow,
  getCancellationTimingLabel,
  getCancellationTimingTone,
  getTripCompletionOverdueMessage,
  getTripStartAvailabilityMessage,
  getTripStatusLabel,
  getTripStatusTone,
} from '../lib/trip-labels';
import type { TripRequestRecord } from '../../trip-requests/types/trip-request';
import type { LatestTripRouteTemplate, TripRecord } from '../types/trip';
import type { VehicleRecord } from '../../vehicles/types/vehicle';
import {
  getTripClosureIncidentLabel,
  getTripClosureIncidentTone,
  getTripClosureWindowCopy,
} from '../lib/trip-closure';
import { TripCreationForm } from './trip-creation-form';
import {
  TripClosureActionCenter,
  type TripClosureActionItem,
} from './trip-closure-action-center';
import { TripsEditorialEmptyState } from './trips-editorial-empty-state';
import { TripExecutionCommandCenter } from './trip-execution-command-center';
import {
  TripLiveTrackingPanel,
  type TripTrackingCandidate,
} from './trip-live-tracking-panel';
import { TripOverviewCard } from './trip-overview-card';
import { TripsWorkspaceSkeleton } from './trips-workspace-skeleton';
import type { TripFormValues } from './trips-workspace.types';

type TripsOperationWorkspaceProps = {
  myTrips: TripRecord[];
  licenseStatus: DriverLicenseStatus;
  blocksDriver: boolean;
  isMutatingTripId: string | null;
  onTripAction: (tripId: string, action: 'publish' | 'start' | 'complete' | 'cancel') => void;
  isCreateTripPanelOpen: boolean;
  onCreateTripPanelOpenChange: (nextOpen: boolean) => void;
  isLoadingLatestRoute: boolean;
  latestRouteTemplate: LatestTripRouteTemplate | null;
  canCreateTrips: boolean;
  isCreatingTrip: boolean;
  tripForm: TripFormValues;
  activeVehicles: VehicleRecord[];
  incomingRequests: TripRequestRecord[];
  onTripFormChange: (field: keyof TripFormValues, value: string) => void;
  onCreateTrip: (event: React.FormEvent<HTMLFormElement>) => void;
  onUseLatestRoute: () => void;
  isRefreshingData?: boolean;
  onOpenCreateTrip: () => void;
  accessToken?: string;
  realtimeStatusLabel: string;
  realtimeStatusTone: 'neutral' | 'success' | 'warning' | 'danger';
};

export function TripsOperationWorkspace({
  myTrips,
  licenseStatus,
  blocksDriver,
  isMutatingTripId,
  onTripAction,
  isCreateTripPanelOpen,
  onCreateTripPanelOpenChange,
  isLoadingLatestRoute,
  latestRouteTemplate,
  canCreateTrips,
  isCreatingTrip,
  tripForm,
  activeVehicles,
  incomingRequests,
  onTripFormChange,
  onCreateTrip,
  onUseLatestRoute,
  isRefreshingData = false,
  onOpenCreateTrip,
  accessToken,
  realtimeStatusLabel,
  realtimeStatusTone,
}: TripsOperationWorkspaceProps) {
  const trackingCandidates = buildDriverTrackingCandidates(myTrips);
  const closureItems = buildDriverClosureItems(myTrips, incomingRequests);

  return (
    <section className="trips-workspace-grid trips-operation-stack">
      {isRefreshingData ? <TripsWorkspaceSkeleton variant="operation" /> : null}

      <TripLiveTrackingPanel
        accessToken={accessToken}
        candidates={trackingCandidates}
        description="Seguimiento moderno del viaje para conductor: ruta planificada, estado operativo y hitos del trayecto en una sola vista."
        emptyDescription="Cuando tengas un viaje publicado, lleno o en curso, aqui aparecerá su seguimiento operativo con mapa y contexto en tiempo real."
        emptyTitle="Aun no tienes un trayecto para seguimiento activo"
        realtimeStatusLabel={realtimeStatusLabel}
        realtimeStatusTone={realtimeStatusTone}
        title="Seguimiento operativo"
      />

      <TripExecutionCommandCenter
        blocksDriver={blocksDriver}
        incomingRequests={incomingRequests}
        isMutatingTripId={isMutatingTripId}
        licenseStatus={licenseStatus}
        myTrips={myTrips}
        onTripAction={onTripAction}
      />

      <TripClosureActionCenter
        description="Los trayectos ya completados o con cierre operativo anomalo aparecen aqui con su ventana de reputacion activa para que no se te pase el seguimiento final."
        emptyDescription="Cuando completes un trayecto con pasajeros confirmados, aqui veras el recordatorio de cierre para calificar o escalar incidentes dentro del plazo."
        emptyTitle="No tienes cierres pendientes como conductor"
        items={closureItems}
        title="Cierre post-viaje del conductor"
      />

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
                          {completionOverdueMessage} Revisalo cuanto antes para evitar inconsistencias operativas.
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
                          || blocksDriver
                        }
                        onClick={() => onTripAction(trip.id, 'publish')}
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
                          || blocksDriver
                          || !canStartTripNow(trip.departureAt, trip.estimatedArrivalAt)
                        }
                        onClick={() => onTripAction(trip.id, 'start')}
                        title={startAvailabilityMessage ?? undefined}
                        variant="secondary"
                      >
                        Iniciar
                      </Button>
                    ) : null}
                    {trip.status === TripStatus.InProgress ? (
                      <Button
                        disabled={isMutatingTripId === trip.id}
                        onClick={() => onTripAction(trip.id, 'complete')}
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
                        onClick={() => onTripAction(trip.id, 'cancel')}
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
          <TripsEditorialEmptyState
            actionLabel="Crear mi primer viaje"
            description="Cuando registres tu primer viaje, aqui veras su progreso y podras gestionarlo en tiempo real."
            eyebrow="Operacion"
            onAction={onOpenCreateTrip}
            title="Tu panel de conduccion aun esta vacio"
          />
        )}
      </article>

      <DisclosurePanel
        className="trip-create-disclosure"
        defaultOpen={false}
        onOpenChange={onCreateTripPanelOpenChange}
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
          onChange={onTripFormChange}
          onSubmit={onCreateTrip}
          onUseLatestRoute={onUseLatestRoute}
          successMessage={null}
          values={tripForm}
          vehicles={activeVehicles}
        />
      </DisclosurePanel>
    </section>
  );
}

function buildDriverTrackingCandidates(myTrips: TripRecord[]): TripTrackingCandidate[] {
  return myTrips
    .filter(
      (trip) =>
        trip.status === TripStatus.Published
        || trip.status === TripStatus.Full
        || trip.status === TripStatus.InProgress,
    )
    .sort((left, right) => {
      const statusPriority = getTrackingPriority(left.status) - getTrackingPriority(right.status);

      if (statusPriority !== 0) {
        return statusPriority;
      }

      return new Date(left.departureAt).getTime() - new Date(right.departureAt).getTime();
    })
    .map((trip) => ({
      id: trip.id,
      tripId: trip.id,
      title: `${trip.originLabel} -> ${trip.destinationLabel}`,
      subtitle: `Conduces este trayecto con ${trip.vehicleDisplayName}`,
      status: trip.status,
      departureAt: trip.departureAt,
      estimatedArrivalAt: trip.estimatedArrivalAt,
      availableSeats: trip.availableSeats,
      seatCount: trip.seatCount,
    }));
}

function buildDriverClosureItems(
  myTrips: TripRecord[],
  incomingRequests: TripRequestRecord[],
): TripClosureActionItem[] {
  return myTrips
    .map((trip) => {
      const summary = getTripPostClosureSummary({
        status: trip.status,
        departureAt: trip.departureAt,
        estimatedArrivalAt: trip.estimatedArrivalAt,
        cancelledAt: trip.cancelledAt,
      });
      const acceptedPassengers = incomingRequests.filter(
        (request) => request.tripId === trip.id && request.status === TripRequestStatus.Accepted,
      );

      if (
        acceptedPassengers.length === 0 ||
        (!summary.canCreateRating && !summary.canCreateIncidentReport)
      ) {
        return null;
      }

      const actionParts: string[] = [];

      if (summary.canCreateRating) {
        actionParts.push(
          `calificar a ${acceptedPassengers.length} pasajero${acceptedPassengers.length === 1 ? '' : 's'}`,
        );
      }

      if (summary.canCreateIncidentReport) {
        actionParts.push('registrar un incidente si algo salio mal');
      }

      return {
        id: trip.id,
        title: `${trip.originLabel} -> ${trip.destinationLabel}`,
        subtitle: `Como conductor • ${acceptedPassengers.length} participante${acceptedPassengers.length === 1 ? '' : 's'} confirmado${acceptedPassengers.length === 1 ? '' : 's'}`,
        summary: `Este cierre sigue activo. Puedes ${actionParts.join(' y ')} desde Confianza antes de que expire la ventana operativa.`,
        windowLabel: getTripClosureWindowCopy(summary),
        tripStatusLabel: getTripStatusLabel(trip.status),
        tripStatusTone: getTripStatusTone(trip.status),
        incidentLabel: summary.incidentType
          ? getTripClosureIncidentLabel(summary.incidentType)
          : null,
        incidentTone: summary.incidentType
          ? getTripClosureIncidentTone(summary.incidentType)
          : 'neutral',
      } satisfies TripClosureActionItem;
    })
    .filter((item): item is TripClosureActionItem => item !== null)
    .sort((left, right) => left.title.localeCompare(right.title));
}

function getTrackingPriority(status: TripStatus): number {
  switch (status) {
    case TripStatus.InProgress:
      return 0;
    case TripStatus.Full:
      return 1;
    case TripStatus.Published:
      return 2;
    default:
      return 3;
  }
}
