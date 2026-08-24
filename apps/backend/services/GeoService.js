// GeoService — server-side country-of-origin detection.
//
// This is the country-detection half of the former GeoAdService, kept when
// advertising was removed on 2026-08-24. The ad-zone half went with the ads;
// this half never had anything to do with them. It answers one question —
// which country is this request from — and `routes/news.js` uses it to pick
// which country's headlines to show.
//
// PRIVACY: detection order is deliberate. The edge/CDN header the request
// already carries (Cloudflare's `cf-ipcountry`, Vercel's
// `x-vercel-ip-country`) is authoritative, free, and involves no extra party —
// so it is tried first and answers nearly every request. Only when no edge
// header is present does it fall back to a cached ip-api.com lookup, and only
// for a public IP. Nothing is stored against a person: the cache is keyed by IP
// for six hours purely to stay inside a free rate limit, and holds a two-letter
// country code and nothing else. There is no geolocation prompt and no
// precise location at any point.
const https = require('https');

// Small in-memory cache for the ip-api fallback so we stay well under the free
// 45 req/min limit and never block the response on a slow external call.
const ipCountryCache = new Map(); // ip -> { country, at }
const IP_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

function normCountry(code) {
  if (!code || typeof code !== 'string') return null;
  const c = code.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) && c !== 'XX' ? c : null;
}

// Best-effort, non-blocking ip-api lookup. Returns null on any failure; caches
// the result so a repeat visitor from the same IP costs nothing.
function lookupCountryByIp(ip) {
  return new Promise((resolve) => {
    const cached = ipCountryCache.get(ip);
    if (cached && Date.now() - cached.at < IP_CACHE_TTL_MS) return resolve(cached.country);
    let done = false;
    const finish = (country) => {
      if (done) return;
      done = true;
      ipCountryCache.set(ip, { country, at: Date.now() });
      resolve(country);
    };
    try {
      const req = https.get(
        `https://ip-api.com/json/${encodeURIComponent(ip)}?fields=countryCode`,
        { timeout: 1200 },
        (res) => {
          let body = '';
          res.on('data', (d) => { body += d; });
          res.on('end', () => {
            try { finish(normCountry(JSON.parse(body).countryCode)); }
            catch { finish(null); }
          });
        },
      );
      req.on('error', () => finish(null));
      req.on('timeout', () => { req.destroy(); finish(null); });
    } catch { finish(null); }
  });
}

class GeoService {
  /** Country from a trusted edge/CDN header, if present. */
  static countryFromHeaders(req) {
    const h = (req && req.headers) || {};
    return (
      normCountry(h['cf-ipcountry']) ||        // Cloudflare
      normCountry(h['x-vercel-ip-country']) || // Vercel
      normCountry(h['x-country-code']) ||      // generic / custom proxy
      normCountry(h['x-appengine-country'])    // GAE
    );
  }

  /** Resolve the visitor's country of origin (edge header first, IP fallback). */
  static async detectCountry(req) {
    const fromHeader = this.countryFromHeaders(req);
    if (fromHeader) return fromHeader;
    // Fallback: real client IP (trust proxy is on, so req.ip is X-Forwarded-For's
    // first hop). Skip private/loopback addresses — ip-api can't resolve them.
    const ip = ((req && req.ip) || '').replace(/^::ffff:/, '');
    if (!ip || ip === '127.0.0.1' || ip === '::1' || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(ip)) {
      return null;
    }
    return lookupCountryByIp(ip);
  }
}

module.exports = GeoService;
