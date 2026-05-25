'use client';

import { InputField } from '../../../components/ui/input-field';
import {
  getGeoapifySetupMessage,
  isGeoapifyConfigured,
} from '../lib/geoapify';
import type { PlaceSelection } from '../types/place-selection';
import type { TripRequestDraft } from './trips-workspace.types';
import { PlaceAutocompleteField } from './place-autocomplete-field';
import { TripRouteMap } from './trip-route-map';

type TripRequestDetourPlannerProps = {
  draft: TripRequestDraft;
  destinationLabel: string;
  destinationLatitude: string;
  destinationLongitude: string;
  routePath?: Array<{ latitude: number; longitude: number }> | null;
  disabled?: boolean;
  originLabel: string;
  originLatitude: string;
  originLongitude: string;
  onChange: (field: keyof TripRequestDraft, value: string) => void;
};

export function TripRequestDetourPlanner({
  draft,
  destinationLabel,
  destinationLatitude,
  destinationLongitude,
  routePath = null,
  disabled = false,
  originLabel,
  originLatitude,
  originLongitude,
  onChange,
}: TripRequestDetourPlannerProps) {
  const isMapsEnabled = isGeoapifyConfigured();
  const originSelection = buildPlaceSelection(originLabel, originLatitude, originLongitude);
  const destinationSelection = buildPlaceSelection(
    destinationLabel,
    destinationLatitude,
    destinationLongitude,
  );
  const dropoffSelection = buildPlaceSelection(
    draft.requestedDropoffLabel,
    draft.requestedDropoffLatitude,
    draft.requestedDropoffLongitude,
  );

  const handleMapSelect = ({
    latitude,
    longitude,
    target,
  }: {
    latitude: number;
    longitude: number;
    target: 'pickup' | 'dropoff' | 'origin' | 'destination';
  }) => {
    if (target !== 'dropoff') {
      return;
    }

    onChange('requestedDropoffLatitude', latitude.toFixed(6));
    onChange('requestedDropoffLongitude', longitude.toFixed(6));
    onChange(
      'requestedDropoffLabel',
      draft.requestedDropoffLabel.trim() || 'Punto de destino marcado en mapa',
    );
  };

  return (
    <section className="trip-request-detour-workspace">
      <div className="trip-request-routing-rule">
        <strong>Recogida institucional fija</strong>
        <p>
          La recogida siempre parte desde la institucion. En este viaje solo puedes ajustar el
          destino dentro del rango permitido para desvio.
        </p>
      </div>

      <div className="form-grid form-grid-2">
        <InputField disabled label="Recogida" value={originLabel} />
        {isMapsEnabled ? (
          <PlaceAutocompleteField
            disabled={disabled}
            label="Destino solicitado"
            onClear={() => {
              onChange('requestedDropoffLabel', '');
              onChange('requestedDropoffLatitude', '');
              onChange('requestedDropoffLongitude', '');
            }}
            onSelect={(place) => {
              onChange('requestedDropoffLabel', place.label);
              onChange('requestedDropoffLatitude', place.latitude.toFixed(6));
              onChange('requestedDropoffLongitude', place.longitude.toFixed(6));
            }}
            onValueChange={(nextValue) => {
              onChange('requestedDropoffLabel', nextValue);
              onChange('requestedDropoffLatitude', '');
              onChange('requestedDropoffLongitude', '');
            }}
            placeholder="Buscar punto de destino"
            selectedPlace={dropoffSelection}
            value={draft.requestedDropoffLabel}
          />
        ) : (
          <InputField
            disabled={disabled}
            label="Destino solicitado"
            onChange={(event) => onChange('requestedDropoffLabel', event.target.value)}
            placeholder="Punto de destino"
            value={draft.requestedDropoffLabel}
          />
        )}
      </div>

      {isMapsEnabled ? (
        <section
          className="trip-map-card trip-request-map-card"
          aria-label="Mapa para solicitud con desvio"
        >
          <div className="trip-map-card-header">
            <div>
              <strong className="trip-map-card-title">Mapa del destino solicitado</strong>
              <p className="panel-text">
                Haz clic sobre el mapa para marcar el destino solicitado dentro del rango permitido.
              </p>
            </div>
            <span className="topbar-badge">Desvio disponible</span>
          </div>

          <TripRouteMap
            destination={destinationSelection}
            dropoff={dropoffSelection}
            onMapSelect={handleMapSelect}
            origin={originSelection}
            routePath={routePath}
            selectionMode="dropoff"
          />

          <div className="trip-location-grid trip-request-location-grid">
            <TripRequestLocationCard
              emptyMessage="La recogida siempre se mantiene en la institucion."
              label="Recogida"
              latitude={originLatitude}
              locationLabel={originLabel}
              longitude={originLongitude}
            />
            <TripRequestLocationCard
              emptyMessage="Si no ajustas el destino, se usara el destino original del viaje."
              label="Destino solicitado"
              latitude={draft.requestedDropoffLatitude}
              locationLabel={draft.requestedDropoffLabel}
              longitude={draft.requestedDropoffLongitude}
            />
          </div>
        </section>
      ) : (
        <>
          <div className="form-helper">{getGeoapifySetupMessage()}</div>
          <div className="form-grid form-grid-2 compact-grid">
            <InputField disabled label="Lat. recogida" value={originLatitude} />
            <InputField disabled label="Long. recogida" value={originLongitude} />
            <InputField
              disabled={disabled}
              label="Lat. destino"
              onChange={(event) => onChange('requestedDropoffLatitude', event.target.value)}
              step="any"
              type="number"
              value={draft.requestedDropoffLatitude}
            />
            <InputField
              disabled={disabled}
              label="Long. destino"
              onChange={(event) => onChange('requestedDropoffLongitude', event.target.value)}
              step="any"
              type="number"
              value={draft.requestedDropoffLongitude}
            />
          </div>
        </>
      )}
    </section>
  );
}

function TripRequestLocationCard({
  label,
  locationLabel,
  latitude,
  longitude,
  emptyMessage,
}: {
  label: string;
  locationLabel: string;
  latitude: string;
  longitude: string;
  emptyMessage: string;
}) {
  const hasCoordinates = latitude.trim() && longitude.trim();

  return (
    <div className="trip-coordinate-card trip-request-location-card">
      <span className="trip-coordinate-card-label">{label}</span>
      {locationLabel.trim() ? <strong>{locationLabel.trim()}</strong> : null}
      {hasCoordinates ? (
        <div className="trip-coordinate-card-values">
          <strong>{latitude}</strong>
          <strong>{longitude}</strong>
        </div>
      ) : (
        <p className="panel-text">{emptyMessage}</p>
      )}
    </div>
  );
}

function buildPlaceSelection(
  label: string,
  latitude: string,
  longitude: string,
): PlaceSelection | null {
  const parsedLatitude = Number.parseFloat(latitude);
  const parsedLongitude = Number.parseFloat(longitude);

  if (!label.trim() || Number.isNaN(parsedLatitude) || Number.isNaN(parsedLongitude)) {
    return null;
  }

  return {
    label,
    address: null,
    latitude: parsedLatitude,
    longitude: parsedLongitude,
  };
}
