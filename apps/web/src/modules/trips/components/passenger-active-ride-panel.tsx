import { TripRequestStatus, TripStatus } from '@saferidepro/shared-types';

import { Button } from '../../../components/ui/button';
import { StatusPill } from '../../../components/ui/status-pill';
import { getTripRequestStatusLabel, getTripRequestStatusTone } from '../../trip-requests/lib/trip-request-labels';
import {
  getTripCompletionOverdueMessage,
  getTripStatusLabel,
  getTripStatusTone,
} from '../lib/trip-labels';
import type { TripRequestRecord } from '../../trip-requests/types/trip-request';

type PassengerActiveRidePanelProps = {
  myRequests: TripRequestRecord[];
  isMutatingRequestId: string | null;
  canCancelOwnRequest: (request: TripRequestRecord) => boolean;
  onCancelMyRequest: (requestId: string) => void;
};

export function PassengerActiveRidePanel({
  myRequests,
  isMutatingRequestId,
  canCancelOwnRequest,
  onCancelMyRequest,
}: PassengerActiveRidePanelProps) {
  const activeRide = selectPrimaryAcceptedRide(myRequests);

  if (!activeRide) {
    return (
      <article className="ride-companion-panel ride-companion-panel-empty">
        <div className="ride-companion-copy">
          <p className="section-label">Ejecucion</p>
          <h2 className="panel-title">Vista del pasajero confirmado</h2>
        </div>
      </article>
    );
  }

  const canCancel = canCancelOwnRequest(activeRide);
  const overdueMessage = getTripCompletionOverdueMessage(
    activeRide.tripStatus,
    activeRide.tripEstimatedArrivalAt,
  );
  const rideGuidance = getPassengerGuidance(activeRide.tripStatus);
  const rideSteps = buildPassengerRideSteps(activeRide.tripStatus);

  return (
    <article className="ride-companion-panel">
      <div className="ride-companion-header">
        <div className="ride-companion-copy">
          <p className="section-label">Ejecucion</p>
          <h2 className="ride-companion-title">Mi trayecto activo</h2>
        </div>
        <div className="ride-companion-badges">
          <StatusPill
            label={getTripStatusLabel(activeRide.tripStatus)}
            tone={getTripStatusTone(activeRide.tripStatus)}
          />
          <StatusPill
            label={getTripRequestStatusLabel(activeRide.status)}
            tone={getTripRequestStatusTone(activeRide.status)}
          />
        </div>
      </div>

      <div className="trip-command-phase-strip" aria-label="Fases del trayecto del pasajero">
        {rideSteps.map((step) => (
          <div
            key={step.id}
            className={[
              'trip-command-phase-pill',
              step.isCurrent ? 'trip-command-phase-pill-current' : null,
              step.isComplete ? 'trip-command-phase-pill-complete' : null,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span>{step.index}</span>
            <strong>{step.label}</strong>
          </div>
        ))}
      </div>

      <div className="ride-companion-grid">
        <div className="ride-companion-main">
          <div className="ride-companion-hero">
            <strong>{activeRide.tripOriginLabel} -&gt; {activeRide.tripDestinationLabel}</strong>
            <p>{activeRide.driverFullName}</p>
          </div>

          <div className="trip-command-chip-row">
            <span className="trip-command-chip">Salida {formatDateTime(activeRide.tripDepartureAt)}</span>
            <span className="trip-command-chip">Llegada {formatDateTime(activeRide.tripEstimatedArrivalAt)}</span>
            <span className="trip-command-chip">{getTripRequestStatusLabel(activeRide.status)}</span>
          </div>

          <div className="ride-companion-stat-grid">
            <RideStatCard label="Salida" value={formatDateTime(activeRide.tripDepartureAt)} />
            <RideStatCard
              label="Llegada estimada"
              value={formatDateTime(activeRide.tripEstimatedArrivalAt)}
            />
            <RideStatCard
              label="Estado del viaje"
              value={getTripStatusLabel(activeRide.tripStatus)}
            />
            <RideStatCard
              label="Tu solicitud"
              value={getTripRequestStatusLabel(activeRide.status)}
            />
          </div>

          <div className="ride-companion-guidance">
            <strong>{rideGuidance.title}</strong>
            <p>{rideGuidance.description}</p>
          </div>

          {activeRide.requestMessage ? (
            <div className="ride-companion-note-card">
              <strong>Tu mensaje al conductor</strong>
              <p>{activeRide.requestMessage}</p>
            </div>
          ) : null}

          {activeRide.reviewNote ? (
            <div className="ride-companion-note-card ride-companion-note-card-muted">
              <strong>Nota operativa</strong>
              <p>{activeRide.reviewNote}</p>
            </div>
          ) : null}

          {overdueMessage ? (
            <div className="ride-companion-note-card ride-companion-note-card-warning">
              <strong>Revision del trayecto</strong>
              <p>{overdueMessage}</p>
            </div>
          ) : null}
        </div>

        <div className="ride-companion-side">
          <div className="ride-companion-checklist">
            <div className="ride-companion-section-heading">
              <strong>Estado rapido</strong>
              <span>Pasajero</span>
            </div>
            <div className="ride-companion-summary-grid">
              <RideSummaryTile label="Conductor" value={activeRide.driverFullName} />
              <RideSummaryTile label="Estado" value={getTripStatusLabel(activeRide.tripStatus)} />
              <RideSummaryTile label="Solicitud" value={getTripRequestStatusLabel(activeRide.status)} />
              <RideSummaryTile label="Cancelacion" value={canCancel ? 'Disponible' : 'Bloqueada'} />
            </div>
          </div>

          {canCancel ? (
            <div className="ride-companion-actions">
              <Button
                disabled={isMutatingRequestId === activeRide.id}
                onClick={() => onCancelMyRequest(activeRide.id)}
                variant="ghost"
              >
                Cancelar mi solicitud
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function RideStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="ride-companion-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RideSummaryTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="trip-command-summary-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function selectPrimaryAcceptedRide(myRequests: TripRequestRecord[]): TripRequestRecord | null {
  return (
    [...myRequests]
      .filter(
        (request) =>
          request.status === TripRequestStatus.Accepted
          && (request.tripStatus === TripStatus.InProgress
            || request.tripStatus === TripStatus.Full
            || request.tripStatus === TripStatus.Published),
      )
      .sort((left, right) => {
        const priorityDiff = getRidePriority(left.tripStatus) - getRidePriority(right.tripStatus);

        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        return new Date(left.tripDepartureAt).getTime() - new Date(right.tripDepartureAt).getTime();
      })[0] ?? null
  );
}

function getRidePriority(status: TripStatus): number {
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

function buildPassengerRideSteps(status: TripStatus): Array<{
  id: string;
  index: string;
  label: string;
  isCurrent: boolean;
  isComplete: boolean;
}> {
  const currentIndex = getPassengerRideStepIndex(status);

  return [
    { id: 'accepted', index: '01', label: 'Confirmado', isCurrent: currentIndex === 0, isComplete: currentIndex > 0 },
    { id: 'ready', index: '02', label: 'Salida', isCurrent: currentIndex === 1, isComplete: currentIndex > 1 },
    { id: 'in-progress', index: '03', label: 'En curso', isCurrent: currentIndex === 2, isComplete: currentIndex > 2 },
    { id: 'closed', index: '04', label: 'Cierre', isCurrent: currentIndex === 3, isComplete: currentIndex > 3 },
  ];
}

function getPassengerRideStepIndex(status: TripStatus): number {
  switch (status) {
    case TripStatus.Published:
    case TripStatus.Full:
      return 1;
    case TripStatus.InProgress:
      return 2;
    case TripStatus.Completed:
    case TripStatus.Cancelled:
      return 3;
    default:
      return 0;
  }
}

function getPassengerGuidance(status: TripStatus): { title: string; description: string } {
  switch (status) {
    case TripStatus.Published:
      return {
        title: 'Prepararte para la salida',
        description: 'Tu cupo ya esta confirmado. Mantente atento a la hora programada y al panel de seguimiento.',
      };
    case TripStatus.Full:
      return {
        title: 'Trayecto listo para arrancar',
        description: 'El viaje ya completo sus cupos. El siguiente paso esperado es que el conductor lo inicie.',
      };
    case TripStatus.InProgress:
      return {
        title: 'Seguir el trayecto en curso',
        description: 'El viaje esta en ejecucion. Usa el seguimiento para entender el estado general del recorrido.',
      };
    default:
      return {
        title: 'Sin accion inmediata',
        description: 'No hay una operacion activa adicional para este trayecto.',
      };
  }
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
