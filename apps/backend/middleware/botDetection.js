/**
 * Bot Detection & Anti-Scraping Middleware
 *
 * Classifies incoming requests and lets the app slow or block automated
 * scrapers while staying friendly to legitimate search-engine crawlers.
 *
 * Layers:
 *   1. Good-bot allow-list (Googlebot, Bingbot, ...) — never blocked, so SEO
 *      indexing is unaffected.
 *   2. Bad-bot / automation detection — known scraping libraries and tools
 *      (curl, python-requests, scrapy, headless browsers, ...) plus heuristic
 *      signals (missing Accept-Language, no User-Agent).
 *   3. Cloudflare integration — reads `cf-connecting-ip` for accurate IP
 *      attribution and honors Cloudflare's verified-bot / threat-score headers
 *      when the zone has Bot Management enabled.
 *
 * The middleware only annotates the request (`req.botInfo`). Enforcement
 * (blocking, tighter rate limits) is applied by `blockBadBots` and the
 * bot-aware rate limiter so each route can opt in.
 *
 * ── DECLARED API CLIENTS ────────────────────────────────────────────────────
 *
 * Truegle publishes a public search API at /developers. Blocking automation
 * outright and documenting an API for automation are contradictory positions,
 * and the contradiction was live: the quickstart on our own documentation page
 * is a curl command, and `curl/` is in BAD_BOT_PATTERNS, so the documented way
 * to call the documented endpoint returned 403.
 *
 * The resolution is the one every real API uses: say who you are. A request
 * carrying `X-Truegle-Client: <name>` is a DECLARED client — it is not
 * pretending to be a browser, and we know what to contact if it misbehaves. It
 * skips the scraper block and the suspicious-client throttle, and picks up a
 * documented rate limit of its own instead.
 *
 * This is not a security control and is not meant to be one — anyone can set a
 * header. It is an honesty channel. What it buys is that the anonymous scraper
 * (no UA, no declaration, hammering us) and the integrator who read the docs
 * are no longer the same request to us, and can be treated differently and
 * revoked separately.
 *
 * Disable entirely with BOT_DETECTION_DISABLED=true.
 */

// The header a documented API client identifies itself with, and the shape it
// has to be in. Bounded and character-restricted because it is attacker-
// controlled and ends up in logs: no newlines (log injection), no unbounded
// length, nothing exotic.
const CLIENT_HEADER = 'x-truegle-client';
const CLIENT_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9 ._/-]{1,63}$/;

/**
 * The name a request declares itself under, or null if it declared nothing
 * usable. A malformed declaration is treated as no declaration rather than as
 * an error — it must not be a way to get a different response out of us.
 */
function declaredClient(req) {
  const raw = req.headers[CLIENT_HEADER];
  if (typeof raw !== 'string') return null;
  const name = raw.trim();
  return CLIENT_PATTERN.test(name) ? name : null;
}

// Legit crawlers we want to index us — matched case-insensitively on UA.
const GOOD_BOT_PATTERNS = [
  /googlebot/i,
  /bingbot/i,
  /slurp/i, // Yahoo
  /duckduckbot/i,
  /baiduspider/i,
  /yandex(bot)?/i,
  /applebot/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /discordbot/i,
  /telegrambot/i,
  /whatsapp/i,
];

// Automation tooling / scraping libraries — high-confidence "not a browser".
const BAD_BOT_PATTERNS = [
  /python-requests/i,
  /python-urllib/i,
  /aiohttp/i,
  /httpx/i,
  /scrapy/i,
  /\bcurl\//i,
  /\bwget\b/i,
  /go-http-client/i,
  /okhttp/i,
  /java\//i,
  /apache-httpclient/i,
  /node-fetch/i,
  /axios\//i,
  /got \(/i,
  /phantomjs/i,
  /headlesschrome/i,
  /puppeteer/i,
  /playwright/i,
  /selenium/i,
  /scrapheap|scraper|crawler|spider|harvest/i,
];

/**
 * Resolve the real client IP, preferring Cloudflare's header when present.
 * Behind Cloudflare -> Vercel, `cf-connecting-ip` is the true client IP.
 */
function getClientIp(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['true-client-ip'] ||
    req.ip
  );
}

/**
 * Classify a request. Returns a botInfo object.
 *   isGoodBot   - allow-listed crawler
 *   isBadBot    - high-confidence scraper/automation
 *   suspicious  - heuristic signals of a non-browser client
 *   score       - 0 (human-like) .. 100 (definitely a bot)
 */
function classify(req) {
  const ua = (req.headers['user-agent'] || '').trim();
  const accept = req.headers['accept'] || '';
  const acceptLang = req.headers['accept-language'] || '';
  const client = declaredClient(req);

  const info = {
    ua,
    ip: getClientIp(req),
    isGoodBot: false,
    isBadBot: false,
    isDeclaredClient: !!client,
    client,
    suspicious: false,
    reasons: [],
    score: 0,
  };

  // A client that says who it is is answered before any of the guessing below.
  // Checked ahead of the good-bot list too: this is a stronger signal than a
  // pattern match on a string anyone can forge, and it must not be possible for
  // a declared client to also come out flagged.
  if (client) {
    info.reasons.push('declared-client');
    return info;
  }

  // Cloudflare verified bot (when Bot Management is enabled on the zone).
  if (req.headers['cf-verified-bot'] === 'true') {
    info.isGoodBot = true;
    info.reasons.push('cf-verified-bot');
    return info;
  }

  if (GOOD_BOT_PATTERNS.some((re) => re.test(ua))) {
    info.isGoodBot = true;
    info.reasons.push('good-bot-ua');
    return info;
  }

  if (BAD_BOT_PATTERNS.some((re) => re.test(ua))) {
    info.isBadBot = true;
    info.score = 100;
    info.reasons.push('automation-ua');
    return info;
  }

  // Heuristic signals — none decisive alone, accumulate a score.
  if (!ua) {
    info.score += 60;
    info.reasons.push('no-user-agent');
  }
  if (ua && !acceptLang) {
    // Real browsers virtually always send Accept-Language.
    info.score += 25;
    info.reasons.push('no-accept-language');
  }
  if (accept === '*/*' && !acceptLang) {
    info.score += 15;
    info.reasons.push('generic-accept');
  }

  // Cloudflare threat score (0 clean .. 100 malicious), Enterprise-only header.
  const cfThreat = parseInt(req.headers['cf-threat-score'], 10);
  if (!Number.isNaN(cfThreat)) {
    info.score = Math.max(info.score, cfThreat);
    if (cfThreat > 0) info.reasons.push(`cf-threat-${cfThreat}`);
  }

  info.suspicious = info.score >= 50;
  return info;
}

/**
 * Annotating middleware — runs everywhere, decides nothing.
 */
const botDetection = (req, res, next) => {
  if (process.env.BOT_DETECTION_DISABLED === 'true') {
    req.botInfo = { isGoodBot: false, isBadBot: false, suspicious: false, score: 0, reasons: ['disabled'] };
    return next();
  }
  req.botInfo = classify(req);
  next();
};

/**
 * Enforcing middleware — blocks high-confidence scrapers. Mount on the routes
 * you actually want to protect (e.g. the search API). Good bots pass through.
 */
const blockBadBots = (req, res, next) => {
  const info = req.botInfo || classify(req);
  // Declared clients are the documented way to use the public API. Blocking
  // them would make /developers a page describing something that does not work.
  if (info.isDeclaredClient) return next();
  if (info.isGoodBot) return next();
  if (info.isBadBot) {
    return res.status(403).json({
      error: 'Forbidden',
      message:
        'Automated scraping of Truegle is not permitted. To use the public API, '
        + 'identify your client with an X-Truegle-Client header — see '
        + 'https://truegle.info/developers.',
    });
  }
  next();
};

module.exports = {
  botDetection,
  blockBadBots,
  classify,
  declaredClient,
  getClientIp,
  CLIENT_HEADER,
  GOOD_BOT_PATTERNS,
  BAD_BOT_PATTERNS,
};
