/**
 * The public API has to be callable by the public.
 *
 * REPORTED, live: `curl https://api.truegle.info/api/search` returned
 * 403 "Automated scraping of Truegle is not permitted" — while /developers
 * published that exact curl command as the quickstart. `curl/` is in
 * BAD_BOT_PATTERNS, so the documented way to call the documented endpoint was
 * refused, and a Devvit reviewer testing the domain request would have hit it
 * on the first try.
 *
 * These tests pin both halves: a client that identifies itself gets through,
 * and one that does not still does not.
 */
const { classify, blockBadBots, declaredClient } = require('../middleware/botDetection');

const reqWith = (headers = {}) => ({
  headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
  ip: '203.0.113.7',
});

const runBlock = (req) => {
  let status = null; let body = null; let passed = false;
  const res = {
    status(code) { status = code; return this; },
    json(payload) { body = payload; return this; },
  };
  blockBadBots(req, res, () => { passed = true; });
  return { passed, status, body };
};

describe('declared API clients', () => {
  it('lets a declaring curl through where a bare curl is blocked', () => {
    const bare = reqWith({ 'User-Agent': 'curl/8.7.1' });
    bare.botInfo = classify(bare);
    expect(bare.botInfo.isBadBot).toBe(true);
    expect(runBlock(bare).status).toBe(403);

    const declared = reqWith({ 'User-Agent': 'curl/8.7.1', 'X-Truegle-Client': 'truegle-reddit' });
    declared.botInfo = classify(declared);
    expect(declared.botInfo.isBadBot).toBe(false);
    expect(declared.botInfo.isDeclaredClient).toBe(true);
    expect(declared.botInfo.client).toBe('truegle-reddit');
    expect(runBlock(declared).passed).toBe(true);
  });

  it('tells a blocked caller how to identify itself', () => {
    const req = reqWith({ 'User-Agent': 'python-requests/2.32' });
    req.botInfo = classify(req);
    const { body } = runBlock(req);
    // A 403 that does not say what to do instead is how an integrator concludes
    // the API is simply closed and goes elsewhere.
    expect(body.message).toMatch(/X-Truegle-Client/);
    expect(body.message).toMatch(/developers/);
  });

  it('does not treat a declared client as suspicious', () => {
    // A UA-less server-side fetch — which is what the Devvit runtime sends —
    // scores 60 and lands in the 5-request-per-minute throttle. Shared across
    // every reader of a Reddit post, that ceiling is reached immediately.
    const anonymous = classify(reqWith({}));
    expect(anonymous.suspicious).toBe(true);

    const declared = classify(reqWith({ 'X-Truegle-Client': 'truegle-reddit' }));
    expect(declared.suspicious).toBe(false);
    expect(declared.score).toBe(0);
  });

  it('ignores a malformed declaration instead of honouring it', () => {
    // The header is attacker-controlled and reaches logs, so the shape is
    // enforced. A bad value must mean "undeclared", never "error" — an error
    // would itself be a distinguishable response worth probing for.
    expect(declaredClient(reqWith({ 'X-Truegle-Client': '' }))).toBeNull();
    expect(declaredClient(reqWith({ 'X-Truegle-Client': 'a' }))).toBeNull();
    expect(declaredClient(reqWith({ 'X-Truegle-Client': 'bad\nInjected: header' }))).toBeNull();
    expect(declaredClient(reqWith({ 'X-Truegle-Client': 'x'.repeat(200) }))).toBeNull();
    expect(declaredClient(reqWith({ 'X-Truegle-Client': '<script>alert(1)</script>' }))).toBeNull();

    const forged = reqWith({ 'User-Agent': 'scrapy/2.11', 'X-Truegle-Client': 'x'.repeat(200) });
    forged.botInfo = classify(forged);
    expect(runBlock(forged).status).toBe(403);
  });

  it('still blocks the scrapers it was built to block', () => {
    for (const ua of ['scrapy/2.11', 'python-requests/2.32', 'wget', 'SomeCrawler/1.0']) {
      const req = reqWith({ 'User-Agent': ua });
      req.botInfo = classify(req);
      expect(runBlock(req).status).toBe(403);
    }
  });

  it('leaves ordinary browser traffic alone', () => {
    const req = reqWith({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36',
      'Accept-Language': 'en-GB,en;q=0.9',
      Accept: 'text/html,application/xhtml+xml',
    });
    req.botInfo = classify(req);
    expect(req.botInfo.isDeclaredClient).toBe(false);
    expect(req.botInfo.suspicious).toBe(false);
    expect(runBlock(req).passed).toBe(true);
  });
});
