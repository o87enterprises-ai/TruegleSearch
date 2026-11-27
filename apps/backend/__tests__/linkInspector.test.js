const request = require('supertest');
const express = require('express');

jest.mock('../utils/safeFetch', () => {
  const actual = jest.requireActual('../utils/safeFetch');
  return { ...actual, safeFetch: jest.fn() };
});
jest.mock('../middleware/rateLimit', () => ({ rateLimitSearch: (req, res, next) => next() }));

const { safeFetch, FetchRefused } = require('../utils/safeFetch');
const { analyse, framingOf, inspect } = require('../services/LinkInspector');

const page = (extra = {}) => ({
  entered: 'https://example.org/a',
  finalUrl: 'https://example.org/a',
  hops: ['https://example.org/a'],
  headers: { 'content-type': 'text/html; charset=utf-8' },
  type: 'text/html; charset=utf-8',
  body: '<html><body>hello</body></html>',
  ...extra,
});

describe('framingOf — can the page be shown inside Truegle?', () => {
  it('allows a page that sends no framing rule', () => {
    expect(framingOf({}).allowed).toBe(true);
  });
  it.each([
    [{ 'x-frame-options': 'DENY' }],
    [{ 'x-frame-options': 'SAMEORIGIN' }],
    [{ 'x-frame-options': 'ALLOW-FROM https://other.example' }],
    [{ 'content-security-policy': "default-src 'self'; frame-ancestors 'none'" }],
    [{ 'content-security-policy': "frame-ancestors 'self'" }],
    [{ 'content-security-policy': 'frame-ancestors https://some-other-site.example' }],
  ])('refuses %j', (headers) => {
    expect(framingOf(headers).allowed).toBe(false);
  });
  it('allows a wildcard and an explicit Truegle entry', () => {
    expect(framingOf({ 'content-security-policy': 'frame-ancestors *' }).allowed).toBe(true);
    expect(framingOf({ 'content-security-policy': 'frame-ancestors https://truegle.info https://x.example' }).allowed).toBe(true);
    expect(framingOf({ 'content-security-policy': 'frame-ancestors https://*.truegle.info' }).allowed).toBe(true);
  });
  it('matches origins exactly: a wildcard for someone else, or a sibling subdomain, is not ours', () => {
    expect(framingOf({ 'content-security-policy': 'frame-ancestors https://*.example.com' }).allowed).toBe(false);
    expect(framingOf({ 'content-security-policy': 'frame-ancestors https://app.truegle.info' }).allowed).toBe(false);
    expect(framingOf({ 'content-security-policy': 'frame-ancestors https://*.truegle.info.evil.example' }).allowed).toBe(false);
  });
  it('lets CSP frame-ancestors win over a stale X-Frame-Options', () => {
    expect(framingOf({ 'x-frame-options': 'SAMEORIGIN', 'content-security-policy': 'frame-ancestors *' }).allowed).toBe(true);
  });
  it('does not treat a look-alike host as ours', () => {
    expect(framingOf({ 'content-security-policy': 'frame-ancestors https://nottruegle.info' }).allowed).toBe(false);
  });
});

describe('analyse', () => {
  it('a plain https page is safe and can open in-app', () => {
    const r = analyse(page());
    expect(r.verdict).toBe('safe');
    expect(r.inAppPossible).toBe(true);
    expect(r.isHtml).toBe(true);
  });

  it('flags a link that lands on a different site', () => {
    const r = analyse(page({ finalUrl: 'https://elsewhere.net/x', hops: ['https://example.org/a', 'https://elsewhere.net/x'] }));
    expect(r.verdict).toBe('caution');
    expect(r.findings.some((f) => /ends up on elsewhere\.net/.test(f.text))).toBe(true);
  });

  it('only notes (does not warn about) a redirect that stays on the same site', () => {
    const r = analyse(page({ finalUrl: 'https://www.example.org/a', hops: ['https://example.org/a', 'https://www.example.org/a'] }));
    expect(r.verdict).toBe('safe');
    expect(r.findings.some((f) => f.level === 'info' && /Redirected 1 time/.test(f.text))).toBe(true);
  });

  it('flags an https -> http downgrade and an unencrypted final page', () => {
    const r = analyse(page({ finalUrl: 'http://example.org/a', hops: ['https://example.org/a', 'http://example.org/a'] }));
    expect(r.verdict).toBe('caution');
    expect(r.findings.filter((f) => f.level === 'caution').length).toBeGreaterThanOrEqual(2);
  });

  it('calls a program download danger and never offers it in-app', () => {
    const byType = analyse(page({ type: 'application/x-msdownload', headers: { 'content-type': 'application/x-msdownload' } }));
    const byName = analyse(page({ finalUrl: 'https://example.org/setup.exe', type: 'application/octet-stream', headers: { 'content-type': 'application/octet-stream' } }));
    for (const r of [byType, byName]) {
      expect(r.verdict).toBe('danger');
      expect(r.inAppPossible).toBe(false);
    }
  });

  it('treats a generic download as caution and not in-app', () => {
    const r = analyse(page({ type: 'application/zip', headers: { 'content-type': 'application/zip', 'content-disposition': 'attachment; filename=a.zip' } }));
    expect(r.verdict).toBe('caution');
    expect(r.isDownload).toBe(true);
    expect(r.inAppPossible).toBe(false);
  });

  it('does not call a video or a PDF a download, but still keeps them out of the in-app frame', () => {
    const video = analyse(page({ type: 'video/mp4', headers: { 'content-type': 'video/mp4' }, body: '' }));
    const pdf = analyse(page({ type: 'application/pdf', headers: { 'content-type': 'application/pdf' } }));
    for (const r of [video, pdf]) {
      expect(r.isDownload).toBe(false);
      expect(r.inAppPossible).toBe(false);
    }
  });

  it('reports a site that forbids framing, and does not offer in-app', () => {
    const r = analyse(page({ headers: { 'content-type': 'text/html', 'x-frame-options': 'DENY' } }));
    expect(r.framing.allowed).toBe(false);
    expect(r.inAppPossible).toBe(false);
    expect(r.verdict).toBe('safe');   // not being framable is not a danger sign
  });

  it('spots hidden frames, an automatic hop to another site, and heavy obfuscation', () => {
    const hidden = analyse(page({ body: '<iframe src="https://x.example" width="0" height="0"></iframe>' }));
    const refresh = analyse(page({ body: '<meta http-equiv="refresh" content="0;url=https://evil.example/p">' }));
    const obf = analyse(page({ body: `<script>${'eval(atob("x"));'.repeat(5)}</script>` }));
    for (const r of [hidden, refresh, obf]) expect(r.verdict).toBe('caution');
  });

  it('ignores a meta refresh that stays on the same site', () => {
    expect(analyse(page({ body: '<meta http-equiv="refresh" content="0;url=/next">' })).verdict).toBe('safe');
  });

  it('does not penalise ordinary script', () => {
    expect(analyse(page({ body: '<script>eval(1)</script><script>atob("a")</script>' })).verdict).toBe('safe');
  });

  it('notes a password field and a frame-breaker as information only', () => {
    const r = analyse(page({ body: '<input type="password"><script>if (top !== self) top.location = self.location</script>' }));
    expect(r.verdict).toBe('safe');
    expect(r.findings.filter((f) => f.level === 'info').length).toBe(2);
  });
});

describe('inspect — never throws', () => {
  afterEach(() => safeFetch.mockReset());

  it('reports a refused address (private network, bad scheme) as refused', async () => {
    safeFetch.mockRejectedValue(new FetchRefused('not a public address'));
    expect(await inspect('http://169.254.169.254/')).toEqual({ ok: false, reason: 'refused' });
  });

  it('reports any other failure generically, without leaking the cause', async () => {
    safeFetch.mockRejectedValue(new Error('connect ECONNREFUSED 10.1.2.3:443'));
    const r = await inspect('https://down.example/');
    expect(r).toEqual({ ok: false, reason: 'unreachable' });
    expect(JSON.stringify(r)).not.toMatch(/10\.1\.2\.3/);
  });

  it('gives up after one overall deadline instead of waiting out a slow redirect chain', async () => {
    jest.useFakeTimers();
    try {
      safeFetch.mockReturnValue(new Promise(() => {}));   // never settles
      const pending = inspect('https://slow.example/');
      await jest.advanceTimersByTimeAsync(10001);
      expect(await pending).toEqual({ ok: false, reason: 'unreachable' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('wraps a good fetch in ok:true with the analysis', async () => {
    safeFetch.mockResolvedValue({ url: 'https://example.org/a', hops: ['https://example.org/a'], headers: {}, type: 'text/html', body: '<html></html>', truncated: false });
    const r = await inspect('https://example.org/a');
    expect(r.ok).toBe(true);
    expect(r.inAppPossible).toBe(true);
  });
});

describe('POST /api/link/inspect', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/link', require('../routes/link'));

  afterEach(() => safeFetch.mockReset());

  it.each([[{}], [{ url: '' }], [{ url: 123 }], [{ url: 'has a space.com' }], [{ url: `https://a.example/${'x'.repeat(2100)}` }]])('rejects %j', async (body) => {
    const res = await request(app).post('/api/link/inspect').send(body);
    expect(res.status).toBe(400);
    expect(safeFetch).not.toHaveBeenCalled();
  });

  it.each(['javascript:alert(1)', 'data:text/html,<b>x</b>', 'file:///etc/passwd', 'ftp://example.org/x'])('refuses non-web scheme %s without fetching', async (url) => {
    const res = await request(app).post('/api/link/inspect').send({ url });
    expect(res.body).toEqual({ ok: false, reason: 'refused' });
    expect(safeFetch).not.toHaveBeenCalled();
  });

  it('adds https:// to a bare host and returns the analysis', async () => {
    safeFetch.mockResolvedValue({ url: 'https://example.org/p', hops: ['https://example.org/p'], headers: {}, type: 'text/html', body: '<html></html>' });
    const res = await request(app).post('/api/link/inspect').send({ url: 'example.org/p' });
    expect(safeFetch.mock.calls[0][0]).toBe('https://example.org/p');
    expect(res.body.ok).toBe(true);
    expect(res.body.verdict).toBe('safe');
  });

  it('serves a repeat from cache, and does not cache a failure', async () => {
    safeFetch.mockResolvedValue({ url: 'https://cache.example/', hops: ['https://cache.example/'], headers: {}, type: 'text/html', body: '<html></html>' });
    await request(app).post('/api/link/inspect').send({ url: 'https://cache.example/' });
    await request(app).post('/api/link/inspect').send({ url: 'https://cache.example/' });
    expect(safeFetch).toHaveBeenCalledTimes(1);

    safeFetch.mockReset();
    safeFetch.mockRejectedValue(new Error('boom'));
    await request(app).post('/api/link/inspect').send({ url: 'https://flaky.example/' });
    await request(app).post('/api/link/inspect').send({ url: 'https://flaky.example/' });
    expect(safeFetch).toHaveBeenCalledTimes(2);
  });
});
