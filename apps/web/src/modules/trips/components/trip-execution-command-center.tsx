import {
  DriverLicenseStatus,
  isTripRequestExecutionResolved,
  TRIP_FORCE_CLOSURE_NOTE_MIN_LENGTH,
  TripRequestExecutionStatus,
  TripRequestStatus,
  TripStatus,
} from '@saferidepro/shared-types';

import { Button } from '../../../components/ui/button';
import { StatusPill } from '../../../components/ui/status-pill';
import { TextareaField } from '../../../components/ui/textarea-field';
import {
  getTripRequestStatusLabel,
  getTripRequestStatusTone,
  getTripRequestExecutionStatusLabel,
  getTripRequestExecutionStatusTone,
} from '../../trip-requests/lib/trip-request-labels';
import {
  canStartTripNow,
  getTripCompletionOverdueMessage,
  getTripStartAvailabilityMessage,
  getTripStatusLabel,
  getTripStatusTone,
} from '../lib/trip-labels';
import type { TripRequestRecord } from '../../trip-requests/types/trip-request';
import type { TripRecord } from '../types/trip';

type TripExecutionCommandCenterProps = {
  myTrips: TripRecord[];
  incomingRequests: TripRequestRecord[];
  isMutatingTripId: string | null;
  isMutatingRequestId: string | null;
  licenseStatus: DriverLicenseStatus;
  blocksDriver: boolean;
  noShowNotes: Record<string, string>;
  onOpenRequests: () => void;
  onNoShowNoteChange: (requestId: string, value: string) => void;
  onMarkPassengerBoarded: (requestId: string) => void;
  onMarkPassengerDroppedOff: (requestId: string) => void;
  onMarkNoShow: (requestId: string) => void;
  onTripAction: (
    tripId: string,
    action: 'publish' | 'start' | 'complete' | 'cancel',
    options?: {
      closureNote?: string;
    },
  ) => void;
  onTripClosureNoteChange: (tripId: string, value: string) => void;
  tripClosureNotes: Record<string, string>;
};

export function TripExecutionCommandCenter({
  myTrips,
  incomingRequests,
  isMutatingTripId,
  isMutatingRequestId,
  licenseStatus,
  blocksDriver,
  noShowNotes,
  onOpenRequests,
  onNoShowNoteChange,
  onMarkPassengerBoarded,
  onMarkPassengerDroppedOff,
  onMarkNoShow,
  onTripAction,
  onTripClosureNoteChange,
  tripClosureNotes,
}: TripExecutionCommandCenterProps) {
  const primaryTrip = selectPrimaryExecutionTrip(myTrips);

  if (!primaryTrip) {
    return (
      <article className="trip-command-center trip-command-center-empty">
        <div className="trip-command-center-copy">
          <p className="section-label">Ejecucion</p>
          <h2 className="panel-title">Centro de mando del conductor</h2>
        </div>
      </article>
    );
  }

  const acceptedPassengers = incomingRequests.filter(
    (request) =>
      request.tripId === primaryTrip.id && request.status === TripRequestStatus.Accepted,
  );
  const pendingRequests = incomingRequests.filter(
    (request) =>
      request.tripId === primaryTrip.id && request.status === TripRequestStatus.Pending,
  );
  const pendingBoardingPassengers = acceptedPassengers.filter((request) =>
    request.executionStatus === null
    || request.executionStatus === TripRequestExecutionStatus.AcceptedPendingBoarding,
  );
  const onBoardPassengers = acceptedPassengers.filter(
    (request) => request.executionStatus === TripRequestExecutionStatus.OnBoard,
  );
  const completedPassengers = acceptedPassengers.filter(
    (request) => request.executionStatus === TripRequestExecutionStatus.DroppedOff,
  );
  const unresolvedPassengers = acceptedPassengers.filter(
    (request) => !isTripRequestExecutionResolved(request.executionStatus),
  );
  const startAvailabilityMessage = getTripStartAvailabilityMessage(
    primaryTrip.departureAt,
    primaryTrip.estimatedArrivalAt,
  );
  const overdueMessage = getTripCompletionOverdueMessage(
    primaryTrip.status,
    primaryTrip.estimatedArrivalAt,
  );
  const guidance = getDriverGuidance(
    primaryTrip,
    acceptedPassengers.length,
    pendingRequests.length,
    pendingBoardingPassengers.length,
    onBoardPassengers.length,
  );
  const executionSteps = buildExecutionSteps(primaryTrip.status);
  const canPublish =
    primaryTrip.status === TripStatus.Draft
    && licenseStatus !== DriverLicenseStatus.Expired
    && !blocksDriver;
  const canStart =
    (primaryTrip.status === TripStatus.Published || primaryTrip.status === TripStatus.Full)
    && licenseStatus !== DriverLicenseStatus.Expired
    && !blocksDriver
    && canStartTripNow(primaryTrip.departureAt, primaryTrip.estimatedArrivalAt);
  const canComplete = primaryTrip.status === TripStatus.InProgress;
  const canCancel =
    primaryTrip.status !== TripStatus.Completed
    && primaryTrip.status !== TripStatus.InProgress
    && primaryTrip.status !== TripStatus.Cancelled;
  const normalizedClosureNote = (tripClosureNotes[primaryTrip.id] ?? '').trim();
  const requiresExceptionalClosureNote = canComplete && unresolvedPassengers.length > 0;
  const hasValidExceptionalClosureNote =
    !requiresExceptionalClosureNote
    || normalizedClosureNote.length >= TRIP_FORCE_CLOSURE_NOTE_MIN_LENGTH;

  return (
    <article className="trip-command-center">
      <div className="trip-command-center-header">
        <div className="trip-command-center-copy">
          <p className="section-label">Ejecucion</p>
          <h2 className="trip-command-center-title">Centro de mando del conductor</h2>
        </div>
        <div className="trip-command-center-badges">
          <StatusPill
            label={getTripStatusLabel(primaryTrip.status)}
            tone={getTripStatusTone(primaryTrip.status)}
          />
          <span className="topbar-badge">{acceptedPassengers.length} confirmados</span>
          <span className="topbar-badge">{pendingRequests.length} pendientes</span>
        </div>
      </div>

      <div className="trip-command-phase-strip" aria-label="Fases del viaje">
        {executionSteps.map((step) => (
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

      <div className="trip-command-center-grid">
        <div className="trip-command-center-main">
          <div className="trip-command-center-hero">
            <div>
              <strong className="trip-command-center-route">
                {primaryTrip.originLabel} -&gt; {primaryTrip.destinationLabel}
              </strong>
              <p className="trip-command-center-subtitle">
                {primaryTrip.vehicleDisplayName} | {primaryTrip.vehiclePlate}
              </p>
            </div>
            <div className="trip-command-center-progress">
              <span className="trip-command-center-progress-label">Siguiente foco</span>
              <strong>{guidance.title}</strong>
              <p>{guidance.description}</p>
            </div>
          </div>

          <div className="trip-command-chip-row">
            <span className="trip-command-chip">Salida {formatDateTime(primaryTrip.departureAt)}</span>
            <span className="trip-command-chip">Llegada {formatDateTime(primaryTrip.estimatedArrivalAt)}</span>
            <span className="trip-command-chip">
              Ocupacion {primaryTrip.seatCount - primaryTrip.availableSeats}/{primaryTrip.seatCount}
            </span>
            <span className="trip-command-chip">Pendientes {pendingBoardingPassengers.length}</span>
            <span className="trip-command-chip">A bordo {onBoardPassengers.length}</span>
          </div>

          <div className="trip-command-kpi-grid">
            <ExecutionStatCard
              label="Salida"
              value={formatDateTime(primaryTrip.departureAt)}
            />
            <ExecutionStatCard
              label="Llegada estimada"
              value={formatDateTime(primaryTrip.estimatedArrivalAt)}
            />
            <ExecutionStatCard
              label="Ocupacion"
              value={`${primaryTrip.seatCount - primaryTrip.availableSeats}/${primaryTrip.seatCount}`}
            />
            <ExecutionStatCard
              label="Cupos libres"
              value={`${primaryTrip.availableSeats}`}
            />
            <ExecutionStatCard
              label="Pendientes"
              value={`${pendingBoardingPassengers.length}`}
            />
            <ExecutionStatCard
              label="Finalizados"
              value={`${completedPassengers.length}`}
            />
          </div>

          {startAvailabilityMessage ? (
            <div className="trip-command-alert">
              <strong>Ventana de inicio</strong>
              <p title={startAvailabilityMessage}>{startAvailabilityMessage}</p>
            </div>
          ) : null}

          {overdueMessage ? (
            <div className="trip-command-alert trip-command-alert-warning">
              <strong>Revision de cierre</strong>
              <p title={overdueMessage}>{overdueMessage}</p>
            </div>
          ) : null}

          {canComplete && unresolvedPassengers.length > 0 ? (
            <div className="trip-command-alert trip-command-alert-warning">
              <strong>Cierre excepcional</strong>
              <p>
                Aun hay {unresolvedPassengers.length} pasajero{unresolvedPassengers.length === 1 ? '' : 's'} sin cierre operativo.
              </p>
            </div>
          ) : null}

          {canComplete ? (
            <div className="trip-command-closure-card">
              <div className="trip-command-section-heading">
                <strong>Cierre del viaje</strong>
                <span>
                  {unresolvedPassengers.length > 0 ? 'Excepcional' : 'Normal'}
                </span>
              </div>
              <TextareaField
                hint={
                  unresolvedPassengers.length > 0
                    ? `Obligatoria si finalizas con pasajeros pendientes de cerrar. Minimo ${TRIP_FORCE_CLOSURE_NOTE_MIN_LENGTH} caracteres.`
                    : 'Opcional.'
                }
                label="Nota de cierre"
                onChange={(event) => onTripClosureNoteChange(primaryTrip.id, event.target.value)}
                placeholder="Describe una incidencia o razon operativa si cierras con pendientes."
                rows={3}
                value={tripClosureNotes[primaryTrip.id] ?? ''}
              />
              {requiresExceptionalClosureNote ? (
                <small>
                  {normalizedClosureNote.length >= TRIP_FORCE_CLOSURE_NOTE_MIN_LENGTH
                    ? 'La nota excepcional ya cumple la longitud minima.'
                    : `Debes escribir al menos ${TRIP_FORCE_CLOSURE_NOTE_MIN_LENGTH} caracteres para cerrar con pasajeros pendientes.`}
                </small>
              ) : null}
            </div>
          ) : null}

          <div className="trip-command-action-row">
            {canPublish ? (
              <Button
                disabled={isMutatingTripId === primaryTrip.id}
                onClick={() => onTripAction(primaryTrip.id, 'publish')}
              >
                Publicar trayecto
              </Button>
            ) : null}
            {canStart ? (
              <Button
                disabled={isMutatingTripId === primaryTrip.id}
                onClick={() => onTripAction(primaryTrip.id, 'start')}
                variant="secondary"
              >
                Iniciar trayecto
              </Button>
            ) : null}
            {canComplete ? (
              <Button
                disabled={
                  isMutatingTripId === primaryTrip.id || !hasValidExceptionalClosureNote
                }
                onClick={() => onTripAction(primaryTrip.id, 'complete', {
                  closureNote: tripClosureNotes[primaryTrip.id],
                })}
                variant="secondary"
              >
                {requiresExceptionalClosureNote ? 'Finalizar con cierre excepcional' : 'Finalizar trayecto'}
              </Button>
            ) : null}
            {canCancel ? (
              <Button
                disabled={isMutatingTripId === primaryTrip.id}
                onClick={() => onTripAction(primaryTrip.id, 'cancel')}
                variant="ghost"
              >
                Cancelar trayecto
              </Button>
            ) : null}
            {pendingRequests.length > 0 ? (
              <Button onClick={onOpenRequests} type="button" variant="ghost">
                Revisar solicitudes
              </Button>
            ) : null}
          </div>
        </div>

        <div className="trip-command-center-side">
          <div className="trip-command-manifest">
            <div className="trip-command-section-heading">
              <strong>Pasajeros confirmados</strong>
              <span>{acceptedPassengers.length} listos</span>
            </div>
            {acceptedPassengers.length ? (
              <div className="trip-command-manifest-list">
                {acceptedPassengers.map((request) => (
                  <div key={request.id} className="trip-command-passenger-card">
                    <div className="trip-command-passenger-head">
                      <strong>{request.passengerFullName}</strong>
                      <StatusPill
                        label={getTripRequestExecutionStatusLabel(request.executionStatus)}
                        tone={getTripRequestExecutionStatusTone(request.executionStatus)}
                      />
                    </div>
                    <div className="trip-command-passenger-meta">
                      <StatusPill
                        label={getTripRequestStatusLabel(request.status)}
                        tone={getTripRequestStatusTone(request.status)}
                      />
                    </div>
                    {request.requestMessage ? (
                      <p title={request.requestMessage}>{request.requestMessage}</p>
                    ) : null}
                    {request.boardedAt ? (
                      <small>Abordo: {formatDateTime(request.boardedAt)}</small>
                    ) : null}
                    {request.droppedOffAt ? (
                      <small>Finalizo: {formatDateTime(request.droppedOffAt)}</small>
                    ) : null}
                    <small>
                      Aceptada el {formatDateTime(request.reviewedAt ?? request.createdAt)}
                    </small>
                    {primaryTrip.status === TripStatus.InProgress ? (
                      <div className="trip-command-passenger-actions">
                        {(request.executionStatus === null
                          || request.executionStatus === TripRequestExecutionStatus.AcceptedPendingBoarding) ? (
                            <>
                              <Button
                                disabled={isMutatingRequestId === request.id}
                                onClick={() => onMarkPassengerBoarded(request.id)}
                                variant="secondary"
                              >
                                Marcar abordo
                              </Button>
                              <TextareaField
                                label="Nota de ausencia"
                                onChange={(event) => onNoShowNoteChange(request.id, event.target.value)}
                                placeholder="Describe brevemente la ausencia."
                                rows={2}
                                value={noShowNotes[request.id] ?? ''}
                              />
                              <Button
                                disabled={isMutatingRequestId === request.id}
                                onClick={() => onMarkNoShow(request.id)}
                                variant="ghost"
                              >
                                Registrar ausencia
                              </Button>
                            </>
                          ) : null}
                        {request.executionStatus === TripRequestExecutionStatus.OnBoard ? (
                          <Button
                            disabled={isMutatingRequestId === request.id}
                            onClick={() => onMarkPassengerDroppedOff(request.id)}
                            variant="secondary"
                          >
                            Marcar finalizado
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-text">Sin pasajeros confirmados.</p>
            )}
          </div>

          <div className="trip-command-manifest trip-command-manifest-muted">
            <div className="trip-command-section-heading">
              <strong>Lectura operacional</strong>
              <span>Rapido</span>
            </div>
            <div className="trip-command-summary-grid">
              <ExecutionSummaryTile label="Estado" value={getTripStatusLabel(primaryTrip.status)} />
              <ExecutionSummaryTile label="Pendientes" value={`${pendingRequests.length}`} />
              <ExecutionSummaryTile label="Confirmados" value={`${acceptedPassengers.length}`} />
              <ExecutionSummaryTile label="A bordo" value={`${onBoardPassengers.length}`} />
              <ExecutionSummaryTile label="Vehiculo" value={primaryTrip.vehiclePlate} />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function ExecutionStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="trip-command-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ExecutionSummaryTile({
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

function selectPrimaryExecutionTrip(myTrips: TripRecord[]): TripRecord | null {
  return (
    [...myTrips]
      .filter(
        (trip) =>
          trip.status === TripStatus.InProgress
          || trip.status === TripStatus.Full
          || trip.status === TripStatus.Published
          || trip.status === TripStatus.Draft,
      )
      .sort((left, right) => {
        const priorityDiff = getTripPriority(left.status) - getTripPriority(right.status);

        if (priorityDiff !== 0) {
          return priorityDiff;
        }

        return new Date(left.departureAt).getTime() - new Date(right.departureAt).getTime();
      })[0] ?? null
  );
}

function getTripPriority(status: TripStatus): number {
  switch (status) {
    case TripStatus.InProgress:
      return 0;
    case TripStatus.Full:
      return 1;
    case TripStatus.Published:
      return 2;
    case TripStatus.Draft:
      return 3;
    default:
      return 4;
  }
}

function buildExecutionSteps(status: TripStatus): Array<{
  id: string;
  index: string;
  label: string;
  isCurrent: boolean;
  isComplete: boolean;
}> {
  const currentIndex = getExecutionStepIndex(status);

  return [
    { id: 'draft', index: '01', label: 'Borrador', isCurrent: currentIndex === 0, isComplete: currentIndex > 0 },
    { id: 'published', index: '02', label: 'Publicado', isCurrent: currentIndex === 1, isComplete: currentIndex > 1 },
    { id: 'in-progress', index: '03', label: 'En curso', isCurrent: currentIndex === 2, isComplete: currentIndex > 2 },
    { id: 'closure', index: '04', label: 'Cierre', isCurrent: currentIndex === 3, isComplete: currentIndex > 3 },
  ];
}

function getExecutionStepIndex(status: TripStatus): number {
  switch (status) {
    case TripStatus.Draft:
      return 0;
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

function getDriverGuidance(
  trip: TripRecord,
  acceptedPassengersCount: number,
  pendingRequestsCount: number,
  pendingBoardingCount: number,
  onBoardCount: number,
): { title: string; description: string } {
  switch (trip.status) {
    case TripStatus.Draft:
      return {
        title: 'Publicar el viaje',
        description: 'Tu ruta ya esta configurada.',
      };
    case TripStatus.Published:
      return {
        title: acceptedPassengersCount > 0 ? 'Preparar salida' : 'Esperar confirmaciones',
        description:
          acceptedPassengersCount > 0
            ? 'Ya tienes pasajeros confirmados.'
            : pendingRequestsCount > 0
              ? 'Tienes solicitudes pendientes.'
              : 'El viaje sigue recibiendo solicitudes.',
      };
    case TripStatus.Full:
      return {
        title: 'Trayecto listo para arrancar',
        description: 'Ya no quedan cupos libres.',
      };
    case TripStatus.InProgress:
      return {
        title:
          pendingBoardingCount > 0
            ? 'Registrar abordajes'
            : onBoardCount > 0
              ? 'Cerrar pasajeros en destino'
              : 'Cerrar trayecto',
        description:
          pendingBoardingCount > 0
            ? 'Marca quienes ya subieron o registra una ausencia.'
            : onBoardCount > 0
              ? 'Finaliza a cada pasajero cuando llegue a destino.'
              : 'El viaje ya puede pasar al cierre.',
      };
    default:
      return {
        title: 'Sin accion inmediata',
        description: 'Sin accion pendiente.',
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
