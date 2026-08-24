/**
 * Per-mode SearXNG engine sets — so modes RETRIEVE differently, not just re-rank.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE PROBLEM THIS SOLVES
 *
 * Every Truegle mode used to send the same query to the same providers and then
 * re-sort the one shared result list. A "perspective" that only reorders a
 * Google-derived list is still Google's worldview with a different sort — so no
 * amount of ranking work could make the modes feel genuinely different.
 *
 * SearXNG accepts an `engines` parameter naming which upstreams to query. Our
 * request never sent one, so every mode got the instance default. Naming a
 * different set per mode is free, needs no index of our own, and is the honest
 * version of what the modes claim to do.
 *
 * WHY THESE SETS
 *
 * The split that matters is which engines own an INDEX rather than reselling
 * Google's. Mojeek and Brave crawl the web themselves; Marginalia and Mwmbl are
 * independent non-commercial indexes that deliberately rank away from
 * SEO-optimised pages. Querying those instead of Google and Bing returns
 * genuinely different documents, not the same documents reordered.
 *
 * NOTHING IS FILTERED OUT. Naming engines chooses where results are FETCHED
 * from; it does not remove or suppress anything a chosen engine returns.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FAILURE BEHAVIOUR — read before editing
 *
 * Engine names must match what the SearXNG instance actually has ENABLED in its
 * settings.yml. Naming an engine that is disabled or misspelled makes SearXNG
 * return few or no results for that query.
 *
 * That is survivable by design: SearchService retries the search WITHOUT the
 * engines parameter when an engine-scoped call comes back thin, so a wrong name
 * costs one extra request and nothing else. It never returns an empty page to a
 * user. But it is silently wasteful, so if a mode feels thin, check the names
 * against the instance's own /config endpoint first.
 *
 * Every set is overridable by env without a deploy — see ENV_KEYS below. Set a
 * variable to an empty string to fall back to the instance default for that mode.
 */

// Conservative defaults. These are stock SearXNG engine names that a default
// install enables; the independent ones are grouped where they matter most.
const DEFAULTS = {
  // Mainstream web. The majors have the broadest coverage, which is what this
  // mode is for — it is the "just find the thing" mode.
  'blue-pill': ['google', 'bing', 'duckduckgo', 'wikipedia'],

  // Green is blue's retrieval with AI-generated content filtered afterwards, so
  // it shares the mainstream set. Wikipedia is weighted in by being listed.
  green: ['google', 'bing', 'duckduckgo', 'wikipedia'],

  // The rabbit hole. Independent indexes only — no Google, no Bing. This is the
  // mode where returning the same ten links as everyone else is the failure.
  // marginalia and mwmbl are small and may be disabled on some instances; the
  // thin-result retry covers that case.
  'red-pill': ['mojeek', 'brave', 'marginalia', 'mwmbl', 'duckduckgo'],

  // Purple filters results down to chosen perspectives, so it needs the WIDEST
  // possible pool to filter from — mixing mainstream and independent. A narrow
  // set here would make the perspective filter come back empty.
  purple: ['google', 'bing', 'duckduckgo', 'brave', 'mojeek', 'wikipedia'],
};

/** Env override per mode, e.g. SEARXNG_ENGINES_RED_PILL="mojeek,brave". */
const ENV_KEYS = {
  'blue-pill': 'SEARXNG_ENGINES_BLUE_PILL',
  green: 'SEARXNG_ENGINES_GREEN',
  'red-pill': 'SEARXNG_ENGINES_RED_PILL',
  purple: 'SEARXNG_ENGINES_PURPLE',
};

const clean = (list) =>
  [...new Set(
    (Array.isArray(list) ? list : String(list).split(','))
      .map((e) => String(e).trim().toLowerCase())
      .filter(Boolean),
  )];

/**
 * Engine names for a mode, as a comma-separated string ready for the SearXNG
 * `engines` query parameter. Returns null when no set applies, which means
 * "send no engines parameter" — i.e. the instance default, the old behaviour.
 */
function enginesFor(mode) {
  const key = mode || 'blue-pill';
  const envKey = ENV_KEYS[key];
  const raw = envKey ? process.env[envKey] : undefined;

  // An env var set to empty string is an explicit "use the instance default".
  if (raw !== undefined && raw !== null) {
    const fromEnv = clean(raw);
    return fromEnv.length ? fromEnv.join(',') : null;
  }

  const preset = DEFAULTS[key];
  return preset && preset.length ? clean(preset).join(',') : null;
}

/** Which modes have a set, for health output and tests. */
function stats() {
  const out = {};
  for (const mode of Object.keys(DEFAULTS)) out[mode] = enginesFor(mode);
  return out;
}

module.exports = { enginesFor, stats, DEFAULTS, ENV_KEYS };
