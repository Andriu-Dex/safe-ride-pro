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
import { StatusPill } from '../../../../components/ui/status-pill';
import { ToastStack, type ToastItem } from '../../../../components/ui/toast-stack';
import { ApiError } from '../../../../lib/api-client';
import { useAuth } from '../../../../modules/auth/hooks/use-auth';
import { TripRouteMap } from '../../../../modules/trips/components/trip-route-map';
import {
  cancelTrip,
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
    trip.status !== TripStatus.Draft &&
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

  const handleCancelTrip = async () => {
    if (!authSession || !trip || !trip.canCancel) {
      return;
    }

    setIsCancelling(true);

    try {
      const response = await cancelTrip(authSession.accessToken, trip.id);
      persistToast({
        title: 'Viaje eliminado',
        description: response.message,
        tone: 'success',
      });
      router.push('/viajes');
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      pushToast(
        'El viaje no pudo eliminarse',
        getApiErrorMessage(error, 'No fue posible eliminar este viaje.'),
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

  if (isLoading) {
    return (
      <section className={styles.pageBackground}>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <article className={`${styles.canvas} ${styles.canvasSmall}`}>
          <div aria-hidden="true" className={styles.loadingPulse} />
          <h1 className={styles.stateTitle}>Cargando viaje</h1>
          <p className={styles.stateText}>Estamos preparando el detalle completo del trayecto.</p>
        </article>
      </section>
    );
  }

  if (!authSession || !trip) {
    return (
      <section className={styles.pageBackground}>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <article className={`${styles.canvas} ${styles.canvasSmall}`}>
          <h1 className={styles.stateTitle}>No pudimos abrir este viaje</h1>
          <p className={styles.stateText}>
            Verifica que sigas dentro de la misma institucion y vuelve a intentarlo.
          </p>
          <div className={styles.topActions}>
            <Link className="button button-secondary" href="/viajes">
              Volver a viajes
            </Link>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className={styles.pageBackground}>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <article className={styles.canvas}>
        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Viajes</p>
              <h1 className={styles.heroTitle}>{trip.originLabel} -&gt; {trip.destinationLabel}</h1>
              <p className={styles.heroLead}>{tripSubtitle}</p>
            </div>

            <div className={styles.topActions}>
              <Link className="button button-secondary" href="/viajes">
                Volver
              </Link>
              {trip.canEdit ? (
                <Link className="button button-ghost" href={`/viajes/${trip.id}/editar`}>
                  Editar
                </Link>
              ) : null}
              {trip.canCancel ? (
                <Button
                  disabled={isCancelling}
                  onClick={() => setIsDeletePromptOpen(true)}
                  variant="primary"
                >
                  Eliminar
                </Button>
              ) : null}
            </div>
          </div>

          <div className={styles.heroMeta}>
            <StatusPill
              label={getTripStatusLabel(trip.status)}
              tone={getTripStatusTone(trip.status)}
            />
            <StatusPill label={getTripRouteModeLabel(trip.routeMode)} tone="neutral" />
            <StatusPill label={`${trip.availableSeats}/${trip.seatCount} cupos`} tone="success" />
            {trip.cancellationTiming ? (
              <StatusPill
                label={getCancellationTimingLabel(trip.cancellationTiming) ?? 'Cancelacion'}
                tone={getCancellationTimingTone(trip.cancellationTiming)}
              />
            ) : null}
          </div>
        </section>

        <section className={styles.contentGrid}>
          <div className={styles.mainColumn}>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionKicker}>Recorrido</p>
                  <h2 className={styles.sectionTitle}>Vista del viaje</h2>
                </div>
              </div>

              {canViewPreciseRoute && origin && destination ? (
                <div className={styles.mapSection}>
                  <TripRouteMap destination={destination} origin={origin} />
                </div>
              ) : (
                <div className={styles.restrictedMap}>
                  <strong>Ruta protegida</strong>
                  <p>
                    Los puntos precisos solo se muestran al conductor propietario o a pasajeros
                    ya aceptados en este viaje.
                  </p>
                </div>
              )}
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <div>
                  <p className={styles.sectionKicker}>Datos operativos</p>
                  <h2 className={styles.sectionTitle}>Detalle formal del viaje</h2>
                </div>
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
            </section>
          </div>

          <aside className={styles.sideColumn}>
            <section className={styles.sideSection}>
              <p className={styles.sectionKicker}>Acciones</p>
              <h2 className={styles.sideTitle}>Lo que puedes hacer aqui</h2>
              <ul className={styles.actionList}>
                <li>Revisar el detalle real antes de publicar, iniciar o cerrar un trayecto.</li>
                <li>Editar solo si todavia no existen solicitudes activas ni pasajeros confirmados.</li>
                <li>Eliminar de forma logica para conservar trazabilidad y auditoria.</li>
              </ul>
            </section>

            {lateCancellationWarning ? (
              <section className={styles.sideSection}>
                <p className={styles.sectionKicker}>Atencion</p>
                <h2 className={styles.sideTitle}>Eliminacion cercana a la salida</h2>
                <p className={styles.sideText}>
                  Si eliminas este viaje dentro de los {CANCELLATION_LATE_WINDOW_MINUTES} minutos
                  previos a la salida, el sistema puede registrar una incidencia operativa para
                  control interno.
                </p>
              </section>
            ) : null}

            {trip.status === TripStatus.Cancelled && trip.cancellationTiming === CancellationTiming.Late ? (
              <section className={styles.sideSection}>
                <p className={styles.sectionKicker}>Auditoria</p>
                <h2 className={styles.sideTitle}>Cancelacion tardia registrada</h2>
                <p className={styles.sideText}>
                  Este viaje ya fue eliminado logicamente dentro de la ventana sensible previa a la
                  salida. La trazabilidad queda disponible para revision administrativa.
                </p>
              </section>
            ) : null}

            {!trip.canViewPreciseRoute ? (
              <section className={styles.sideSection}>
                <p className={styles.sectionKicker}>Privacidad</p>
                <h2 className={styles.sideTitle}>Ubicacion precisa protegida</h2>
                <p className={styles.sideText}>
                  Mientras no formes parte confirmada del viaje, la ruta exacta se mantiene oculta.
                </p>
              </section>
            ) : null}
          </aside>
        </section>
      </article>

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
              <p className={styles.sectionKicker}>Eliminar viaje</p>
              <h2 className={styles.modalTitle} id="trip-delete-title">
                Esta accion no borra el historial
              </h2>
              <p className={styles.modalText}>
                El viaje se cancelara logicamente para mantener auditoria. Si ya existen pagos,
                solicitudes o pasajeros vinculados, el sistema dejara trazabilidad y aplicara las
                reglas operativas correspondientes.
              </p>
            </div>

            {lateCancellationWarning ? (
              <p className={styles.modalWarning}>
                Estas dentro de la ventana sensible previa a la salida. Esto puede generar una
                incidencia operativa automatica.
              </p>
            ) : null}

            <div className={styles.modalActions}>
              <Button
                disabled={isCancelling}
                onClick={() => setIsDeletePromptOpen(false)}
                variant="ghost"
              >
                Conservar viaje
              </Button>
              <Button
                disabled={isCancelling}
                onClick={() => void handleCancelTrip()}
                variant="primary"
              >
                {isCancelling ? 'Eliminando...' : 'Eliminar logicamente'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.detailItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
