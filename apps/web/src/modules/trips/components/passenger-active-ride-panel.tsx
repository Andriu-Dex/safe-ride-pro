import {
  isTripPaymentClosed,
  isTripPaymentSettled,
  TripRequestExecutionStatus,
  TripRequestStatus,
  TripStatus,
} from '@saferidepro/shared-types';

import { Button } from '../../../components/ui/button';
import { StatusPill } from '../../../components/ui/status-pill';
import {
  getTripRequestExecutionStatusLabel,
  getTripRequestExecutionStatusTone,
  getTripRequestStatusLabel,
  getTripRequestStatusTone,
} from '../../trip-requests/lib/trip-request-labels';
import type { TripRequestRecord } from '../../trip-requests/types/trip-request';
import {
  formatTripPaymentAmount,
  getPaymentProviderLabel,
  getTripPaymentStatusLabel,
  getTripPaymentStatusTone,
} from '../../payments/lib/payment-labels';
import {
  getTripCompletionOverdueMessage,
  getTripRouteModeLabel,
  getTripStatusLabel,
  getTripStatusTone,
} from '../lib/trip-labels';

type PassengerActiveRidePanelProps = {
  myRequests: TripRequestRecord[];
  isMutatingRequestId: string | null;
  isMutatingPaymentId: string | null;
  canCancelOwnRequest: (request: TripRequestRecord) => boolean;
  onCancelMyRequest: (requestId: string) => void;
  onCreatePaymentCheckout: (paymentId: string) => void;
  onRefreshPaymentStatus: (paymentId: string) => void;
};

export function PassengerActiveRidePanel({
  myRequests,
  isMutatingRequestId,
  isMutatingPaymentId,
  canCancelOwnRequest,
  onCancelMyRequest,
  onCreatePaymentCheckout,
  onRefreshPaymentStatus,
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
  const rideSteps = buildPassengerRideSteps(activeRide.tripStatus, activeRide.executionStatus);
  const passengerChecklist = buildPassengerChecklist(
    activeRide.tripStatus,
    activeRide.executionStatus,
    canCancel,
  );
  const pickupCoordinates = formatCoordinatePair(
    activeRide.requestedPickupLatitude,
    activeRide.requestedPickupLongitude,
  );
  const dropoffCoordinates = formatCoordinatePair(
    activeRide.requestedDropoffLatitude,
    activeRide.requestedDropoffLongitude,
  );
  const payment = activeRide.payment;
  const canCreatePaymentCheckout =
    payment !== null
    && !isTripPaymentSettled(payment.status)
    && !isTripPaymentClosed(payment.status);
  const paymentUpdatedLabel = payment ? formatDateTime(payment.updatedAt) : null;

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
          <StatusPill
            label={getTripRequestExecutionStatusLabel(activeRide.executionStatus)}
            tone={getTripRequestExecutionStatusTone(activeRide.executionStatus)}
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
          <div className="ride-companion-hero ride-companion-hero-strong">
            <div className="ride-companion-hero-copy-block">
              <strong className="ride-companion-route-title">
                {activeRide.tripOriginLabel} -&gt; {activeRide.tripDestinationLabel}
              </strong>
              <p>{activeRide.driverFullName}</p>
            </div>

            <div className="trip-command-chip-row">
              <span className="trip-command-chip">Salida {formatDateTime(activeRide.tripDepartureAt)}</span>
              <span className="trip-command-chip">Llegada {formatDateTime(activeRide.tripEstimatedArrivalAt)}</span>
              <span className="trip-command-chip">{getTripRouteModeLabel(activeRide.tripRouteMode)}</span>
              <span className="trip-command-chip">
                {canCancel ? 'Cancelacion disponible' : 'Cancelacion cerrada'}
              </span>
            </div>
          </div>

          <div className="ride-companion-command-card">
            <div className="ride-companion-command-head">
              <div>
                <span className="ride-companion-command-kicker">Siguiente paso</span>
                <strong>{rideGuidance.title}</strong>
              </div>
              <StatusPill
                label={rideGuidance.badge}
                tone={rideGuidance.tone}
              />
            </div>
            <p>{rideGuidance.description}</p>
          </div>

          <div className="ride-companion-stat-grid">
            <RideStatCard label="Salida" value={formatDateTime(activeRide.tripDepartureAt)} />
            <RideStatCard
              label="Llegada estimada"
              value={formatDateTime(activeRide.tripEstimatedArrivalAt)}
            />
            <RideStatCard
              label="Modalidad"
              value={getTripRouteModeLabel(activeRide.tripRouteMode)}
            />
            <RideStatCard
              label="Cancelacion"
              value={canCancel ? 'Disponible' : 'No disponible'}
            />
            <RideStatCard
              label="Ejecucion"
              value={getTripRequestExecutionStatusLabel(activeRide.executionStatus)}
            />
          </div>

          {pickupCoordinates || dropoffCoordinates ? (
            <div className="ride-companion-location-grid">
              <RideLocationCard
                label="Tu recogida"
                value={pickupCoordinates ?? 'No personalizada'}
              />
              <RideLocationCard
                label="Tu destino"
                value={dropoffCoordinates ?? 'No personalizado'}
              />
            </div>
          ) : null}

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

          {payment ? (
            <div className="ride-companion-note-card">
              <div className="ride-companion-command-head">
                <div>
                  <span className="ride-companion-command-kicker">Pago del cupo</span>
                  <strong>{formatTripPaymentAmount(payment.amount, payment.currencyCode)}</strong>
                </div>
                <StatusPill
                  label={getTripPaymentStatusLabel(payment.status)}
                  tone={getTripPaymentStatusTone(payment.status)}
                />
              </div>
              <p>
                {getPaymentProviderLabel(payment.provider)}
                {payment.paidAt
                  ? ` | Confirmado ${formatDateTime(payment.paidAt)}`
                  : paymentUpdatedLabel
                    ? ` | Actualizado ${paymentUpdatedLabel}`
                    : ''}
              </p>
              <div className="button-row trip-request-action-row">
                {canCreatePaymentCheckout ? (
                  <Button
                    disabled={isMutatingPaymentId === payment.id}
                    onClick={() => onCreatePaymentCheckout(payment.id)}
                  >
                    {payment.checkoutUrl ? 'Abrir pago' : 'Pagar con PayPal'}
                  </Button>
                ) : null}
                {!isTripPaymentSettled(payment.status) ? (
                  <Button
                    disabled={isMutatingPaymentId === payment.id}
                    onClick={() => onRefreshPaymentStatus(payment.id)}
                    variant="secondary"
                  >
                    Actualizar pago
                  </Button>
                ) : null}
              </div>
            </div>
          ) : activeRide.status === TripRequestStatus.Accepted ? (
            <div className="ride-companion-note-card ride-companion-note-card-muted">
              <strong>Pago del cupo</strong>
              <p>Tu solicitud fue aceptada y el cobro aun se esta preparando.</p>
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
          <div className="ride-companion-checklist ride-companion-checklist-strong">
            <div className="ride-companion-section-heading">
              <strong>Estado rapido</strong>
              <span>Pasajero</span>
            </div>
            <div className="ride-companion-summary-grid">
              <RideSummaryTile label="Conductor" value={activeRide.driverFullName} />
              <RideSummaryTile label="Estado" value={getTripStatusLabel(activeRide.tripStatus)} />
              <RideSummaryTile label="Solicitud" value={getTripRequestStatusLabel(activeRide.status)} />
              <RideSummaryTile
                label="Ejecucion"
                value={getTripRequestExecutionStatusLabel(activeRide.executionStatus)}
              />
              <RideSummaryTile
                label="Ruta"
                value={getTripRouteModeLabel(activeRide.tripRouteMode)}
              />
            </div>
          </div>

          <div className="ride-companion-flow-card">
            <div className="ride-companion-section-heading">
              <strong>Checklist activo</strong>
              <span>{passengerChecklist.length} puntos</span>
            </div>
            <ul className="ride-companion-flow-list">
              {passengerChecklist.map((item) => (
                <li key={item.label} className="ride-companion-flow-item">
                  <StatusPill label={item.badge} tone={item.tone} />
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="ride-companion-actions ride-companion-actions-card">
            <div className="ride-companion-action-copy">
              <strong>{canCancel ? 'Aun puedes cancelar' : 'Solicitud bloqueada para cancelar'}</strong>
              <p>
                {canCancel
                  ? 'Usa esta accion solo si ya no tomaras el viaje.'
                  : 'El trayecto ya entro en una fase donde la cancelacion no esta disponible.'}
              </p>
            </div>
            {canCancel ? (
              <Button
                disabled={isMutatingRequestId === activeRide.id}
                onClick={() => onCancelMyRequest(activeRide.id)}
                variant="ghost"
              >
                Cancelar mi solicitud
              </Button>
            ) : null}
          </div>
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

function RideLocationCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="ride-companion-location-card">
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

function buildPassengerRideSteps(
  status: TripStatus,
  executionStatus: TripRequestExecutionStatus | null,
): Array<{
  id: string;
  index: string;
  label: string;
  isCurrent: boolean;
  isComplete: boolean;
}> {
  const currentIndex = getPassengerRideStepIndex(status, executionStatus);

  return [
    {
      id: 'accepted',
      index: '01',
      label: 'Confirmado',
      isCurrent: currentIndex === 0,
      isComplete: currentIndex > 0,
    },
    {
      id: 'ready',
      index: '02',
      label: 'Salida',
      isCurrent: currentIndex === 1,
      isComplete: currentIndex > 1,
    },
    {
      id: 'in-progress',
      index: '03',
      label: 'En curso',
      isCurrent: currentIndex === 2,
      isComplete: currentIndex > 2,
    },
    {
      id: 'closed',
      index: '04',
      label: 'Cierre',
      isCurrent: currentIndex === 3,
      isComplete: currentIndex > 3,
    },
  ];
}

function getPassengerRideStepIndex(
  status: TripStatus,
  executionStatus: TripRequestExecutionStatus | null,
): number {
  switch (status) {
    case TripStatus.Published:
    case TripStatus.Full:
      return 1;
    case TripStatus.InProgress:
      if (executionStatus === TripRequestExecutionStatus.DroppedOff) {
        return 3;
      }

      return executionStatus === TripRequestExecutionStatus.OnBoard ? 2 : 1;
    case TripStatus.Completed:
    case TripStatus.Cancelled:
      return 3;
    default:
      return 0;
  }
}

function getPassengerGuidance(status: TripStatus): {
  title: string;
  description: string;
  badge: string;
  tone: 'neutral' | 'success' | 'warning';
} {
  switch (status) {
    case TripStatus.Published:
      return {
        title: 'Prepararte para la salida',
        description: 'Tu cupo ya esta confirmado. Mantente atento a la hora programada y al panel de seguimiento.',
        badge: 'Previo a salida',
        tone: 'neutral',
      };
    case TripStatus.Full:
      return {
        title: 'Trayecto listo para arrancar',
        description: 'El viaje ya completo sus cupos. El siguiente cambio esperado es el inicio por parte del conductor.',
        badge: 'Listo',
        tone: 'success',
      };
    case TripStatus.InProgress:
      return {
        title: 'Seguir el trayecto en curso',
        description: 'El viaje esta en ejecucion. Usa el seguimiento para revisar el estado general del recorrido.',
        badge: 'En curso',
        tone: 'warning',
      };
    default:
      return {
        title: 'Sin accion inmediata',
        description: 'No hay una operacion activa adicional para este trayecto.',
        badge: 'Sin movimiento',
        tone: 'neutral',
      };
  }
}

function buildPassengerChecklist(
  status: TripStatus,
  executionStatus: TripRequestExecutionStatus | null,
  canCancel: boolean,
): Array<{
  label: string;
  description: string;
  badge: string;
  tone: 'neutral' | 'success' | 'warning';
}> {
  switch (status) {
    case TripStatus.Published:
      return [
        {
          label: 'Cupo confirmado',
          description: 'Tu solicitud ya fue aceptada por el conductor.',
          badge: 'Confirmado',
          tone: 'success',
        },
        {
          label: 'Salida pendiente',
          description: 'El conductor aun no inicia el viaje.',
          badge: 'Pendiente',
          tone: 'warning',
        },
        {
          label: 'Cancelacion',
          description: canCancel
            ? 'Todavia puedes cancelar si cambias de decision.'
            : 'La ventana de cancelacion ya no esta disponible.',
          badge: canCancel ? 'Disponible' : 'Cerrada',
          tone: canCancel ? 'neutral' : 'warning',
        },
      ];
    case TripStatus.Full:
      return [
        {
          label: 'Viaje completo',
          description: 'Los cupos del trayecto ya fueron ocupados.',
          badge: 'Completo',
          tone: 'success',
        },
        {
          label: 'Esperando inicio',
          description: 'La siguiente actualizacion esperada es el arranque del viaje.',
          badge: 'En espera',
          tone: 'warning',
        },
        {
          label: 'Cancelacion',
          description: canCancel
            ? 'Todavia puedes cancelar si necesitas liberar el cupo.'
            : 'La operacion ya no admite cancelacion desde tu lado.',
          badge: canCancel ? 'Disponible' : 'Cerrada',
          tone: canCancel ? 'neutral' : 'warning',
        },
      ];
    case TripStatus.InProgress:
      return [
        {
          label:
            executionStatus === TripRequestExecutionStatus.OnBoard
              ? 'Ya estas a bordo'
              : executionStatus === TripRequestExecutionStatus.DroppedOff
                ? 'Traslado completado'
                : 'Viaje iniciado',
          description:
            executionStatus === TripRequestExecutionStatus.OnBoard
              ? 'El conductor ya te marco dentro del vehiculo.'
              : executionStatus === TripRequestExecutionStatus.DroppedOff
                ? 'Tu cierre operativo ya fue registrado.'
                : 'El conductor ya inicio el trayecto y falta registrar tu abordaje.',
          badge:
            executionStatus === TripRequestExecutionStatus.DroppedOff
              ? 'Finalizado'
              : executionStatus === TripRequestExecutionStatus.OnBoard
                ? 'A bordo'
                : 'Activo',
          tone:
            executionStatus === TripRequestExecutionStatus.DroppedOff
              ? 'success'
              : executionStatus === TripRequestExecutionStatus.OnBoard
                ? 'success'
                : 'warning',
        },
        {
          label: 'Seguimiento habilitado',
          description: 'Puedes revisar la ruta planificada y el estado compartido.',
          badge: 'Visible',
          tone: 'success',
        },
        {
          label: 'Cierre posterior',
          description: 'Al terminar podras pasar a la fase de cierre y revision.',
          badge: 'Pendiente',
          tone: 'neutral',
        },
      ];
    default:
      return [
        {
          label: 'Sin movimiento activo',
          description: 'No hay una accion operativa inmediata disponible.',
          badge: 'En pausa',
          tone: 'neutral',
        },
      ];
  }
}

function formatCoordinatePair(
  latitude: number | null,
  longitude: number | null,
): string | null {
  if (latitude === null || longitude === null) {
    return null;
  }

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
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
