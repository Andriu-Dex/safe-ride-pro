import {
  PaymentProvider,
  TripRequestStatus,
  TripRouteMode,
  TripStatus,
} from '@saferidepro/shared-types';
import Link from 'next/link';

import { Button } from '../../../components/ui/button';
import { StatusPill } from '../../../components/ui/status-pill';
import type { InstitutionSettingsRecord } from '../../institutions/types/institution-settings';
import { formatWalletAmount } from '../../wallet/lib/wallet-labels';
import type { WalletRecord } from '../../wallet/types/wallet';
import { TextareaField } from '../../../components/ui/textarea-field';
import type { TripRequestRecord } from '../../trip-requests/types/trip-request';
import type { TripFilters, TripRecord } from '../types/trip';
import { TripReservationCommitment } from './trip-reservation-commitment';
import { TripsEditorialEmptyState } from './trips-editorial-empty-state';
import { TripsListPagination } from './trips-list-pagination';
import { TripRequestDetourPlanner } from './trip-request-detour-planner';
import { EMPTY_REQUEST_DRAFT, type TripRequestDraft } from './trips-workspace.types';
import { TripsWorkspaceSkeleton } from './trips-workspace-skeleton';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './trips-discover-workspace.module.css';

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
  onBlockedAction?: (title: string, description: string) => void;
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
  onBlockedAction,
  canCreateRequestForTrip,
  isRefreshingData = false,
}: TripsDiscoverWorkspaceProps) {
  const [page, setPage] = useState(1);
  const [requestTripModalId, setRequestTripModalId] = useState<string | null>(null);
  const pageSize = 6;
  const paginatedTrips = useMemo(
    () => visibleAvailableTrips.slice((page - 1) * pageSize, page * pageSize),
    [page, visibleAvailableTrips],
  );
  const visibleTripsWithSeatsCount = visibleAvailableTrips.filter(
    (trip) => trip.status === TripStatus.Published && trip.availableSeats > 0,
  ).length;
  const notifyBlockedAction = (title: string, description: string) => {
    onBlockedAction?.(title, description);
  };

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
              tone={visibleTripsWithSeatsCount > 0 ? 'neutral' : 'warning'}
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
          <div className={styles.tripList}>
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
                <article className={styles.tripRow} key={trip.id}>
                  <div className={styles.tripRouteCell}>
                    <div className={styles.tripRouteTopline}>
                      <span className={styles.tripKicker}>{trip.routeMode === TripRouteMode.PlannedDetour ? 'Desvio permitido' : 'Ruta directa'}</span>
                    </div>
                    <h3 className={styles.tripRoute}>
                      {trip.originLabel} <span aria-hidden="true">&rarr;</span> {trip.destinationLabel}
                    </h3>
                    <div className={styles.tripMetaStrip}>
                      <span>{trip.vehicleDisplayName}</span>
                      <span>{trip.vehiclePlate}</span>
                    </div>
                  </div>

                  <div className={styles.tripCell}>
                    <span>Salida</span>
                    <strong>{new Date(trip.departureAt).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })}</strong>
                    <small>{new Date(trip.departureAt).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false })}</small>
                  </div>

                  <div className={styles.tripCell}>
                    <span>Conductor</span>
                    <strong>{trip.driverFullName}</strong>
                  </div>

                  <div className={styles.tripCell}>
                    <span>Cupos libres</span>
                    <strong>{trip.availableSeats} / {trip.seatCount}</strong>
                  </div>

                  <div className={styles.tripCell}>
                    <span>Precio</span>
                    <strong>${trip.basePriceReference.toFixed(2)}</strong>
                  </div>

                  <div className={styles.tripSignals}>
                    <StatusPill label={requestState.label} tone={requestState.tone === 'success' ? 'neutral' : requestState.tone} />
                  </div>

                  <div className={styles.tripActions}>
                    <Link className={styles.tripAction} href={`/viajes/${trip.id}`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '0.3rem'}}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                      Detalle
                    </Link>
                    <button
                      className={styles.tripAction}
                      onClick={() => {
                        if (hasActiveRequest) {
                          notifyBlockedAction(
                            'Solicitud ya registrada',
                            'Revisa el estado y el pago desde Mis solicitudes.',
                          );
                          onOpenRequests();
                          return;
                        }

                        if (isMutatingRequestId === trip.id) {
                          notifyBlockedAction('Operacion en curso', 'Espera a que termine la accion anterior.');
                          return;
                        }

                        if (isPassengerOperationBlocked) {
                          notifyBlockedAction('No puedes solicitar', 'Tienes una restriccion activa como pasajero.');
                          return;
                        }

                        if (!hasActiveRequest && (trip.status === TripStatus.Full || trip.availableSeats <= 0)) {
                          notifyBlockedAction('Sin cupos disponibles', 'Este viaje ya no tiene cupos libres.');
                          return;
                        }

                        setRequestTripModalId(trip.id);
                      }}
                      style={hasActiveRequest ? { background: '#f0f6ff', borderColor: '#0061a5', color: '#0061a5', cursor: 'pointer' } : { background: '#0061a5', color: '#fff', borderColor: '#0061a5', cursor: 'pointer' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '0.3rem'}}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>
                      {hasActiveRequest ? 'Gestionar' : 'Solicitar'}
                    </button>
                  </div>
                </article>
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

      {requestTripModalId && typeof document !== 'undefined' ? (() => {
        const trip = visibleAvailableTrips.find(t => t.id === requestTripModalId);
        if (!trip) return null;

        const hasActiveRequest = myRequests.some(
          (request) =>
            request.tripId === trip.id
            && (request.status === TripRequestStatus.Pending
              || request.status === TripRequestStatus.Accepted),
        );
        const canSubmitRequest = canCreateRequestForTrip(trip, hasActiveRequest);
        const canUseCashPayment = reservationSettings?.allowCashPayments ?? true;
        const canUsePaypalPayment = reservationSettings?.allowPaypalPayments ?? true;
        const requestAmount = trip.basePriceReference + (trip.detourSurchargeReference ?? 0);
        const canUseWalletPayment =
          (reservationSettings?.allowWalletPayments ?? true) &&
          Boolean(wallet) &&
          (wallet?.account.availableBalance ?? 0) >= requestAmount;
        const hasEnabledPaymentOption = canUseCashPayment || canUsePaypalPayment || canUseWalletPayment;
        const draft = requestDrafts[trip.id] ?? ({
            ...EMPTY_REQUEST_DRAFT,
            paymentProvider: !canUseCashPayment && canUsePaypalPayment
                ? PaymentProvider.Paypal
                : !canUseCashPayment && !canUsePaypalPayment && canUseWalletPayment
                  ? PaymentProvider.Wallet
                : PaymentProvider.Cash,
          } as TripRequestDraft);

        return createPortal(
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1800, display: 'grid', placeItems: 'center', padding: '1rem',
            background: 'rgba(2, 20, 40, 0.65)', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.25s ease'
          }}>
            <div style={{
              background: '#ffffff', width: 'min(100%, 38rem)', borderRadius: '24px', padding: '1.5rem 1.75rem',
              maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: '1.25rem',
              boxShadow: '0 24px 60px rgba(0, 97, 165, 0.2), 0 0 0 1px rgba(0, 97, 165, 0.1)',
              animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)', overflow: 'hidden'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#002045', fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                    {hasActiveRequest ? 'Solicitud registrada' : 'Solicitar este viaje'}
                  </h3>
                  <p style={{ margin: '0.35rem 0 0', color: '#5a6c72', fontSize: '0.95rem' }}>
                    {trip.routeMode === TripRouteMode.PlannedDetour ? 'Ruta personalizable (desvios permitidos)' : 'Ruta directa sin desvios'}
                  </p>
                </div>
                <button
                  onClick={() => setRequestTripModalId(null)}
                  style={{
                    display: 'grid', placeItems: 'center', width: '2.2rem', height: '2.2rem', borderRadius: '50%',
                    background: 'rgba(0, 97, 165, 0.08)', border: 'none', color: '#0061a5', cursor: 'pointer', transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0, 97, 165, 0.15)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'rgba(0, 97, 165, 0.08)'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              <div style={{ overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {trip.routeMode === TripRouteMode.PlannedDetour ? (
                  <TripRequestDetourPlanner
                    destinationLabel={trip.destinationLabel}
                    destinationLatitude={trip.destinationLatitude?.toFixed(6) ?? ''}
                    destinationLongitude={trip.destinationLongitude?.toFixed(6) ?? ''}
                    routePath={trip.routePath}
                    disabled={isPassengerOperationBlocked || isMutatingRequestId === trip.id || hasActiveRequest}
                    draft={draft}
                    originLabel={trip.originLabel}
                    originLatitude={trip.originLatitude?.toFixed(6) ?? ''}
                    originLongitude={trip.originLongitude?.toFixed(6) ?? ''}
                    onChange={(field, value) => onRequestDraftChange(trip.id, field, value)}
                  />
                ) : (
                  <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '16px', borderLeft: '4px solid #0061a5' }}>
                    <strong style={{ color: '#0b1c30', display: 'block', marginBottom: '0.5rem', fontSize: '1.05rem' }}>Informacion de la ruta</strong>
                    <p style={{ margin: 0, color: '#4a5568', fontSize: '0.95rem', lineHeight: 1.5 }}>
                      La recogida siempre parte desde la institucion y el pasajero debe seguir la ruta definida por el conductor.
                    </p>
                    <div style={{ display: 'grid', gap: '0.85rem', marginTop: '1.25rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Recogida</span>
                        <strong style={{ color: '#0f172a', fontSize: '1rem' }}>{trip.originLabel}</strong>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Destino del trayecto</span>
                        <strong style={{ color: '#0f172a', fontSize: '1rem' }}>{trip.destinationLabel}</strong>
                      </div>
                    </div>
                  </div>
                )}

                <TextareaField
                  label="Mensaje"
                  onChange={(event) => onRequestDraftChange(trip.id, 'requestMessage', event.target.value)}
                  placeholder="Comentario opcional para el conductor"
                  rows={3}
                  value={draft.requestMessage}
                />

                <fieldset className="trip-payment-choice" style={{ margin: 0, padding: 0, border: 'none', display: 'grid', gap: '0.75rem' }}>
                  <legend style={{ fontSize: '1rem', fontWeight: 800, color: '#0b1c30', marginBottom: '0.5rem' }}>Forma de pago</legend>
                  {canUseCashPayment && (
                    <label className="trip-payment-option" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1rem', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'border-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.borderColor = '#94a3b8'} onMouseOut={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}>
                      <input checked={draft.paymentProvider === PaymentProvider.Cash} disabled={hasActiveRequest || isMutatingRequestId === trip.id} name={`payment-${trip.id}`} onChange={() => onRequestDraftChange(trip.id, 'paymentProvider', PaymentProvider.Cash)} type="radio" style={{ width: '1.25rem', height: '1.25rem', accentColor: '#0061a5' }} />
                      <span style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ color: '#0f172a', fontSize: '0.98rem' }}>Efectivo</strong>
                        <small style={{ color: '#64748b', fontSize: '0.85rem' }}>Pagas al finalizar el viaje.</small>
                      </span>
                    </label>
                  )}
                  {canUsePaypalPayment && (
                    <label className="trip-payment-option" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1rem', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'border-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.borderColor = '#94a3b8'} onMouseOut={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}>
                      <input checked={draft.paymentProvider === PaymentProvider.Paypal} disabled={hasActiveRequest || isMutatingRequestId === trip.id} name={`payment-${trip.id}`} onChange={() => onRequestDraftChange(trip.id, 'paymentProvider', PaymentProvider.Paypal)} type="radio" style={{ width: '1.25rem', height: '1.25rem', accentColor: '#0061a5' }} />
                      <span style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ color: '#0f172a', fontSize: '0.98rem' }}>PayPal</strong>
                        <small style={{ color: '#64748b', fontSize: '0.85rem' }}>Debes pagar antes de enviar al conductor.</small>
                      </span>
                    </label>
                  )}
                  {(reservationSettings?.allowWalletPayments ?? true) && (
                    <label className="trip-payment-option" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1rem', background: '#f8fafc', borderRadius: '14px', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'border-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.borderColor = '#94a3b8'} onMouseOut={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}>
                      <input checked={draft.paymentProvider === PaymentProvider.Wallet} disabled={hasActiveRequest || isMutatingRequestId === trip.id || !canUseWalletPayment} name={`payment-${trip.id}`} onChange={() => onRequestDraftChange(trip.id, 'paymentProvider', PaymentProvider.Wallet)} type="radio" style={{ width: '1.25rem', height: '1.25rem', accentColor: '#0061a5' }} />
                      <span style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong style={{ color: '#0f172a', fontSize: '0.98rem' }}>Billetera</strong>
                        <small style={{ color: '#64748b', fontSize: '0.85rem' }}>
                          {wallet ? `${formatWalletAmount(wallet.account.availableBalance, wallet.account.currencyCode)} disponible` : 'Sin saldo disponible'}
                        </small>
                      </span>
                    </label>
                  )}
                  {!hasEnabledPaymentOption && (
                    <p style={{ margin: 0, color: '#b42318', fontSize: '0.9rem', padding: '0.85rem', background: '#fef2f2', borderRadius: '12px', border: '1px solid #fecaca' }}>
                      Esta institucion no tiene formas de pago habilitadas para nuevas reservas.
                    </p>
                  )}
                </fieldset>

                <TripReservationCommitment
                  checked={draft.acceptReservationCommitment}
                  disabled={hasActiveRequest || isMutatingRequestId === trip.id || isPassengerOperationBlocked}
                  onCheckedChange={(checked) => onRequestDraftChange(trip.id, 'acceptReservationCommitment', checked)}
                  settings={reservationSettings}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.85rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0' }}>
                <button
                  onClick={() => setRequestTripModalId(null)}
                  style={{
                    padding: '0.75rem 1.25rem', borderRadius: '12px', background: 'transparent', border: '1px solid #cbd5e1',
                    color: '#475569', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem', transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                >
                  Cancelar
                </button>
                <Button
                  onClick={() => {
                    if (isMutatingRequestId === trip.id) {
                      notifyBlockedAction('Operacion en curso', 'Espera a que termine la accion anterior.');
                      return;
                    }

                    if (isPassengerOperationBlocked) {
                      notifyBlockedAction('No puedes solicitar', 'Tienes una restriccion activa como pasajero.');
                      return;
                    }

                    if (!hasEnabledPaymentOption) {
                      notifyBlockedAction('No puedes solicitar', 'No hay formas de pago habilitadas.');
                      return;
                    }

                    if (!draft.acceptReservationCommitment) {
                      notifyBlockedAction('Falta confirmar reglas', 'Acepta las reglas de reserva antes de continuar.');
                      return;
                    }

                    if (!canSubmitRequest) {
                      notifyBlockedAction(
                        trip.status === TripStatus.Full ? 'Sin cupos disponibles' : 'No puedes solicitar',
                        trip.status === TripStatus.Full
                          ? 'Este viaje ya no tiene cupos libres.'
                          : 'Este viaje no esta disponible para una nueva solicitud.',
                      );
                      return;
                    }

                    onCreateRequest(trip);
                    setRequestTripModalId(null);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: '12px', fontSize: '0.95rem' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  {hasActiveRequest ? 'Actualizar' : trip.status === TripStatus.Full ? 'Sin cupos disponibles' : 'Confirmar solicitud'}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        );
      })() : null}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}} />
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
