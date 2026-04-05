const GEOAPIFY_API_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY?.trim() ?? '';

export const DEFAULT_TRIP_MAP_CENTER = {
  latitude: -1.24908,
  longitude: -78.61675,
} as const;

export const DEFAULT_TRIP_MAP_ZOOM = 13;

const AUTOCOMPLETE_LIMIT = 5;
const ECUADOR_COUNTRY_FILTER = 'countrycode:ec';

type GeoapifyAutocompleteResponse = {
  features?: Array<{
    geometry?: {
      coordinates?: [number, number];
    };
    properties?: {
      place_id?: string;
      formatted?: string;
      address_line1?: string;
      lat?: number;
      lon?: number;
    };
  }>;
};

export type GeoapifyPlaceSuggestion = {
  id: string;
  label: string;
  address: string | null;
  latitude: number;
  longitude: number;
};

export function isGeoapifyConfigured(): boolean {
  return GEOAPIFY_API_KEY.length > 0;
}

export function getGeoapifySetupMessage(): string {
  return 'Configura NEXT_PUBLIC_GEOAPIFY_API_KEY para habilitar el mapa y el autocompletado geografico.';
}

export function buildGeoapifyAutocompleteUrl(query: string): string {
  if (!isGeoapifyConfigured()) {
    throw new Error(getGeoapifySetupMessage());
  }

  const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete');
  url.searchParams.set('text', query);
  url.searchParams.set('limit', AUTOCOMPLETE_LIMIT.toString());
  url.searchParams.set('lang', 'es');
  url.searchParams.set(
    'bias',
    `proximity:${DEFAULT_TRIP_MAP_CENTER.longitude},${DEFAULT_TRIP_MAP_CENTER.latitude}`,
  );
  url.searchParams.set('filter', ECUADOR_COUNTRY_FILTER);
  url.searchParams.set('apiKey', GEOAPIFY_API_KEY);

  return url.toString();
}

export function mapGeoapifySuggestions(
  payload: GeoapifyAutocompleteResponse,
): GeoapifyPlaceSuggestion[] {
  return (payload.features ?? [])
    .map((feature) => {
      const latitude = feature.properties?.lat ?? feature.geometry?.coordinates?.[1];
      const longitude = feature.properties?.lon ?? feature.geometry?.coordinates?.[0];
      const label = feature.properties?.address_line1 ?? feature.properties?.formatted ?? null;
      const address = feature.properties?.formatted ?? null;

      if (
        !label ||
        typeof latitude !== 'number' ||
        Number.isNaN(latitude) ||
        typeof longitude !== 'number' ||
        Number.isNaN(longitude)
      ) {
        return null;
      }

      return {
        id:
          feature.properties?.place_id ??
          `${label}-${latitude.toFixed(6)}-${longitude.toFixed(6)}`,
        label,
        address,
        latitude,
        longitude,
      } satisfies GeoapifyPlaceSuggestion;
    })
    .filter((suggestion): suggestion is GeoapifyPlaceSuggestion => suggestion !== null);
}

export function getGeoapifyTileLayerConfig() {
  if (!isGeoapifyConfigured()) {
    throw new Error(getGeoapifySetupMessage());
  }

  return {
    baseUrl: `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_API_KEY}`,
    retinaUrl: `https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}@2x.png?apiKey=${GEOAPIFY_API_KEY}`,
    attribution: [
      'Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a>',
      '<a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">&copy; OpenMapTiles</a>',
      '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">&copy; OpenStreetMap</a> contributors',
    ].join(' | '),
    maxZoom: 20,
  } as const;
}
