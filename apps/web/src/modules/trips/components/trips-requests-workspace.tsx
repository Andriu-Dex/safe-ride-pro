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
import { useState } from 'react';

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
import { TripsWorkspaceSkeleton } from './trips-workspace-skeleton';

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
  const incomingSectionTitle =
    showIncomingRequestsSection && !showMyRequestsSection
      ? 'Aprobar solicitudes'
      : 'Solicitudes recibidas';
  const incomingResultsCount = incomingRequestsCountOverride ?? incomingRequests.length;
  const myRequestsResultsCount = myRequestsCountOverride ?? myRequests.length;
  const closureItems = buildPassengerClosureItems(myRequests);

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

      <section className="trips-workspace-grid">
      {isRefreshingData ? <TripsWorkspaceSkeleton variant="requests" /> : null}

      {showActiveRidePanel ? (
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
            <div className="list-stack">
              {incomingRequests.map((request) => (
                <div key={request.id} className="list-card trip-request-card trip-request-card-incoming">
                  <div className="list-card-header">
                    <strong>{request.passengerFullName}</strong>
                    <div className="trip-request-status-group">
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
                      {request.payment ? (
                        <StatusPill
                          label={getTripPaymentStatusLabel(request.payment.status)}
                          tone={getTripPaymentStatusTone(request.payment.status)}
                        />
                      ) : null}
                    </div>
                  </div>

                  <div className="trip-request-route-line">
                    <strong>{request.tripOriginLabel} -&gt; {request.tripDestinationLabel}</strong>
                  </div>

                  <div className="trip-request-meta-grid">
                    <RequestMetaItem label="Salida" value={formatDateTime(request.tripDepartureAt)} />
                    <RequestMetaItem label="Viaje" value={getTripStatusLabel(request.tripStatus)} />
                    <RequestMetaItem label="Solicitud" value={getTripRequestStatusLabel(request.status)} />
                    <RequestMetaItem
                      label="Ejecucion"
                      value={getTripRequestExecutionStatusLabel(request.executionStatus)}
                    />
                    <RequestMetaItem label="Pasajero" value={request.passengerFullName} />
                    <RequestMetaItem
                      label="Pago"
                      value={
                        request.payment
                          ? getTripPaymentStatusLabel(request.payment.status)
                          : 'Aun no generado'
                      }
                    />
                  </div>

                  {request.requestMessage ? (
                    <div className="trip-request-note">
                      <strong>Mensaje</strong>
                      <p>{request.requestMessage}</p>
                    </div>
                  ) : null}
                  {request.status === TripRequestStatus.Pending
                  && request.tripStatus === TripStatus.Full ? (
                    <p className="panel-text">Viaje sin cupos.</p>
                  ) : null}
                  {request.status === TripRequestStatus.Pending
                  && request.tripStatus !== TripStatus.Published
                  && request.tripStatus !== TripStatus.Full ? (
                    <p className="panel-text">Solicitud desactualizada.</p>
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
                  {request.payment ? (
                    <div className="trip-request-note trip-request-note-muted">
                      <strong>Pago del pasajero</strong>
                      <p>
                        {formatTripPaymentAmount(request.payment.amount, request.payment.currencyCode)}
                        {' | '}
                        {getPaymentProviderLabel(request.payment.provider)}
                      </p>
                    </div>
                  ) : null}
                  {request.payment?.provider === PaymentProvider.Cash &&
                  request.payment.status === TripPaymentStatus.Pending &&
                  request.status === TripRequestStatus.Accepted ? (
                    <div className="button-row trip-request-action-row">
                      <Button
                        disabled={isMutatingPaymentId === request.payment.id}
                        onClick={() => onConfirmCashPayment(request.payment!.id)}
                      >
                        Pago recibido
                      </Button>
                      <Button
                        disabled={isMutatingPaymentId === request.payment.id}
                        onClick={() => onReportCashPaymentIssue(request.payment!.id)}
                        variant="secondary"
                      >
                        Reportar novedad
                      </Button>
                    </div>
                  ) : null}
                  <div className="button-row trip-request-action-row">
                    <Button
                      onClick={() => {
                        setSelectedRequestPerspective('driver');
                        setSelectedRequest(request);
                      }}
                      variant="ghost"
                    >
                      Ver solicitud
                    </Button>
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
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <TripsEditorialEmptyState
              eyebrow={incomingSectionTitle}
              title="Nada por aprobar por ahora"
            />
          )}
        </article>
      ) : null}

      {showMyRequestsSection ? (
        <article className="panel panel-stack trips-stream-panel">
          <div className="section-heading">
            <h2 className="panel-title">Mis solicitudes</h2>
            <p className="section-heading-meta">{myRequestsResultsCount} resultados</p>
          </div>
          {myRequests.length ? (
            <div className="list-stack">
              {myRequests.map((request) => (
                <div key={request.id} className="list-card trip-request-card trip-request-card-own">
                  <div className="list-card-header">
                    <strong>{request.tripOriginLabel} -&gt; {request.tripDestinationLabel}</strong>
                    <div className="trip-request-status-group">
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
                    {request.payment ? (
                      <StatusPill
                        label={getTripPaymentStatusLabel(request.payment.status)}
                        tone={getTripPaymentStatusTone(request.payment.status)}
                      />
                    ) : null}
                  </div>
                </div>

                <div className="trip-request-meta-grid">
                  <RequestMetaItem label="Conductor" value={request.driverFullName} />
                  <RequestMetaItem label="Salida" value={formatDateTime(request.tripDepartureAt)} />
                  <RequestMetaItem label="Viaje" value={getTripStatusLabel(request.tripStatus)} />
                  <RequestMetaItem label="Solicitud" value={getTripRequestStatusLabel(request.status)} />
                  <RequestMetaItem
                    label="Ejecucion"
                    value={getTripRequestExecutionStatusLabel(request.executionStatus)}
                  />
                  <RequestMetaItem
                    label="Pago"
                    value={
                      request.payment
                        ? formatTripPaymentAmount(request.payment.amount, request.payment.currencyCode)
                        : 'Sin cargo'
                    }
                  />
                </div>

                {request.reviewNote ? (
                  <div className="trip-request-note trip-request-note-muted">
                    <strong>Revision</strong>
                    <p>{request.reviewNote}</p>
                  </div>
                ) : null}
                {request.payment ? (
                  <div className="trip-request-note trip-request-note-muted">
                    <strong>Estado de pago</strong>
                    <p>
                      {getTripPaymentStatusLabel(request.payment.status)}
                      {' | '}
                      {getPaymentProviderLabel(request.payment.provider)}
                    </p>
                    {request.payment.paidAt ? (
                      <p>Confirmado {formatDateTime(request.payment.paidAt)}</p>
                    ) : null}
                  </div>
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
                  <p className="panel-text">Ya no se puede cancelar.</p>
                ) : null}
                {canCancelOwnRequest(request) ? (
                  <div className="button-row trip-request-action-row">
                    <Button
                      onClick={() => {
                        setSelectedRequestPerspective('passenger');
                        setSelectedRequest(request);
                      }}
                      variant="secondary"
                    >
                      Ver solicitud
                    </Button>
                    <Button
                      disabled={isMutatingRequestId === request.id}
                      onClick={() => setSelectedRequestForCancel(request)}
                      variant="ghost"
                    >
                      Cancelar solicitud
                    </Button>
                  </div>
                ) : null}
                {!canCancelOwnRequest(request) ? (
                  <div className="button-row trip-request-action-row">
                    <Button
                      onClick={() => {
                        setSelectedRequestPerspective('passenger');
                        setSelectedRequest(request);
                      }}
                      variant="ghost"
                    >
                      Ver solicitud
                    </Button>
                  </div>
                ) : null}
                {request.payment ? (
                  <div className="button-row trip-request-action-row">
                    {request.payment.provider === PaymentProvider.Paypal &&
                    !isTripPaymentSettled(request.payment.status) &&
                    !isTripPaymentClosed(request.payment.status) ? (
                      <Button
                        disabled={isMutatingPaymentId === request.payment.id}
                        onClick={() => onCreatePaymentCheckout(request.payment!.id)}
                      >
                        {request.payment.checkoutUrl ? 'Abrir pago' : 'Pagar con PayPal'}
                      </Button>
                    ) : null}
                    {request.payment.provider === PaymentProvider.Paypal &&
                    !isTripPaymentSettled(request.payment.status) ? (
                      <Button
                        disabled={isMutatingPaymentId === request.payment.id}
                        onClick={() => onRefreshPaymentStatus(request.payment!.id)}
                        variant="secondary"
                      >
                        Actualizar pago
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              ))}
            </div>
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

      {showMyRequestsSection && closureItems.length ? (
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

