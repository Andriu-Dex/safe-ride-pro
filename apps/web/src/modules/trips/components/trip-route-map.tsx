'use client';

import {
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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

const MAX_HISTORY_POINTS = 24;
let leafletModulePromise: Promise<typeof Leaflet> | null = null;

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
  const mapShellRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const bundleRef = useRef<MapBundle | null>(null);
  const invalidateFrameRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const lastGeometryKeyRef = useRef<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [shouldMountMap, setShouldMountMap] = useState(false);

  const cappedHistory = useMemo(
    () => (history.length > MAX_HISTORY_POINTS ? history.slice(-MAX_HISTORY_POINTS) : history),
    [history],
  );
  const geometryKey = useMemo(
    () =>
      JSON.stringify({
        origin: serializePlace(origin),
        destination: serializePlace(destination),
        pickup: serializePlace(pickup),
        dropoff: serializePlace(dropoff),
        livePosition: serializePlace(livePosition),
        history: cappedHistory.map(serializePlace),
      }),
    [cappedHistory, destination, dropoff, livePosition, origin, pickup],
  );

  useEffect(() => {
    const shellElement = mapShellRef.current;

    if (!shellElement) {
      return;
    }

    if (shouldMountMap) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (entry?.isIntersecting) {
          setShouldMountMap(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '180px 0px',
        threshold: 0.01,
      },
    );

    observer.observe(shellElement);

    return () => {
      observer.disconnect();
    };
  }, [shouldMountMap]);

  useEffect(() => {
    const mapElement = mapRef.current;

    if (!mapElement || !shouldMountMap) {
      return;
    }

    let isMounted = true;

    const initializeMap = async () => {
      try {
        const leafletModule = await getLeafletModule();

        if (!isMounted || !mapElement || bundleRef.current) {
          return;
        }

        const tileLayerConfig = getGeoapifyTileLayerConfig();
        const map = leafletModule.map(mapElement, {
          center: [DEFAULT_TRIP_MAP_CENTER.latitude, DEFAULT_TRIP_MAP_CENTER.longitude],
          zoom: DEFAULT_TRIP_MAP_ZOOM,
          zoomControl: true,
          attributionControl: true,
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
        });

        leafletModule.tileLayer(
          leafletModule.Browser.retina ? tileLayerConfig.retinaUrl : tileLayerConfig.baseUrl,
          {
            attribution: tileLayerConfig.attribution,
            maxZoom: tileLayerConfig.maxZoom,
            updateWhenIdle: true,
            keepBuffer: 2,
          },
        ).addTo(map);

        const overlayGroup = leafletModule.featureGroup().addTo(map);

        bundleRef.current = {
          leaflet: leafletModule,
          map,
          overlayGroup,
        };
        setIsMapReady(true);

        lastGeometryKeyRef.current = '';
        syncMapBundle(bundleRef.current, origin, destination, pickup, dropoff, livePosition, cappedHistory);
        scheduleMapInvalidate(() => bundleRef.current?.map, mapRef, invalidateFrameRef);
        setErrorMessage(null);

        if (typeof ResizeObserver !== 'undefined') {
          resizeObserverRef.current = new ResizeObserver(() => {
            scheduleMapInvalidate(() => bundleRef.current?.map, mapRef, invalidateFrameRef);
          });
          resizeObserverRef.current.observe(mapElement);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : 'No fue posible cargar el mapa del viaje.',
        );
      }
    };

    void initializeMap();

    return () => {
      isMounted = false;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      if (invalidateFrameRef.current !== null) {
        window.cancelAnimationFrame(invalidateFrameRef.current);
        invalidateFrameRef.current = null;
      }
      setIsMapReady(false);
      lastGeometryKeyRef.current = '';
      if (bundleRef.current) {
        try {
          bundleRef.current.overlayGroup.clearLayers();
          bundleRef.current.map.off();
          bundleRef.current.map.stop();
          bundleRef.current.map.remove();
        } catch {
          // Ignore teardown issues from Leaflet during route transitions.
        }
      }
      bundleRef.current = null;
    };
  }, [cappedHistory, destination, dropoff, livePosition, origin, pickup, shouldMountMap]);

  useEffect(() => {
    const shellElement = mapShellRef.current;

    if (!shellElement) {
      return;
    }

    const preventPageScrollWhileZooming = (event: WheelEvent) => {
      event.preventDefault();
    };

    shellElement.addEventListener('wheel', preventPageScrollWhileZooming, {
      capture: true,
      passive: false,
    });

    return () => {
      shellElement.removeEventListener('wheel', preventPageScrollWhileZooming, {
        capture: true,
      });
    };
  }, []);

  useEffect(() => {
    const bundle = bundleRef.current;

    if (!bundle || !isMapReady || lastGeometryKeyRef.current === geometryKey) {
      return;
    }

    syncMapBundle(bundle, origin, destination, pickup, dropoff, livePosition, cappedHistory);
    lastGeometryKeyRef.current = geometryKey;
    scheduleMapInvalidate(() => bundleRef.current?.map, mapRef, invalidateFrameRef);
  }, [cappedHistory, destination, dropoff, geometryKey, isMapReady, livePosition, origin, pickup]);

  useEffect(() => {
    const bundle = bundleRef.current;

    if (!bundle) {
      return;
    }

    const mapContainer = bundle.map.getContainer();
    mapContainer.classList.toggle('trip-map-canvas-passive', Boolean(selectionMode));
    setMapInteractionMode(bundle.map, Boolean(selectionMode));

    return () => {
      mapContainer.classList.remove('trip-map-canvas-passive');
    };
  }, [isMapReady, onMapSelect, selectionMode]);

  const handleSelectionPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!selectionMode || !onMapSelect) {
      return;
    }

    const bundle = bundleRef.current;
    const shellElement = mapShellRef.current;

    if (!bundle || !shellElement) {
      return;
    }

    const bounds = shellElement.getBoundingClientRect();
    const containerPoint: [number, number] = [
      event.clientX - bounds.left,
      event.clientY - bounds.top,
    ];
    const latlng = bundle.map.containerPointToLatLng(containerPoint);

    onMapSelect({
      latitude: latlng.lat,
      longitude: latlng.lng,
      target: selectionMode,
    });
  };

  const handleSelectionWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const bundle = bundleRef.current;

    if (!bundle) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const shellElement = mapShellRef.current;

    if (!shellElement || event.deltaY === 0) {
      return;
    }

    const bounds = shellElement.getBoundingClientRect();
    const containerPoint: [number, number] = [
      event.clientX - bounds.left,
      event.clientY - bounds.top,
    ];
    const currentZoom = bundle.map.getZoom();
    const minZoom = bundle.map.getMinZoom();
    const maxZoom = bundle.map.getMaxZoom();
    const requestedZoom = currentZoom + (event.deltaY < 0 ? 1 : -1);
    const nextZoom = Math.max(minZoom, Math.min(maxZoom, requestedZoom));

    if (nextZoom === currentZoom) {
      return;
    }

    bundle.map.setZoomAround(containerPoint, nextZoom, {
      animate: false,
    });
  };

  return (
    <>
      {errorMessage ? <div className="form-helper">{errorMessage}</div> : null}
      <div
        className={[
          'trip-map-shell',
          selectionMode ? 'trip-map-canvas-selection' : null,
          !shouldMountMap ? 'trip-map-canvas-pending' : null,
          shouldMountMap && !isMapReady ? 'trip-map-canvas-loading' : null,
        ]
          .filter(Boolean)
          .join(' ')}
        ref={mapShellRef}
      >
        <div className="trip-map-canvas" ref={mapRef} />
        {selectionMode && isMapReady ? (
          <div
            aria-label="Capa de selección de puntos en el mapa"
            className="trip-map-selection-overlay"
            onPointerUp={handleSelectionPointerUp}
            onWheel={handleSelectionWheel}
            role="presentation"
          />
        ) : null}
        {!shouldMountMap || !isMapReady ? (
          <div className="trip-map-placeholder">
            <strong>{!shouldMountMap ? 'Preparando mapa' : 'Cargando ruta'}</strong>
            <span>
              {!shouldMountMap
                ? 'El mapa se activara en cuanto entre en pantalla.'
                : 'Sincronizando tiles y puntos del trayecto.'}
            </span>
          </div>
        ) : null}
      </div>
    </>
  );
}

async function getLeafletModule(): Promise<typeof Leaflet> {
  if (!leafletModulePromise) {
    leafletModulePromise = import('leaflet');
  }

  return leafletModulePromise;
}

function scheduleMapInvalidate(
  getMap: () => Leaflet.Map | undefined,
  mapRef: React.RefObject<HTMLDivElement | null>,
  invalidateFrameRef: React.MutableRefObject<number | null>,
) {
  if (invalidateFrameRef.current !== null) {
    window.cancelAnimationFrame(invalidateFrameRef.current);
  }

  invalidateFrameRef.current = window.requestAnimationFrame(() => {
    const map = getMap();

    if (!map || !mapRef.current?.isConnected || mapRef.current.offsetParent === null) {
      return;
    }

    try {
      map.invalidateSize({ pan: false, animate: false });
    } catch {
      // Ignore transient Leaflet layout errors when the container is changing.
    }
  });
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
      { animate: false },
    );
    return;
  }

  if (points.length === 1) {
    map.setView(points[0], 15, { animate: false });
    return;
  }

  map.fitBounds(overlayGroup.getBounds(), {
    animate: false,
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

function serializePlace(place: PlaceSelection | null): string | null {
  if (!place) {
    return null;
  }

  return `${place.latitude.toFixed(6)}:${place.longitude.toFixed(6)}:${place.label}`;
}

function setMapInteractionMode(map: Leaflet.Map, isSelectionActive: boolean) {
  toggleMapHandler(map.dragging, isSelectionActive);
  toggleMapHandler(map.doubleClickZoom, isSelectionActive);
  toggleMapHandler(map.boxZoom, isSelectionActive);
  toggleMapHandler(map.keyboard, isSelectionActive);
  toggleMapHandler(map.touchZoom, isSelectionActive);
}

function toggleMapHandler(
  handler: {
    disable: () => void;
    enable: () => void;
  } | null | undefined,
  shouldDisable: boolean,
) {
  if (!handler) {
    return;
  }

  if (shouldDisable) {
    handler.disable();
    return;
  }

  handler.enable();
}
