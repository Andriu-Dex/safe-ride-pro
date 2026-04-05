import { afterEach, describe, expect, it, vi } from 'vitest';

describe('geoapify helpers', () => {
  const originalApiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;

  afterEach(() => {
    vi.resetModules();

    if (originalApiKey === undefined) {
      delete process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
      return;
    }

    process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY = originalApiKey;
  });

  it('builds a configured autocomplete URL', async () => {
    process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY = 'geoapify-test-key';

    const { buildGeoapifyAutocompleteUrl } = await import('./geoapify');

    const url = new URL(buildGeoapifyAutocompleteUrl('Ambato'));

    expect(url.origin).toBe('https://api.geoapify.com');
    expect(url.pathname).toBe('/v1/geocode/autocomplete');
    expect(url.searchParams.get('text')).toBe('Ambato');
    expect(url.searchParams.get('apiKey')).toBe('geoapify-test-key');
    expect(url.searchParams.get('filter')).toBe('countrycode:ec');
  });

  it('maps Geoapify features into place suggestions', async () => {
    const { mapGeoapifySuggestions } = await import('./geoapify');

    const suggestions = mapGeoapifySuggestions({
      features: [
        {
          properties: {
            place_id: 'ambato-uta',
            address_line1: 'Universidad Tecnica de Ambato',
            formatted: 'Universidad Tecnica de Ambato, Ambato, Tungurahua, Ecuador',
            lat: -1.2523,
            lon: -78.6221,
          },
        },
      ],
    });

    expect(suggestions).toEqual([
      {
        id: 'ambato-uta',
        label: 'Universidad Tecnica de Ambato',
        address: 'Universidad Tecnica de Ambato, Ambato, Tungurahua, Ecuador',
        latitude: -1.2523,
        longitude: -78.6221,
      },
    ]);
  });
});
