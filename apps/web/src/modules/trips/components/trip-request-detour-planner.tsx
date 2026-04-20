'use client';

import { useState } from 'react';

import { Button } from '../../../components/ui/button';
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
  disabled?: boolean;
  onChange: (field: keyof TripRequestDraft, value: string) => void;
};

type PlannerTarget = 'pickup' | 'dropoff';

export function TripRequestDetourPlanner({
  draft,
  disabled = false,
  onChange,
}: TripRequestDetourPlannerProps) {
  const [activeTarget, setActiveTarget] = useState<PlannerTarget>('pickup');
  const isMapsEnabled = isGeoapifyConfigured();
  const pickupSelection = buildPlaceSelection(
    draft.requestedPickupLabel,
    draft.requestedPickupLatitude,
    draft.requestedPickupLongitude,
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
    target: PlannerTarget;
  }) => {
    if (target === 'pickup') {
      onChange('requestedPickupLatitude', latitude.toFixed(6));
      onChange('requestedPickupLongitude', longitude.toFixed(6));
      onChange(
        'requestedPickupLabel',
        draft.requestedPickupLabel.trim() || 'Punto de recogida marcado en mapa',
      );
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
      <div className="trip-request-detour-toggle">
        <Button
          className={activeTarget === 'pickup' ? 'trip-request-map-target-active' : undefined}
          disabled={disabled}
          onClick={() => setActiveTarget('pickup')}
          type="button"
          variant={activeTarget === 'pickup' ? 'primary' : 'ghost'}
        >
          Marcar recogida
        </Button>
        <Button
          className={activeTarget === 'dropoff' ? 'trip-request-map-target-active' : undefined}
          disabled={disabled}
          onClick={() => setActiveTarget('dropoff')}
          type="button"
          variant={activeTarget === 'dropoff' ? 'primary' : 'ghost'}
        >
          Marcar destino
        </Button>
      </div>

      <div className="form-grid form-grid-2">
        {isMapsEnabled ? (
          <>
            <PlaceAutocompleteField
              disabled={disabled}
              label="Recogida"
              onClear={() => {
                onChange('requestedPickupLabel', '');
                onChange('requestedPickupLatitude', '');
                onChange('requestedPickupLongitude', '');
              }}
              onSelect={(place) => {
                onChange('requestedPickupLabel', place.label);
                onChange('requestedPickupLatitude', place.latitude.toFixed(6));
                onChange('requestedPickupLongitude', place.longitude.toFixed(6));
              }}
              onValueChange={(nextValue) => {
                onChange('requestedPickupLabel', nextValue);
                onChange('requestedPickupLatitude', '');
                onChange('requestedPickupLongitude', '');
              }}
              placeholder="Buscar punto de recogida"
              selectedPlace={pickupSelection}
              value={draft.requestedPickupLabel}
            />
            <PlaceAutocompleteField
              disabled={disabled}
              label="Destino"
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
          </>
        ) : (
          <>
            <InputField
              disabled={disabled}
              label="Recogida"
              onChange={(event) => onChange('requestedPickupLabel', event.target.value)}
              placeholder="Punto de recogida"
              value={draft.requestedPickupLabel}
            />
            <InputField
              disabled={disabled}
              label="Destino"
              onChange={(event) => onChange('requestedDropoffLabel', event.target.value)}
              placeholder="Punto de destino"
              value={draft.requestedDropoffLabel}
            />
          </>
        )}
      </div>

      {isMapsEnabled ? (
        <section className="trip-map-card trip-request-map-card" aria-label="Mapa para solicitud con desvio">
          <div className="trip-map-card-header">
            <div>
              <strong className="trip-map-card-title">Mapa de desvio</strong>
            </div>
            <span className="topbar-badge">
              {activeTarget === 'pickup' ? 'Editando recogida' : 'Editando destino'}
            </span>
          </div>

          <TripRouteMap
            destination={null}
            dropoff={dropoffSelection}
            onMapSelect={handleMapSelect}
            origin={null}
            pickup={pickupSelection}
            selectionMode={activeTarget}
          />

          <div className="trip-location-grid trip-request-location-grid">
            <TripRequestLocationCard
              emptyMessage="Selecciona o marca un punto para la recogida."
              label="Recogida"
              latitude={draft.requestedPickupLatitude}
              locationLabel={draft.requestedPickupLabel}
              longitude={draft.requestedPickupLongitude}
            />
            <TripRequestLocationCard
              emptyMessage="Selecciona o marca un punto para el destino."
              label="Destino"
              latitude={draft.requestedDropoffLatitude}
              locationLabel={draft.requestedDropoffLabel}
              longitude={draft.requestedDropoffLongitude}
            />
          </div>
        </section>
      ) : (
        <>
          <div className="form-helper">{getGeoapifySetupMessage()}</div>
          <div className="form-grid form-grid-4 compact-grid">
            <InputField
              disabled={disabled}
              label="Lat. recogida"
              onChange={(event) => onChange('requestedPickupLatitude', event.target.value)}
              step="any"
              type="number"
              value={draft.requestedPickupLatitude}
            />
            <InputField
              disabled={disabled}
              label="Long. recogida"
              onChange={(event) => onChange('requestedPickupLongitude', event.target.value)}
              step="any"
              type="number"
              value={draft.requestedPickupLongitude}
            />
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
