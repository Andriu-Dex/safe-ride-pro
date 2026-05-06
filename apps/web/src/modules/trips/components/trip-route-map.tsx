'use client';

import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';

import {
  DEFAULT_TRIP_MAP_CENTER,
  DEFAULT_TRIP_MAP_ZOOM,
  getGeoapifyTileLayerConfig,
} from '../lib/geoapify';
import type { PlaceSelection } from '../types/place-selection';

export type TripRouteMapSelectionMode = 'pickup' | 'dropoff' | 'origin' | 'destination';

type TripRouteMapProps = {
  origin: PlaceSelection | null;
  destination: PlaceSelection | null;
  pickup?: PlaceSelection | null;
  dropoff?: PlaceSelection | null;
  livePosition?: PlaceSelection | null;
  history?: PlaceSelection[];
  selectionMode?: TripRouteMapSelectionMode | null;
  onMapSelect?: (selection: {
    latitude: number;
    longitude: number;
    target: TripRouteMapSelectionMode;
  }) => void;
};

type MapBundle = {
  leaflet: typeof Leaflet;
  map: Leaflet.Map;
  overlayGroup: Leaflet.FeatureGroup;
};

export function TripRouteMap({
  origin,
  destination,
  pickup = null,
  dropoff = null,
  livePosition = null,
  history = [],
  selectionMode = null,
  onMapSelect,
}: TripRouteMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const bundleRef = useRef<MapBundle | null>(null);
  const invalidateFrameRef = useRef<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

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
        setIsMapReady(true);

        syncMapBundle(bundleRef.current, origin, destination, pickup, dropoff, livePosition, history);
        invalidateFrameRef.current = window.requestAnimationFrame(() => {
          if (!isMounted || bundleRef.current?.map !== map) {
            return;
          }

          try {
            map.invalidateSize();
          } catch {
            // Leaflet can briefly throw during teardown or hidden-layout transitions.
          }
        });
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
      if (invalidateFrameRef.current !== null) {
        window.cancelAnimationFrame(invalidateFrameRef.current);
        invalidateFrameRef.current = null;
      }
      setIsMapReady(false);
      bundleRef.current?.map.remove();
      bundleRef.current = null;
    };
  }, []);

  useEffect(() => {
    const bundle = bundleRef.current;

    if (!bundle || !isMapReady) {
      return;
    }

    syncMapBundle(bundle, origin, destination, pickup, dropoff, livePosition, history);
    invalidateFrameRef.current = window.requestAnimationFrame(() => {
      if (bundleRef.current?.map !== bundle.map) {
        return;
      }

      try {
        bundle.map.invalidateSize();
      } catch {
        // Ignore transient Leaflet layout errors when the container is changing.
      }
    });
  }, [destination, dropoff, history, livePosition, origin, pickup]);

  useEffect(() => {
    const bundle = bundleRef.current;

    if (!bundle) {
      return;
    }

    const mapElement = mapRef.current;

    if (mapElement) {
      mapElement.style.cursor = selectionMode ? 'crosshair' : '';
    }

    if (!selectionMode || !onMapSelect) {
      return;
    }

    const handleMapClick = (event: Leaflet.LeafletMouseEvent) => {
      onMapSelect({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
        target: selectionMode,
      });
    };

    bundle.map.on('click', handleMapClick);

    return () => {
      bundle.map.off('click', handleMapClick);
    };
  }, [onMapSelect, selectionMode, isMapReady]);

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
  pickup: PlaceSelection | null,
  dropoff: PlaceSelection | null,
  livePosition: PlaceSelection | null,
  history: PlaceSelection[],
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

  if (pickup) {
    const position: [number, number] = [pickup.latitude, pickup.longitude];
    points.push(position);
    leaflet
      .marker(position, {
        icon: buildMarkerIcon(leaflet, 'R', 'trip-map-marker-pickup'),
      })
      .addTo(overlayGroup);
  }

  if (dropoff) {
    const position: [number, number] = [dropoff.latitude, dropoff.longitude];
    points.push(position);
    leaflet
      .marker(position, {
        icon: buildMarkerIcon(leaflet, 'B', 'trip-map-marker-dropoff'),
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

  if (history.length > 1) {
    leaflet
      .polyline(
        history.map((point) => [point.latitude, point.longitude] as [number, number]),
        {
          color: '#14b8a6',
          opacity: 0.72,
          weight: 5,
          dashArray: '10 8',
        },
      )
      .addTo(overlayGroup);
  }

  if (livePosition) {
    const position: [number, number] = [livePosition.latitude, livePosition.longitude];
    points.push(position);
    leaflet
      .marker(position, {
        icon: buildMarkerIcon(leaflet, 'V', 'trip-map-marker-live'),
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
