'use client';

import { TripRouteMode } from '@saferidepro/shared-types';
import Link from 'next/link';
import { createPortal } from 'react-dom';

import { Button } from '../../../components/ui/button';
import { StatusPill } from '../../../components/ui/status-pill';
import {
  formatTripPaymentAmount,
  getPaymentProviderLabel,
  getTripPaymentStatusLabel,
  getTripPaymentStatusTone,
} from '../../payments/lib/payment-labels';
import {
  getTripRequestExecutionStatusLabel,
  getTripRequestExecutionStatusTone,
  getTripRequestStatusLabel,
  getTripRequestStatusTone,
} from '../../trip-requests/lib/trip-request-labels';
import type { TripRequestRecord } from '../../trip-requests/types/trip-request';
import { getTripRouteModeLabel, getTripStatusLabel, getTripStatusTone } from '../lib/trip-labels';
import type { PlaceSelection } from '../types/place-selection';
import { TripRouteMap } from './trip-route-map';
import styles from './trip-request-detail-modal.module.css';

type TripRequestDetailModalProps = {
  request: TripRequestRecord | null;
  perspective: 'driver' | 'passenger';
  onClose: () => void;
};

export function TripRequestDetailModal({
  request,
  perspective,
  onClose,
}: TripRequestDetailModalProps) {
  if (!request || typeof document === 'undefined') {
    return null;
  }

  const originSelection = buildPlaceSelection(
    request.tripOriginLabel,
    request.tripOriginLatitude,
    request.tripOriginLongitude,
  );
  const destinationSelection = buildPlaceSelection(
    request.tripDestinationLabel,
    request.tripDestinationLatitude,
    request.tripDestinationLongitude,
  );
  const requestedDropoffSelection = hasCustomDropoff(request)
    ? buildPlaceSelection(
        'Destino solicitado por el pasajero',
        request.requestedDropoffLatitude,
        request.requestedDropoffLongitude,
      )
    : null;
  const destinationCopy =
    request.tripRouteMode === TripRouteMode.PlannedDetour && hasCustomDropoff(request)
      ? {
          title: 'Destino solicitado',
          note:
            'Este viaje permite desvio. El pasajero solicito un destino personalizado dentro del rango permitido.',
          value: 'Destino ajustado sobre la solicitud',
          coordinates: formatCoordinates(
            request.requestedDropoffLatitude,
            request.requestedDropoffLongitude,
          ),
        }
      : {
          title: 'Destino del trayecto',
          note:
            request.tripRouteMode === TripRouteMode.PlannedDetour
              ? 'No se solicito un desvio. Se mantiene el destino original del viaje.'
              : 'Ruta sin desvio. El pasajero debe seguir el trayecto trazado por el conductor.',
          value: request.tripDestinationLabel,
          coordinates: null,
        };

  return createPortal(
    <div className={styles.modalOverlay} onClick={onClose} role="presentation">
      <div
        aria-labelledby="trip-request-detail-title"
        aria-modal="true"
        className={styles.modalCard}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className={styles.modalHeader}>
          <p className={styles.eyebrow}>Solicitud de viaje</p>
          <h2 className={styles.title} id="trip-request-detail-title">
            {request.tripOriginLabel} -&gt; {request.tripDestinationLabel}
          </h2>
          <p className={styles.summary}>
            {perspective === 'driver'
              ? `${request.passengerFullName} solicito unirse a este trayecto.`
              : `Solicitud enviada al conductor ${request.driverFullName}.`}
          </p>
        </div>

        <div className={styles.body}>
          <section className={styles.heroSection}>
            <div className={styles.heroCopy}>
              <p className={styles.heroEyebrow}>Resumen operativo</p>
              <h3 className={styles.heroTitle}>
                {perspective === 'driver'
                  ? 'Revisa si la solicitud encaja con tu trayecto'
                  : 'Consulta el estado y las condiciones de tu solicitud'}
              </h3>
              <p className={styles.heroText}>
                {request.tripRouteMode === TripRouteMode.PlannedDetour
                  ? 'La recogida se mantiene en la institucion y el destino puede ajustarse dentro del rango permitido por el conductor.'
                  : 'La ruta se mantiene fija y no admite desvio. El pasajero sigue el trayecto ya definido.'}
              </p>
            </div>
            <div className={styles.statusRow}>
              <StatusPill
                label={getTripRequestStatusLabel(request.status)}
                tone={getTripRequestStatusTone(request.status)}
              />
              <StatusPill
                label={getTripRequestExecutionStatusLabel(request.executionStatus)}
                tone={getTripRequestExecutionStatusTone(request.executionStatus)}
              />
              <StatusPill
                label={getTripStatusLabel(request.tripStatus)}
                tone={getTripStatusTone(request.tripStatus)}
              />
              {request.payment ? (
                <StatusPill
                  label={getTripPaymentStatusLabel(request.payment.status)}
                  tone={getTripPaymentStatusTone(request.payment.status)}
                />
              ) : null}
            </div>
          </section>

          <div className={styles.metaGrid}>
            <MetaItem label={perspective === 'driver' ? 'Pasajero' : 'Conductor'} value={perspective === 'driver' ? request.passengerFullName : request.driverFullName} />
            <MetaItem label="Salida" value={formatDateTime(request.tripDepartureAt)} />
            <MetaItem label="Modalidad" value={getTripRouteModeLabel(request.tripRouteMode)} />
            <MetaItem label="Institucion" value={request.institutionName} />
            <MetaItem
              label="Pago"
              value={
                request.payment
                  ? `${formatTripPaymentAmount(request.payment.amount, request.payment.currencyCode)} | ${getPaymentProviderLabel(request.payment.provider)}`
                  : 'Sin cargo generado'
              }
            />
          </div>

          {originSelection && destinationSelection ? (
            <section className={styles.mapSection}>
              <div className={styles.mapHeader}>
                <div>
                  <h3>Ruta de la solicitud</h3>
                  <p>
                    {request.tripRouteMode === TripRouteMode.PlannedDetour && requestedDropoffSelection
                      ? 'Se muestra la ruta base del viaje y el destino personalizado solicitado por el pasajero.'
                      : 'Se muestra la ruta original definida por el conductor.'}
                  </p>
                </div>
                {request.tripRouteMode === TripRouteMode.PlannedDetour ? (
                  <span className={styles.routeBadge}>Desvio disponible</span>
                ) : (
                  <span className={styles.routeBadgeMuted}>Ruta directa</span>
                )}
              </div>
              <div className={styles.mapFrame}>
                <TripRouteMap
                  destination={destinationSelection}
                  dropoff={requestedDropoffSelection}
                  origin={originSelection}
                />
              </div>
            </section>
          ) : null}

          <div className={styles.section}>
            <h3>Regla operativa de la ruta</h3>
            <p>
              {request.tripRouteMode === TripRouteMode.PlannedDetour
                ? 'La recogida siempre parte desde la institucion. En este viaje solo puede ajustarse el destino dentro del rango permitido para desvio.'
                : 'La recogida parte desde la institucion y el trayecto no admite desvio. El pasajero sigue la ruta definida por el conductor.'}
            </p>
          </div>

          <div className={styles.pointGrid}>
            <div className={styles.pointCard}>
              <span>Recogida</span>
              <strong>{request.tripOriginLabel}</strong>
              <p className={styles.pointNote}>
                Punto institucional fijo para todos los pasajeros.
              </p>
            </div>
            <div className={styles.pointCard}>
              <span>{destinationCopy.title}</span>
              <strong>{destinationCopy.value}</strong>
              {destinationCopy.coordinates ? (
                <p className={styles.coords}>{destinationCopy.coordinates}</p>
              ) : null}
              <p className={styles.pointNote}>{destinationCopy.note}</p>
            </div>
          </div>

          {request.requestMessage ? (
            <div className={styles.section}>
              <h3>Mensaje del pasajero</h3>
              <p>{request.requestMessage}</p>
            </div>
          ) : null}

          {request.reviewNote ? (
            <div className={styles.section}>
              <h3>Nota de revision</h3>
              <p>{request.reviewNote}</p>
            </div>
          ) : null}
        </div>

        <div className={styles.actions}>
          <Link className={styles.linkAction} href={`/viajes/${request.tripId}`}>
            Ver viaje
          </Link>
          <div className={styles.actionsRight}>
            <Button onClick={onClose} variant="secondary">
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metaItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function hasCustomDropoff(request: TripRequestRecord): boolean {
  return (
    request.requestedDropoffLatitude !== null &&
    request.requestedDropoffLongitude !== null
  );
}

function formatCoordinates(
  latitude: number | null,
  longitude: number | null,
): string | null {
  if (latitude === null || longitude === null) {
    return null;
  }

  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-EC');
}

function buildPlaceSelection(
  label: string,
  latitude: number | null,
  longitude: number | null,
): PlaceSelection | null {
  if (!label.trim() || latitude === null || longitude === null) {
    return null;
  }

  return {
    label,
    address: null,
    latitude,
    longitude,
  };
}
