// Hugging Face search-gateway: the Space's HTTP server (auth, validation, no self-calls) and the
// pool's FALLBACK tier that routes failed/cooling providers through it. Real captured payloads as fixtures.
jest.mock('axios');
const axios = require('axios');
const express = require('express'); // eslint-disable-line no-unused-vars
const request = require('supertest');
const fx = (n) => require(`./fixtures/openSearch/${n}.json`);
const OpenSearch = require('../services/openSearch');
const { createApp } = require('../services/openSearch/gatewayServer');

const ROUTES = [['sepiasearch.org', 'sepia'], ['api.dailymotion.com', 'dailymotion'], ['archive.org', 'archive'],
  ['api.audius.co', 'audius'], ['api.openverse.org', 'openverse'], ['itunes.apple.com', 'itunes'], ['lemmy.ml', 'lemmy'], ['mastodon.social', 'mastodon']];
let down;
const calls = (host) => axios.get.mock.calls.filter(([u]) => u.includes(host)).length;
const gwCalls = () => axios.post.mock.calls.filter(([u]) => u.startsWith('https://gw.example.hf.space'));

beforeEach(() => {
  OpenSearch.__reset(); down = new Set();
  delete process.env.OPEN_SEARCH_DISABLE; delete process.env.SEARCH_GATEWAY_URL; delete process.env.SEARCH_GATEWAY_TOKEN;
  axios.get.mockReset(); axios.post.mockReset();
  axios.get.mockImplementation(async (url) => {
    const hit = ROUTES.find(([host]) => url.includes(host));
    if (!hit) throw new Error(`unexpected url ${url}`);
    if (down.has(hit[1])) { const e = new Error('boom'); e.response = { status: 403 }; throw e; }
    return { data: fx(hit[1]) };
  });
});

describe('gateway server (runs inside the Space)', () => {
  const TOKEN = 'test-token-123';
  const post = (app, feature, body, auth = `Bearer ${TOKEN}`) => { const r = request(app).post(`/search/${feature}`); if (auth) r.set('Authorization', auth); return r.send(body); };

  test('/health is open and only says whether it is configured', async () => {
    const r = await request(createApp({ token: TOKEN })).get('/health');
    expect(r.body).toEqual({ ok: true, configured: true, features: ['video', 'audio', 'social'] });
    expect(JSON.stringify(r.body)).not.toContain(TOKEN);
    expect((await request(createApp({ token: '' })).get('/health')).body.configured).toBe(false);
  });
  test('with no token set it refuses to be an open search proxy (503), never searching', async () => {
    const r = await post(createApp({ token: '' }), 'video', { q: 'news' }, null);
    expect(r.status).toBe(503); expect(axios.get).not.toHaveBeenCalled();
  });
  test('missing, wrong-length and wrong tokens are all 401 and never search', async () => {
    const app = createApp({ token: TOKEN });
    for (const h of [null, 'Bearer nope', 'Bearer ' + 'x'.repeat(TOKEN.length), TOKEN]) expect((await post(app, 'video', { q: 'news' }, h)).status).toBe(401);
    expect(axios.get).not.toHaveBeenCalled();
  });
  test('a valid request returns the same shape as /api/open-search, never cached', async () => {
    const r = await post(createApp({ token: TOKEN }), 'video', { q: 'news', limit: 3 });
    expect(r.status).toBe(200); expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body).toMatchObject({ feature: 'video', answered: 3 }); expect(r.body.results[0]).toMatchObject({ category: 'videos' });
  });
  test('providers[] restricts which providers run (this is what makes it a cheap fallback)', async () => {
    const r = await post(createApp({ token: TOKEN }), 'video', { q: 'news', providers: ['sepia', 'not-a-provider'] });
    expect(Object.keys(r.body.providers)).toEqual(['sepia']); expect(calls('dailymotion')).toBe(0); expect(calls('sepiasearch')).toBe(1);
  });
  test('validation: unknown feature 404, bad q 400, only-unknown providers 400', async () => {
    const app = createApp({ token: TOKEN });
    expect((await post(app, 'nope', { q: 'x' })).status).toBe(404);
    expect((await post(app, 'video', {})).status).toBe(400);
    expect((await post(app, 'video', { q: 'a'.repeat(201) })).status).toBe(400);
    expect((await post(app, 'video', { q: 'x', providers: ['bogus'] })).status).toBe(400);
  });
  test('the gateway never calls a gateway (no loop), even if the env is set', async () => {
    process.env.SEARCH_GATEWAY_URL = 'https://gw.example.hf.space'; process.env.SEARCH_GATEWAY_TOKEN = 'x';
    down.add('sepia');
    await post(createApp({ token: TOKEN }), 'video', { q: 'news' });
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe('fallback tier in the pool', () => {
  const on = () => { process.env.SEARCH_GATEWAY_URL = 'https://gw.example.hf.space/'; process.env.SEARCH_GATEWAY_TOKEN = 'tok'; };
  const gatewayAnswers = (feature, providers, items) => axios.post.mockImplementation(async () => ({ data: {
    results: items, providers: Object.fromEntries(providers.map((p) => [p, { status: 'ok', count: items.filter((i) => i.source === p).length }])) } }));
  const sepiaItem = () => ({ title: 'via gateway', url: 'https://pt.example/w/1', source: 'sepia', category: 'videos' });

  test('inert unless both env vars are set, and https only', async () => {
    down.add('sepia'); await OpenSearch.search('video', 'news');
    process.env.SEARCH_GATEWAY_URL = 'https://gw.example.hf.space'; await OpenSearch.search('video', 'news', { now: Date.now() + 1e9 }); // no token
    process.env.SEARCH_GATEWAY_TOKEN = 'tok'; process.env.SEARCH_GATEWAY_URL = 'http://gw.example.hf.space'; await OpenSearch.search('video', 'news', { now: Date.now() + 2e9 });
    expect(axios.post).not.toHaveBeenCalled();
  });
  test('a provider that fails directly is retried ONCE through the gateway, only that provider, with the token', async () => {
    on(); down.add('sepia'); gatewayAnswers('video', ['sepia'], [sepiaItem()]);
    const r = await OpenSearch.search('video', 'news');
    expect(gwCalls()).toHaveLength(1);
    const [url, body, cfg] = gwCalls()[0];
    expect(url).toBe('https://gw.example.hf.space/search/video'); // trailing slash trimmed, query in the BODY not the URL
    expect(body).toMatchObject({ q: 'news', providers: ['sepia'] }); expect(url).not.toContain('news');
    expect(cfg.headers.Authorization).toBe('Bearer tok');
    expect(r.report.sepia).toMatchObject({ status: 'error', viaGateway: true, gatewayCount: 1 });
    expect(r.items.some((i) => i.title === 'via gateway')).toBe(true); expect(r.answered).toBe(3); // dailymotion + archive + sepia(via gateway)
  });
  test('a cooling provider goes straight to the gateway without a direct attempt', async () => {
    on(); down.add('sepia'); gatewayAnswers('video', ['sepia'], [sepiaItem()]);
    const t = Date.now(); await OpenSearch.search('video', 'news', { now: t });
    axios.get.mockClear(); axios.post.mockClear(); gatewayAnswers('video', ['sepia'], [sepiaItem()]);
    const r = await OpenSearch.search('video', 'news', { now: t + 5000 });
    expect(r.report.sepia).toMatchObject({ status: 'cooling', viaGateway: true }); expect(calls('sepiasearch')).toBe(0); expect(gwCalls()).toHaveLength(1);
  });
  test('a gateway error is swallowed: the feature still answers from the direct providers', async () => {
    on(); down.add('sepia'); axios.post.mockRejectedValue(Object.assign(new Error('asleep'), { code: 'ECONNABORTED' }));
    const r = await OpenSearch.search('video', 'news');
    expect(r.report.gateway).toMatchObject({ status: 'error', error: 'ECONNABORTED' }); expect(r.items.length).toBeGreaterThan(0); expect(r.answered).toBe(2);
  });
  test('trusts nothing extra from the gateway: other providers and other categories are dropped', async () => {
    on(); down.add('sepia');
    gatewayAnswers('video', ['sepia'], [sepiaItem(), { title: 'spoof', url: 'https://x.test/1', source: 'dailymotion', category: 'videos' },
      { title: 'wrong cat', url: 'https://x.test/2', source: 'sepia', category: 'audio' }]);
    const r = await OpenSearch.search('video', 'news');
    expect(r.items.some((i) => i.title === 'spoof')).toBe(false); expect(r.items.some((i) => i.title === 'wrong cat')).toBe(false);
    expect(r.items.some((i) => i.title === 'via gateway')).toBe(true);
  });
  test('never exceeds the deadline: under 1s left means no gateway call', async () => {
    on(); down.add('sepia'); gatewayAnswers('video', ['sepia'], [sepiaItem()]);
    await OpenSearch.search('video', 'news', { deadlineMs: 900 });
    expect(axios.post).not.toHaveBeenCalled();
  });
  test('the gateway gets only the time that is left (its HTTP timeout = remaining budget)', async () => {
    on(); down.add('sepia'); gatewayAnswers('video', ['sepia'], [sepiaItem()]);
    await OpenSearch.search('video', 'news', { deadlineMs: 4500 });
    const cfg = gwCalls()[0][2]; expect(cfg.timeout).toBeLessThanOrEqual(4500); expect(cfg.timeout).toBeGreaterThanOrEqual(1000);
  });
  test('owner-disabled providers are never forwarded to the gateway', async () => {
    on(); process.env.OPEN_SEARCH_DISABLE = 'sepia'; down.add('dailymotion'); gatewayAnswers('video', ['dailymotion'], []);
    await OpenSearch.search('video', 'news');
    expect(gwCalls()[0][1].providers).toEqual(['dailymotion']);
  });
  test('all direct providers down but the gateway up: asSourcePayload resolves instead of rejecting', async () => {
    on(); ['sepia', 'dailymotion', 'archive'].forEach((p) => down.add(p));
    gatewayAnswers('video', ['sepia', 'dailymotion', 'archive'], [sepiaItem()]);
    await expect(OpenSearch.asSourcePayload('video', 'news', {})).resolves.toMatchObject({ _source: 'open-media' });
  });
  test('nothing to fall back for when every direct provider is healthy', async () => {
    on(); await OpenSearch.search('video', 'news'); expect(axios.post).not.toHaveBeenCalled();
  });
  test('ping(): best-effort, never throws, silent when not configured', async () => {
    const gw = require('../services/openSearch/gateway');
    expect(await gw.ping()).toBe(false); expect(axios.get).not.toHaveBeenCalled();
    on(); axios.get.mockRejectedValueOnce(new Error('asleep')); expect(await gw.ping()).toBe(false);
    axios.get.mockResolvedValueOnce({ data: { ok: true } }); expect(await gw.ping()).toBe(true);
  });
});
