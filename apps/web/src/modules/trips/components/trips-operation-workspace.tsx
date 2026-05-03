import {
  DriverLicenseStatus,
  getTripPostClosureSummary,
  TripRequestStatus,
  TripStatus,
} from '@saferidepro/shared-types';

import { Button } from '../../../components/ui/button';
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
import type { TripRecord } from '../types/trip';
import {
  getTripClosureIncidentLabel,
  getTripClosureIncidentTone,
  getTripClosureWindowCopy,
} from '../lib/trip-closure';
import type { TripClosureActionItem } from './trip-closure-action-center';
import { TripsEditorialEmptyState } from './trips-editorial-empty-state';
import { TripExecutionCommandCenter } from './trip-execution-command-center';
import { TripOverviewCard } from './trip-overview-card';
import { TripsWorkspaceSkeleton } from './trips-workspace-skeleton';

type TripsOperationWorkspaceProps = {
  myTrips: TripRecord[];
  licenseStatus: DriverLicenseStatus;
  blocksDriver: boolean;
  isMutatingTripId: string | null;
  isMutatingRequestId: string | null;
  noShowNotes: Record<string, string>;
  tripClosureNotes: Record<string, string>;
  onTripAction: (
    tripId: string,
    action: 'publish' | 'start' | 'complete' | 'cancel',
    options?: {
      closureNote?: string;
    },
  ) => void;
  canCreateTrips: boolean;
  incomingRequests: TripRequestRecord[];
  isRefreshingData?: boolean;
  onNavigateToCreateTrip: () => void;
  onOpenRequests: () => void;
  onNoShowNoteChange: (requestId: string, value: string) => void;
  onMarkPassengerBoarded: (requestId: string) => void;
  onMarkPassengerDroppedOff: (requestId: string) => void;
  onMarkNoShow: (requestId: string) => void;
  onTripClosureNoteChange: (tripId: string, value: string) => void;
};

export function TripsOperationWorkspace({
  myTrips,
  licenseStatus,
  blocksDriver,
  isMutatingTripId,
  isMutatingRequestId,
  noShowNotes,
  tripClosureNotes,
  onTripAction,
  canCreateTrips,
  incomingRequests,
  isRefreshingData = false,
  onNavigateToCreateTrip,
  onOpenRequests,
  onNoShowNoteChange,
  onMarkPassengerBoarded,
  onMarkPassengerDroppedOff,
  onMarkNoShow,
  onTripClosureNoteChange,
}: TripsOperationWorkspaceProps) {
  const closureItems = buildDriverClosureItems(myTrips, incomingRequests);

  return (
    <section className="trips-workspace-grid trips-operation-stack">
      {isRefreshingData ? <TripsWorkspaceSkeleton variant="operation" /> : null}

      <TripExecutionCommandCenter
        blocksDriver={blocksDriver}
        incomingRequests={incomingRequests}
        isMutatingRequestId={isMutatingRequestId}
        isMutatingTripId={isMutatingTripId}
        licenseStatus={licenseStatus}
        myTrips={myTrips}
        noShowNotes={noShowNotes}
        onMarkNoShow={onMarkNoShow}
        onMarkPassengerBoarded={onMarkPassengerBoarded}
        onMarkPassengerDroppedOff={onMarkPassengerDroppedOff}
        onNoShowNoteChange={onNoShowNoteChange}
        onOpenRequests={onOpenRequests}
        onTripAction={onTripAction}
        onTripClosureNoteChange={onTripClosureNoteChange}
        tripClosureNotes={tripClosureNotes}
      />

      <article className="panel panel-stack trips-stream-panel">
        <div className="section-heading">
          <div>
            <h2 className="panel-title">Mis viajes</h2>
            <p className="section-heading-meta">{myTrips.length} resultados</p>
          </div>
          <Button
            disabled={!canCreateTrips}
            onClick={onNavigateToCreateTrip}
            variant="secondary"
          >
            Nuevo viaje
          </Button>
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
                          Licencia vencida.
                        </p>
                      ) : null}
                      {(trip.status === TripStatus.Published || trip.status === TripStatus.Full)
                      && startAvailabilityMessage ? (
                        <p className="panel-text">{startAvailabilityMessage}</p>
                      ) : null}
                      {completionOverdueMessage ? (
                        <p className="panel-text">
                          {completionOverdueMessage}
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
                        onClick={() => onTripAction(trip.id, 'complete', {
                          closureNote: tripClosureNotes[trip.id],
                        })}
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
            actionLabel={canCreateTrips ? 'Crear mi primer viaje' : undefined}
            eyebrow="Operacion"
            onAction={canCreateTrips ? onNavigateToCreateTrip : undefined}
            title="Tu panel de conduccion aun esta vacio"
          />
        )}
      </article>

      {closureItems.length ? (
        <article className="panel panel-stack trips-stream-panel">
          <div className="section-heading">
            <h2 className="panel-title">Pendientes post-viaje</h2>
          </div>
          <div className="list-stack">
            {closureItems.map((item) => (
              <div key={item.id} className="list-card">
                <div className="list-card-header">
                  <strong>{item.title}</strong>
                  <StatusPill
                    label={item.tripStatusLabel}
                    tone={item.tripStatusTone}
                  />
                </div>
                <p className="panel-text">{item.summary}</p>
                <div className="button-row">
                  {item.actions.map((action) => (
                    <Button
                      key={action.href}
                      onClick={() => {
                        window.location.href = action.href;
                      }}
                      variant={action.variant ?? 'secondary'}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>
      ) : null}
    </section>
  );
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
        completedAt: trip.completedAt,
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

      const actions: TripClosureActionItem['actions'] = [];

      if (summary.canCreateRating) {
        actions.push({
          label: 'Ir a calificaciones',
          href: buildTrustClosureHref({
            focus: 'rating',
            tripId: trip.id,
          }),
        });
      }

      if (summary.canCreateIncidentReport) {
        actions.push({
          label: 'Ir a reportes',
          href: buildTrustClosureHref({
            focus: 'report',
            tripId: trip.id,
          }),
          variant: summary.canCreateRating ? 'ghost' : 'secondary',
        });
      }

      return {
        id: trip.id,
        title: `${trip.originLabel} -> ${trip.destinationLabel}`,
        subtitle: `Conductor | ${acceptedPassengers.length} participante${acceptedPassengers.length === 1 ? '' : 's'} confirmado${acceptedPassengers.length === 1 ? '' : 's'}`,
        summary: trip.closureNote
          ? `${actionParts.join(' y ')}. Nota de cierre: ${trip.closureNote}`
          : actionParts.join(' y '),
        windowLabel: getTripClosureWindowCopy(summary),
        tripStatusLabel: getTripStatusLabel(trip.status),
        tripStatusTone: getTripStatusTone(trip.status),
        incidentLabel: summary.incidentType
          ? getTripClosureIncidentLabel(summary.incidentType)
          : null,
        incidentTone: summary.incidentType
          ? getTripClosureIncidentTone(summary.incidentType)
          : 'neutral',
        actions,
      } satisfies TripClosureActionItem;
    })
    .filter((item): item is TripClosureActionItem => item !== null)
    .sort((left, right) => left.title.localeCompare(right.title));
}

function buildTrustClosureHref({
  focus,
  tripId,
}: {
  focus: 'rating' | 'report';
  tripId: string;
}): string {
  const searchParams = new URLSearchParams({
    focus,
    tripId,
  });

  return `/confianza?${searchParams.toString()}`;
}


