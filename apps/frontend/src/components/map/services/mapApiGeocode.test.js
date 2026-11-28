import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import mapApi from './mapApi';

vi.mock('axios');

// REPORTED: searching "Sacramento Greyhound station" on the map never moved the map.
// Mapbox/Radar/TomTom have no keys in production, so the public Nominatim was the
// only geocoder — and it returns [] for that exact phrase.
const photon = (...features) => ({ data: { features } });
const terminal = {
  properties: { name: 'Sacramento Greyhound Terminal', street: 'Sequoia Pacific Boulevard', city: 'Sacramento', state: 'California', osm_value: 'bus_station' },
  geometry: { coordinates: [-121.4969, 38.5967] },
};

describe('geocode ladder with no map keys', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mapApi.requestCache.clear();
    mapApi.setProvider(null);
    // Keyed providers go through the backend; make them fail like an unconfigured deploy.
    axios.post.mockRejectedValue(new Error('no key'));
  });

  it('uses Photon before the OSM floor and returns a position', async () => {
    axios.get.mockImplementation(async (url) => {
      if (url.includes('photon.komoot.io')) return photon(terminal);
      throw new Error('Nominatim should not be reached');
    });
    const res = await mapApi.geocode('Sacramento Greyhound station');
    expect(res.provider).toBe('photon');
    expect(res.data[0].name).toBe('Sacramento Greyhound Terminal');
    expect(res.data[0].position).toEqual({ lat: 38.5967, lng: -121.4969 });
  });

  it('falls through to Nominatim when Photon is down', async () => {
    axios.get.mockImplementation(async (url) => {
      if (url.includes('photon.komoot.io')) throw new Error('503');
      return { data: [{ lat: '38.59', lon: '-121.49', display_name: 'Greyhound, Sacramento' }] };
    });
    const res = await mapApi.geocode('Sacramento Greyhound station');
    expect(res.provider).toBe('leaflet');
  });

  it('retries Nominatim once without "station" when the literal phrase finds nothing', async () => {
    const asked = [];
    axios.get.mockImplementation(async (url, { params }) => {
      if (url.includes('photon.komoot.io')) return photon();
      asked.push(params.q);
      return { data: params.q === 'Sacramento Greyhound' ? [{ lat: '38.59', lon: '-121.49', display_name: 'Greyhound' }] : [] };
    });
    const res = await mapApi.geocode('Sacramento Greyhound station');
    expect(asked).toEqual(['Sacramento Greyhound station', 'Sacramento Greyhound']);
    expect(res.provider).toBe('leaflet');
  });

  it('never asks Photon for directions or places (geocode-only)', async () => {
    axios.get.mockRejectedValue(new Error('down'));
    await expect(mapApi.getDirections({ lat: 1, lng: 1 }, { lat: 2, lng: 2 })).rejects.toThrow();
    expect(axios.get.mock.calls.some(([u]) => String(u).includes('photon.komoot.io'))).toBe(false);
  });
});
