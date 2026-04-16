'use client';

import { TripStatus } from '@saferidepro/shared-types';
import { useEffect, useMemo, useState } from 'react';

import { StatusPill } from '../../../components/ui/status-pill';
import { ApiError } from '../../../lib/api-client';
import { getTripById } from '../lib/trip-api';
import {
  getCancellationTimingLabel,
  getCancellationTimingTone,
  getTripRouteModeLabel,
  getTripStatusLabel,
  getTripStatusTone,
} from '../lib/trip-labels';
import type { PlaceSelection } from '../types/place-selection';
import type { TripDetailRecord } from '../types/trip';
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
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  candidates: TripTrackingCandidate[];
  accessToken?: string;
  realtimeStatusLabel: string;
  realtimeStatusTone: 'neutral' | 'success' | 'warning' | 'danger';
};

type TripTrackingStep = {
  id: string;
  title: string;
  description: string;
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
}: TripLiveTrackingPanelProps) {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    candidates[0]?.id ?? null,
  );
  const [tripDetail, setTripDetail] = useState<TripDetailRecord | null>(null);
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

  useEffect(() => {
    if (!accessToken || !selectedCandidate) {
      setTripDetail(null);
      setErrorMessage(null);
      return;
    }

    let isMounted = true;

    const loadTripDetail = async () => {
      setIsLoadingDetail(true);
      setErrorMessage(null);

      try {
        const detail = await getTripById(accessToken, selectedCandidate.tripId);

        if (isMounted) {
          setTripDetail(detail);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setTripDetail(null);
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

    void loadTripDetail();

    return () => {
      isMounted = false;
    };
  }, [
    accessToken,
    selectedCandidate?.tripId,
    selectedCandidate?.status,
    selectedCandidate?.departureAt,
    selectedCandidate?.estimatedArrivalAt,
  ]);

  if (!candidates.length) {
    return (
      <article className="trip-live-panel trip-live-panel-empty">
        <div className="trip-live-empty-copy">
          <p className="section-label">Tracking v1</p>
          <h2 className="panel-title">{emptyTitle}</h2>
          <p className="panel-text">{emptyDescription}</p>
        </div>
      </article>
    );
  }

  if (!selectedCandidate) {
    return (
      <article className="trip-live-panel trip-live-panel-empty">
        <div className="trip-live-empty-copy">
          <p className="section-label">Tracking v1</p>
          <h2 className="panel-title">Preparando seguimiento</h2>
          <p className="panel-text">
            Estamos resolviendo el trayecto principal para mostrar su mapa y estado operativo.
          </p>
        </div>
      </article>
    );
  }

  const routeMapOrigin = buildPlaceSelection(
    tripDetail?.originLabel ?? selectedCandidate?.title ?? 'Origen',
    tripDetail?.originLatitude ?? null,
    tripDetail?.originLongitude ?? null,
  );
  const routeMapDestination = buildPlaceSelection(
    tripDetail?.destinationLabel ?? selectedCandidate?.title ?? 'Destino',
    tripDetail?.destinationLatitude ?? null,
    tripDetail?.destinationLongitude ?? null,
  );
  const plannedDuration = formatPlannedDuration(
    selectedCandidate.departureAt,
    selectedCandidate.estimatedArrivalAt,
  );
  const routePrecisionVisible = Boolean(routeMapOrigin && routeMapDestination);
  const trackingNarrative = getTrackingNarrative(selectedCandidate.status);
  const trackingProgress = getTrackingProgress(selectedCandidate.status);
  const trackingSteps = buildTrackingSteps(selectedCandidate.status);

  return (
    <article className="trip-live-panel">
      <div className="trip-live-hero">
        <div className="trip-live-hero-copy">
          <p className="section-label">Tracking v1</p>
          <h2 className="trip-live-title">{title}</h2>
          <p className="panel-text">{description}</p>
        </div>
        <div className="trip-live-hero-actions">
          <StatusPill
            label={getTripStatusLabel(selectedCandidate.status)}
            tone={getTripStatusTone(selectedCandidate.status)}
          />
          <StatusPill label={realtimeStatusLabel} tone={realtimeStatusTone} />
          <StatusPill
            label={routePrecisionVisible ? 'Ruta precisa disponible' : 'Ruta precisa reservada'}
            tone={routePrecisionVisible ? 'success' : 'neutral'}
          />
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
          <small>{trackingNarrative}</small>
        </div>
      </div>

      <div className="trip-live-layout">
        <div className="trip-live-map-card">
          <div className="trip-live-map-head">
            <div>
              <strong>Ruta planificada</strong>
              <p className="panel-text">
                Vista basada en la ruta prevista y cambios de estado del viaje. Todavia no incluye GPS continuo.
              </p>
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
              <p className="panel-text">
                Estamos cargando la ruta planificada y el contexto operativo del viaje.
              </p>
            </div>
          ) : errorMessage ? (
            <div className="trip-live-map-placeholder trip-live-map-placeholder-warning">
              <strong>No pudimos cargar el seguimiento.</strong>
              <p className="panel-text">{errorMessage}</p>
            </div>
          ) : routePrecisionVisible ? (
            <TripRouteMap destination={routeMapDestination} origin={routeMapOrigin} />
          ) : (
            <div className="trip-live-map-placeholder">
              <strong>Ruta precisa no disponible.</strong>
              <p className="panel-text">
                El mapa detallado solo se comparte con participantes confirmados del trayecto.
              </p>
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
            <TrackingStatCard
              label="Duracion prevista"
              value={plannedDuration}
            />
            <TrackingStatCard
              label="Ocupacion"
              value={`${selectedCandidate.seatCount - selectedCandidate.availableSeats}/${selectedCandidate.seatCount}`}
            />
            <TrackingStatCard
              label="Modalidad"
              value={tripDetail ? getTripRouteModeLabel(tripDetail.routeMode) : 'Cargando'}
            />
            <TrackingStatCard
              label="Estado compartido"
              value={getTripStatusLabel(selectedCandidate.status)}
            />
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
                  className={[
                    'trip-live-step',
                    `trip-live-step-${step.tone}`,
                  ].join(' ')}
                >
                  <div className="trip-live-step-dot" aria-hidden="true" />
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

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
      description:
        status === TripStatus.Draft
          ? 'El viaje aun esta en borrador y todavia no entra a coordinacion.'
          : 'La ruta ya se encuentra visible para coordinacion y gestion de cupos.',
      tone: status === TripStatus.Draft ? 'warning' : 'success',
    },
    {
      id: 'departure',
      title: 'Preparacion de salida',
      description:
        status === TripStatus.Published || status === TripStatus.Full
          ? 'El trayecto esta listo para iniciar y mantiene su plan de ruta actual.'
          : 'La salida ya fue resuelta o reemplazada por un cierre distinto.',
      tone:
        status === TripStatus.Published || status === TripStatus.Full
          ? 'warning'
          : 'success',
    },
    {
      id: 'in-progress',
      title: 'Seguimiento del trayecto',
      description:
        status === TripStatus.InProgress
          ? 'Se comparte el estado del viaje en curso con base en la ruta planificada.'
          : 'Todavia no existe un trayecto activo en ejecucion o ya concluyo.',
      tone: status === TripStatus.InProgress ? 'warning' : 'neutral',
    },
    {
      id: 'closure',
      title: 'Cierre operativo',
      description:
        status === TripStatus.Completed
          ? 'El viaje se cerro correctamente y queda listo para confianza y evaluaciones.'
          : status === TripStatus.Cancelled
            ? 'El viaje se cerro por cancelacion y conserva la ruta planificada como referencia.'
            : 'El cierre todavia depende del estado final que marque el conductor o el sistema.',
      tone:
        status === TripStatus.Completed || status === TripStatus.Cancelled
          ? 'success'
          : 'neutral',
    },
  ];
}

function getTrackingNarrative(status: TripStatus): string {
  switch (status) {
    case TripStatus.Draft:
      return 'Borrador interno sin seguimiento compartido.';
    case TripStatus.Published:
      return 'Publicado con cupos disponibles.';
    case TripStatus.Full:
      return 'Listo para salir con todos los cupos ocupados.';
    case TripStatus.InProgress:
      return 'Trayecto en curso con seguimiento de estado.';
    case TripStatus.Completed:
      return 'Trayecto cerrado correctamente.';
    case TripStatus.Cancelled:
      return 'Trayecto cancelado con referencia historica de la ruta.';
    default:
      return 'Seguimiento operativo disponible.';
  }
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
