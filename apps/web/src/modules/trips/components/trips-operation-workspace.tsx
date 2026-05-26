import {
  CANCELLATION_LATE_WINDOW_MINUTES,
  DriverLicenseStatus,
  getTripPostClosureSummary,
  TripRequestStatus,
  TripStatus,
} from '@saferidepro/shared-types';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { StatusPill } from '../../../components/ui/status-pill';
import {
  canStartTripNow,
  getCancellationTimingLabel,
  getCancellationTimingTone,
  getTripCompletionOverdueMessage,
  getTripRouteModeLabel,
  getTripStartAvailabilityMessage,
  getTripStatusLabel,
  getTripStatusTone,
} from '../lib/trip-labels';
import {
  getLuggagePolicyLabel,
  getVehicleTypeLabel,
} from '../../vehicles/lib/vehicle-labels';
import type { TripRequestRecord } from '../../trip-requests/types/trip-request';
import type { TripRecord } from '../types/trip';
import {
  getTripClosureIncidentLabel,
  getTripClosureIncidentTone,
  getTripClosureWindowCopy,
} from '../lib/trip-closure';
import type { TripClosureActionItem } from './trip-closure-action-center';
import { TripsEditorialEmptyState } from './trips-editorial-empty-state';
import { TripFinalizationModal } from './trip-finalization-modal';
import { TripsListPagination } from './trips-list-pagination';
import { TripExecutionCommandCenter } from './trip-execution-command-center';
import { TripDeleteConfirmationModal } from './trip-delete-confirmation-modal';
import { TripsWorkspaceSkeleton } from './trips-workspace-skeleton';
import styles from './trips-operation-workspace.module.css';

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
    action: 'publish' | 'start' | 'complete' | 'cancel' | 'delete',
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
  onBlockedAction?: (title: string, description: string) => void;
  showCommandCenter?: boolean;
  showClosureItems?: boolean;
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
  onBlockedAction,
  showCommandCenter = true,
  showClosureItems = true,
}: TripsOperationWorkspaceProps) {
  const [page, setPage] = useState(1);
  const [selectedTripIdForClosure, setSelectedTripIdForClosure] = useState<string | null>(null);
  const [selectedDraftTripIdForDelete, setSelectedDraftTripIdForDelete] = useState<string | null>(null);
  const pageSize = 10;
  const paginatedTrips = useMemo(
    () => myTrips.slice((page - 1) * pageSize, page * pageSize),
    [myTrips, page],
  );
  const closureItems = buildDriverClosureItems(myTrips, incomingRequests);
  const requestsByTrip = useMemo(() => {
    const groupedRequests = new Map<string, TripRequestRecord[]>();

    incomingRequests.forEach((request) => {
      const currentRequests = groupedRequests.get(request.tripId) ?? [];
      currentRequests.push(request);
      groupedRequests.set(request.tripId, currentRequests);
    });

    return groupedRequests;
  }, [incomingRequests]);
  const selectedTripForClosure = useMemo(
    () => myTrips.find((trip) => trip.id === selectedTripIdForClosure) ?? null,
    [myTrips, selectedTripIdForClosure],
  );
  const selectedDraftTripForDelete = useMemo(
    () => myTrips.find((trip) => trip.id === selectedDraftTripIdForDelete) ?? null,
    [myTrips, selectedDraftTripIdForDelete],
  );
  const selectedTripRequestsForClosure = useMemo(
    () =>
      selectedTripForClosure
        ? incomingRequests.filter(
            (request) =>
              request.tripId === selectedTripForClosure.id
              && request.status === TripRequestStatus.Accepted,
          )
        : [],
    [incomingRequests, selectedTripForClosure],
  );

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(myTrips.length / pageSize));

    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [myTrips.length, page]);

  useEffect(() => {
    if (selectedTripForClosure && selectedTripForClosure.status !== TripStatus.InProgress) {
      setSelectedTripIdForClosure(null);
    }
  }, [selectedTripForClosure]);

  const notifyBlockedAction = (title: string, description: string) => {
    onBlockedAction?.(title, description);
  };

  return (
    <>
      <TripFinalizationModal
        isMutatingRequestId={isMutatingRequestId}
        isMutatingTripId={isMutatingTripId}
        noShowNotes={noShowNotes}
        onClose={() => setSelectedTripIdForClosure(null)}
        onComplete={() => {
          if (!selectedTripForClosure) {
            return;
          }

          onTripAction(selectedTripForClosure.id, 'complete', {
            closureNote: tripClosureNotes[selectedTripForClosure.id],
          });
        }}
        onMarkNoShow={onMarkNoShow}
        onMarkPassengerBoarded={onMarkPassengerBoarded}
        onMarkPassengerDroppedOff={onMarkPassengerDroppedOff}
        onNoShowNoteChange={onNoShowNoteChange}
        onTripClosureNoteChange={onTripClosureNoteChange}
        requestFallbackNoShowNote="El pasajero no se presento al punto acordado."
        requestList={selectedTripRequestsForClosure}
        trip={selectedTripForClosure}
        tripClosureNote={
          selectedTripForClosure ? tripClosureNotes[selectedTripForClosure.id] ?? '' : ''
        }
      />
      <TripDeleteConfirmationModal
        isDeleting={Boolean(
          selectedDraftTripIdForDelete && isMutatingTripId === selectedDraftTripIdForDelete,
        )}
        onClose={() => setSelectedDraftTripIdForDelete(null)}
        onConfirm={() => {
          if (!selectedDraftTripForDelete) {
            return;
          }

          onTripAction(selectedDraftTripForDelete.id, 'delete');
          setSelectedDraftTripIdForDelete(null);
        }}
        trip={selectedDraftTripForDelete}
      />

      <section className="trips-workspace-grid trips-operation-stack">
      {isRefreshingData ? <TripsWorkspaceSkeleton variant="operation" /> : null}

      {showCommandCenter ? (
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
      ) : null}

      <article className={styles.tripBoardPanel}>
        <div className={styles.tripBoardHeader}>
          <div>
            <h2>Mis viajes</h2>
            <span>{myTrips.length} resultados</span>
          </div>
          <Button
            onClick={onNavigateToCreateTrip}
            variant="secondary"
          >
            Nuevo viaje
          </Button>
        </div>
        {myTrips.length ? (
          <div className={styles.tripList}>
            {paginatedTrips.map((trip) => {
              const startAvailabilityMessage = getTripStartAvailabilityMessage(
                trip.departureAt,
                trip.estimatedArrivalAt,
              );
              const completionOverdueMessage = getTripCompletionOverdueMessage(
                trip.status,
                trip.estimatedArrivalAt,
              );
              const lateRemovalWarning = getLateRemovalWarning(trip);
              const isDraftTrip = trip.status === TripStatus.Draft;
              const relatedRequests = requestsByTrip.get(trip.id) ?? [];
              const acceptedPassengersCount = relatedRequests.filter(
                (request) => request.status === TripRequestStatus.Accepted,
              ).length;
              const pendingPassengersCount = relatedRequests.filter(
                (request) => request.status === TripRequestStatus.Pending,
              ).length;

              return (
                <article className={styles.tripRow} key={trip.id}>
                  <div className={styles.tripRouteCell}>
                    <div className={styles.tripRouteTopline}>
                      <span className={styles.tripKicker}>{getTripRouteModeLabel(trip.routeMode)}</span>
                      <StatusPill
                        label={getTripStatusLabel(trip.status)}
                        tone={getTripStatusTone(trip.status)}
                      />
                    </div>
                    <h3 className={styles.tripRoute}>
                      {trip.originLabel} <span aria-hidden="true">&rarr;</span> {trip.destinationLabel}
                    </h3>
                    <div className={styles.tripMetaStrip}>
                      <span>{getVehicleTypeLabel(trip.vehicleTypeSnapshot)}</span>
                      <span>{getLuggagePolicyLabel(trip.luggagePolicySnapshot)}</span>
                      {trip.detourSurchargeReference ? (
                        <span>Desvio {formatCurrency(trip.detourSurchargeReference)}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className={styles.tripCell}>
                    <span>Salida</span>
                    <strong>{formatTripDeparture(trip.departureAt)}</strong>
                  </div>

                  <div className={styles.tripCell}>
                    <span>Vehiculo</span>
                    <strong>{trip.vehicleDisplayName}</strong>
                    <small>{trip.vehiclePlate}</small>
                  </div>

                  <div className={styles.tripCell}>
                    <span>Cupos</span>
                    <strong>{trip.availableSeats}/{trip.seatCount}</strong>
                    <small>{acceptedPassengersCount} confirmados</small>
                  </div>

                  <div className={styles.tripCell}>
                    <span>Precio</span>
                    <strong>{formatCurrency(trip.basePriceReference)}</strong>
                  </div>

                  <div className={styles.tripSignals}>
                    {pendingPassengersCount > 0 ? (
                      <button
                        className={`${styles.signalChip} ${styles.signalChipAction}`}
                        onClick={onOpenRequests}
                        type="button"
                      >
                        {pendingPassengersCount} pendientes
                      </button>
                    ) : null}
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
                      <span className={styles.warningText}>Licencia vencida</span>
                    ) : null}
                    {(trip.status === TripStatus.Published || trip.status === TripStatus.Full)
                    && startAvailabilityMessage ? (
                      <span className={styles.warningText} title={startAvailabilityMessage}>
                        Inicio no disponible
                      </span>
                    ) : null}
                    {lateRemovalWarning ? (
                      <span className={styles.warningText} title={lateRemovalWarning}>
                        Cancelacion tardia
                      </span>
                    ) : null}
                    {completionOverdueMessage ? (
                      <span className={styles.warningText} title={completionOverdueMessage}>
                        Revisar cierre
                      </span>
                    ) : null}
                  </div>

                  <div className={styles.tripActions}>
                      <Link
                        aria-label="Ver detalle del viaje"
                        className={styles.tripAction}
                        href={`/viajes/${trip.id}`}
                        title="Ver detalle"
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span>Ver detalle</span>
                      </Link>
                      {trip.status === TripStatus.Draft ||
                      trip.status === TripStatus.Published ||
                      trip.status === TripStatus.Full ? (
                        <Link
                          aria-label="Editar viaje"
                          className={styles.tripAction}
                          href={`/viajes/${trip.id}/editar`}
                          title="Editar"
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24">
                            <path d="m4 20 4.5-1 9.2-9.2a1.8 1.8 0 0 0 0-2.6l-.9-.9a1.8 1.8 0 0 0-2.6 0L5 15.5 4 20Z" />
                            <path d="m13.5 6.5 4 4" />
                          </svg>
                          <span>Editar</span>
                        </Link>
                      ) : null}
                      {trip.status === TripStatus.InProgress ? (
                        <Link
                          aria-label="Abrir seguimiento del viaje"
                          className={styles.tripAction}
                          href={`/viajes/${trip.id}/seguimiento`}
                          title="Seguimiento"
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24">
                            <path d="M12 3v3" />
                            <path d="M12 18v3" />
                            <path d="M3 12h3" />
                            <path d="M18 12h3" />
                            <circle cx="12" cy="12" r="4" />
                            <path d="m14 10-1.2 3.1L10 14l1.2-3.1L14 10Z" />
                          </svg>
                          <span>Seguimiento</span>
                        </Link>
                      ) : null}
                    {(trip.status === TripStatus.Published || trip.status === TripStatus.Full) && pendingPassengersCount > 0 ? (
                      <Button
                        onClick={onOpenRequests}
                        title="Abrir solicitudes"
                        variant="ghost"
                      >
                        Solicitudes
                      </Button>
                    ) : null}
                    {trip.status === TripStatus.Draft ||
                    trip.status === TripStatus.Published ||
                    trip.status === TripStatus.Full ? (
                      <Button
                        onClick={() => {
                          if (isMutatingTripId === trip.id) {
                            notifyBlockedAction('Operacion en curso', 'Espera a que termine la accion anterior.');
                            return;
                          }

                          if (isDraftTrip) {
                            setSelectedDraftTripIdForDelete(trip.id);
                            return;
                          }

                          onTripAction(trip.id, 'cancel');
                        }}
                        title={
                          isDraftTrip
                            ? 'Eliminar borrador'
                            : lateRemovalWarning ?? 'Cancelar viaje'
                        }
                        variant="ghost"
                      >
                        {isDraftTrip ? 'Eliminar' : 'Cancelar'}
                      </Button>
                    ) : null}
                    {trip.status === TripStatus.Draft ? (
                      <Button
                        onClick={() => {
                          if (isMutatingTripId === trip.id) {
                            notifyBlockedAction('Operacion en curso', 'Espera a que termine la accion anterior.');
                            return;
                          }

                          if (licenseStatus === DriverLicenseStatus.Expired) {
                            notifyBlockedAction('No puedes publicar', 'Tu licencia esta vencida.');
                            return;
                          }

                          if (blocksDriver) {
                            notifyBlockedAction('No puedes publicar', 'Tienes una restriccion activa como conductor.');
                            return;
                          }

                          onTripAction(trip.id, 'publish');
                        }}
                        variant="primary"
                      >
                        Publicar
                      </Button>
                    ) : null}
                    {(trip.status === TripStatus.Published || trip.status === TripStatus.Full) ? (
                      <Button
                        onClick={() => {
                          if (isMutatingTripId === trip.id) {
                            notifyBlockedAction('Operacion en curso', 'Espera a que termine la accion anterior.');
                            return;
                          }

                          if (licenseStatus === DriverLicenseStatus.Expired) {
                            notifyBlockedAction('No puedes iniciar', 'Tu licencia esta vencida.');
                            return;
                          }

                          if (blocksDriver) {
                            notifyBlockedAction('No puedes iniciar', 'Tienes una restriccion activa como conductor.');
                            return;
                          }

                          if (!canStartTripNow(trip.departureAt, trip.estimatedArrivalAt)) {
                            notifyBlockedAction(
                              'No puedes iniciar aun',
                              startAvailabilityMessage ?? 'Este viaje solo puede iniciarse dentro del horario permitido.',
                            );
                            return;
                          }

                          onTripAction(trip.id, 'start');
                        }}
                        title={startAvailabilityMessage ?? undefined}
                        variant="secondary"
                      >
                        Iniciar
                      </Button>
                    ) : null}
                    {trip.status === TripStatus.InProgress ? (
                      <Button
                        onClick={() => {
                          if (isMutatingTripId === trip.id) {
                            notifyBlockedAction('Operacion en curso', 'Espera a que termine la accion anterior.');
                            return;
                          }

                          setSelectedTripIdForClosure(trip.id);
                        }}
                        variant="secondary"
                      >
                        Gestionar cierre
                      </Button>
                    ) : null}
                  </div>
                </article>
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
        <TripsListPagination
          onPageChange={setPage}
          page={page}
          pageSize={pageSize}
          totalItems={myTrips.length}
        />
      </article>

      {showClosureItems && closureItems.length ? (
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
    </>
  );
}

function getLateRemovalWarning(trip: TripRecord): string | null {
  if (
    trip.status !== TripStatus.Published &&
    trip.status !== TripStatus.Full
  ) {
    return null;
  }

  const departureAt = new Date(trip.departureAt);
  const millisecondsUntilDeparture = departureAt.getTime() - Date.now();

  if (millisecondsUntilDeparture <= 0) {
    return null;
  }

  if (millisecondsUntilDeparture <= CANCELLATION_LATE_WINDOW_MINUTES * 60_000) {
    return `Cancelar este viaje dentro de los ${CANCELLATION_LATE_WINDOW_MINUTES} minutos previos a la salida puede generar una incidencia operativa.`;
  }

  return null;
}

function formatTripDeparture(value: string): string {
  const date = new Date(value);
  const formattedDate = new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
  const formattedTime = new Intl.DateTimeFormat('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  return `${formattedDate} | ${formattedTime}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
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


