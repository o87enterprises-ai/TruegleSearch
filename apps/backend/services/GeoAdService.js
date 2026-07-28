// GeoAdService — server-side, IP-country-of-origin ad targeting.
//
// Adsterra pays on CONVERSIONS, and an offer that isn't available in the
// visitor's country can never convert — a US user shown a UK-only offer earns
// $0. So we detect the visitor's country server-side and hand the frontend the
// Adsterra zone mapped to that country (falling back to a global DEFAULT zone),
// plus the CPM tier so the rest of the stack can prioritise the highest-value
// traffic. Only the three highest-CPM formats are ever served: native banner,
// social bar (in-page push) and popunder.
//
// Country detection order (no paid GeoIP DB, no per-request lookups on the hot
// path): trust the edge/CDN header first — Cloudflare's `cf-ipcountry` and
// Vercel's `x-vercel-ip-country` are set on every request for free and are
// authoritative — then fall back to a cached ip-api.com lookup (free tier,
// 45 req/min) only when no edge header is present. Everything degrades to the
// DEFAULT global zone, so ads never break if detection fails.
const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'ad_zones.json');

// Loaded once at startup; the file is small and static.
let adZones = { tiers: { tier1: [], tier2: [] }, zones: { DEFAULT: {} } };
try {
  adZones = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('GeoAdService: failed to load ad_zones.json, using empty config:', err.message);
}

// Env overrides for the DEFAULT (global fallback) zone, so keys can rotate
// without a code change — mirrors how the frontend reads them from Vite env.
const DEFAULT_ZONE = {
  nativeBanner: process.env.ADSTERRA_NATIVE_KEY || adZones.zones?.DEFAULT?.nativeBanner || null,
  socialBar: process.env.ADSTERRA_SOCIAL_BAR_URL || adZones.zones?.DEFAULT?.socialBar || null,
  popunder: process.env.ADSTERRA_POPUNDER_URL || adZones.zones?.DEFAULT?.popunder || null,
};

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

class GeoAdService {
  /** Country from a trusted edge/CDN header, if present. */
  static countryFromHeaders(req) {
    const h = req.headers || {};
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
    const ip = (req.ip || '').replace(/^::ffff:/, '');
    if (!ip || ip === '127.0.0.1' || ip === '::1' || /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(ip)) {
      return null;
    }
    return lookupCountryByIp(ip);
  }

  static tierOf(country) {
    if (!country) return 'tier3';
    if ((adZones.tiers?.tier1 || []).includes(country)) return 'tier1';
    if ((adZones.tiers?.tier2 || []).includes(country)) return 'tier2';
    return 'tier3';
  }

  /** DEFAULT zone with any country-specific overrides merged on top. */
  static zonesForCountry(country) {
    const override = (country && adZones.zones?.[country]) || {};
    return { ...DEFAULT_ZONE, ...override };
  }

  /** Full ad config for a request: country of origin, CPM tier, and zones. */
  static async getAdConfig(req) {
    const country = await this.detectCountry(req);
    const tier = this.tierOf(country);
    const zones = this.zonesForCountry(country);
    return {
      country: country || 'ZZ', // ZZ = unknown -> DEFAULT global zone
      tier,
      isTier1: tier === 'tier1',
      zones,
      // A country with its own zone entry is being explicitly targeted; anything
      // else is riding the global DEFAULT fallback (useful for the monitoring
      // KPI in the plan: "fallback zone triggered %").
      usingFallback: !(country && adZones.zones?.[country]),
    };
  }
}

module.exports = GeoAdService;
