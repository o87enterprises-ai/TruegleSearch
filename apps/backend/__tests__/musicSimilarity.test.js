/**
 * The Radio switch's similar-artist lookup (services/MusicSimilarity.js).
 * Network is mocked: MusicBrainz name → id, then ListenBrainz labs id → artists.
 */
jest.mock('axios');
const axios = require('axios');
const { similarArtists, _cache } = require('../services/MusicSimilarity');

const MBID = 'a74b1b7f-71a5-4011-9441-d0b5e4122711';
const mb = (artists) => ({ data: { artists } });
const lb = (rows) => ({ data: rows });

beforeEach(() => { _cache.clear(); axios.get.mockReset(); delete process.env.LASTFM_API_KEY; });

describe('similarArtists', () => {
  it('maps a name to similar artists, best first, without the artist itself', async () => {
    axios.get
      .mockResolvedValueOnce(mb([{ id: MBID, name: 'Radiohead', score: 100 }]))
      .mockResolvedValueOnce(lb([
        { artist_mbid: 'm', name: 'Muse', score: 10286 },
        { artist_mbid: 'n', name: 'Nirvana', score: 11156 },
        { artist_mbid: MBID, name: 'Radiohead', score: 99999 },
      ]));
    const r = await similarArtists('radiohead');
    expect(r).toEqual({ artist: 'Radiohead', similar: ['Nirvana', 'Muse'] });
    expect(axios.get.mock.calls[0][1].headers['User-Agent']).toMatch(/Truegle/);
  });

  it('refuses a weak name match rather than starting a radio of the wrong band', async () => {
    axios.get.mockResolvedValueOnce(mb([{ id: 'x', name: 'Radiohedd Tribute', score: 61 }]));
    expect(await similarArtists('radiohedd')).toEqual({ artist: null, similar: [] });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it('asks about each artist once (cached)', async () => {
    axios.get
      .mockResolvedValueOnce(mb([{ id: MBID, name: 'Radiohead', score: 100 }]))
      .mockResolvedValueOnce(lb([{ artist_mbid: 'm', name: 'Muse', score: 1 }]));
    await similarArtists('Radiohead');
    await similarArtists('  radiohead ');
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it('fails open on a network error, and does not cache the failure', async () => {
    axios.get.mockRejectedValueOnce(new Error('503 busy'));
    expect(await similarArtists('Muse')).toEqual({ artist: null, similar: [] });
    expect(_cache.size).toBe(0);
  });

  it('ignores an empty name without a request', async () => {
    expect(await similarArtists('   ')).toEqual({ artist: null, similar: [] });
    expect(axios.get).not.toHaveBeenCalled();
  });
});

describe('similarArtists with a Last.fm key', () => {
  beforeEach(() => { process.env.LASTFM_API_KEY = 'test-key'; });
  afterEach(() => { delete process.env.LASTFM_API_KEY; });

  const lf = (rows, artist = 'Radiohead') => ({ data: { similarartists: { artist: rows, '@attr': { artist } } } });

  it('uses Last.fm alone — best match first, no MusicBrainz lookup', async () => {
    axios.get.mockResolvedValueOnce(lf([
      { name: 'Muse', match: '0.61' },
      { name: 'Thom Yorke', match: '1' },
      { name: 'Muse', match: '0.5' },
    ]));
    const r = await similarArtists('radiohead');
    expect(r).toEqual({ artist: 'Radiohead', similar: ['Thom Yorke', 'Muse'] });
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][0]).toMatch(/audioscrobbler/);
    expect(axios.get.mock.calls[0][1].params).toMatchObject({ method: 'artist.getsimilar', api_key: 'test-key', autocorrect: 1 });
  });

  it('falls back to ListenBrainz when Last.fm does not know the artist', async () => {
    axios.get
      .mockResolvedValueOnce({ data: { error: 6, message: 'The artist you supplied could not be found' } })
      .mockResolvedValueOnce(mb([{ id: MBID, name: 'Radiohead', score: 100 }]))
      .mockResolvedValueOnce(lb([{ artist_mbid: 'm', name: 'Muse', score: 1 }]));
    expect(await similarArtists('Radiohead')).toEqual({ artist: 'Radiohead', similar: ['Muse'] });
    expect(axios.get).toHaveBeenCalledTimes(3);
  });

  it('falls back when Last.fm is down, without leaking the key', async () => {
    axios.get
      .mockRejectedValueOnce(Object.assign(new Error('boom api_key=test-key'), { code: 'ECONNRESET' }))
      .mockResolvedValueOnce(mb([{ id: MBID, name: 'Radiohead', score: 100 }]))
      .mockResolvedValueOnce(lb([{ artist_mbid: 'm', name: 'Muse', score: 1 }]));
    const r = await similarArtists('Radiohead');
    expect(JSON.stringify(r)).not.toMatch(/test-key/);
    expect(r.similar).toEqual(['Muse']);
  });

  it('never calls Last.fm without a key', async () => {
    delete process.env.LASTFM_API_KEY;
    axios.get.mockResolvedValueOnce(mb([]));
    await similarArtists('Nobody');
    expect(axios.get.mock.calls.every(([url]) => !/audioscrobbler/.test(url))).toBe(true);
  });
});
