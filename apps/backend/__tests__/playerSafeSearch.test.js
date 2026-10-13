/**
 * Songs with swearing must be findable with Safe Search on.
 *
 * Owner, 2026-10-13: "when safe search is on it won't pull results that have
 * cussing in it so searching for songs becomes cumbersome … allow all music to
 * be played (while safe search is on) unless the song link is explicitly an 18+
 * gated YouTube video."
 *
 * Why they vanished: under "safe" the search engines run at their STRICTEST
 * setting, and that drops any page with profanity. For the PLAYER's search the
 * engines are now asked at MODERATE and Truegle filters afterwards: sexual
 * material out, swearing not consulted, music let through, and a YouTube video
 * that YouTube itself marks 18+ dropped. Real route, search service mocked.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-for-player';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-only';
process.env.YOUTUBE_API_KEY = 'test-key';
const request = require('supertest');
const express = require('express');
const { isExplicitRow, looksLikeMusic } = require('../utils/explicitTitle');
const { ageRestrictedIds, idOf, clearAgeGateCache } = require('../services/AgeGate');

const mockPerformSearch = jest.fn();
jest.mock('../services/SearchService', () => jest.fn().mockImplementation(() => ({
  performSearch: mockPerformSearch,
})));
const searchRouter = require('../routes/search');

const app = express();
app.use(express.json());
app.use('/api/search', searchRouter);

const yt = (id, title, extra = {}) => ({ url: `https://www.youtube.com/watch?v=${id}`, title, snippet: '', sourceName: 'YouTube', ...extra });
const A = 'aaaaaaaaaaa'; const B = 'bbbbbbbbbbb'; const C = 'ccccccccccc'; const D = 'ddddddddddd'; const E = 'eeeeeeeeeee';

describe('swearing is not a reason to hide anything', () => {
  it.each([
    'Eminem - The Real Slim Shady (Official Video)', 'Fuck the Police - N.W.A', 'Cee Lo Green - Forget You (Fuck You) [Explicit]',
    'Shit Hits the Fan (feat. Someone)', 'Bitch Better Have My Money - Rihanna', 'Damn. - Kendrick Lamar',
  ])('%s', (title) => expect(isExplicitRow({ title, channel: 'Artist - Topic' })).toBe(false));
});

describe('SOFT words: allowed in a song, hidden otherwise', () => {
  it('"Naked", "Nude", "Lingerie" pass when the row looks like music', () => {
    expect(isExplicitRow({ title: 'James Arthur - Naked (Official Video)' })).toBe(false);
    expect(isExplicitRow({ title: 'Nude', channel: 'Radiohead - Topic' })).toBe(false);
    expect(isExplicitRow({ title: 'Lingerie - Lyrics' })).toBe(false);
    expect(isExplicitRow({ title: 'Naked', kind: 'soundcloud' })).toBe(false);
  });
  it('…and are hidden when nothing says it is music', () => {
    expect(isExplicitRow({ title: 'Naked yoga class at home' })).toBe(true);
    expect(isExplicitRow({ title: 'Sexy lingerie haul' })).toBe(true);
  });
  it('HARD terms are hidden even on something dressed up as music', () => {
    expect(isExplicitRow({ title: 'Hot porn compilation (Official Video)' })).toBe(true);
    expect(isExplicitRow({ title: 'Hentai AMV', channel: 'Someone - Topic' })).toBe(true);
    expect(isExplicitRow({ title: 'Hot Cam Girls (Official Audio)' })).toBe(true);
  });
  it('adult sites are hidden whatever the result is called', () => {
    expect(isExplicitRow({ title: 'Summer Mix (Official Audio)', url: 'https://www.pornhub.com/view_video.php?viewkey=1' })).toBe(true);
  });
  it('music detection is what it says', () => {
    expect(looksLikeMusic({ channel: 'Taylor Swift - Topic' })).toBe(true);
    expect(looksLikeMusic({ channel: 'TaylorSwiftVEVO' })).toBe(true);
    expect(looksLikeMusic({ title: 'Cooking pasta at home' })).toBe(false);
  });
});

describe('idOf', () => {
  it('reads the id out of every YouTube URL shape', () => {
    expect(idOf(`https://www.youtube.com/watch?v=${A}`)).toBe(A);
    expect(idOf(`https://youtu.be/${A}?t=4`)).toBe(A);
    expect(idOf(`https://www.youtube.com/embed/${A}`)).toBe(A);
    expect(idOf(`https://www.youtube.com/shorts/${A}`)).toBe(A);
    expect(idOf(`https://m.youtube.com/watch?v=${A}`)).toBe(A);
    expect(idOf('https://example.com/watch?v=aaaaaaaaaaa')).toBeNull();
    expect(idOf('not a url')).toBeNull();
  });
});

describe('ageRestrictedIds — YouTube\'s own 18+ flag', () => {
  beforeEach(() => clearAgeGateCache());
  const reply = (items) => jest.fn(async () => ({ ok: true, json: async () => ({ items }) }));
  const gated = (id) => ({ id, contentDetails: { contentRating: { ytRating: 'ytAgeRestricted' } } });
  const plain = (id) => ({ id, contentDetails: { contentRating: {} } });

  it('returns exactly the videos YouTube marks ytAgeRestricted', async () => {
    const f = reply([gated(A), plain(B)]);
    const out = await ageRestrictedIds([A, B], { fetchImpl: f, apiKey: 'k' });
    expect([...out]).toEqual([A]);
    expect(f.mock.calls[0][0]).toContain('part=contentDetails');
  });
  it('asks once per video per day', async () => {
    const f = reply([gated(A), plain(B)]);
    await ageRestrictedIds([A, B], { fetchImpl: f, apiKey: 'k' });
    const again = await ageRestrictedIds([A, B], { fetchImpl: f, apiKey: 'k' });
    expect(f).toHaveBeenCalledTimes(1);
    expect([...again]).toEqual([A]);
  });
  it('batches 50 ids to a call — one quota unit each', async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `v${String(i).padStart(10, '0')}`);
    const f = reply([]);
    await ageRestrictedIds(ids, { fetchImpl: f, apiKey: 'k' });
    expect(f).toHaveBeenCalledTimes(3);
  });
  it('FAILS OPEN: no key, an API error, or a timeout hides nothing and never throws', async () => {
    expect((await ageRestrictedIds([A], { fetchImpl: reply([]), apiKey: '' })).size).toBe(0);
    const bad = jest.fn(async () => ({ ok: false, status: 403 }));
    expect((await ageRestrictedIds([B], { fetchImpl: bad, apiKey: 'k' })).size).toBe(0);
    const boom = jest.fn(async () => { throw new Error('timeout'); });
    expect((await ageRestrictedIds([C], { fetchImpl: boom, apiKey: 'k' })).size).toBe(0);
  });
  it('ignores things that are not video ids', async () => {
    const f = reply([]);
    await ageRestrictedIds(['nope', '', null, '../../x'], { fetchImpl: f, apiKey: 'k' });
    expect(f).not.toHaveBeenCalled();
  });
});

describe('POST /api/search from the PLAYER, Safe Search on', () => {
  beforeEach(() => {
    clearAgeGateCache();
    mockPerformSearch.mockReset();
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ items: [
      { id: D, contentDetails: { contentRating: { ytRating: 'ytAgeRestricted' } } },
    ] }) }));
  });
  const ask = (filters) => request(app).post('/api/search').send({ query: 'songs', filters: { category: 'videos', ...filters } });

  it('asks the engines at MODERATE, not strict, so a song with swearing is not dropped by them', async () => {
    mockPerformSearch.mockResolvedValue([]);
    await ask({ safeSearch: 'safe', purpose: 'player' });
    expect(mockPerformSearch.mock.calls[0][1].safeSearch).toBe('blur');
  });
  it('keeps the songs, hides sexual material, and drops what YouTube age-gates', async () => {
    mockPerformSearch.mockResolvedValue([
      yt(A, 'N.W.A - Fuck tha Police (Official Video)'),          // swearing: kept
      yt(B, 'James Arthur - Naked (Official Audio)'),             // soft word + music: kept
      yt(C, 'Hot porn compilation'),                              // hard: hidden
      yt(D, 'A song YouTube has marked 18+'),                     // age-gated: dropped
      yt(E, 'Naked yoga class'),                                  // soft word, not music: hidden
      { url: 'https://www.pornhub.com/view_video.php?viewkey=1', title: 'Summer Mix', sourceName: 'pornhub.com' },
    ]);
    const res = await ask({ safeSearch: 'safe', purpose: 'player' });
    expect(res.body.results.map((r) => r.title)).toEqual([
      'N.W.A - Fuck tha Police (Official Video)', 'James Arthur - Naked (Official Audio)',
    ]);
  });
  it('still keeps the songs when the age-check is unavailable (fails open)', async () => {
    global.fetch = jest.fn(async () => { throw new Error('quota'); });
    mockPerformSearch.mockResolvedValue([yt(A, 'Some Song (Official Video)'), yt(D, 'Maybe gated')]);
    const res = await ask({ safeSearch: 'safe', purpose: 'player' });
    expect(res.body.results).toHaveLength(2);
  });
  it('an anonymous visitor cannot unlock "off" — they get the same filtered result', async () => {
    mockPerformSearch.mockResolvedValue([yt(C, 'Hot porn compilation'), yt(A, 'A song (Official Video)')]);
    const res = await ask({ safeSearch: 'off', purpose: 'player' });
    expect(res.body.results.map((r) => r.title)).toEqual(['A song (Official Video)']);
  });
});

describe('everything that is NOT the player is unchanged', () => {
  beforeEach(() => { mockPerformSearch.mockReset(); mockPerformSearch.mockResolvedValue([yt(C, 'Hot porn compilation')]); });
  it('the web search page still asks the engines for STRICT', async () => {
    await request(app).post('/api/search').send({ query: 'songs', filters: { safeSearch: 'safe' } });
    expect(mockPerformSearch.mock.calls[0][1].safeSearch).toBe('safe');
  });
  it('and does not apply the player filter (the engine owns it there)', async () => {
    const res = await request(app).post('/api/search').send({ query: 'songs', filters: { safeSearch: 'safe' } });
    expect(res.body.results).toHaveLength(1);
  });
  it('a made-up purpose is ignored', async () => {
    await request(app).post('/api/search').send({ query: 'songs', filters: { safeSearch: 'safe', purpose: 'whatever' } });
    expect(mockPerformSearch.mock.calls[0][1].safeSearch).toBe('safe');
  });
});
