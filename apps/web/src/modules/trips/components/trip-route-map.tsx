'use client';

import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';

import {
  DEFAULT_TRIP_MAP_CENTER,
  DEFAULT_TRIP_MAP_ZOOM,
  getGeoapifyTileLayerConfig,
} from '../lib/geoapify';
import type { PlaceSelection } from '../types/place-selection';

type TripRouteMapProps = {
  origin: PlaceSelection | null;
  destination: PlaceSelection | null;
};

type MapBundle = {
  leaflet: typeof Leaflet;
  map: Leaflet.Map;
  overlayGroup: Leaflet.FeatureGroup;
};

export function TripRouteMap({ origin, destination }: TripRouteMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const bundleRef = useRef<MapBundle | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const mapElement = mapRef.current;

    if (!mapElement) {
      return;
    }

    let isMounted = true;

    const initializeMap = async () => {
      try {
        const leafletModule = await import('leaflet');

        if (!isMounted || !mapElement) {
          return;
        }

        const tileLayerConfig = getGeoapifyTileLayerConfig();
        const map = leafletModule.map(mapElement, {
          center: [DEFAULT_TRIP_MAP_CENTER.latitude, DEFAULT_TRIP_MAP_CENTER.longitude],
          zoom: DEFAULT_TRIP_MAP_ZOOM,
          zoomControl: true,
          attributionControl: true,
        });

        leafletModule.tileLayer(
          leafletModule.Browser.retina ? tileLayerConfig.retinaUrl : tileLayerConfig.baseUrl,
          {
            attribution: tileLayerConfig.attribution,
            maxZoom: tileLayerConfig.maxZoom,
          },
        ).addTo(map);

        const overlayGroup = leafletModule.featureGroup().addTo(map);

        bundleRef.current = {
          leaflet: leafletModule,
          map,
          overlayGroup,
        };

        syncMapBundle(bundleRef.current, origin, destination);
        setErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'No fue posible cargar el mapa del viaje.',
        );
      }
    };

    void initializeMap();

    return () => {
      isMounted = false;
      bundleRef.current?.map.remove();
      bundleRef.current = null;
    };
  }, []);

  useEffect(() => {
    const bundle = bundleRef.current;

    if (!bundle) {
      return;
    }

    syncMapBundle(bundle, origin, destination);
  }, [destination, origin]);

  return (
    <>
      {errorMessage ? <div className="form-helper">{errorMessage}</div> : null}
      <div className="trip-map-canvas" ref={mapRef} />
    </>
  );
}

function syncMapBundle(
  bundle: MapBundle,
  origin: PlaceSelection | null,
  destination: PlaceSelection | null,
) {
  const { leaflet, map, overlayGroup } = bundle;

  overlayGroup.clearLayers();

  const points: Array<[number, number]> = [];

  if (origin) {
    const position: [number, number] = [origin.latitude, origin.longitude];
    points.push(position);
    leaflet
      .marker(position, {
        icon: buildMarkerIcon(leaflet, 'O', 'trip-map-marker-origin'),
      })
      .addTo(overlayGroup);
  }

  if (destination) {
    const position: [number, number] = [destination.latitude, destination.longitude];
    points.push(position);
    leaflet
      .marker(position, {
        icon: buildMarkerIcon(leaflet, 'D', 'trip-map-marker-destination'),
      })
      .addTo(overlayGroup);
  }

  if (points.length > 1) {
    leaflet
      .polyline(points, {
        color: '#0f766e',
        opacity: 0.9,
        weight: 4,
      })
      .addTo(overlayGroup);
  }

  if (points.length === 0) {
    map.setView(
      [DEFAULT_TRIP_MAP_CENTER.latitude, DEFAULT_TRIP_MAP_CENTER.longitude],
      DEFAULT_TRIP_MAP_ZOOM,
    );
    return;
  }

  if (points.length === 1) {
    map.setView(points[0], 15);
    return;
  }

  map.fitBounds(overlayGroup.getBounds(), {
    padding: [72, 72],
  });
}

function buildMarkerIcon(
  leafletModule: typeof Leaflet,
  label: string,
  accentClassName: string,
) {
  return leafletModule.divIcon({
    className: `trip-map-marker ${accentClassName}`,
    html: `<span>${label}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}
