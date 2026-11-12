/**
 * Open search pool: keyless providers assigned to FEATURES.
 *
 * WHY: one shared pool of keys/quotas is how a heavy feature starves everything else
 * (key exhaustion). Here every feature owns its own provider list, so video traffic
 * can only ever spend video providers. Add a provider by writing one adapter and
 * listing it under the feature(s) it serves.
 *
 * HEALTH: a provider that times out / 429s / 5xxs is skipped ("cooling") for
 * 30s, doubling per consecutive failure up to 15 min, and recovers on first success.
 * One provider failing never fails the feature; only "every provider failed or is
 * cooling" does, and then the caller's other sources carry the search.
 * State is per process (Vercel instances are short-lived), which is fine: worst case
 * an instance re-learns a bad provider with one 5s-bounded request.
 *
 * KILL SWITCH: OPEN_SEARCH_DISABLE=sepia,lemmy turns providers off without a deploy
 * of code (env change + redeploy).
 */
const adapters = require('./adapters');
const logger = require('../../utils/logger');

// feature -> { category: what an item must be tagged to count, providers: ordered }
const FEATURES = {
  video: { category: 'videos', providers: ['sepia', 'dailymotion', 'archive'] },
  audio: { category: 'audio', providers: ['audius', 'openverse', 'itunes', 'archive'] },
  social: { category: 'social', providers: ['lemmy', 'mastodon'] },
};

const PROVIDERS = {
  sepia: adapters.sepia,
  dailymotion: adapters.dailymotion,
  archive: adapters.internetArchive,
  audius: adapters.audius,
  openverse: adapters.openverseAudio,
  itunes: adapters.itunesPodcasts,
  lemmy: adapters.lemmy,
  mastodon: adapters.mastodonTag,
};

const DEADLINE_MS = 4500;          // same budget as the SearXNG call: never hold a search hostage
const FAIL_BASE_MS = 30 * 1000;
const FAIL_MAX_MS = 15 * 60 * 1000;
const health = new Map();          // provider -> { fails, until }

const disabled = () => new Set(String(process.env.OPEN_SEARCH_DISABLE || '').split(',').map((s) => s.trim()).filter(Boolean));
const isCooling = (name, now) => (health.get(name)?.until || 0) > now;
function recordFail(name, now) {
  const fails = (health.get(name)?.fails || 0) + 1;
  health.set(name, { fails, until: now + Math.min(FAIL_MAX_MS, FAIL_BASE_MS * 2 ** (fails - 1)) });
}
const recordOk = (name) => health.delete(name);

const withDeadline = (p, ms) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('deadline')), ms);
  p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

const keyOf = (u) => String(u || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '');

/** Round-robin across providers so one chatty source cannot bury the rest; drop duplicate URLs. */
function interleave(lists) {
  const seen = new Set(); const out = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const it = l[i];
      if (!it) continue;
      const k = keyOf(it.url);
      if (k && !seen.has(k)) { seen.add(k); out.push(it); }
    }
  }
  return out;
}

/**
 * @returns {{items: object[], report: object, answered: number}}
 *   answered = providers that returned without error (0 results still counts).
 */
async function search(feature, query, { limit = 10, safe = true, now = Date.now(), deadlineMs = DEADLINE_MS } = {}) {
  const spec = FEATURES[feature];
  if (!spec) throw new Error(`unknown feature ${feature}`);
  const q = String(query || '').trim();
  const off = disabled();
  const report = {};
  if (!q) return { items: [], report, answered: 0 };

  const runs = spec.providers.map(async (name) => {
    if (off.has(name)) { report[name] = { status: 'disabled' }; return []; }
    if (isCooling(name, now)) { report[name] = { status: 'cooling' }; return []; }
    const started = Date.now();
    try {
      const items = (await withDeadline(PROVIDERS[name](q, { limit, safe, timeoutMs: deadlineMs }), deadlineMs)).filter((i) => i.category === spec.category);
      recordOk(name);
      report[name] = { status: 'ok', count: items.length, ms: Date.now() - started };
      return items;
    } catch (err) {
      recordFail(name, now);
      report[name] = { status: 'error', error: err.response?.status ? `HTTP ${err.response.status}` : (err.code || err.message) };
      logger.warn(`open-search ${feature}/${name} failed: ${report[name].error}`);
      return [];
    }
  });

  const lists = await Promise.all(runs);
  const answered = Object.values(report).filter((r) => r.status === 'ok').length;
  return { items: interleave(lists).slice(0, limit * 2), report, answered };
}

/**
 * Shape SearchService's detectSource/formatResults understand ({_source:'open-media', results}).
 * Throws when NO provider answered, so the caller's Promise.allSettled records it as a failed
 * source instead of a silent empty one.
 */
async function asSourcePayload(feature, query, filters = {}) {
  const { items, answered } = await search(feature, query, { limit: filters.perPage || 10, safe: filters.safeSearch !== 'off' });
  if (!answered) throw new Error('open-media unavailable');
  return { _source: 'open-media', results: items };
}

function stats(now = Date.now()) {
  const off = disabled();
  const out = {};
  for (const [feature, spec] of Object.entries(FEATURES)) {
    out[feature] = spec.providers.map((name) => ({
      provider: name,
      status: off.has(name) ? 'disabled' : isCooling(name, now) ? 'cooling' : 'ready',
      consecutiveFailures: health.get(name)?.fails || 0,
    }));
  }
  return out;
}

const __reset = () => health.clear();

module.exports = { search, asSourcePayload, stats, FEATURES, __reset };
