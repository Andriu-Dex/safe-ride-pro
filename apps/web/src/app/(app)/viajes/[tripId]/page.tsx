'use client';

import Link from 'next/link';
import {
  CANCELLATION_LATE_WINDOW_MINUTES,
  CancellationTiming,
  TripStatus,
} from '@saferidepro/shared-types';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { persistToast } from '../../../../components/ui/flash-toast';
import { Button } from '../../../../components/ui/button';
import { ToastStack, type ToastItem } from '../../../../components/ui/toast-stack';
import { ApiError } from '../../../../lib/api-client';
import { useAuth } from '../../../../modules/auth/hooks/use-auth';
import { TripRouteMap } from '../../../../modules/trips/components/trip-route-map';
import {
  cancelTrip,
  deleteDraftTrip,
  getTripById,
} from '../../../../modules/trips/lib/trip-api';
import {
  getCancellationTimingLabel,
  getCancellationTimingTone,
  getTripRouteModeLabel,
  getTripStatusLabel,
  getTripStatusTone,
} from '../../../../modules/trips/lib/trip-labels';
import type { TripDetailRecord } from '../../../../modules/trips/types/trip';
import {
  getLuggagePolicyLabel,
  getVehicleTypeLabel,
} from '../../../../modules/vehicles/lib/vehicle-labels';
import styles from './page.module.css';

function getApiErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

function canShowLateCancellationWarning(trip: TripDetailRecord) {
  if (
    trip.status !== TripStatus.Published &&
    trip.status !== TripStatus.Full
  ) {
    return false;
  }

  const departureAt = new Date(trip.departureAt).getTime();
  const millisecondsUntilDeparture = departureAt - Date.now();

  return (
    millisecondsUntilDeparture > 0 &&
    millisecondsUntilDeparture <= CANCELLATION_LATE_WINDOW_MINUTES * 60_000
  );
}

export default function TripDetailPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = typeof params?.tripId === 'string' ? params.tripId : '';
  const router = useRouter();
  const { authSession, isHydrated, refreshSession } = useAuth();

  const [trip, setTrip] = useState<TripDetailRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDeletePromptOpen, setIsDeletePromptOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((title: string, description: string, tone: ToastItem['tone']) => {
    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id: `trip-detail-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        tone,
      },
    ]);
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  }, []);

  const loadTrip = useCallback(async () => {
    if (!authSession || !tripId) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const tripData = await getTripById(authSession.accessToken, tripId);
      setTrip(tripData);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(getApiErrorMessage(error, 'No fue posible cargar el detalle del viaje.'));
    } finally {
      setIsLoading(false);
    }
  }, [authSession, refreshSession, tripId]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!authSession || !tripId) {
      setIsLoading(false);
      return;
    }

    void loadTrip();
  }, [authSession, isHydrated, loadTrip, tripId]);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    pushToast('No fue posible continuar', errorMessage, 'error');
    setErrorMessage(null);
  }, [errorMessage, pushToast]);

  const canViewPreciseRoute = trip?.canViewPreciseRoute ?? false;
  const lateCancellationWarning = trip ? canShowLateCancellationWarning(trip) : false;
  const tripSubtitle = useMemo(() => {
    if (!trip) {
      return '';
    }

    return `${trip.institutionName} | ${formatDateTime(trip.departureAt)}`;
  }, [trip]);

  const getBadgeClass = (tone: string) => {
    switch (tone) {
      case 'success':
        return styles.heroBadgeSuccess;
      case 'warning':
        return styles.heroBadgeWarning;
      case 'danger':
        return styles.heroBadgeDanger;
      default:
        return styles.heroBadgeNeutral;
    }
  };

  const handleCancelTrip = async () => {
    if (!authSession || !trip || !trip.canCancel) {
      return;
    }

    setIsCancelling(true);

    try {
      const isDraftTrip = trip.status === TripStatus.Draft;
      const response = isDraftTrip
        ? await deleteDraftTrip(authSession.accessToken, trip.id)
        : await cancelTrip(authSession.accessToken, trip.id);
      persistToast({
        title: isDraftTrip ? 'Viaje eliminado' : 'Viaje cancelado',
        description: response.message,
        tone: 'success',
      });
      router.push('/viajes');
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      pushToast(
        trip.status === TripStatus.Draft
          ? 'El viaje no pudo eliminarse'
          : 'El viaje no pudo cancelarse',
        getApiErrorMessage(
          error,
          trip.status === TripStatus.Draft
            ? 'No fue posible eliminar este viaje.'
            : 'No fue posible cancelar este viaje.',
        ),
        'error',
      );
    } finally {
      setIsCancelling(false);
      setIsDeletePromptOpen(false);
    }
  };

  const origin =
    trip && trip.originLatitude !== null && trip.originLongitude !== null
      ? {
          label: trip.originLabel,
          address: null,
          latitude: trip.originLatitude,
          longitude: trip.originLongitude,
        }
      : null;

  const destination =
    trip && trip.destinationLatitude !== null && trip.destinationLongitude !== null
      ? {
          label: trip.destinationLabel,
          address: null,
          latitude: trip.destinationLatitude,
          longitude: trip.destinationLongitude,
        }
      : null;
  const isDraftTrip = trip?.status === TripStatus.Draft;

  if (isLoading) {
    return (
      <section className={styles.page}>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <div className={styles.loadingShell}>
          <article className={styles.stateCard}>
            <div aria-hidden="true" className={styles.loadingPulse} />
            <h1 className={styles.stateTitle}>Cargando viaje</h1>
            <p className={styles.stateText}>Estamos preparando el detalle completo del trayecto.</p>
          </article>
        </div>
      </section>
    );
  }

  if (!authSession || !trip) {
    return (
      <section className={styles.page}>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <div className={styles.loadingShell}>
          <article className={styles.stateCard}>
            <h1 className={styles.stateTitle}>No pudimos abrir este viaje</h1>
            <p className={styles.stateText}>
              Verifica que sigas dentro de la misma institucion y vuelve a intentarlo.
            </p>
            <div className={styles.topActions} style={{ marginTop: '1.5rem' }}>
              <Link className={styles.heroBtnSecondary} href="/viajes" style={{ color: '#0f2a2f', borderColor: '#cbd5e1' }}>
                Volver a viajes
              </Link>
            </div>
          </article>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <header className={styles.heroHeader}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Viajes</p>
          <h1 className={styles.heroTitle}>{trip.originLabel} -&gt; {trip.destinationLabel}</h1>
          <p className={styles.heroLead}>{tripSubtitle}</p>
        
          <div className={styles.heroMeta}>
            <span className={`${styles.heroBadge} ${getBadgeClass(getTripStatusTone(trip.status))}`}>
              {getTripStatusLabel(trip.status)}
            </span>
            <span className={`${styles.heroBadge} ${getBadgeClass('neutral')}`}>
              {getTripRouteModeLabel(trip.routeMode)}
            </span>
            <span className={`${styles.heroBadge} ${getBadgeClass('success')}`}>
              {`${trip.availableSeats}/${trip.seatCount} cupos`}
            </span>
            {trip.cancellationTiming ? (
              <span className={`${styles.heroBadge} ${getBadgeClass(getCancellationTimingTone(trip.cancellationTiming))}`}>
                {getCancellationTimingLabel(trip.cancellationTiming) ?? 'Cancelacion'}
              </span>
            ) : null}
          </div>
        </div>

        <div className={styles.topActions}>
          <Link className={styles.heroBtnSecondary} href="/viajes">
            Volver
          </Link>
          {trip.canEdit ? (
            <Link className={styles.heroBtnSecondary} href={`/viajes/${trip.id}/editar`}>
              Editar
            </Link>
          ) : null}
          {trip.canCancel ? (
            <button
              className={styles.heroBtnDanger}
              disabled={isCancelling}
              onClick={() => setIsDeletePromptOpen(true)}
              type="button"
            >
              {isDraftTrip ? 'Eliminar' : 'Cancelar'}
            </button>
          ) : null}
        </div>
      </header>

      <div className={styles.content}>
        {lateCancellationWarning ? (
          <div className={`${styles.noticeCard} ${styles.warning}`}>
            <strong>Atencion: Cancelaci&oacute;n cercana a la salida</strong>
            <p>
              Si cancelas este viaje dentro de los {CANCELLATION_LATE_WINDOW_MINUTES} minutos previos a la salida, 
              el sistema puede registrar una incidencia operativa para control interno.
            </p>
          </div>
        ) : null}

        {trip.status === TripStatus.Cancelled && trip.cancellationTiming === CancellationTiming.Late ? (
          <div className={`${styles.noticeCard} ${styles.info}`}>
            <strong>Auditoria: Cancelaci&oacute;n tard&iacute;a registrada</strong>
            <p>
              Este viaje fue eliminado l&oacute;gicamente dentro de la ventana sensible previa a la salida. 
              La trazabilidad queda disponible para revisi&oacute;n administrativa.
            </p>
          </div>
        ) : null}

        <div className={styles.tripCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Vista del recorrido</h2>
          </div>

          {canViewPreciseRoute && origin && destination ? (
            <div className={styles.mapSection}>
              <TripRouteMap destination={destination} origin={origin} />
            </div>
          ) : (
            <div className={`${styles.noticeCard} ${styles.info}`} style={{ margin: 0 }}>
              <strong>Ubicaci&oacute;n precisa protegida</strong>
              <p>
                Mientras no formes parte confirmada del viaje o seas el propietario, 
                la ruta exacta y los puntos precisos se mantienen ocultos por privacidad.
              </p>
            </div>
          )}
        </div>

        <div className={styles.tripCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Datos formales del viaje</h2>
          </div>

          <div className={styles.detailGrid}>
            <DetailItem label="Conductor" value={trip.driverFullName} />
            <DetailItem label="Institucion" value={trip.institutionName} />
            <DetailItem label="Salida" value={formatDateTime(trip.departureAt)} />
            <DetailItem label="Llegada estimada" value={formatDateTime(trip.estimatedArrivalAt)} />
            <DetailItem label="Vehiculo" value={`${trip.vehicleDisplayName} | ${trip.vehiclePlate}`} />
            <DetailItem label="Tipo" value={getVehicleTypeLabel(trip.vehicleTypeSnapshot)} />
            <DetailItem label="Equipaje" value={getLuggagePolicyLabel(trip.luggagePolicySnapshot)} />
            <DetailItem label="Precio base" value={formatCurrency(trip.basePriceReference)} />
            <DetailItem
              label="Recargo por desvio"
              value={
                trip.detourSurchargeReference
                  ? formatCurrency(trip.detourSurchargeReference)
                  : 'No aplica'
              }
            />
            <DetailItem label="Creado" value={formatDateTime(trip.createdAt)} />
            <DetailItem
              label="Cierre real"
              value={trip.completedAt ? formatDateTime(trip.completedAt) : 'Aun no cerrado'}
            />
            <DetailItem
              label="Cancelado"
              value={trip.cancelledAt ? formatDateTime(trip.cancelledAt) : 'Activo'}
            />
          </div>

          {trip.notes ? (
            <div className={styles.noteBlock}>
              <strong>Notas del conductor</strong>
              <p>{trip.notes}</p>
            </div>
          ) : null}

          {trip.closureNote ? (
            <div className={styles.noteBlock}>
              <strong>Nota de cierre operativo</strong>
              <p>{trip.closureNote}</p>
            </div>
          ) : null}
        </div>
      </div>

      {isDeletePromptOpen ? (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsDeletePromptOpen(false)}
          role="presentation"
        >
          <div
            aria-labelledby="trip-delete-title"
            aria-modal="true"
            className={styles.modalCard}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle} id="trip-delete-title">
                {isDraftTrip ? 'Eliminar borrador' : 'Cancelar viaje publicado'}
              </h2>
              <p className={styles.modalSubtitle}>
                {isDraftTrip
                  ? 'El viaje saldra de tu lista, conservando trazabilidad interna.'
                  : 'El viaje sera cancelado logicamente para mantener auditoria.'}
              </p>
            </div>

            <div className={styles.modalBody}>
              <div className={`${styles.noticeCard} ${styles.info}`} style={{ margin: 0 }}>
                <strong>{isDraftTrip ? 'Borrador no publicado' : 'Trazabilidad protegida'}</strong>
                <p>
                  {isDraftTrip
                    ? 'Como aun no fue publicado, no hay pasajeros expuestos a este viaje.'
                    : 'Si ya existen pagos, solicitudes o pasajeros vinculados, el sistema dejara registro y aplicara las reglas operativas correspondientes.'}
                </p>
              </div>
              
              {lateCancellationWarning ? (
                <div className={`${styles.noticeCard} ${styles.warning}`} style={{ margin: 0 }}>
                  <strong>Atenci&oacute;n</strong>
                  <p>Est&aacute;s dentro de la ventana sensible previa a la salida. Esto puede generar una incidencia operativa autom&aacute;tica.</p>
                </div>
              ) : null}
            </div>

            <div className={styles.modalActions}>
            <div className={styles.modalFooter}>
              <button
                className={styles.heroBtnSecondary}
                style={{ color: '#5a6c72', borderColor: '#e2e8f0' }}
                disabled={isCancelling}
                onClick={() => setIsDeletePromptOpen(false)}
                type="button"
              >
                Conservar viaje
              </button>
              <button
                className={styles.heroBtnDanger}
                disabled={isCancelling}
                onClick={() => void handleCancelTrip()}
                type="button"
              >
                {isCancelling
                  ? isDraftTrip ? 'Eliminando...' : 'Cancelando...'
                  : isDraftTrip ? 'Eliminar' : 'Cancelar viaje'}
              </button>
            </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoTile}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
