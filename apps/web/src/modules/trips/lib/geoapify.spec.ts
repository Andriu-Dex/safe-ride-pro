import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('geoapify helpers', () => {
  const originalApiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
    } else {
      process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY = originalApiKey;
    }
  });

  it('handles not configured state', async () => {
    process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY = '';
    const {
      isGeoapifyConfigured,
      getGeoapifySetupMessage,
      buildGeoapifyAutocompleteUrl,
      buildGeoapifyReverseGeocodeUrl,
      buildGeoapifyRoutingUrl,
      getGeoapifyTileLayerConfig,
    } = await import('./geoapify');

    expect(isGeoapifyConfigured()).toBe(false);
    expect(getGeoapifySetupMessage()).toBeDefined();

    expect(() => buildGeoapifyAutocompleteUrl('Ambato')).toThrow();
    expect(() => buildGeoapifyReverseGeocodeUrl({ latitude: 1, longitude: 2 })).toThrow();
    expect(() => buildGeoapifyRoutingUrl({ latitude: 1, longitude: 2 }, { latitude: 3, longitude: 4 })).toThrow();
    expect(() => getGeoapifyTileLayerConfig()).toThrow();
  });

  it('builds autocomplete, reverse geocode, and routing URLs and tile layer config when configured', async () => {
    process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY = 'geoapify-test-key';
    const {
      buildGeoapifyAutocompleteUrl,
      buildGeoapifyReverseGeocodeUrl,
      buildGeoapifyRoutingUrl,
      getGeoapifyTileLayerConfig,
      isGeoapifyConfigured,
    } = await import('./geoapify');

    expect(isGeoapifyConfigured()).toBe(true);

    const autocompleteUrl = buildGeoapifyAutocompleteUrl('Ambato');
    expect(autocompleteUrl).toContain('geocode/autocomplete');
    expect(autocompleteUrl).toContain('apiKey=geoapify-test-key');

    const reverseUrl = buildGeoapifyReverseGeocodeUrl({ latitude: -1.2, longitude: -78.6 });
    expect(reverseUrl).toContain('geocode/reverse');
    expect(reverseUrl).toContain('lat=-1.2');
    expect(reverseUrl).toContain('lon=-78.6');

    const routingUrl = buildGeoapifyRoutingUrl({ latitude: -1.2, longitude: -78.6 }, { latitude: -1.3, longitude: -78.7 });
    expect(routingUrl).toContain('routing');
    expect(routingUrl).toContain('waypoints=-1.2%2C-78.6%7C-1.3%2C-78.7');

    const tiles = getGeoapifyTileLayerConfig();
    expect(tiles.baseUrl).toContain('apiKey=geoapify-test-key');
    expect(tiles.retinaUrl).toContain('apiKey=geoapify-test-key');
    expect(tiles.attribution).toContain('OpenStreetMap');
    expect(tiles.maxZoom).toBe(20);
  });

  it('maps Geoapify features into place suggestions', async () => {
    const { mapGeoapifySuggestions } = await import('./geoapify');

    const suggestions = mapGeoapifySuggestions({
      features: [
        {
          properties: {
            place_id: 'ambato-uta',
            address_line1: 'Universidad Tecnica de Ambato',
            formatted: 'Universidad Tecnica de Ambato, Ambato, Ecuador',
            lat: -1.2523,
            lon: -78.6221,
          },
        },
        // Fallbacks for lat/lon in geometry coordinates
        {
          geometry: {
            coordinates: [-78.62, -1.25],
          },
          properties: {
            formatted: 'Fallback Address',
          },
        },
        // Invalid properties
        {
          properties: {
            place_id: 'invalid-one',
            // missing label/formatted
          },
        },
      ],
    });

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]).toEqual({
      id: 'ambato-uta',
      label: 'Universidad Tecnica de Ambato',
      address: 'Universidad Tecnica de Ambato, Ambato, Ecuador',
      latitude: -1.2523,
      longitude: -78.6221,
    });
    expect(suggestions[1]).toEqual({
      id: 'Fallback Address--1.250000--78.620000',
      label: 'Fallback Address',
      address: 'Fallback Address',
      latitude: -1.25,
      longitude: -78.62,
    });

    // 4. Empty/undefined features list
    const emptySuggestions = mapGeoapifySuggestions({});
    expect(emptySuggestions).toEqual([]);
  });

  it('fetches route recommendation and maps it', async () => {
    process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY = 'geoapify-test-key';
    const { fetchGeoapifyRouteRecommendation } = await import('./geoapify');

    const origin = { latitude: -1.2, longitude: -78.6 };
    const destination = { latitude: -1.3, longitude: -78.7 };

    // 1. Unsuccessful response
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
    } as Response);
    let result = await fetchGeoapifyRouteRecommendation(origin, destination);
    expect(result).toBeNull();

    // 2. JSON throws error
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new Error('JSON parse error')),
    } as unknown as Response);
    result = await fetchGeoapifyRouteRecommendation(origin, destination);
    expect(result).toBeNull();

    // 3. Successful parse with valid coordinates (single flat array)
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        features: [
          {
            geometry: {
              coordinates: [
                [-78.6, -1.2],
                [-78.7, -1.3],
              ],
            },
            properties: {
              distance: 1250.4,
              time: 300,
            },
          },
        ],
      }),
    } as unknown as Response);
    result = await fetchGeoapifyRouteRecommendation(origin, destination);
    expect(result).toEqual({
      path: [
        { latitude: -1.2, longitude: -78.6 },
        { latitude: -1.3, longitude: -78.7 },
      ],
      distanceMeters: 1250,
      durationSeconds: 300,
    });

    // 4. coordinates nested inside array (multi-line strings / nested coordinates)
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        features: [
          {
            geometry: {
              coordinates: [
                [
                  [-78.6, -1.2],
                  [-78.7, -1.3],
                ],
              ],
            },
            properties: {},
          },
        ],
      }),
    } as unknown as Response);
    result = await fetchGeoapifyRouteRecommendation(origin, destination);
    expect(result).toEqual({
      path: [
        { latitude: -1.2, longitude: -78.6 },
        { latitude: -1.3, longitude: -78.7 },
      ],
      distanceMeters: null,
      durationSeconds: null,
    });

    // 5. coordinate mapping path length too short
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        features: [
          {
            geometry: {
              coordinates: [
                [-78.6, -1.2],
              ],
            },
          },
        ],
      }),
    } as unknown as Response);
    result = await fetchGeoapifyRouteRecommendation(origin, destination);
    expect(result).toBeNull();

    // 6. coordinate mapping completely invalid (not array)
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        features: [
          {
            geometry: {
              coordinates: 'not-an-array',
            },
          },
        ],
      }),
    } as unknown as Response);
    result = await fetchGeoapifyRouteRecommendation(origin, destination);
    expect(result).toBeNull();

    // 7. coordinates is array but coordinates[0] is neither a coordinate pair nor an array
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        features: [
          {
            geometry: {
              coordinates: ['not-a-pair-or-array'],
            },
          },
        ],
      }),
    } as unknown as Response);
    result = await fetchGeoapifyRouteRecommendation(origin, destination);
    expect(result).toBeNull();

    // 8. coordinates array contains invalid coordinate pair elements
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        features: [
          {
            geometry: {
              coordinates: [
                [-78.6, -1.2],
                ['not-a-number', -1.3],
              ],
            },
          },
        ],
      }),
    } as unknown as Response);
    result = await fetchGeoapifyRouteRecommendation(origin, destination);
    expect(result).toBeNull();
  });

  it('fetches place label and handles various address/properties structures', async () => {
    process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY = 'geoapify-test-key';
    const { fetchGeoapifyPlaceLabel } = await import('./geoapify');

    const point = { latitude: -1.2, longitude: -78.6 };

    // 1. Unsuccessful response
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
    } as Response);
    let label = await fetchGeoapifyPlaceLabel(point);
    expect(label).toBeNull();

    // 2. Successful parse with address_line1
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        features: [
          {
            properties: {
              address_line1: 'Line 1 Address',
            },
          },
        ],
      }),
    } as unknown as Response);
    label = await fetchGeoapifyPlaceLabel(point);
    expect(label).toBe('Line 1 Address');

    // 3. Successful parse with formatted only
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        features: [
          {
            properties: {
              formatted: 'Formatted Address',
            },
          },
        ],
      }),
    } as unknown as Response);
    label = await fetchGeoapifyPlaceLabel(point);
    expect(label).toBe('Formatted Address');

    // 4. Successful parse with no label properties
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        features: [
          {
            properties: {},
          },
        ],
      }),
    } as unknown as Response);
    label = await fetchGeoapifyPlaceLabel(point);
    expect(label).toBeNull();
  });
});
