/**
 * The Stations tuner's directory lookup (services/StationsService.js).
 * Network mocked. What matters: only streams a browser can play on an https
 * page are listed, locations are coarsened, and a dead directory fails open.
 */
jest.mock('axios');
const axios = require('axios');
const { stations, regions, _cache } = require('../services/StationsService');

const row = (o) => ({ stationuuid: o.name, name: o.name, url_resolved: o.url, hls: 0, tags: 'rock,indie,local,x', countrycode: 'US', state: 'Oregon', favicon: '', bitrate: 128, ...o });

beforeEach(() => { _cache.clear(); axios.get.mockReset(); });

describe('stations', () => {
  it('lists only https, non-HLS streams, once each', async () => {
    axios.get.mockResolvedValueOnce({ data: [
      row({ name: 'KMSW', url: 'https://a.example/kmsw' }),
      row({ name: 'Plain', url: 'http://b.example/live' }),
      row({ name: 'Hls', url: 'https://c.example/x.m3u8', hls: 1 }),
      row({ name: 'kmsw', url: 'https://d.example/dup' }),
    ] });
    const out = await stations({ country: 'us', region: 'Oregon' });
    expect(out.map((s) => s.name)).toEqual(['KMSW']);
    expect(out[0].tags).toEqual(['rock', 'indie', 'local']);
    const params = axios.get.mock.calls[0][1].params;
    expect(params).toMatchObject({ countrycode: 'US', state: 'Oregon', hidebroken: true });
  });

  it('rounds "near me" coordinates to ~11km before asking', async () => {
    axios.get.mockResolvedValueOnce({ data: [] });
    await stations({ lat: '45.5231', lng: '-122.6765', km: 50 });
    expect(axios.get.mock.calls[0][1].params).toMatchObject({ geo_lat: 45.5, geo_long: -122.7, geo_distance: 50000 });
  });

  it('tries the next mirror, then fails open', async () => {
    axios.get.mockRejectedValue(new Error('down'));
    expect(await stations({ country: 'DE' })).toEqual([]);
    expect(axios.get).toHaveBeenCalledTimes(3);
  });

  it('rejects junk input without a request', async () => {
    expect(await stations({ country: 'USA' })).toEqual([]);
    expect(await stations({ lat: 'x', lng: 1 })).toEqual([]);
    expect(await regions('1')).toEqual([]);
    expect(axios.get).not.toHaveBeenCalled();
  });
});
