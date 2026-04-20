'use client';

import {
  TripLiveTrackingSignalStatus,
  TripStatus,
} from '@saferidepro/shared-types';
import { useEffect, useMemo, useState } from 'react';

import { StatusPill } from '../../../components/ui/status-pill';
import { ApiError } from '../../../lib/api-client';
import { type DriverTripLiveTrackingState } from '../hooks/use-driver-trip-live-tracking';
import { getTripById, getTripLiveTracking } from '../lib/trip-api';
import {
  getCancellationTimingLabel,
  getCancellationTimingTone,
  getTripRouteModeLabel,
  getTripStatusLabel,
  getTripStatusTone,
} from '../lib/trip-labels';
import type { PlaceSelection } from '../types/place-selection';
import type { TripDetailRecord, TripLiveTrackingRecord } from '../types/trip';
import { TripRouteMap } from './trip-route-map';

export type TripTrackingCandidate = {
  id: string;
  tripId: string;
  title: string;
  subtitle: string;
  status: TripStatus;
  departureAt: string;
  estimatedArrivalAt: string;
  availableSeats: number;
  seatCount: number;
};

type TripLiveTrackingPanelProps = {
  title: string;
  description?: string;
  emptyTitle: string;
  emptyDescription?: string;
  candidates: TripTrackingCandidate[];
  accessToken?: string;
  realtimeStatusLabel: string;
  realtimeStatusTone: 'neutral' | 'success' | 'warning' | 'danger';
  trackingVersionByTripId?: Record<string, number>;
  driverCaptureState?: DriverTripLiveTrackingState | null;
};

type TripTrackingStep = {
  id: string;
  title: string;
  tone: 'neutral' | 'success' | 'warning';
};

export function TripLiveTrackingPanel({
  title,
  description,
  emptyTitle,
  emptyDescription,
  candidates,
  accessToken,
  realtimeStatusLabel,
  realtimeStatusTone,
  trackingVersionByTripId = {},
  driverCaptureState = null,
}: TripLiveTrackingPanelProps) {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    candidates[0]?.id ?? null,
  );
  const [tripDetail, setTripDetail] = useState<TripDetailRecord | null>(null);
  const [liveTracking, setLiveTracking] = useState<TripLiveTrackingRecord | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!candidates.length) {
      setSelectedCandidateId(null);
      return;
    }

    setSelectedCandidateId((currentCandidateId) => {
      if (currentCandidateId && candidates.some((candidate) => candidate.id === currentCandidateId)) {
        return currentCandidateId;
      }

      return candidates[0].id;
    });
  }, [candidates]);

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null,
    [candidates, selectedCandidateId],
  );
  const selectedTrackingVersion = selectedCandidate
    ? trackingVersionByTripId[selectedCandidate.tripId] ?? 0
    : 0;

  useEffect(() => {
    if (!accessToken || !selectedCandidate) {
      setTripDetail(null);
      setLiveTracking(null);
      setErrorMessage(null);
      return;
    }

    let isMounted = true;

    const loadTripTracking = async () => {
      setIsLoadingDetail(true);
      setErrorMessage(null);

      try {
        const [detail, tracking] = await Promise.all([
          getTripById(accessToken, selectedCandidate.tripId),
          getTripLiveTracking(accessToken, selectedCandidate.tripId),
        ]);

        if (!isMounted) {
          return;
        }

        setTripDetail(detail);
        setLiveTracking(tracking);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setTripDetail(null);
        setLiveTracking(null);
        setErrorMessage(
          error instanceof ApiError
            ? error.message
            : 'No fue posible cargar el detalle de seguimiento del viaje.',
        );
      } finally {
        if (isMounted) {
          setIsLoadingDetail(false);
        }
      }
    };

    void loadTripTracking();

    return () => {
      isMounted = false;
    };
  }, [accessToken, selectedCandidate?.tripId, selectedTrackingVersion]);

  if (!candidates.length) {
    return (
      <article className="trip-live-panel trip-live-panel-empty">
        <div className="trip-live-empty-copy">
          <p className="section-label">Tracking</p>
          <h2 className="panel-title">{emptyTitle}</h2>
          {emptyDescription ? <p className="panel-text">{emptyDescription}</p> : null}
        </div>
      </article>
    );
  }

  if (!selectedCandidate) {
    return (
      <article className="trip-live-panel trip-live-panel-empty">
        <div className="trip-live-empty-copy">
          <p className="section-label">Tracking</p>
          <h2 className="panel-title">Preparando seguimiento</h2>
        </div>
      </article>
    );
  }

  const routeMapOrigin = buildPlaceSelection(
    tripDetail?.originLabel ?? selectedCandidate.title ?? 'Origen',
    tripDetail?.originLatitude ?? null,
    tripDetail?.originLongitude ?? null,
  );
  const routeMapDestination = buildPlaceSelection(
    tripDetail?.destinationLabel ?? selectedCandidate.title ?? 'Destino',
    tripDetail?.destinationLatitude ?? null,
    tripDetail?.destinationLongitude ?? null,
  );
  const livePosition = buildPlaceSelection(
    'Ubicacion actual',
    liveTracking?.currentLatitude ?? null,
    liveTracking?.currentLongitude ?? null,
  );
  const liveHistory = (liveTracking?.history ?? [])
    .map((point, index) =>
      buildPlaceSelection(`Punto ${index + 1}`, point.latitude, point.longitude),
    )
    .filter((point): point is PlaceSelection => point !== null);
  const plannedDuration = formatPlannedDuration(
    selectedCandidate.departureAt,
    selectedCandidate.estimatedArrivalAt,
  );
  const routePrecisionVisible = Boolean(routeMapOrigin && routeMapDestination);
  const trackingProgress = getTrackingProgress(selectedCandidate.status);
  const trackingSteps = buildTrackingSteps(selectedCandidate.status);
  const liveSignalLabel = getTrackingSignalLabel(liveTracking?.signalStatus ?? null);
  const liveSignalTone = getTrackingSignalTone(liveTracking?.signalStatus ?? null);
  const lastSignalValue = formatLastSignal(
    liveTracking?.lastSignalAt ?? null,
    liveTracking?.lastSignalAgeInSeconds ?? null,
  );
  const speedValue = formatSpeed(liveTracking?.currentSpeedKph ?? null);
  const accuracyValue = formatAccuracy(liveTracking?.currentAccuracyMeters ?? null);
  const headingValue = formatHeading(liveTracking?.currentHeadingDegrees ?? null);

  return (
    <article className="trip-live-panel">
      <div className="trip-live-hero">
        <div className="trip-live-hero-copy">
          <p className="section-label">Tracking</p>
          <h2 className="trip-live-title">{title}</h2>
          {description ? <p className="panel-text">{description}</p> : null}
        </div>
        <div className="trip-live-hero-actions">
          <StatusPill
            label={getTripStatusLabel(selectedCandidate.status)}
            tone={getTripStatusTone(selectedCandidate.status)}
          />
          <StatusPill label={realtimeStatusLabel} tone={realtimeStatusTone} />
          <StatusPill label={liveSignalLabel} tone={liveSignalTone} />
          {driverCaptureState && selectedCandidate.status === TripStatus.InProgress ? (
            <StatusPill label={driverCaptureState.label} tone={driverCaptureState.tone} />
          ) : null}
        </div>
      </div>

      {candidates.length > 1 ? (
        <div className="trip-live-selector" role="tablist" aria-label="Trayectos para seguimiento">
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              aria-selected={candidate.id === selectedCandidateId}
              className={[
                'trip-live-selector-button',
                candidate.id === selectedCandidateId ? 'trip-live-selector-button-active' : null,
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setSelectedCandidateId(candidate.id)}
              role="tab"
              type="button"
            >
              <strong>{candidate.title}</strong>
              <span>{candidate.subtitle}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="trip-live-summary-strip">
        <div className="trip-live-summary-copy">
          <strong>{selectedCandidate.title}</strong>
          <span>{selectedCandidate.subtitle}</span>
        </div>
        <div className="trip-live-progress">
          <div className="trip-live-progress-bar" aria-hidden="true">
            <span style={{ width: `${trackingProgress}%` }} />
          </div>
        </div>
      </div>

      <div className="trip-live-layout">
        <div className="trip-live-map-card">
          <div className="trip-live-map-head">
            <div>
              <strong>
                {selectedCandidate.status === TripStatus.InProgress
                  ? 'Ruta y posicion actual'
                  : 'Ruta planificada'}
              </strong>
            </div>
            {tripDetail?.cancellationTiming ? (
              <StatusPill
                label={getCancellationTimingLabel(tripDetail.cancellationTiming) ?? 'Cancelacion'}
                tone={getCancellationTimingTone(tripDetail.cancellationTiming)}
              />
            ) : null}
          </div>

          {isLoadingDetail ? (
            <div className="trip-live-map-placeholder">
              <strong>Sincronizando detalle...</strong>
            </div>
          ) : errorMessage ? (
            <div className="trip-live-map-placeholder trip-live-map-placeholder-warning">
              <strong>No pudimos cargar el seguimiento.</strong>
              <p className="panel-text">{errorMessage}</p>
            </div>
          ) : routePrecisionVisible ? (
            <TripRouteMap
              destination={routeMapDestination}
              history={liveHistory}
              livePosition={livePosition}
              origin={routeMapOrigin}
            />
          ) : (
            <div className="trip-live-map-placeholder">
              <strong>Ruta precisa no disponible.</strong>
            </div>
          )}
        </div>

        <div className="trip-live-sidebar">
          <div className="trip-live-stat-grid">
            <TrackingStatCard
              label="Salida programada"
              value={formatDateTime(selectedCandidate.departureAt)}
            />
            <TrackingStatCard
              label="Llegada estimada"
              value={formatDateTime(selectedCandidate.estimatedArrivalAt)}
            />
            <TrackingStatCard label="Duracion prevista" value={plannedDuration} />
            <TrackingStatCard
              label="Ocupacion"
              value={`${selectedCandidate.seatCount - selectedCandidate.availableSeats}/${selectedCandidate.seatCount}`}
            />
            <TrackingStatCard
              label="Ultima senal"
              value={lastSignalValue}
            />
            <TrackingStatCard
              label="Precision"
              value={accuracyValue}
            />
            <TrackingStatCard label="Velocidad" value={speedValue} />
            <TrackingStatCard label="Rumbo" value={headingValue} />
            <TrackingStatCard
              label="Modalidad"
              value={tripDetail ? getTripRouteModeLabel(tripDetail.routeMode) : 'Cargando'}
            />
            <TrackingStatCard label="Estado compartido" value={getTripStatusLabel(selectedCandidate.status)} />
          </div>

          <div className="trip-live-timeline">
            <div className="trip-live-section-heading">
              <strong>Hitos operativos</strong>
              <span>{trackingProgress}% del flujo</span>
            </div>
            <div className="trip-live-step-list">
              {trackingSteps.map((step) => (
                <div
                  key={step.id}
                  className={['trip-live-step', `trip-live-step-${step.tone}`].join(' ')}
                >
                  <div className="trip-live-step-dot" aria-hidden="true" />
                  <div>
                    <strong>{step.title}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {driverCaptureState?.detail && selectedCandidate.status === TripStatus.InProgress ? (
            <div className="trip-live-note-card">
              <strong>GPS del conductor</strong>
              <p>{driverCaptureState.detail}</p>
            </div>
          ) : null}

          {tripDetail?.notes ? (
            <div className="trip-live-note-card">
              <strong>Observaciones del viaje</strong>
              <p>{tripDetail.notes}</p>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function TrackingStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="trip-live-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildPlaceSelection(
  label: string,
  latitude: number | null,
  longitude: number | null,
): PlaceSelection | null {
  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    label,
    address: label,
    latitude,
    longitude,
  };
}

function buildTrackingSteps(status: TripStatus): TripTrackingStep[] {
  return [
    {
      id: 'publication',
      title: 'Publicacion y confirmaciones',
      tone: status === TripStatus.Draft ? 'warning' : 'success',
    },
    {
      id: 'departure',
      title: 'Preparacion de salida',
      tone:
        status === TripStatus.Published || status === TripStatus.Full
          ? 'warning'
          : 'success',
    },
    {
      id: 'in-progress',
      title: 'Seguimiento del trayecto',
      tone: status === TripStatus.InProgress ? 'warning' : 'neutral',
    },
    {
      id: 'closure',
      title: 'Cierre operativo',
      tone:
        status === TripStatus.Completed || status === TripStatus.Cancelled
          ? 'success'
          : 'neutral',
    },
  ];
}

function getTrackingProgress(status: TripStatus): number {
  switch (status) {
    case TripStatus.Draft:
      return 12;
    case TripStatus.Published:
      return 36;
    case TripStatus.Full:
      return 48;
    case TripStatus.InProgress:
      return 78;
    case TripStatus.Completed:
      return 100;
    case TripStatus.Cancelled:
      return 100;
    default:
      return 0;
  }
}

function getTrackingSignalLabel(signalStatus: TripLiveTrackingSignalStatus | null): string {
  switch (signalStatus) {
    case TripLiveTrackingSignalStatus.Live:
      return 'GPS en vivo';
    case TripLiveTrackingSignalStatus.Delayed:
      return 'GPS demorado';
    case TripLiveTrackingSignalStatus.Offline:
      return 'GPS sin senal';
    case TripLiveTrackingSignalStatus.Closed:
      return 'Tracking cerrado';
    case TripLiveTrackingSignalStatus.Pending:
    default:
      return 'GPS pendiente';
  }
}

function getTrackingSignalTone(
  signalStatus: TripLiveTrackingSignalStatus | null,
): 'neutral' | 'success' | 'warning' | 'danger' {
  switch (signalStatus) {
    case TripLiveTrackingSignalStatus.Live:
      return 'success';
    case TripLiveTrackingSignalStatus.Delayed:
      return 'warning';
    case TripLiveTrackingSignalStatus.Offline:
      return 'danger';
    case TripLiveTrackingSignalStatus.Closed:
      return 'neutral';
    case TripLiveTrackingSignalStatus.Pending:
    default:
      return 'neutral';
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

function formatPlannedDuration(departureAt: string, estimatedArrivalAt: string): string {
  const departureDate = new Date(departureAt);
  const estimatedArrivalDate = new Date(estimatedArrivalAt);
  const durationInMinutes = Math.max(
    0,
    Math.round((estimatedArrivalDate.getTime() - departureDate.getTime()) / 60_000),
  );

  if (durationInMinutes < 60) {
    return `${durationInMinutes} min`;
  }

  const hours = Math.floor(durationInMinutes / 60);
  const minutes = durationInMinutes % 60;

  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}

function formatLastSignal(value: string | null, ageInSeconds: number | null): string {
  if (!value) {
    return 'Pendiente';
  }

  const timeLabel = new Date(value).toLocaleTimeString('es-EC', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  if (ageInSeconds === null) {
    return timeLabel;
  }

  if (ageInSeconds < 60) {
    return `${timeLabel} · ${ageInSeconds}s`;
  }

  const ageInMinutes = Math.round(ageInSeconds / 60);

  return `${timeLabel} · ${ageInMinutes} min`;
}

function formatSpeed(value: number | null): string {
  if (value === null) {
    return 'Sin dato';
  }

  return `${value.toFixed(1)} km/h`;
}

function formatAccuracy(value: number | null): string {
  if (value === null) {
    return 'Sin dato';
  }

  return `${Math.round(value)} m`;
}

function formatHeading(value: number | null): string {
  if (value === null) {
    return 'Sin dato';
  }

  return `${Math.round(value)}°`;
}
