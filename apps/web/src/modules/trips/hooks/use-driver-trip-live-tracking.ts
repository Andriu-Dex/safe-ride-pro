'use client';

import { useEffect, useRef, useState } from 'react';

import { ApiError } from '../../../lib/api-client';
import { updateTripLiveTracking } from '../lib/trip-api';

const MIN_SYNC_INTERVAL_MS = 12_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const MIN_MOVEMENT_DISTANCE_METERS = 25;

type TrackingTone = 'neutral' | 'success' | 'warning' | 'danger';

type PositionSnapshot = {
  capturedAt: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  headingDegrees?: number;
  speedKph?: number;
};

export type DriverTripLiveTrackingState = {
  label: string;
  tone: TrackingTone;
  detail: string | null;
  lastPublishedAt: string | null;
};

type UseDriverTripLiveTrackingOptions = {
  accessToken?: string;
  tripId?: string | null;
  enabled: boolean;
};

export function useDriverTripLiveTracking({
  accessToken,
  tripId,
  enabled,
}: UseDriverTripLiveTrackingOptions): DriverTripLiveTrackingState {
  const [state, setState] = useState<DriverTripLiveTrackingState>({
    label: 'GPS en espera',
    tone: 'neutral',
    detail: null,
    lastPublishedAt: null,
  });
  const lastSentPositionRef = useRef<PositionSnapshot | null>(null);
  const pendingPositionRef = useRef<PositionSnapshot | null>(null);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !accessToken || !tripId) {
      setState({
        label: 'GPS inactivo',
        tone: 'neutral',
        detail: null,
        lastPublishedAt: null,
      });
      lastSentPositionRef.current = null;
      pendingPositionRef.current = null;
      isSyncingRef.current = false;
      return;
    }

    if (!('geolocation' in navigator)) {
      setState({
        label: 'GPS no disponible',
        tone: 'warning',
        detail: 'Tu navegador no permite geolocalizacion para este seguimiento.',
        lastPublishedAt: null,
      });
      return;
    }

    let isCancelled = false;
    let watchId: number | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    const flushPosition = async (position: PositionSnapshot) => {
      if (isCancelled || isSyncingRef.current) {
        pendingPositionRef.current = position;
        return;
      }

      isSyncingRef.current = true;
      setState((currentState) => ({
        ...currentState,
        label: currentState.lastPublishedAt ? 'GPS sincronizando' : 'GPS iniciando',
        tone: 'warning',
        detail: null,
      }));

      try {
        const response = await updateTripLiveTracking(accessToken, tripId, position);

        if (isCancelled) {
          return;
        }

        lastSentPositionRef.current = position;
        setState({
          label: 'GPS compartiendo',
          tone: 'success',
          detail: response.lastSignalAt
            ? `Ultima senal ${formatTime(response.lastSignalAt)}`
            : 'Ubicacion publicada correctamente.',
          lastPublishedAt: response.lastSignalAt,
        });
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setState((currentState) => ({
          ...currentState,
          label: 'GPS con incidente',
          tone: 'danger',
          detail:
            error instanceof ApiError
              ? error.message
              : 'No fue posible compartir la ubicacion del viaje.',
        }));
      } finally {
        isSyncingRef.current = false;

        if (!isCancelled && pendingPositionRef.current) {
          const nextPosition = pendingPositionRef.current;
          pendingPositionRef.current = null;
          await flushPosition(nextPosition);
        }
      }
    };

    const maybeSyncPosition = (position: PositionSnapshot, force = false) => {
      const lastSentPosition = lastSentPositionRef.current;

      if (!force && lastSentPosition) {
        const elapsedMs =
          new Date(position.capturedAt).getTime() - new Date(lastSentPosition.capturedAt).getTime();
        const distanceMeters = calculateDistanceInMeters(lastSentPosition, position);

        if (
          elapsedMs < MIN_SYNC_INTERVAL_MS &&
          distanceMeters < MIN_MOVEMENT_DISTANCE_METERS
        ) {
          return;
        }
      }

      void flushPosition(position);
    };

    const handleGeolocationSuccess = (result: GeolocationPosition) => {
      const nextPosition: PositionSnapshot = {
        capturedAt: new Date(result.timestamp).toISOString(),
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
        accuracyMeters: Number.isFinite(result.coords.accuracy)
          ? result.coords.accuracy
          : undefined,
        headingDegrees:
          result.coords.heading !== null && Number.isFinite(result.coords.heading)
            ? normalizeHeading(result.coords.heading)
            : undefined,
        speedKph:
          result.coords.speed !== null && Number.isFinite(result.coords.speed)
            ? Math.max(0, Number((result.coords.speed * 3.6).toFixed(2)))
            : undefined,
      };

      maybeSyncPosition(nextPosition);
    };

    const handleGeolocationError = (error: GeolocationPositionError) => {
      if (isCancelled) {
        return;
      }

      setState((currentState) => ({
        ...currentState,
        label: 'GPS con incidente',
        tone: 'danger',
        detail: getGeolocationErrorMessage(error),
      }));
    };

    setState({
      label: 'GPS preparando',
      tone: 'warning',
      detail: 'Solicitando permiso de ubicacion para el viaje activo.',
      lastPublishedAt: null,
    });

    watchId = navigator.geolocation.watchPosition(
      handleGeolocationSuccess,
      handleGeolocationError,
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 20_000,
      },
    );

    heartbeatTimer = setInterval(() => {
      const lastPosition = lastSentPositionRef.current ?? pendingPositionRef.current;

      if (!lastPosition) {
        return;
      }

      const refreshedPosition: PositionSnapshot = {
        ...lastPosition,
        capturedAt: new Date().toISOString(),
      };

      maybeSyncPosition(refreshedPosition, true);
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      isCancelled = true;

      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }

      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
    };
  }, [accessToken, enabled, tripId]);

  return state;
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function normalizeHeading(value: number): number {
  const normalizedValue = value % 360;

  return normalizedValue >= 0 ? normalizedValue : normalizedValue + 360;
}

function calculateDistanceInMeters(left: PositionSnapshot, right: PositionSnapshot): number {
  const earthRadiusInMeters = 6_371_000;
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const leftLatitude = toRadians(left.latitude);
  const rightLatitude = toRadians(right.latitude);

  const a =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2)
    + Math.cos(leftLatitude)
      * Math.cos(rightLatitude)
      * Math.sin(longitudeDelta / 2)
      * Math.sin(longitudeDelta / 2);

  return 2 * earthRadiusInMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function getGeolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Activa el permiso de ubicacion para compartir el viaje en vivo.';
    case error.POSITION_UNAVAILABLE:
      return 'No pudimos obtener tu ubicacion actual en este momento.';
    case error.TIMEOUT:
      return 'La lectura GPS tardo demasiado. Reintentaremos automaticamente.';
    default:
      return 'Ocurrio un problema al leer la ubicacion del dispositivo.';
  }
}
