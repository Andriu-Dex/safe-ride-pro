import { DriverLicenseStatus, TripRequestStatus, TripStatus } from '@saferidepro/shared-types';

import { Button } from '../../../components/ui/button';
import { StatusPill } from '../../../components/ui/status-pill';
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
  licenseStatus: DriverLicenseStatus;
  blocksDriver: boolean;
  onTripAction: (tripId: string, action: 'publish' | 'start' | 'complete' | 'cancel') => void;
};

export function TripExecutionCommandCenter({
  myTrips,
  incomingRequests,
  isMutatingTripId,
  licenseStatus,
  blocksDriver,
  onTripAction,
}: TripExecutionCommandCenterProps) {
  const primaryTrip = selectPrimaryExecutionTrip(myTrips);

  if (!primaryTrip) {
    return (
      <article className="trip-command-center trip-command-center-empty">
        <div className="trip-command-center-copy">
          <p className="section-label">Execution UX</p>
          <h2 className="panel-title">Centro de mando del conductor</h2>
          <p className="panel-text">
            Cuando tengas un viaje publicado, lleno o en curso, aqui veras el mando principal para operarlo con menos friccion.
          </p>
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
  const startAvailabilityMessage = getTripStartAvailabilityMessage(
    primaryTrip.departureAt,
    primaryTrip.estimatedArrivalAt,
  );
  const overdueMessage = getTripCompletionOverdueMessage(
    primaryTrip.status,
    primaryTrip.estimatedArrivalAt,
  );
  const guidance = getDriverGuidance(primaryTrip, acceptedPassengers.length, pendingRequests.length);
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

  return (
    <article className="trip-command-center">
      <div className="trip-command-center-header">
        <div className="trip-command-center-copy">
          <p className="section-label">Execution UX</p>
          <h2 className="trip-command-center-title">Centro de mando del conductor</h2>
          <p className="panel-text">
            Todo lo importante del trayecto principal en una sola superficie: estado, pasajeros confirmados y siguiente accion sugerida.
          </p>
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

      <div className="trip-command-center-grid">
        <div className="trip-command-center-main">
          <div className="trip-command-center-hero">
            <div>
              <strong className="trip-command-center-route">
                {primaryTrip.originLabel} -&gt; {primaryTrip.destinationLabel}
              </strong>
              <p className="trip-command-center-subtitle">
                {primaryTrip.vehicleDisplayName} · {primaryTrip.vehiclePlate}
              </p>
            </div>
            <div className="trip-command-center-progress">
              <span className="trip-command-center-progress-label">Siguiente foco</span>
              <strong>{guidance.title}</strong>
              <p>{guidance.description}</p>
            </div>
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
          </div>

          {startAvailabilityMessage ? (
            <div className="trip-command-alert">
              <strong>Ventana de inicio</strong>
              <p>{startAvailabilityMessage}</p>
            </div>
          ) : null}

          {overdueMessage ? (
            <div className="trip-command-alert trip-command-alert-warning">
              <strong>Revision de cierre</strong>
              <p>{overdueMessage}</p>
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
                disabled={isMutatingTripId === primaryTrip.id}
                onClick={() => onTripAction(primaryTrip.id, 'complete')}
                variant="secondary"
              >
                Finalizar trayecto
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
                        label={request.tripStatus === TripStatus.InProgress ? 'A bordo esperado' : 'Confirmado'}
                        tone={request.tripStatus === TripStatus.InProgress ? 'warning' : 'success'}
                      />
                    </div>
                    {request.requestMessage ? <p>{request.requestMessage}</p> : null}
                    <small>
                      Solicitud aceptada el {formatDateTime(request.reviewedAt ?? request.createdAt)}
                    </small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-text">
                Aun no tienes pasajeros confirmados para este trayecto.
              </p>
            )}
          </div>

          <div className="trip-command-manifest trip-command-manifest-muted">
            <div className="trip-command-section-heading">
              <strong>Lectura operacional</strong>
              <span>Resumen</span>
            </div>
            <ul className="trip-command-checklist">
              <li>Estado actual: {getTripStatusLabel(primaryTrip.status)}</li>
              <li>Solicitudes pendientes: {pendingRequests.length}</li>
              <li>Confirmaciones activas: {acceptedPassengers.length}</li>
              <li>Vehiculo asignado: {primaryTrip.vehicleDisplayName}</li>
            </ul>
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

function getDriverGuidance(
  trip: TripRecord,
  acceptedPassengersCount: number,
  pendingRequestsCount: number,
): { title: string; description: string } {
  switch (trip.status) {
    case TripStatus.Draft:
      return {
        title: 'Publicar el viaje',
        description: 'Tu ruta ya esta configurada. Publicala para empezar a recibir solicitudes.',
      };
    case TripStatus.Published:
      return {
        title: acceptedPassengersCount > 0 ? 'Preparar salida' : 'Esperar confirmaciones',
        description:
          acceptedPassengersCount > 0
            ? 'Ya tienes pasajeros confirmados. Revisa la hora de salida y deja listo el inicio.'
            : pendingRequestsCount > 0
              ? 'Tienes solicitudes pendientes por revisar antes de la salida.'
              : 'Aun puedes seguir recibiendo solicitudes para completar el trayecto.',
      };
    case TripStatus.Full:
      return {
        title: 'Trayecto listo para arrancar',
        description: 'El viaje ya no tiene cupos libres. Enfocate en iniciar a tiempo y coordinar la salida.',
      };
    case TripStatus.InProgress:
      return {
        title: 'Acompanhar y cerrar correctamente',
        description: 'Mantén el trayecto en seguimiento y finalizalo solo cuando realmente haya concluido.',
      };
    default:
      return {
        title: 'Sin accion inmediata',
        description: 'Este trayecto ya no requiere una operacion activa.',
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
