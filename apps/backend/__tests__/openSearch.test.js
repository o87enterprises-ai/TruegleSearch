// Keyless open-search providers: adapters map REAL captured payloads (fixtures, 2026-11-12) to the
// shape SearchService already uses, and the pool keeps one failing provider from taking a feature down.
jest.mock('axios');
const axios = require('axios');
const fx = (n) => require(`./fixtures/openSearch/${n}.json`);
const OpenSearch = require('../services/openSearch');
const A = require('../services/openSearch/adapters');

const ROUTES = [
  ['sepiasearch.org', 'sepia'], ['api.dailymotion.com', 'dailymotion'], ['api.audius.co', 'audius'],
  ['api.openverse.org', 'openverse'], ['itunes.apple.com', 'itunes'], ['archive.org', 'archive'],
  ['lemmy.ml', 'lemmy'], ['mastodon.social', 'mastodon'],
];
let down; // hosts currently failing
beforeEach(() => {
  OpenSearch.__reset(); down = new Set(); delete process.env.OPEN_SEARCH_DISABLE;
  axios.get.mockReset();
  axios.get.mockImplementation(async (url) => {
    const hit = ROUTES.find(([host]) => url.includes(host));
    if (!hit) throw new Error(`unexpected url ${url}`);
    if (down.has(hit[1])) { const e = new Error('boom'); e.response = { status: 503 }; throw e; }
    return { data: fx(hit[1]) };
  });
});
const calls = (host) => axios.get.mock.calls.filter(([u]) => u.includes(host)).length;

describe('adapters map real responses to the SearchService result shape', () => {
  test('sepia (PeerTube): embed + thumbnail + duration', async () => {
    const [v] = await A.sepia('news');
    expect(v).toMatchObject({ source: 'sepia', category: 'videos', title: 'Fediverse News - February 2025', duration: '5:52', domain: 'video.fedihost.co', verified: true });
    expect(v.iframeSrc).toContain('/videos/embed/'); expect(v.thumbnail).toMatch(/^https:/); expect(v.sourceName).toBe('News · PeerTube');
  });
  test('dailymotion: dotted owner field, embed url, html stripped', async () => {
    const [v] = await A.dailymotion('news');
    expect(v).toMatchObject({ source: 'dailymotion', category: 'videos', duration: '1:05', sourceName: 'TV INTERNET · Dailymotion' });
    expect(v.iframeSrc).toContain('geo.dailymotion.com');
  });
  test('audius / openverse / itunes are audio; archive splits by mediatype', async () => {
    expect((await A.audius('rain'))[0]).toMatchObject({ category: 'audio', url: 'https://audius.co/cooprecsmusic/louis-futon-summer-soaked-in-rain', duration: '3:24' });
    expect((await A.openverseAudio('rain'))[0]).toMatchObject({ category: 'audio', duration: '1:00', url: 'https://freesound.org/people/InspectorJ/sounds/401275' });
    expect((await A.itunesPodcasts('news'))[0]).toMatchObject({ category: 'audio', title: 'NPR News Now' });
    const ia = await A.internetArchive('news');
    expect(ia[0]).toMatchObject({ category: 'videos', url: 'https://archive.org/details/nnpsva-School_Board_Spotlight_April_2015' });
  });
  test('archive query keeps repeated fl[] keys intact (axios would mangle them)', async () => {
    await A.internetArchive('news');
    const url = axios.get.mock.calls.find(([u]) => u.includes('archive.org'))[0];
    expect(url).toContain('fl%5B%5D=identifier'); expect(url).toContain('fl%5B%5D=title');
  });
  test('lemmy: discussion link, score in label, nsfw hidden under safe search', async () => {
    const [p] = await A.lemmy('news');
    expect(p).toMatchObject({ source: 'lemmy', category: 'social', url: 'https://lemmy.world/post/54288875' });
    expect(p.sourceName).toMatch(/^c\/politics · Lemmy · \d+ points$/);
    const nsfw = JSON.parse(JSON.stringify(fx('lemmy'))); nsfw.posts[0].post.nsfw = true;
    axios.get.mockResolvedValueOnce({ data: nsfw });
    expect(await A.lemmy('news', { safe: true })).toHaveLength(0);
    axios.get.mockResolvedValueOnce({ data: nsfw });
    expect(await A.lemmy('news', { safe: false })).toHaveLength(1);
  });
  test('mastodon: hashtag-shaped queries only (search needs a login), html stripped, sensitive hidden', async () => {
    expect(await A.mastodonTag('two words')).toEqual([]);
    expect(axios.get).not.toHaveBeenCalled(); // not an error, not a request
    const [m] = await A.mastodonTag('#news');
    expect(m).toMatchObject({ source: 'mastodon', category: 'social' }); expect(m.snippet).not.toMatch(/<p>/);
    expect(axios.get.mock.calls[0][0]).toContain('/timelines/tag/news');
  });
  test('safe search is sent to providers that support it', async () => {
    await A.sepia('x', { safe: true }); await A.sepia('x', { safe: false });
    expect(axios.get.mock.calls[0][1].params.nsfw).toBe('false'); expect(axios.get.mock.calls[1][1].params.nsfw).toBe('both');
  });
  test('clock()', () => { expect(A.clock(352)).toBe('5:52'); expect(A.clock(3725)).toBe('1:02:05'); expect(A.clock(0)).toBeNull(); expect(A.clock('x')).toBeNull(); });
});

describe('the pool: failure isolation, cooldown, recovery', () => {
  test('a feature draws only on its own providers', async () => {
    await OpenSearch.search('video', 'news');
    expect(calls('audius')).toBe(0); expect(calls('lemmy')).toBe(0); expect(calls('sepiasearch')).toBe(1);
  });
  test('categories never leak across features (archive movies stay out of audio)', async () => {
    const { items } = await OpenSearch.search('audio', 'news');
    expect(items.every((i) => i.category === 'audio')).toBe(true);
    const v = await OpenSearch.search('video', 'news');
    expect(v.items.every((i) => i.category === 'videos')).toBe(true);
  });
  test('one provider down: the feature still answers, and the failure is reported', async () => {
    down.add('sepia');
    const r = await OpenSearch.search('video', 'news');
    expect(r.items.length).toBeGreaterThan(0); expect(r.report.sepia).toMatchObject({ status: 'error', error: 'HTTP 503' }); expect(r.answered).toBe(2);
  });
  test('a failing provider cools down (no request), then recovers after the window', async () => {
    down.add('sepia'); const t0 = Date.now();
    await OpenSearch.search('video', 'news', { now: t0 });
    expect(calls('sepiasearch')).toBe(1);
    const r2 = await OpenSearch.search('video', 'news', { now: t0 + 10_000 });
    expect(r2.report.sepia.status).toBe('cooling'); expect(calls('sepiasearch')).toBe(1);
    down.delete('sepia');
    const r3 = await OpenSearch.search('video', 'news', { now: t0 + 31_000 });
    expect(r3.report.sepia.status).toBe('ok'); expect(OpenSearch.stats(t0 + 31_000).video[0]).toMatchObject({ provider: 'sepia', status: 'ready', consecutiveFailures: 0 });
  });
  test('cooldown doubles per consecutive failure and is capped at 15 minutes', async () => {
    down.add('sepia'); let t = 1_000_000;
    for (let i = 0; i < 12; i++) { await OpenSearch.search('video', 'x', { now: t }); t += 16 * 60_000; }
    const s = OpenSearch.stats(t).video[0]; expect(s.consecutiveFailures).toBe(12);
    const until = OpenSearch.stats(t - 16 * 60_000 + 1000).video[0];
    expect(until.status).toBe('cooling'); // still inside a (capped) window right after the last failure
    expect(OpenSearch.stats(t - 16 * 60_000 + 15 * 60_000 + 1).video[0].status).toBe('ready'); // cap = 15 min
  });
  test('every provider down: asSourcePayload rejects so the caller records a failed source', async () => {
    ['sepia', 'dailymotion', 'archive'].forEach((p) => down.add(p));
    await expect(OpenSearch.asSourcePayload('video', 'news', {})).rejects.toThrow('open-media unavailable');
  });
  test('answered but nothing found is an empty success, not a failure', async () => {
    axios.get.mockImplementation(async () => ({ data: {} }));
    await expect(OpenSearch.asSourcePayload('video', 'zzzz', {})).resolves.toEqual({ _source: 'open-media', results: [] });
  });
  test('OPEN_SEARCH_DISABLE switches a provider off without touching code', async () => {
    process.env.OPEN_SEARCH_DISABLE = 'sepia, dailymotion';
    const r = await OpenSearch.search('video', 'news');
    expect(r.report.sepia.status).toBe('disabled'); expect(calls('sepiasearch')).toBe(0); expect(calls('dailymotion')).toBe(0);
  });
  test('a hung provider is cut off at the 4.5s deadline and does not hold the search', async () => {
    jest.useFakeTimers();
    try {
      axios.get.mockImplementation((url) => (url.includes('sepiasearch') ? new Promise(() => {}) : Promise.resolve({ data: fx('dailymotion') })));
      const p = OpenSearch.search('video', 'news');
      await jest.advanceTimersByTimeAsync(4600);
      const r = await p;
      expect(r.report.sepia.status).toBe('error'); expect(r.report.sepia.error).toBe('deadline'); expect(r.items.length).toBeGreaterThan(0);
    } finally { jest.useRealTimers(); }
  });
  test('results are interleaved across providers and duplicate URLs dropped', async () => {
    const dup = JSON.parse(JSON.stringify(fx('dailymotion'))); dup.list[0].url = fx('sepia').data[0].url + '/?utm=x';
    axios.get.mockImplementation(async (u) => ({ data: u.includes('dailymotion') ? dup : u.includes('sepiasearch') ? fx('sepia') : { response: { docs: [] } } }));
    const { items } = await OpenSearch.search('video', 'news');
    expect(items).toHaveLength(1); expect(items[0].source).toBe('sepia'); // first provider wins the duplicate
  });
  test('the deadline is also the HTTP timeout, so a longer budget really is longer', async () => {
    await OpenSearch.search('video', 'news');
    expect(axios.get.mock.calls.every(([, cfg]) => cfg.timeout === 4500)).toBe(true);
    axios.get.mockClear();
    await OpenSearch.search('video', 'news', { deadlineMs: 8000, now: Date.now() + 1e9 });
    expect(axios.get.mock.calls.every(([, cfg]) => cfg.timeout === 8000)).toBe(true);
  });
  test('unknown feature is a programming error', async () => { await expect(OpenSearch.search('nope', 'x')).rejects.toThrow('unknown feature'); });
});

describe('SearchService understands the open-media source', () => {
  const SearchService = require('../services/SearchService');
  const svc = new SearchService();
  test('detectSource + formatResults pass the adapter items straight through', () => {
    const payload = { _source: 'open-media', results: [{ title: 't', url: 'https://x.test', category: 'videos' }] };
    expect(svc.detectSource(payload)).toBe('open-media');
    expect(svc.formatResults(payload, 'open-media')).toEqual(payload.results);
    expect(svc.formatResults({ _source: 'open-media' }, 'open-media')).toEqual([]);
  });
});

describe('GET /api/open-search', () => {
  const express = require('express'); const request = require('supertest');
  const app = () => { const a = express(); a.use('/api/open-search', require('../routes/openSearch')); return a; };
  test('health lists every feature with provider status and no secrets', async () => {
    const r = await request(app()).get('/api/open-search/health');
    expect(r.status).toBe(200); expect(Object.keys(r.body.features)).toEqual(['video', 'audio', 'social']);
    expect(r.body.features.video[0]).toEqual({ provider: 'sepia', status: 'ready', consecutiveFailures: 0 });
  });
  test('returns results for a feature, cached privately only', async () => {
    const r = await request(app()).get('/api/open-search/video?q=news&limit=3');
    expect(r.status).toBe(200); expect(r.body.results.length).toBeGreaterThan(0); expect(r.body.answered).toBe(3);
    expect(r.headers['cache-control']).toBe('private, max-age=300');
  });
  test('rejects unknown feature, missing or oversized q', async () => {
    expect((await request(app()).get('/api/open-search/nope?q=x')).status).toBe(404);
    expect((await request(app()).get('/api/open-search/video')).status).toBe(400);
    expect((await request(app()).get(`/api/open-search/video?q=${'a'.repeat(201)}`)).status).toBe(400);
  });
});
