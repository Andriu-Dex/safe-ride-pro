import { CancellationTiming, TripRequestStatus, TripStatus } from '@saferidepro/shared-types';

import { Button } from '../../../components/ui/button';
import { StatusPill } from '../../../components/ui/status-pill';
import { TextareaField } from '../../../components/ui/textarea-field';
import {
  getTripRequestCancellationTimingLabel,
  getTripRequestStatusLabel,
  getTripRequestStatusTone,
} from '../../trip-requests/lib/trip-request-labels';
import type { TripRequestRecord } from '../../trip-requests/types/trip-request';
import {
  TripLiveTrackingPanel,
  type TripTrackingCandidate,
} from './trip-live-tracking-panel';
import { PassengerActiveRidePanel } from './passenger-active-ride-panel';
import { TripsEditorialEmptyState } from './trips-editorial-empty-state';
import { TripsWorkspaceSkeleton } from './trips-workspace-skeleton';

type TripsRequestsWorkspaceProps = {
  incomingRequests: TripRequestRecord[];
  myRequests: TripRequestRecord[];
  isMutatingRequestId: string | null;
  noShowNotes: Record<string, string>;
  defaultNoShowNote: string;
  canAcceptIncomingRequest: (request: TripRequestRecord) => boolean;
  canRejectIncomingRequest: (request: TripRequestRecord) => boolean;
  canMarkRequestAsNoShow: (request: TripRequestRecord) => boolean;
  canCancelOwnRequest: (request: TripRequestRecord) => boolean;
  onIncomingRequestAction: (requestId: string, action: 'accept' | 'reject') => void;
  onNoShowNoteChange: (requestId: string, value: string) => void;
  onMarkNoShow: (requestId: string) => void;
  onCancelMyRequest: (requestId: string) => void;
  isRefreshingData?: boolean;
  onExploreTrips: () => void;
  accessToken?: string;
  realtimeStatusLabel: string;
  realtimeStatusTone: 'neutral' | 'success' | 'warning' | 'danger';
};

export function TripsRequestsWorkspace({
  incomingRequests,
  myRequests,
  isMutatingRequestId,
  noShowNotes,
  defaultNoShowNote,
  canAcceptIncomingRequest,
  canRejectIncomingRequest,
  canMarkRequestAsNoShow,
  canCancelOwnRequest,
  onIncomingRequestAction,
  onNoShowNoteChange,
  onMarkNoShow,
  onCancelMyRequest,
  isRefreshingData = false,
  onExploreTrips,
  accessToken,
  realtimeStatusLabel,
  realtimeStatusTone,
}: TripsRequestsWorkspaceProps) {
  const passengerTrackingCandidates = buildPassengerTrackingCandidates(myRequests);

  return (
    <section className="trips-workspace-grid">
      {isRefreshingData ? <TripsWorkspaceSkeleton variant="requests" /> : null}

      <div className="trip-live-panel-span">
        <TripLiveTrackingPanel
          accessToken={accessToken}
          candidates={passengerTrackingCandidates}
          description="Seguimiento del trayecto para pasajero confirmado: ves la ruta prevista, el estado actual y los hitos del viaje sin depender todavia de GPS continuo."
          emptyDescription="Cuando una de tus solicitudes sea aceptada y el viaje quede proximo o en curso, aqui veras su panel de seguimiento."
          emptyTitle="Todavia no tienes un viaje confirmado para seguir"
          realtimeStatusLabel={realtimeStatusLabel}
          realtimeStatusTone={realtimeStatusTone}
          title="Seguimiento de mis trayectos"
        />
      </div>

      <div className="trip-live-panel-span">
        <PassengerActiveRidePanel
          canCancelOwnRequest={canCancelOwnRequest}
          isMutatingRequestId={isMutatingRequestId}
          myRequests={myRequests}
          onCancelMyRequest={onCancelMyRequest}
        />
      </div>

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
                      onNoShowNoteChange(request.id, event.target.value)
                    }
                    placeholder="Describe brevemente que el pasajero no se presento."
                    rows={2}
                    value={noShowNotes[request.id] ?? defaultNoShowNote}
                  />
                ) : null}
                <div className="button-row">
                  {canAcceptIncomingRequest(request) ? (
                    <Button
                      disabled={isMutatingRequestId === request.id}
                      onClick={() => onIncomingRequestAction(request.id, 'accept')}
                    >
                      Aceptar
                    </Button>
                  ) : null}
                  {canRejectIncomingRequest(request) ? (
                    <Button
                      disabled={isMutatingRequestId === request.id}
                      onClick={() => onIncomingRequestAction(request.id, 'reject')}
                      variant="secondary"
                    >
                      Rechazar
                    </Button>
                  ) : null}
                  {canMarkRequestAsNoShow(request) ? (
                    <Button
                      disabled={isMutatingRequestId === request.id}
                      onClick={() => onMarkNoShow(request.id)}
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
          <TripsEditorialEmptyState
            description="Aun no tienes pasajeros solicitando tus rutas. Publica mas viajes para aumentar visibilidad."
            eyebrow="Solicitudes recibidas"
            title="Nada por aprobar por ahora"
          />
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
                      onClick={() => onCancelMyRequest(request.id)}
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
          <TripsEditorialEmptyState
            actionLabel="Explorar viajes"
            description="Explora rutas publicadas por otros conductores y envia solicitudes segun tus horarios."
            eyebrow="Mis solicitudes"
            onAction={onExploreTrips}
            title="Aun no has solicitado un viaje"
          />
        )}
      </article>
    </section>
  );
}

function buildPassengerTrackingCandidates(myRequests: TripRequestRecord[]): TripTrackingCandidate[] {
  return myRequests
    .filter(
      (request) =>
        request.status === TripRequestStatus.Accepted
        && (request.tripStatus === TripStatus.Published
          || request.tripStatus === TripStatus.Full
          || request.tripStatus === TripStatus.InProgress),
    )
    .sort((left, right) => {
      const statusPriority =
        getTrackingPriority(left.tripStatus) - getTrackingPriority(right.tripStatus);

      if (statusPriority !== 0) {
        return statusPriority;
      }

      return new Date(left.tripDepartureAt).getTime() - new Date(right.tripDepartureAt).getTime();
    })
    .map((request) => ({
      id: request.id,
      tripId: request.tripId,
      title: `${request.tripOriginLabel} -> ${request.tripDestinationLabel}`,
      subtitle: `Conductor asignado: ${request.driverFullName}`,
      status: request.tripStatus,
      departureAt: request.tripDepartureAt,
      estimatedArrivalAt: request.tripEstimatedArrivalAt,
      availableSeats: request.tripAvailableSeats,
      seatCount: request.tripSeatCount,
    }));
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

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-EC');
}
