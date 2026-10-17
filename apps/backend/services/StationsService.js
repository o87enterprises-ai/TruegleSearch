/**
 * Live radio stations, for the Tube page's Stations tuner (owner, 2026-10-17:
 * "a local or select a region FM tuner").
 *
 * Source: Radio Browser (radio-browser.info) — a free, open, community-run
 * directory of ~50k real stations' internet streams. No key. These are the
 * stations' own web streams, not an FM signal.
 *
 * ONLY HTTPS STREAMS ARE LISTED. truegle.info is served over https, and a
 * browser refuses an http audio stream on an https page (mixed content).
 * Relaying http streams through our backend would fix that, but would put
 * every listener's audio through a serverless function — bandwidth and
 * function-time we don't pay for ($0 budget) — so those stations are hidden
 * rather than listed and left to fail. HLS streams are left out too: a plain
 * <audio> only plays them in Safari.
 *
 * "Near me" coordinates are rounded to one decimal (~11km) before they leave
 * Truegle, and never logged.
 *
 * FAILS OPEN: an unreachable directory returns [] and the tuner says so.
 */
const axios = require('axios');

const UA = 'TruegleSearch/1.0 (https://truegle.info)';
// Radio Browser runs several mirrors and asks clients to spread across them;
// any one being down must not take the tuner with it.
const MIRRORS = ['https://de1.api.radio-browser.info', 'https://fi1.api.radio-browser.info', 'https://de2.api.radio-browser.info'];
const TIMEOUT_MS = 6000;
const DAY = 24 * 60 * 60 * 1000;
const TEN_MIN = 10 * 60 * 1000;
const MAX_CACHE = 500;

const cache = new Map(); // key → { at, ttl, value }

async function cached(key, ttl, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value;
  const value = await load();
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), ttl, value });
  return value;
}

async function rb(path, params = {}) {
  let lastErr;
  for (const base of MIRRORS) {
    try {
      const { data } = await axios.get(`${base}${path}`, { params, headers: { 'User-Agent': UA }, timeout: TIMEOUT_MS });
      return data;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/** [{ code, name, count }], biggest first. */
async function countries() {
  try {
    return await cached('countries', DAY, async () => {
      const rows = await rb('/json/countries', { order: 'stationcount', reverse: true, hidebroken: true });
      return (Array.isArray(rows) ? rows : [])
        .filter((c) => c.iso_3166_1 && c.name && c.stationcount >= 3)
        .map((c) => ({ code: c.iso_3166_1.toUpperCase(), name: c.name, count: c.stationcount }));
    });
  } catch {
    return [];
  }
}

/** Regions (states/provinces) of a country by ISO code: [{ name, count }]. */
async function regions(code) {
  const cc = String(code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return [];
  try {
    const country = (await countries()).find((c) => c.code === cc);
    if (!country) return [];
    return await cached(`regions:${cc}`, DAY, async () => {
      const rows = await rb(`/json/states/${encodeURIComponent(country.name)}/`, { order: 'stationcount', reverse: true, hidebroken: true });
      return (Array.isArray(rows) ? rows : [])
        // The directory is community-entered: "Oregon" and "Portland OR" both
        // appear. A region with one station is usually a typo of another.
        .filter((r) => r.name && r.stationcount >= 2)
        .map((r) => ({ name: r.name, count: r.stationcount }));
    });
  } catch {
    return [];
  }
}

const toStation = (s) => ({
  id: s.stationuuid,
  name: String(s.name || '').trim(),
  url: s.url_resolved,
  homepage: s.homepage || null,
  favicon: /^https:\/\//.test(s.favicon || '') ? s.favicon : null,
  tags: String(s.tags || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 3),
  country: s.countrycode || null,
  region: s.state || null,
  codec: s.codec || null,
  bitrate: Number(s.bitrate) || null,
  km: s.geo_distance != null ? Math.round(s.geo_distance / 1000) : null,
});

/**
 * Stations by country (+ optional region) or near a point.
 * @param {{country?: string, region?: string, lat?: number, lng?: number, km?: number}} q
 */
async function stations(q = {}) {
  const params = { hidebroken: true, order: 'clickcount', reverse: true, limit: 150 };
  let key;
  const lat = Number(q.lat);
  const lng = Number(q.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    const km = Math.min(Math.max(Number(q.km) || 100, 10), 500);
    params.geo_lat = Math.round(lat * 10) / 10;
    params.geo_long = Math.round(lng * 10) / 10;
    params.geo_distance = km * 1000;
    key = `near:${params.geo_lat},${params.geo_long},${km}`;
  } else {
    const cc = String(q.country || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) return [];
    params.countrycode = cc;
    const region = String(q.region || '').trim().slice(0, 80);
    if (region) { params.state = region; params.stateExact = true; }
    key = `in:${cc}:${region.toLowerCase()}`;
  }
  try {
    return await cached(key, TEN_MIN, async () => {
      const rows = await rb('/json/stations/search', params);
      const seen = new Set();
      return (Array.isArray(rows) ? rows : [])
        .filter((s) => /^https:\/\//i.test(s.url_resolved || '') && !Number(s.hls))
        .map(toStation)
        .filter((s) => {
          // The same station is often listed twice (two contributors).
          const k = s.name.toLowerCase();
          if (!s.name || seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .slice(0, 60);
    });
  } catch {
    return [];
  }
}

module.exports = { countries, regions, stations, _cache: cache };
