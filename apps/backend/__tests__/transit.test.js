/**
 * Public transit directions (Transitous) — the parts that can be wrong without
 * the network: the polyline decoder, the shape handed to the map, and the
 * refusal of bad input before anything leaves the server.
 */
process.env.JWT_SECRET ||= 'test-only-secret';
process.env.ENCRYPTION_KEY ||= '0123456789abcdef0123456789abcdef';

const axios = require('axios');
const TransitService = require('../services/TransitService');

describe('decodePolyline', () => {
  test('decodes Google\'s reference example at precision 5', () => {
    // developers.google.com/maps/documentation/utilities/polylinealgorithm
    const pts = TransitService.decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5);
    expect(pts).toEqual([[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]]);
  });
});

describe('normalise', () => {
  const walk = { mode: 'WALK', from: { name: 'START', lat: 1, lon: 2 }, to: { name: 'Stop A', lat: 1.1, lon: 2.1 }, duration: 60, distance: 80, startTime: 't0', endTime: 't1' };
  const bus = { mode: 'BUS', routeShortName: '12', headsign: 'Downtown', routeColor: 'ff0000', from: { name: 'Stop A', lat: 1.1, lon: 2.1 }, to: { name: 'Stop B', lat: 1.5, lon: 2.5 }, duration: 600, startTime: 't1', endTime: 't2' };

  test('keeps transit trips, with a route, colour and readable stop names', () => {
    const [it] = TransitService.normalise({ itineraries: [{ duration: 660, transfers: 0, legs: [walk, bus] }] });
    expect(it.legs[0]).toMatchObject({ mode: 'WALK', transit: false, from: { name: null } });   // START is not a place name
    expect(it.legs[1]).toMatchObject({ mode: 'BUS', transit: true, route: '12', headsign: 'Downtown', color: '#ff0000' });
  });

  test('drops "itineraries" that are only a walk — the walking mode does that', () => {
    expect(TransitService.normalise({ itineraries: [{ legs: [walk] }] })).toEqual([]);
  });

  test('copes with no itineraries at all', () => {
    expect(TransitService.normalise({})).toEqual([]);
  });
});

describe('plan', () => {
  afterEach(() => jest.restoreAllMocks());

  test('refuses bad coordinates without calling out', async () => {
    const spy = jest.spyOn(axios, 'get');
    await expect(TransitService.plan({ lat: 999, lng: 0 }, { lat: 1, lng: 1 })).rejects.toMatchObject({ status: 400 });
    await expect(TransitService.plan(null, { lat: 1, lng: 1 })).rejects.toMatchObject({ status: 400 });
    expect(spy).not.toHaveBeenCalled();
  });

  test('asks Transitous for the trip and returns at most five', async () => {
    const leg = { mode: 'BUS', routeShortName: '1', from: { lat: 0, lon: 0 }, to: { lat: 1, lon: 1 } };
    const spy = jest.spyOn(axios, 'get').mockResolvedValue({ data: { itineraries: Array.from({ length: 8 }, () => ({ legs: [leg] })) } });
    const out = await TransitService.plan({ lat: 40.75, lng: -73.98 }, { lat: 40.69, lng: -74.04 }, { time: '2026-10-07T16:00:00Z' });
    expect(out).toHaveLength(5);
    const [url, cfg] = spy.mock.calls[0];
    expect(url).toBe('https://api.transitous.org/api/v1/plan');
    expect(cfg.params).toMatchObject({ fromPlace: '40.75,-73.98', toPlace: '40.69,-74.04', time: '2026-10-07T16:00:00.000Z', arriveBy: 'false' });
  });
});
