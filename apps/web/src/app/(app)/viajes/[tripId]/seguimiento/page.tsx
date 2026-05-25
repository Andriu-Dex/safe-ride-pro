'use client';

import {
  REALTIME_TRIP_LIVE_TRACKING_UPDATED_EVENT,
  TripStatus,
} from '@saferidepro/shared-types';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { StatusPill } from '../../../../../components/ui/status-pill';
import { ToastStack, type ToastItem } from '../../../../../components/ui/toast-stack';
import { ApiError } from '../../../../../lib/api-client';
import { useAuth } from '../../../../../modules/auth/hooks/use-auth';
import { useRealtimeEventStream } from '../../../../../modules/realtime/hooks/use-realtime-event-stream';
import { useDriverTripLiveTracking } from '../../../../../modules/trips/hooks/use-driver-trip-live-tracking';
import {
  getTripById,
  getTripLiveTracking,
} from '../../../../../modules/trips/lib/trip-api';
import {
  getTripStatusLabel,
  getTripStatusTone,
} from '../../../../../modules/trips/lib/trip-labels';
import { TripRouteMap } from '../../../../../modules/trips/components/trip-route-map';
import type { PlaceSelection } from '../../../../../modules/trips/types/place-selection';
import type {
  TripDetailRecord,
  TripLiveTrackingRecord,
} from '../../../../../modules/trips/types/trip';
import styles from './page.module.css';

function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

export default function TripTrackingPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = typeof params?.tripId === 'string' ? params.tripId : '';
  const { authSession, isHydrated, refreshSession } = useAuth();

  const [trip, setTrip] = useState<TripDetailRecord | null>(null);
  const [tracking, setTracking] = useState<TripLiveTrackingRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((title: string, description: string, tone: ToastItem['tone']) => {
    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id: `tracking-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        tone,
      },
    ]);
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  }, []);

  const loadTracking = useCallback(async () => {
    if (!authSession || !tripId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [tripData, trackingData] = await Promise.all([
        getTripById(authSession.accessToken, tripId),
        getTripLiveTracking(authSession.accessToken, tripId),
      ]);

      setTrip(tripData);
      setTracking(trackingData);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(getApiErrorMessage(error, 'No fue posible abrir el seguimiento.'));
    } finally {
      setIsLoading(false);
    }
  }, [authSession, refreshSession, tripId]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void loadTracking();
  }, [isHydrated, loadTracking]);

  useEffect(() => {
    if (!authSession || !trip || trip.status !== TripStatus.InProgress) {
      return;
    }

    const timer = window.setInterval(() => {
      void getTripLiveTracking(authSession.accessToken, trip.id)
        .then(setTracking)
        .catch(() => undefined);
    }, 12_000);

    return () => window.clearInterval(timer);
  }, [authSession, trip]);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    pushToast('Seguimiento no disponible', errorMessage, 'error');
    setErrorMessage(null);
  }, [errorMessage, pushToast]);

  useRealtimeEventStream({
    accessToken: authSession?.accessToken,
    enabled: Boolean(authSession && trip),
    onEvent: (event) => {
      if (
        event.type === REALTIME_TRIP_LIVE_TRACKING_UPDATED_EVENT &&
        event.tripId === tripId
      ) {
        void getTripLiveTracking(authSession!.accessToken, tripId)
          .then(setTracking)
          .catch(() => undefined);
      }
    },
  });

  const driverCaptureState = useDriverTripLiveTracking({
    accessToken: authSession?.accessToken,
    tripId,
    enabled: Boolean(trip?.isOwner && trip.status === TripStatus.InProgress),
  });

  const origin = useMemo(
    () =>
      trip && trip.originLatitude !== null && trip.originLongitude !== null
        ? {
            label: trip.originLabel,
            address: null,
            latitude: trip.originLatitude,
            longitude: trip.originLongitude,
          }
        : null,
    [trip],
  );
  const destination = useMemo(
    () =>
      trip && trip.destinationLatitude !== null && trip.destinationLongitude !== null
        ? {
            label: trip.destinationLabel,
            address: null,
            latitude: trip.destinationLatitude,
            longitude: trip.destinationLongitude,
          }
        : null,
    [trip],
  );
  const livePosition = useMemo(
    () => buildLivePosition(tracking),
    [tracking],
  );
  const history = useMemo(
    () =>
      tracking?.history.map((point) => ({
        label: 'GPS',
        address: null,
        latitude: point.latitude,
        longitude: point.longitude,
      })) ?? [],
    [tracking],
  );

  if (isLoading) {
    return (
      <section className={styles.page}>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <article className={styles.stateCard}>
          <div aria-hidden="true" className={styles.loadingPulse} />
          <h1>Cargando seguimiento</h1>
        </article>
      </section>
    );
  }

  if (!trip) {
    return (
      <section className={styles.page}>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <article className={styles.stateCard}>
          <h1>Seguimiento no disponible</h1>
          <Link className={styles.linkButton} href="/viajes">Volver</Link>
        </article>
      </section>
    );
  }

  const canRenderMap = origin && destination;

  return (
    <section className={styles.page}>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>Seguimiento</p>
          <h1>{trip.originLabel} -&gt; {trip.destinationLabel}</h1>
        </div>
        <div className={styles.heroActions}>
          <StatusPill label={getTripStatusLabel(trip.status)} tone={getTripStatusTone(trip.status)} />
          <Link className={styles.linkButton} href={`/viajes/${trip.id}`}>Detalle</Link>
        </div>
      </header>

      <section className={styles.mapPanel}>
        {canRenderMap ? (
          <TripRouteMap
            destination={destination}
            history={history}
            livePosition={livePosition}
            origin={origin}
            routePath={trip.routePath}
          />
        ) : (
          <div className={styles.stateCard}>
            <h2>Ruta protegida</h2>
          </div>
        )}
      </section>

      <section className={styles.statusGrid}>
        <TrackingTile label="GPS" value={trip.isOwner ? driverCaptureState.label : getSignalLabel(tracking)} />
        <TrackingTile label="Ultima señal" value={tracking?.lastSignalAt ? formatTime(tracking.lastSignalAt) : 'Pendiente'} />
        <TrackingTile label="Velocidad" value={formatSpeed(tracking?.currentSpeedKph)} />
        <TrackingTile label="Precision" value={formatAccuracy(tracking?.currentAccuracyMeters)} />
      </section>
    </section>
  );
}

function TrackingTile({ label, value }: { label: string; value: string }) {
  return (
    <article className={styles.tile}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function buildLivePosition(tracking: TripLiveTrackingRecord | null): PlaceSelection | null {
  if (
    tracking?.currentLatitude === null ||
    tracking?.currentLongitude === null ||
    tracking?.currentLatitude === undefined ||
    tracking?.currentLongitude === undefined
  ) {
    return null;
  }

  return {
    label: 'Vehiculo',
    address: null,
    latitude: tracking.currentLatitude,
    longitude: tracking.currentLongitude,
  };
}

function getSignalLabel(tracking: TripLiveTrackingRecord | null): string {
  if (!tracking?.lastSignalAt) {
    return 'Pendiente';
  }

  return tracking.signalStatus === 'LIVE' ? 'En vivo' : 'Con demora';
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatSpeed(value: number | null | undefined): string {
  return typeof value === 'number' ? `${Math.round(value)} km/h` : 'Pendiente';
}

function formatAccuracy(value: number | null | undefined): string {
  return typeof value === 'number' ? `${Math.round(value)} m` : 'Pendiente';
}
