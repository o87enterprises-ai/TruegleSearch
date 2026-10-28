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

describe('artistForTitle', () => {
  const { artistForTitle, cleanTitle } = require('../services/MusicSimilarity');
  const rec = (recordings) => ({ data: { recordings } });

  it('strips upload noise before asking', () => {
    expect(cleanTitle('Bohemian Rhapsody (Official Video) [Remastered] #queen')).toBe('Bohemian Rhapsody');
    expect(cleanTitle('Halo (Lyrics) | Best Songs 2024')).toBe('Halo');
  });

  it('names the artist from a confident recording match', async () => {
    axios.get.mockResolvedValueOnce(rec([{ score: 100, title: 'Halo', 'artist-credit': [{ name: 'Beyoncé' }] }]));
    expect(await artistForTitle('Halo (Lyrics)')).toEqual({ artist: 'Beyoncé' });
    expect(axios.get.mock.calls[0][1].params.query).toBe('recording:"Halo"');
  });

  it('says nothing rather than guessing on a weak match', async () => {
    axios.get.mockResolvedValueOnce(rec([{ score: 70, 'artist-credit': [{ name: 'Someone' }] }]));
    expect(await artistForTitle('my cat vlog day 3')).toEqual({ artist: null });
  });

  it('fails open on a network error', async () => {
    axios.get.mockRejectedValueOnce(new Error('down'));
    expect(await artistForTitle('Anything')).toEqual({ artist: null });
  });
});

describe('cleanTitle drops any bracketed aside', () => {
  const { cleanTitle } = require('../services/MusicSimilarity');
  it('"Tweedle Dee (Performed live on The Ed Sullivan Show 11/20/55)" → the song', () => {
    expect(cleanTitle('Tweedle Dee (Performed live on The Ed Sullivan Show 11/20/55)')).toBe('Tweedle Dee');
  });
});

describe('identifyQuery — who and what a song search was for', () => {
  const { identifyQuery, similarity } = require('../services/MusicSimilarity');
  const tracks = (rows) => ({ data: { results: { trackmatches: { track: rows } } } });
  const artists = (rows) => ({ data: { results: { artistmatches: { artist: rows } } } });

  it('similarity reads whole phrases: a typo or a split word is the same, a different song is not', () => {
    expect(similarity('larussel tweedlee dee', 'LaRussell Tweedledee')).toBeGreaterThanOrEqual(0.85);
    expect(similarity('sade smooth criminal', 'Sade Smooth Operator')).toBeLessThan(0.85);
  });

  describe('with a Last.fm key', () => {
    beforeEach(() => { process.env.LASTFM_API_KEY = 'test-key'; });
    afterEach(() => { delete process.env.LASTFM_API_KEY; });

    it('names the track that accounts for every word of the query, a typo included', async () => {
      axios.get.mockResolvedValueOnce(tracks([
        { name: 'Tweedle Dee', artist: 'LaVern Baker', listeners: '90000' },
        { name: 'Tweedledee', artist: 'LaRussell', listeners: '4000' },
      ]));
      expect(await identifyQuery('Larussel tweedlee dee')).toEqual({ artist: 'LaRussell', track: 'Tweedledee' });
      expect(axios.get.mock.calls[0][1].params).toMatchObject({ method: 'track.search', track: 'larussel tweedlee dee', api_key: 'test-key' });
    });

    it('of several full matches, the one more people listen to', async () => {
      axios.get.mockResolvedValueOnce(tracks([
        { name: 'Smooth Operator', artist: 'Sade', listeners: '10' },
        { name: 'Smooth Operator', artist: 'Sade', listeners: '5000000' },
      ]));
      expect((await identifyQuery('sade smooth operator')).artist).toBe('Sade');
    });

    it('falls back to just the artist when no track covers the query', async () => {
      axios.get
        .mockResolvedValueOnce(tracks([{ name: 'Smooth Criminal', artist: 'Michael Jackson', listeners: '1' }]))
        .mockResolvedValueOnce(artists([{ name: 'Sade' }]));
      expect(await identifyQuery('sade smooth criminal')).toEqual({ artist: 'Sade', track: null });
    });

    it('says nothing for a query that is not a song, and does not start a stream for it', async () => {
      axios.get
        .mockResolvedValueOnce(tracks([{ name: 'Chicago', artist: 'Sufjan Stevens', listeners: '1' }]))
        .mockResolvedValue(artists([{ name: 'Best' }]));
      expect(await identifyQuery('best pizza chicago')).toEqual({ artist: null, track: null });
    });

    it('asks once per query (cached), and never for a single word', async () => {
      axios.get.mockResolvedValueOnce(tracks([{ name: 'Halo', artist: 'Beyoncé', listeners: '1' }]));
      await identifyQuery('beyonce halo');
      await identifyQuery('  Beyonce   HALO ');
      expect(axios.get).toHaveBeenCalledTimes(1);
      axios.get.mockClear();
      expect(await identifyQuery('halo')).toEqual({ artist: null, track: null });
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  describe('without a key', () => {
    it('uses MusicBrainz, at the same bar', async () => {
      axios.get.mockResolvedValueOnce({ data: { recordings: [
        { score: 98, title: 'Smooth Operator', 'artist-credit': [{ name: 'Sade' }] },
        { score: 60, title: 'Smooth Operator (cover)', 'artist-credit': [{ name: 'Someone' }] },
      ] } });
      expect(await identifyQuery('sade smooth operator')).toEqual({ artist: 'Sade', track: 'Smooth Operator' });
    });

    it('fails open on a busy MusicBrainz and does not cache the failure', async () => {
      axios.get.mockRejectedValueOnce(new Error('503 busy'));
      expect(await identifyQuery('sade smooth operator')).toEqual({ artist: null, track: null });
      expect(_cache.size).toBe(0);
    });
  });
});
