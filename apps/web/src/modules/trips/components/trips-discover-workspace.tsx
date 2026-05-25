import {
  PaymentProvider,
  TripRequestStatus,
  TripRouteMode,
  TripStatus,
} from '@saferidepro/shared-types';
import Link from 'next/link';

import { Button } from '../../../components/ui/button';
import { DisclosurePanel } from '../../../components/ui/disclosure-panel';
import { StatusPill } from '../../../components/ui/status-pill';
import type { InstitutionSettingsRecord } from '../../institutions/types/institution-settings';
import { formatWalletAmount } from '../../wallet/lib/wallet-labels';
import type { WalletRecord } from '../../wallet/types/wallet';
import { TextareaField } from '../../../components/ui/textarea-field';
import type { TripRequestRecord } from '../../trip-requests/types/trip-request';
import type { TripFilters, TripRecord } from '../types/trip';
import { TripReservationCommitment } from './trip-reservation-commitment';
import { TripOverviewCard } from './trip-overview-card';
import { TripsEditorialEmptyState } from './trips-editorial-empty-state';
import { TripsListPagination } from './trips-list-pagination';
import { TripRequestDetourPlanner } from './trip-request-detour-planner';
import { EMPTY_REQUEST_DRAFT, type TripRequestDraft } from './trips-workspace.types';
import { TripsWorkspaceSkeleton } from './trips-workspace-skeleton';
import { useEffect, useMemo, useState } from 'react';

type TripsDiscoverWorkspaceProps = {
  activeFiltersCount: number;
  activeFilterLabels: string[];
  visibleAvailableTrips: TripRecord[];
  filterFormValues: TripFilters;
  isFiltering: boolean;
  requestDrafts: Record<string, TripRequestDraft>;
  myRequests: TripRequestRecord[];
  reservationSettings: InstitutionSettingsRecord | null;
  wallet: WalletRecord | null;
  isMutatingRequestId: string | null;
  isPassengerOperationBlocked: boolean;
  onFilterChange: (field: keyof TripFilters, value: string) => void;
  onApplyFilters: (event: React.FormEvent<HTMLFormElement>) => void;
  onResetFilters: () => void;
  onOpenRequests: () => void;
  onRequestDraftChange: (
    tripId: string,
    field: keyof TripRequestDraft,
    value: string | boolean,
  ) => void;
  onCreateRequest: (trip: TripRecord) => void;
  canCreateRequestForTrip: (trip: TripRecord, hasActiveRequest: boolean) => boolean;
  isRefreshingData?: boolean;
};

export function TripsDiscoverWorkspace({
  activeFiltersCount,
  activeFilterLabels,
  visibleAvailableTrips,
  filterFormValues,
  isFiltering,
  requestDrafts,
  myRequests,
  reservationSettings,
  wallet,
  isMutatingRequestId,
  isPassengerOperationBlocked,
  onFilterChange,
  onApplyFilters,
  onResetFilters,
  onOpenRequests,
  onRequestDraftChange,
  onCreateRequest,
  canCreateRequestForTrip,
  isRefreshingData = false,
}: TripsDiscoverWorkspaceProps) {
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const paginatedTrips = useMemo(
    () => visibleAvailableTrips.slice((page - 1) * pageSize, page * pageSize),
    [page, visibleAvailableTrips],
  );
  const visibleTripsWithSeatsCount = visibleAvailableTrips.filter(
    (trip) => trip.status === TripStatus.Published && trip.availableSeats > 0,
  ).length;

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(visibleAvailableTrips.length / pageSize));

    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, visibleAvailableTrips.length]);

  return (
    <section className="trips-discover-stack">
      {isRefreshingData ? <TripsWorkspaceSkeleton variant="discover" /> : null}

      <article className="panel panel-stack trips-stream-panel">
        <div className="trip-discover-stream-head">
          <div className="section-heading">
            <h2 className="panel-title">Viajes disponibles</h2>
            <p className="section-heading-meta">
              {visibleAvailableTrips.length} resultado{visibleAvailableTrips.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="chip-row">
            <StatusPill
              label={`${visibleTripsWithSeatsCount} con cupos`}
              tone={visibleTripsWithSeatsCount > 0 ? 'success' : 'warning'}
            />
          </div>
        </div>

        {activeFilterLabels.length ? (
          <div className="chip-row trip-filter-chip-row">
            {activeFilterLabels.map((label) => (
              <span key={label} className="status-pill status-pill-neutral">
                {label}
              </span>
            ))}
          </div>
        ) : null}

        {visibleAvailableTrips.length ? (
          <div className="list-stack">
            {paginatedTrips.map((trip) => {
              const hasActiveRequest = myRequests.some(
                (request) =>
                  request.tripId === trip.id
                  && (request.status === TripRequestStatus.Pending
                    || request.status === TripRequestStatus.Accepted),
              );
              const canSubmitRequest = canCreateRequestForTrip(trip, hasActiveRequest);
              const requestState = getRequestStateLabel(
                trip,
                hasActiveRequest,
                isPassengerOperationBlocked,
              );
              const canUseCashPayment =
                reservationSettings?.allowCashPayments ?? true;
              const canUsePaypalPayment =
                reservationSettings?.allowPaypalPayments ?? true;
              const requestAmount = trip.basePriceReference + (trip.detourSurchargeReference ?? 0);
              const canUseWalletPayment =
                (reservationSettings?.allowWalletPayments ?? true) &&
                Boolean(wallet) &&
                (wallet?.account.availableBalance ?? 0) >= requestAmount;
              const hasEnabledPaymentOption =
                canUseCashPayment || canUsePaypalPayment || canUseWalletPayment;
              const draft =
                requestDrafts[trip.id] ??
                ({
                  ...EMPTY_REQUEST_DRAFT,
                  paymentProvider:
                    !canUseCashPayment && canUsePaypalPayment
                      ? PaymentProvider.Paypal
                      : !canUseCashPayment && !canUsePaypalPayment && canUseWalletPayment
                        ? PaymentProvider.Wallet
                      : PaymentProvider.Cash,
                } satisfies TripRequestDraft);

              return (
                <TripOverviewCard
                  key={trip.id}
                  emphasis
                  showDriver
                  trip={trip}
                >
                  <div className="trip-request-composer-stack">
                    <div className="chip-row trip-request-composer-pills">
                      <StatusPill label={requestState.label} tone={requestState.tone} />
                      <StatusPill
                        label={
                          trip.routeMode === TripRouteMode.PlannedDetour
                            ? 'Desvio permitido'
                            : 'Ruta directa'
                        }
                        tone="neutral"
                      />
                      <StatusPill
                        label={`${trip.availableSeats} de ${trip.seatCount} cupos`}
                        tone={trip.availableSeats > 0 ? 'success' : 'warning'}
                      />
                    </div>

                    <DisclosurePanel
                      className="trip-request-composer"
                      defaultOpen={trip.routeMode === TripRouteMode.PlannedDetour}
                      meta={
                        trip.routeMode === TripRouteMode.PlannedDetour
                          ? 'Personalizable'
                          : 'Rapida'
                      }
                      title={hasActiveRequest ? 'Solicitud registrada' : 'Solicitar este viaje'}
                    >
                      <div className="trip-request-composer-grid">
                        {trip.routeMode === TripRouteMode.PlannedDetour ? (
                          <TripRequestDetourPlanner
                            destinationLabel={trip.destinationLabel}
                            destinationLatitude={trip.destinationLatitude?.toFixed(6) ?? ''}
                            destinationLongitude={trip.destinationLongitude?.toFixed(6) ?? ''}
                            routePath={trip.routePath}
                            disabled={
                              isPassengerOperationBlocked
                              || isMutatingRequestId === trip.id
                              || hasActiveRequest
                            }
                            draft={draft}
                            originLabel={trip.originLabel}
                            originLatitude={trip.originLatitude?.toFixed(6) ?? ''}
                            originLongitude={trip.originLongitude?.toFixed(6) ?? ''}
                            onChange={(field, value) =>
                              onRequestDraftChange(trip.id, field, value)}
                          />
                        ) : (
                          <div className="trip-request-routing-rule">
                            <strong>Ruta sin desvio</strong>
                            <p>
                              La recogida siempre parte desde la institucion y el pasajero debe
                              seguir la ruta definida por el conductor.
                            </p>
                            <div className="trip-request-fixed-points">
                              <div className="trip-request-fixed-point">
                                <span>Recogida</span>
                                <strong>{trip.originLabel}</strong>
                              </div>
                              <div className="trip-request-fixed-point">
                                <span>Destino del trayecto</span>
                                <strong>{trip.destinationLabel}</strong>
                              </div>
                            </div>
                          </div>
                        )}

                        <TextareaField
                          label="Mensaje"
                          onChange={(event) =>
                            onRequestDraftChange(trip.id, 'requestMessage', event.target.value)
                          }
                          placeholder="Comentario opcional para el conductor"
                          rows={3}
                          value={draft.requestMessage}
                        />

                        <fieldset className="trip-payment-choice">
                          <legend>Forma de pago</legend>
                          {canUseCashPayment ? (
                            <label className="trip-payment-option">
                              <input
                                checked={draft.paymentProvider === PaymentProvider.Cash}
                                disabled={hasActiveRequest || isMutatingRequestId === trip.id}
                                name={`payment-${trip.id}`}
                                onChange={() =>
                                  onRequestDraftChange(
                                    trip.id,
                                    'paymentProvider',
                                    PaymentProvider.Cash,
                                  )}
                                type="radio"
                              />
                              <span>
                                <strong>Efectivo</strong>
                                <small>Pagas al finalizar el viaje.</small>
                              </span>
                            </label>
                          ) : null}
                          {canUsePaypalPayment ? (
                            <label className="trip-payment-option">
                              <input
                                checked={draft.paymentProvider === PaymentProvider.Paypal}
                                disabled={hasActiveRequest || isMutatingRequestId === trip.id}
                                name={`payment-${trip.id}`}
                                onChange={() =>
                                  onRequestDraftChange(
                                    trip.id,
                                    'paymentProvider',
                                    PaymentProvider.Paypal,
                                  )}
                                type="radio"
                              />
                              <span>
                                <strong>PayPal</strong>
                                <small>Debes pagar antes de enviar al conductor.</small>
                              </span>
                            </label>
                          ) : null}
                          {(reservationSettings?.allowWalletPayments ?? true) ? (
                            <label className="trip-payment-option">
                              <input
                                checked={draft.paymentProvider === PaymentProvider.Wallet}
                                disabled={
                                  hasActiveRequest ||
                                  isMutatingRequestId === trip.id ||
                                  !canUseWalletPayment
                                }
                                name={`payment-${trip.id}`}
                                onChange={() =>
                                  onRequestDraftChange(
                                    trip.id,
                                    'paymentProvider',
                                    PaymentProvider.Wallet,
                                  )}
                                type="radio"
                              />
                              <span>
                                <strong>Billetera</strong>
                                <small>
                                  {wallet
                                    ? `${formatWalletAmount(wallet.account.availableBalance, wallet.account.currencyCode)} disponible`
                                    : 'Sin saldo disponible'}
                                </small>
                              </span>
                            </label>
                          ) : null}
                          {!hasEnabledPaymentOption ? (
                            <p className="panel-text">
                              Esta institucion no tiene formas de pago habilitadas para nuevas
                              reservas.
                            </p>
                          ) : null}
                        </fieldset>

                        <TripReservationCommitment
                          checked={draft.acceptReservationCommitment}
                          disabled={
                            hasActiveRequest ||
                            isMutatingRequestId === trip.id ||
                            isPassengerOperationBlocked
                          }
                          onCheckedChange={(checked) =>
                            onRequestDraftChange(
                              trip.id,
                              'acceptReservationCommitment',
                              checked,
                            )}
                          settings={reservationSettings}
                        />

                        <div className="button-row trip-request-composer-footer">
                          <Link className="button button-ghost" href={`/viajes/${trip.id}`}>
                            Ver detalle
                          </Link>
                          <Button
                            disabled={
                              !canSubmitRequest
                              || !draft.acceptReservationCommitment
                              || !hasEnabledPaymentOption
                              || isMutatingRequestId === trip.id
                              || isPassengerOperationBlocked
                            }
                            onClick={() => onCreateRequest(trip)}
                          >
                            {hasActiveRequest
                              ? 'Ya solicitaste este viaje'
                              : isPassengerOperationBlocked
                                ? 'Solicitud restringida'
                                : trip.status === TripStatus.Full
                                  ? 'Sin cupos disponibles'
                                  : 'Solicitar cupo'}
                          </Button>
                        </div>
                      </div>
                    </DisclosurePanel>
                  </div>
                </TripOverviewCard>
              );
            })}
          </div>
        ) : (
          <TripsEditorialEmptyState
            actionLabel={activeFiltersCount > 0 ? 'Limpiar filtros' : undefined}
            eyebrow="Explorar"
            onAction={activeFiltersCount > 0 ? onResetFilters : undefined}
            title="No hay viajes que encajen con estos filtros"
          />
        )}

        <TripsListPagination
          onPageChange={setPage}
          page={page}
          pageSize={pageSize}
          totalItems={visibleAvailableTrips.length}
        />
      </article>
    </section>
  );
}

function getRequestStateLabel(
  trip: TripRecord,
  hasActiveRequest: boolean,
  isPassengerOperationBlocked: boolean,
): {
  label: string;
  tone: 'neutral' | 'success' | 'warning';
} {
  if (hasActiveRequest) {
    return {
      label: 'Solicitud activa',
      tone: 'success',
    };
  }

  if (isPassengerOperationBlocked) {
    return {
      label: 'Operacion restringida',
      tone: 'warning',
    };
  }

  if (trip.status === TripStatus.Full || trip.availableSeats <= 0) {
    return {
      label: 'Sin cupos',
      tone: 'warning',
    };
  }

  return {
    label: 'Disponible',
    tone: 'neutral',
  };
}
