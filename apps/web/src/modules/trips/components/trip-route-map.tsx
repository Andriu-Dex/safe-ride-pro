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
  routePath?: Array<{ latitude: number; longitude: number }> | null;
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
  routePath = null,
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
  const lastSelectionWheelAtRef = useRef(0);
  const selectionDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    hasDragged: boolean;
  } | null>(null);
  const lastGeometryKeyRef = useRef<string>('');
  const lastFitKeyRef = useRef<string>('');
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
        routePath: serializeRoutePath(routePath),
        pickup: serializePlace(pickup),
        dropoff: serializePlace(dropoff),
        livePosition: serializePlace(livePosition),
        history: cappedHistory.map(serializePlace),
      }),
    [cappedHistory, destination, dropoff, livePosition, origin, pickup, routePath],
  );
  const fitKey = useMemo(
    () =>
      JSON.stringify({
        origin: serializePlace(origin),
        destination: serializePlace(destination),
        routePath: serializeRoutePath(routePath),
        pickup: serializePlace(pickup),
        dropoff: serializePlace(dropoff),
      }),
    [destination, dropoff, origin, pickup, routePath],
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
          scrollWheelZoom: true,
          wheelDebounceTime: 80,
          wheelPxPerZoomLevel: 120,
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
        lastFitKeyRef.current = '';
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
      lastFitKeyRef.current = '';
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
  }, [shouldMountMap]);

  useEffect(() => {
    const bundle = bundleRef.current;

    if (!bundle || !isMapReady || lastGeometryKeyRef.current === geometryKey) {
      return;
    }

    const shouldFit = lastFitKeyRef.current !== fitKey;

    syncMapBundle(
      bundle,
      origin,
      destination,
      routePath,
      pickup,
      dropoff,
      livePosition,
      cappedHistory,
      shouldFit,
    );
    lastGeometryKeyRef.current = geometryKey;
    lastFitKeyRef.current = fitKey;
    scheduleMapInvalidate(() => bundleRef.current?.map, mapRef, invalidateFrameRef);
  }, [cappedHistory, destination, dropoff, fitKey, geometryKey, isMapReady, livePosition, origin, pickup, routePath]);

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

  const handleSelectionPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!selectionMode || !onMapSelect) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    selectionDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      hasDragged: false,
    };
  };

  const handleSelectionPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = selectionDragRef.current;
    const bundle = bundleRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId || !bundle) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const movementX = event.clientX - dragState.lastX;
    const movementY = event.clientY - dragState.lastY;
    const totalMovement = Math.hypot(
      event.clientX - dragState.startX,
      event.clientY - dragState.startY,
    );

    if (totalMovement > 6) {
      dragState.hasDragged = true;
    }

    if (dragState.hasDragged && (movementX !== 0 || movementY !== 0)) {
      bundle.map.panBy([-movementX, -movementY], { animate: false });
    }

    dragState.lastX = event.clientX;
    dragState.lastY = event.clientY;
  };

  const handleSelectionPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!selectionMode || !onMapSelect) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const bundle = bundleRef.current;
    const shellElement = mapShellRef.current;
    const dragState = selectionDragRef.current;

    if (dragState?.pointerId === event.pointerId) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }

      selectionDragRef.current = null;
    }

    if (!bundle || !shellElement) {
      return;
    }

    if (dragState?.hasDragged) {
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

  const handleSelectionPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (selectionDragRef.current?.pointerId === event.pointerId) {
      selectionDragRef.current = null;
    }
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

    const now = window.performance.now();

    if (now - lastSelectionWheelAtRef.current < 120) {
      return;
    }

    lastSelectionWheelAtRef.current = now;

    zoomMapAtClientPoint(
      bundle.map,
      shellElement,
      event.clientX,
      event.clientY,
      event.deltaY,
    );
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
            onPointerCancel={handleSelectionPointerCancel}
            onPointerDown={handleSelectionPointerDown}
            onPointerMove={handleSelectionPointerMove}
            onPointerUp={handleSelectionPointerUp}
            onWheel={handleSelectionWheel}
            role="presentation"
          />
        ) : null}
        {!shouldMountMap || !isMapReady ? (
          <div className="trip-map-placeholder">
            <strong>{!shouldMountMap ? 'Mapa' : 'Cargando'}</strong>
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
  routePath: Array<{ latitude: number; longitude: number }> | null,
  pickup: PlaceSelection | null,
  dropoff: PlaceSelection | null,
  livePosition: PlaceSelection | null,
  history: PlaceSelection[],
  shouldFit: boolean,
) {
  const { leaflet, map, overlayGroup } = bundle;

  overlayGroup.clearLayers();

  const points: Array<[number, number]> = [];
  const fitPoints: Array<[number, number]> = [];

  if (origin) {
    const position: [number, number] = [origin.latitude, origin.longitude];
    points.push(position);
    fitPoints.push(position);
    leaflet
      .marker(position, {
        icon: buildMarkerIcon(leaflet, 'O', 'trip-map-marker-origin'),
      })
      .addTo(overlayGroup);
  }

  if (destination) {
    const position: [number, number] = [destination.latitude, destination.longitude];
    points.push(position);
    fitPoints.push(position);
    leaflet
      .marker(position, {
        icon: buildMarkerIcon(leaflet, 'D', 'trip-map-marker-destination'),
      })
      .addTo(overlayGroup);
  }

  if (pickup) {
    const position: [number, number] = [pickup.latitude, pickup.longitude];
    points.push(position);
    fitPoints.push(position);
    leaflet
      .marker(position, {
        icon: buildMarkerIcon(leaflet, 'R', 'trip-map-marker-pickup'),
      })
      .addTo(overlayGroup);
  }

  if (dropoff) {
    const position: [number, number] = [dropoff.latitude, dropoff.longitude];
    points.push(position);
    fitPoints.push(position);
    leaflet
      .marker(position, {
        icon: buildMarkerIcon(leaflet, 'B', 'trip-map-marker-dropoff'),
      })
      .addTo(overlayGroup);
  }

  if (routePath && routePath.length > 1) {
    const routePositions = routePath.map(
      (point) => [point.latitude, point.longitude] as [number, number],
    );
    fitPoints.push(...routePositions);
    leaflet
      .polyline(routePositions, {
        color: '#0f766e',
        opacity: 0.92,
        weight: 5,
      })
      .addTo(overlayGroup);
  } else if (points.length > 1) {
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

  if (!shouldFit) {
    return;
  }

  if (fitPoints.length === 0) {
    map.setView(
      [DEFAULT_TRIP_MAP_CENTER.latitude, DEFAULT_TRIP_MAP_CENTER.longitude],
      DEFAULT_TRIP_MAP_ZOOM,
      { animate: false },
    );
    return;
  }

  if (fitPoints.length === 1) {
    map.setView(fitPoints[0], 15, { animate: false });
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

function serializeRoutePath(routePath: Array<{ latitude: number; longitude: number }> | null): string | null {
  if (!routePath?.length) {
    return null;
  }

  return routePath
    .map((point) => `${point.latitude.toFixed(6)}:${point.longitude.toFixed(6)}`)
    .join('|');
}

function zoomMapAtClientPoint(
  map: Leaflet.Map | undefined,
  shellElement: HTMLDivElement | null,
  clientX: number,
  clientY: number,
  deltaY: number,
) {
  if (!map || !shellElement || deltaY === 0) {
    return;
  }

  const bounds = shellElement.getBoundingClientRect();
  const containerPoint: [number, number] = [
    clientX - bounds.left,
    clientY - bounds.top,
  ];
  const latLng = map.containerPointToLatLng(containerPoint);
  const currentZoom = map.getZoom();
  const minZoom = map.getMinZoom();
  const maxZoom = map.getMaxZoom();
  const requestedZoom = currentZoom + (deltaY < 0 ? 1 : -1);
  const nextZoom = Math.max(minZoom, Math.min(maxZoom, requestedZoom));

  if (nextZoom === currentZoom) {
    return;
  }

  map.setZoomAround(latLng, nextZoom, {
    animate: false,
  });
}

function setMapInteractionMode(map: Leaflet.Map, isSelectionActive: boolean) {
  toggleMapHandler(map.dragging, isSelectionActive);
  toggleMapHandler(map.doubleClickZoom, isSelectionActive);
  toggleMapHandler(map.boxZoom, isSelectionActive);
  toggleMapHandler(map.keyboard, isSelectionActive);
  toggleMapHandler(map.touchZoom, isSelectionActive);
  toggleMapHandler(map.scrollWheelZoom, isSelectionActive);
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
