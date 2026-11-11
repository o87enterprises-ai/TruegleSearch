/**
 * The Feed/Tube language filter (owner, 2026-11-09).
 *
 *   LOCAL  (default): only posts in the visitor's language.
 *   GLOBAL:           everything, the visitor's language first.
 * "The visitor's language" is the primary language of their device/browser
 * setting (e.g. en-US -> en), sent by the page. Nothing is located or tracked.
 *
 * A post's language, best evidence first:
 *   1. its SPOKEN language, for YouTube videos (services/AudioLang.js). This wins:
 *      an English title over foreign audio is not English.
 *   2. a language the network itself labels (Mastodon, Bluesky).
 *   3. its text (services/langDetect.js).
 * A post whose language cannot be told (too little text) is KEPT in Local, as
 * long as its script fits the visitor's language: a wrong "not your language"
 * would hide a good post. TikTok/Instagram/Facebook/Rumble publish no audio
 * language, so for them the text is all there is.
 */
const { detectLang, scriptOf } = require('./langDetect');
const AudioLang = require('./AudioLang');

const YT_ID = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
const ytId = (item) => (YT_ID.exec(String(item?.url || '')) || YT_ID.exec(String(item?.permalink || '')) || [])[1] || null;
const primary = (code) => (code ? String(code).toLowerCase().split(/[-_]/)[0] : null);
const textOf = (item) => `${item?.title || ''} ${item?.snippet || ''}`;

/** Every distinct post object in a feed payload. */
function itemsOf(payload) {
  const set = new Set();
  for (const r of payload?.results || []) if (r && typeof r === 'object') set.add(r);
  for (const arr of Object.values(payload?.platforms || {})) for (const r of arr || []) if (r && typeof r === 'object') set.add(r);
  return [...set];
}

/**
 * Work out each post's language ONCE, in place, before the payload is cached:
 * `lang` (text or network label) and, for YouTube videos, `audioLang`.
 */
async function annotateItems(items, { budgetMs = 3000 } = {}) {
  const ids = [];
  for (const it of items) {
    const label = primary(it.lang);
    it.lang = label && label !== 'und' ? label : detectLang(textOf(it)).lang;
    const id = ytId(it);
    if (id && !it.audioLang) ids.push(id);
  }
  if (ids.length) {
    const spoken = await AudioLang.lookup(ids, { budgetMs });
    for (const it of items) { const id = ytId(it); if (id && spoken.get(id)) it.audioLang = spoken.get(id); }
  }
  return items;
}
const annotate = async (payload, opts) => { await annotateItems(itemsOf(payload), opts); return payload; };

/** 'match' | 'unknown' | 'other' for one post against the visitor's language. */
function verdict(item, lang) {
  if (item?.audioLang) return item.audioLang === lang ? 'match' : 'other';
  const t = item?.lang && item.lang !== 'und' ? item.lang : detectLang(textOf(item)).lang;
  if (t === lang) return 'match';
  if (t !== 'und') return 'other';
  // Undetermined: keep it unless it is written in another language's script.
  const { script } = detectLang(textOf(item));
  return script === 'none' || script === scriptOf(lang) ? 'unknown' : 'other';
}

const RANK = { match: 0, unknown: 1, other: 2 };
function applyTo(list, lang, mode) {
  if (!Array.isArray(list)) return list;
  if (mode === 'global') {
    return list.map((it, i) => ({ it, i, r: RANK[verdict(it, lang)] }))
      .sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.it);
  }
  return list.filter((it) => verdict(it, lang) !== 'other');
}

/** A new payload filtered (Local) or reordered (Global) for this visitor. Never mutates. */
function filterByLang(payload, { lang, mode = 'local' } = {}) {
  const l = primary(lang);
  if (!payload || !l || !/^[a-z]{2,3}$/.test(l)) return payload;
  const platforms = {};
  for (const [k, v] of Object.entries(payload.platforms || {})) platforms[k] = applyTo(v, l, mode);
  return { ...payload, results: applyTo(payload.results, l, mode), platforms };
}

module.exports = { annotate, annotateItems, filterByLang, verdict, itemsOf, ytId };
