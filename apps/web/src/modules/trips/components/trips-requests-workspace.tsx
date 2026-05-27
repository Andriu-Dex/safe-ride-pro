import {
  CancellationTiming,
  getTripPostClosureSummary,
  isTripPaymentClosed,
  isTripPaymentSettled,
  PaymentProvider,
  TripPaymentStatus,
  TripRequestStatus,
  TripStatus,
} from '@saferidepro/shared-types';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { StatusPill } from '../../../components/ui/status-pill';
import {
  getTripRequestCancellationTimingLabel,
  getTripRequestExecutionStatusLabel,
  getTripRequestExecutionStatusTone,
  getTripRequestStatusLabel,
  getTripRequestStatusTone,
} from '../../trip-requests/lib/trip-request-labels';
import { wasConfirmedBeforeClosure } from '../../trip-requests/lib/trip-request-closure';
import type { TripRequestRecord } from '../../trip-requests/types/trip-request';
import {
  formatTripPaymentAmount,
  getPaymentProviderLabel,
  getTripPaymentStatusLabel,
  getTripPaymentStatusTone,
} from '../../payments/lib/payment-labels';
import {
  getTripClosureIncidentLabel,
  getTripClosureIncidentTone,
  getTripClosureWindowCopy,
} from '../lib/trip-closure';
import { getTripStatusLabel, getTripStatusTone } from '../lib/trip-labels';
import type { TripClosureActionItem } from './trip-closure-action-center';
import { PassengerActiveRidePanel } from './passenger-active-ride-panel';
import { TripRequestCancelConfirmationModal } from './trip-request-cancel-confirmation-modal';
import { TripRequestDetailModal } from './trip-request-detail-modal';
import { TripsEditorialEmptyState } from './trips-editorial-empty-state';
import { TripsListPagination } from './trips-list-pagination';
import { TripsWorkspaceSkeleton } from './trips-workspace-skeleton';
import styles from './trips-requests-workspace.module.css';

type TripsRequestsWorkspaceProps = {
  incomingRequests: TripRequestRecord[];
  myRequests: TripRequestRecord[];
  incomingRequestsCountOverride?: number;
  myRequestsCountOverride?: number;
  isMutatingRequestId: string | null;
  isMutatingPaymentId: string | null;
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
  onCreatePaymentCheckout: (paymentId: string) => void;
  onRefreshPaymentStatus: (paymentId: string) => void;
  onConfirmCashPayment: (paymentId: string) => void;
  onReportCashPaymentIssue: (paymentId: string) => void;
  isRefreshingData?: boolean;
  onExploreTrips: () => void;
  showIncomingRequestsSection?: boolean;
  showMyRequestsSection?: boolean;
  showActiveRidePanel?: boolean;
};

export function TripsRequestsWorkspace({
  incomingRequests,
  myRequests,
  incomingRequestsCountOverride,
  myRequestsCountOverride,
  isMutatingRequestId,
  isMutatingPaymentId,
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
  onCreatePaymentCheckout,
  onRefreshPaymentStatus,
  onConfirmCashPayment,
  onReportCashPaymentIssue,
  isRefreshingData = false,
  onExploreTrips,
  showIncomingRequestsSection = true,
  showMyRequestsSection = true,
  showActiveRidePanel = true,
}: TripsRequestsWorkspaceProps) {
  const [selectedRequest, setSelectedRequest] = useState<TripRequestRecord | null>(null);
  const [selectedRequestPerspective, setSelectedRequestPerspective] = useState<'driver' | 'passenger'>('driver');
  const [selectedRequestForCancel, setSelectedRequestForCancel] = useState<TripRequestRecord | null>(null);
  const [passengerSection, setPassengerSection] = useState<'active' | 'requests' | 'closure'>('requests');
  const incomingSectionTitle =
    showIncomingRequestsSection && !showMyRequestsSection
      ? 'Aprobar solicitudes'
      : 'Solicitudes recibidas';
  const incomingResultsCount = incomingRequestsCountOverride ?? incomingRequests.length;
  const myRequestsResultsCount = myRequestsCountOverride ?? myRequests.length;
  const myRequestsPageSize = 8;
  const [myRequestsPage, setMyRequestsPage] = useState(1);
  const paginatedMyRequests = useMemo(
    () => myRequests.slice((myRequestsPage - 1) * myRequestsPageSize, myRequestsPage * myRequestsPageSize),
    [myRequests, myRequestsPage],
  );
  const closureItems = buildPassengerClosureItems(myRequests);
  const showPassengerTabs = showMyRequestsSection && !showIncomingRequestsSection;
  const activeRideCount = myRequests.filter(
    (request) =>
      request.status === TripRequestStatus.Accepted &&
      (request.tripStatus === TripStatus.Published ||
        request.tripStatus === TripStatus.Full ||
        request.tripStatus === TripStatus.InProgress),
  ).length;

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(myRequests.length / myRequestsPageSize));

    if (myRequestsPage > totalPages) {
      setMyRequestsPage(totalPages);
    }
  }, [myRequests.length, myRequestsPage]);

  return (
    <>
      <TripRequestDetailModal
        onClose={() => setSelectedRequest(null)}
        perspective={selectedRequestPerspective}
        request={selectedRequest}
      />
      <TripRequestCancelConfirmationModal
        isCancelling={Boolean(
          selectedRequestForCancel && isMutatingRequestId === selectedRequestForCancel.id,
        )}
        onClose={() => setSelectedRequestForCancel(null)}
        onConfirm={() => {
          if (!selectedRequestForCancel) {
            return;
          }

          onCancelMyRequest(selectedRequestForCancel.id);
          setSelectedRequestForCancel(null);
        }}
        request={selectedRequestForCancel}
      />

      <section className={styles.requestsStack}>
      {isRefreshingData ? <TripsWorkspaceSkeleton variant="requests" /> : null}

      {showPassengerTabs ? (
        <div className={styles.sectionTabs} role="tablist" aria-label="Secciones de solicitudes">
          <button
            className={`${styles.sectionTab} ${passengerSection === 'requests' ? styles.sectionTabActive : ''}`}
            onClick={() => setPassengerSection('requests')}
            type="button"
          >
            Mis solicitudes
            <span>{myRequestsResultsCount}</span>
          </button>
          <button
            className={`${styles.sectionTab} ${passengerSection === 'active' ? styles.sectionTabActive : ''}`}
            onClick={() => setPassengerSection('active')}
            type="button"
          >
            Trayecto activo
            <span>{activeRideCount}</span>
          </button>
          <button
            className={`${styles.sectionTab} ${passengerSection === 'closure' ? styles.sectionTabActive : ''}`}
            onClick={() => setPassengerSection('closure')}
            type="button"
          >
            Post-viaje
            <span>{closureItems.length}</span>
          </button>
        </div>
      ) : null}

      {showActiveRidePanel && (!showPassengerTabs || passengerSection === 'active') ? (
        <div className="trip-live-panel-span">
          <PassengerActiveRidePanel
            canCancelOwnRequest={canCancelOwnRequest}
            isMutatingRequestId={isMutatingRequestId}
            isMutatingPaymentId={isMutatingPaymentId}
            myRequests={myRequests}
            onCancelMyRequest={onCancelMyRequest}
            onCreatePaymentCheckout={onCreatePaymentCheckout}
            onRefreshPaymentStatus={onRefreshPaymentStatus}
          />
        </div>
      ) : null}

      {showIncomingRequestsSection ? (
        <article className="panel panel-stack trips-stream-panel">
          <div className="section-heading">
            <h2 className="panel-title">{incomingSectionTitle}</h2>
            <p className="section-heading-meta">{incomingResultsCount} resultados</p>
          </div>
          {incomingRequests.length ? (
            <div className={styles.tableContainer}>
              <table className={styles.compactTable}>
                <thead>
                  <tr>
                    <th>Ruta del viaje</th>
                    <th>Salida</th>
                    <th>Pasajero</th>
                    <th>Estado</th>
                    <th>Pago</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {incomingRequests.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <div className={styles.cellRoute}>
                          <strong>{request.tripOriginLabel} -&gt; {request.tripDestinationLabel}</strong>
                          {request.requestMessage ? (
                            <small title={request.requestMessage}>Mensaje: {request.requestMessage}</small>
                          ) : null}
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(request.tripDepartureAt)}</td>
                      <td>{request.passengerFullName}</td>
                      <td>
                        <div className={styles.cellStatus}>
                          <StatusPill
                            label={getTripRequestStatusLabel(request.status)}
                            tone={getTripRequestStatusTone(request.status)}
                          />
                          {request.status === TripRequestStatus.Accepted || request.status === TripRequestStatus.NoShow ? (
                            <StatusPill
                              label={getTripRequestExecutionStatusLabel(request.executionStatus)}
                              tone={getTripRequestExecutionStatusTone(request.executionStatus)}
                            />
                          ) : null}
                          {request.status === TripRequestStatus.Pending && request.tripStatus === TripStatus.Full ? (
                            <span className={styles.warningText}>Viaje sin cupos</span>
                          ) : null}
                          {request.status === TripRequestStatus.Pending && request.tripStatus !== TripStatus.Published && request.tripStatus !== TripStatus.Full ? (
                            <span className={styles.warningText}>Solicitud desactualizada</span>
                          ) : null}
                          {request.status === TripRequestStatus.Cancelled && request.cancellationTiming ? (
                            <StatusPill
                              label={getTripRequestCancellationTimingLabel(request.cancellationTiming) ?? 'Cancelacion'}
                              tone={request.cancellationTiming === CancellationTiming.Late ? 'warning' : 'neutral'}
                            />
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className={styles.cellPayment}>
                          {request.payment ? (
                            <>
                              <StatusPill
                                label={getTripPaymentStatusLabel(request.payment.status)}
                                tone={getTripPaymentStatusTone(request.payment.status)}
                              />
                              <small>
                                {formatTripPaymentAmount(request.payment.amount, request.payment.currencyCode)}
                                {' | '}
                                {getPaymentProviderLabel(request.payment.provider)}
                              </small>
                            </>
                          ) : (
                            <span className={styles.emptyText}>Sin cargo</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className={styles.cellActions}>
                          {request.payment?.provider === PaymentProvider.Cash &&
                          request.payment.status === TripPaymentStatus.Pending &&
                          request.status === TripRequestStatus.Accepted ? (
                            <>
                              <button
                                className={`${styles.iconBtn} ${styles.accept}`}
                                disabled={isMutatingPaymentId === request.payment.id}
                                onClick={() => onConfirmCashPayment(request.payment!.id)}
                                title="Pago recibido"
                                type="button"
                              >
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                              <button
                                className={`${styles.iconBtn} ${styles.reject}`}
                                disabled={isMutatingPaymentId === request.payment.id}
                                onClick={() => onReportCashPaymentIssue(request.payment!.id)}
                                title="Reportar novedad de pago"
                                type="button"
                              >
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              </button>
                            </>
                          ) : null}

                          <button
                            className={styles.iconBtn}
                            onClick={() => {
                              setSelectedRequestPerspective('driver');
                              setSelectedRequest(request);
                            }}
                            title="Ver solicitud"
                            type="button"
                          >
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>

                          {canAcceptIncomingRequest(request) ? (
                            <button
                              className={`${styles.iconBtn} ${styles.accept}`}
                              disabled={isMutatingRequestId === request.id}
                              onClick={() => onIncomingRequestAction(request.id, 'accept')}
                              title="Aceptar solicitud"
                              type="button"
                            >
                              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          ) : null}

                          {canRejectIncomingRequest(request) ? (
                            <button
                              className={`${styles.iconBtn} ${styles.reject}`}
                              disabled={isMutatingRequestId === request.id}
                              onClick={() => onIncomingRequestAction(request.id, 'reject')}
                              title="Rechazar solicitud"
                              type="button"
                            >
                              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <TripsEditorialEmptyState
              eyebrow={incomingSectionTitle}
              title="Nada por aprobar por ahora"
            />
          )}
        </article>
      ) : null}

      {showMyRequestsSection && (!showPassengerTabs || passengerSection === 'requests') ? (
        <article className="panel panel-stack trips-stream-panel">
          <div className="section-heading">
            <h2 className="panel-title">Mis solicitudes</h2>
            <p className="section-heading-meta">{myRequestsResultsCount} resultados</p>
          </div>
          {myRequests.length ? (
            <>
              <div className={styles.tableContainer}>
                <table className={styles.compactTable}>
                  <thead>
                    <tr>
                      <th>Ruta del viaje</th>
                      <th>Salida</th>
                      <th>Conductor</th>
                      <th>Estado</th>
                      <th>Pago</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedMyRequests.map((request) => {
                      const canCancel = canCancelOwnRequest(request);
                      const canPayWithPaypal =
                        request.payment?.provider === PaymentProvider.Paypal
                        && !isTripPaymentSettled(request.payment.status)
                        && !isTripPaymentClosed(request.payment.status);
                      const canRefreshPaypal =
                        request.payment?.provider === PaymentProvider.Paypal
                        && !isTripPaymentSettled(request.payment.status);
                      const isPaypalAwaitingPayment =
                        request.payment?.provider === PaymentProvider.Paypal
                        && !isTripPaymentSettled(request.payment.status)
                        && !isTripPaymentClosed(request.payment.status);

                      return (
                        <tr key={request.id}>
                          <td>
                            <div className={styles.cellRoute}>
                              <strong>{request.tripOriginLabel} -&gt; {request.tripDestinationLabel}</strong>
                              {request.reviewNote ? (
                                <small title={request.reviewNote}>Nota: {request.reviewNote}</small>
                              ) : null}
                            </div>
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(request.tripDepartureAt)}</td>
                          <td>{request.driverFullName}</td>
                          <td>
                            <div className={styles.cellStatus}>
                              <StatusPill
                                label={isPaypalAwaitingPayment ? 'Pendiente de pago' : getTripRequestStatusLabel(request.status)}
                                tone={isPaypalAwaitingPayment ? 'warning' : getTripRequestStatusTone(request.status)}
                              />
                              {isPaypalAwaitingPayment ? (
                                <span className={styles.warningText}>No enviada al conductor</span>
                              ) : null}
                              {request.status === TripRequestStatus.Accepted || request.status === TripRequestStatus.NoShow ? (
                                <StatusPill
                                  label={getTripRequestExecutionStatusLabel(request.executionStatus)}
                                  tone={getTripRequestExecutionStatusTone(request.executionStatus)}
                                />
                              ) : null}
                              {request.status === TripRequestStatus.Cancelled && request.cancellationTiming ? (
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
                              ) : null}
                            </div>
                          </td>
                          <td>
                        <div className={styles.cellPayment}>
                              {request.payment ? (
                                <>
                                  <StatusPill
                                    label={getTripPaymentStatusLabel(request.payment.status)}
                                    tone={getTripPaymentStatusTone(request.payment.status)}
                                  />
                                  <small>
                                    {formatTripPaymentAmount(request.payment.amount, request.payment.currencyCode)}
                                    {' | '}
                                    {getPaymentProviderLabel(request.payment.provider)}
                                  </small>
                                  {isPaypalAwaitingPayment ? (
                                    <small>Abre PayPal para enviar la solicitud</small>
                                  ) : null}
                                </>
                              ) : (
                            <span className={styles.emptyText}>Sin cargo</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className={styles.cellActions}>
                              <button
                                className={styles.iconBtn}
                                onClick={() => {
                                  setSelectedRequestPerspective('passenger');
                                  setSelectedRequest(request);
                                }}
                                title="Ver detalle"
                                type="button"
                              >
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>

                              {canCancel ? (
                                <button
                                  className={`${styles.iconBtn} ${styles.reject}`}
                                  disabled={isMutatingRequestId === request.id}
                                  onClick={() => setSelectedRequestForCancel(request)}
                                  title="Cancelar reserva"
                                  type="button"
                                >
                                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              ) : null}

                              {canRefreshPaypal && request.payment ? (
                                <button
                                  className={styles.iconBtn}
                                  disabled={isMutatingPaymentId === request.payment.id}
                                  onClick={() => onRefreshPaymentStatus(request.payment!.id)}
                                  title="Actualizar pago"
                                  type="button"
                                >
                                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                </button>
                              ) : null}

                              {canPayWithPaypal && request.payment ? (
                                <button
                                  className={`${styles.iconBtn} ${styles.primary}`}
                                  disabled={isMutatingPaymentId === request.payment.id}
                                  onClick={() => onCreatePaymentCheckout(request.payment!.id)}
                                  title={request.payment.checkoutUrl ? 'Continuar pago' : 'Pagar reserva'}
                                  type="button"
                                >
                                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                  </svg>
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <TripsListPagination
                onPageChange={setMyRequestsPage}
                page={myRequestsPage}
                pageSize={myRequestsPageSize}
                totalItems={myRequests.length}
              />
            </>
          ) : (
            <TripsEditorialEmptyState
              actionLabel="Explorar viajes"
              eyebrow="Mis solicitudes"
              onAction={onExploreTrips}
              title="Aun no has solicitado un viaje"
            />
          )}
        </article>
      ) : null}

      {showMyRequestsSection && closureItems.length && (!showPassengerTabs || passengerSection === 'closure') ? (
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

function RequestMetaItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="trip-request-meta-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildPassengerClosureItems(myRequests: TripRequestRecord[]): TripClosureActionItem[] {
  return myRequests
    .map((request) => {
      if (!wasConfirmedBeforeClosure(request)) {
        return null;
      }

      const summary = getTripPostClosureSummary({
        status: request.tripStatus,
        departureAt: request.tripDepartureAt,
        estimatedArrivalAt: request.tripEstimatedArrivalAt,
        completedAt: request.tripCompletedAt,
        cancelledAt: request.tripCancelledAt,
      });

      if (!summary.canCreateRating && !summary.canCreateIncidentReport) {
        return null;
      }

      const actionParts: string[] = [];

      if (summary.canCreateRating) {
        actionParts.push('calificar al conductor');
      }

      if (summary.canCreateIncidentReport) {
        actionParts.push('registrar un reporte si hubo un problema');
      }

      const actions: TripClosureActionItem['actions'] = [];

      if (summary.canCreateRating) {
        actions.push({
          label: 'Ir a calificaciones',
          href: buildTrustClosureHref({
            focus: 'rating',
            tripId: request.tripId,
            membershipId: request.driverMembershipId,
          }),
        });
      }

      if (summary.canCreateIncidentReport) {
        actions.push({
          label: 'Ir a reportes',
          href: buildTrustClosureHref({
            focus: 'report',
            tripId: request.tripId,
            membershipId: request.driverMembershipId,
          }),
          variant: summary.canCreateRating ? 'ghost' : 'secondary',
        });
      }

      return {
        id: request.id,
        title: `${request.tripOriginLabel} -> ${request.tripDestinationLabel}`,
        subtitle: `Pasajero | ${request.driverFullName}`,
        summary: request.tripClosureNote
          ? `${actionParts.join(' y ')}. Nota de cierre: ${request.tripClosureNote}`
          : actionParts.join(' y '),
        windowLabel: getTripClosureWindowCopy(summary),
        tripStatusLabel: getTripStatusLabel(request.tripStatus),
        tripStatusTone: getTripStatusTone(request.tripStatus),
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
  membershipId,
}: {
  focus: 'rating' | 'report';
  tripId: string;
  membershipId?: string;
}): string {
  const searchParams = new URLSearchParams({
    focus,
    tripId,
  });

  if (membershipId) {
    searchParams.set('membershipId', membershipId);
  }

  return `/confianza?${searchParams.toString()}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-EC');
}
