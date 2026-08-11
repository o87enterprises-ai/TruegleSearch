import { useSyncExternalStore } from 'react';
import { mediaKey } from './videoEmbed';

// 👍 / 👎 — what comes next, and who gets to know about it.
//
// TWO LAYERS, on purpose:
//
//   1. YOUR taste lives in YOUR browser. Every thumb you press is written to
//      localStorage and never sent anywhere with your name on it. There is no
//      account, no profile row, no cookie following you between sites — which
//      is the whole reason to use Truegle, and it would be absurd to build a
//      recommendation engine that quietly undoes it.
//
//   2. The PLATFORM learns from the votes in aggregate. A thumb also fires a
//      single anonymous counter bump — "this video got a 👍" — with no user id,
//      no session id and nothing that could be joined back to a person. That
//      pool is what a brand-new visitor gets recommendations from on their
//      first ever click, before they have a taste profile of their own.
//
// Layer 1 personalises; layer 2 solves cold start. Neither needs an account.
//
// Ballot-stuffing: the client sends the TRANSITION (none→up, up→down, …), not
// a raw increment, so pressing 👍 twenty times moves the platform counter once.
// Backend rate-limits on top of that. It is not un-gameable — nothing anonymous
// is — but it costs an attacker a fresh browser per vote.
const KEY = 'truegle_taste_v1';
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// Words that say nothing about what someone likes.
const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'this', 'that', 'you', 'your', 'are',
  'was', 'his', 'her', 'they', 'them', 'out', 'not', 'but', 'all', 'get',
  'got', 'how', 'why', 'who', 'what', 'when', 'new', 'official', 'video',
  'audio', 'lyrics', 'lyric', 'full', 'hd', 'ft', 'feat', 'featuring', 'live',
  'episode', 'part', 'ep', 'vs', 'remix', 'version', 'music', 'watch', 'free',
]);

export function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .slice(0, 12);
}

const EMPTY = { ratings: {}, channels: {}, words: {} };

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return EMPTY;
    return {
      ratings: raw.ratings && typeof raw.ratings === 'object' ? raw.ratings : {},
      channels: raw.channels && typeof raw.channels === 'object' ? raw.channels : {},
      words: raw.words && typeof raw.words === 'object' ? raw.words : {},
    };
  } catch {
    return EMPTY;
  }
}

let state = read();
// A version counter, not the object: useSyncExternalStore compares snapshots by
// identity, and an object rebuilt on every read loops forever.
let version = 0;
const listeners = new Set();

function commit(next) {
  state = next;
  version += 1;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
  listeners.forEach((fn) => fn());
}

// Weights decay as the profile grows so one obsessive week doesn't permanently
// own the feed, and a taste can change.
const CAP = 8;
const bump = (map, k, by) => {
  if (!k) return;
  map[k] = Math.max(-CAP, Math.min(CAP, (map[k] || 0) + by));
};

/**
 * Record a thumb. `dir` is 1, -1, or 0 to clear. Pressing the same thumb again
 * clears it — the control is a toggle, like every other vote button.
 * @returns the rating that is now in force.
 */
export function rate(source, dir) {
  const key = mediaKey(source);
  if (!key) return 0;
  const was = state.ratings[key] || 0;
  const now = was === dir ? 0 : dir;

  const ratings = { ...state.ratings };
  if (now === 0) delete ratings[key]; else ratings[key] = now;

  // Undo the old vote's influence before applying the new one, or flipping
  // 👍→👎 would leave the channel/word weights permanently upvoted.
  const channels = { ...state.channels };
  const words = { ...state.words };
  const delta = now - was;
  if (delta) {
    bump(channels, source?.channel, delta * 2);
    tokens(source?.title).forEach((w) => bump(words, w, delta));
  }

  commit({ ratings, channels, words });
  signal(source, was, now);
  return now;
}

export const ratingOf = (source) => state.ratings[mediaKey(source)] || 0;
export const isDisliked = (source) => ratingOf(source) === -1;

/**
 * How well a candidate matches this browser's taste. Higher is better;
 * -Infinity means "never play this" (they thumbed it down).
 *
 * Deliberately crude — a linear sum of a channel weight and word overlap. It
 * is legible, it costs nothing to run, and with a handful of votes it already
 * beats "play whatever the search returned first", which is the bar.
 */
export function tasteScore(source) {
  if (!source) return -Infinity;
  const r = state.ratings[mediaKey(source)] || 0;
  if (r === -1) return -Infinity;
  let score = r * 3;
  if (source.channel) score += (state.channels[source.channel] || 0) * 1.5;
  const ws = tokens(source.title);
  if (ws.length) {
    const hit = ws.reduce((sum, w) => sum + (state.words[w] || 0), 0);
    score += hit / Math.sqrt(ws.length);
  }
  return score;
}

/** Channels this browser keeps thumbing up, best first. Feeds candidate lookup. */
export function likedChannels(limit = 4) {
  return Object.entries(state.channels)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

/**
 * The words this browser's thumbs weight most heavily, best first.
 *
 * This is what a COLD feed is seeded from — on launch there is no "current
 * title" to search around, and without a seed the search rung returns nothing
 * and an empty player stays empty. Someone who keeps thumbing up grime tracks
 * has "grime" sitting at the top of this list, which is a far better opening
 * question than whatever the index would hand back for an empty string.
 */
export function likedWords(limit = 6) {
  return Object.entries(state.words)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

/** Has this browser voted at all? Decides whether to lean on the platform pool. */
export const hasTaste = () => Object.keys(state.ratings).length > 0;

/** Wipe the profile. Offered in the UI — a taste profile you can't delete is a dossier. */
export function forgetTaste() {
  commit({ ratings: {}, channels: {}, words: {} });
}

// ── the anonymous half ──────────────────────────────────────────────────────
// One counter bump per transition. No identifier of any kind travels with it;
// `keepalive` lets it survive the page being closed straight after a vote.
function signal(source, from, to) {
  const key = mediaKey(source);
  if (!key || from === to) return;
  try {
    fetch(`${BACKEND}/api/media/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        key,
        from,
        to,
        kind: source.kind,
        title: source.title,
        pageUrl: source.pageUrl,
        poster: source.poster,
        channel: source.channel,
      }),
    }).catch(() => { /* offline — the local profile still stands */ });
  } catch { /* fetch unavailable */ }
}

/** A play is a weak signal, but it's the only one most people ever give. */
export function signalPlay(source) {
  const key = mediaKey(source);
  if (!key) return;
  try {
    fetch(`${BACKEND}/api/media/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        key, play: true, kind: source.kind, title: source.title,
        pageUrl: source.pageUrl, poster: source.poster, channel: source.channel,
      }),
    }).catch(() => {});
  } catch { /* noop */ }
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const getVersion = () => version;

/** Re-renders on any vote. Returns the rating currently on `source`. */
export function useRating(source) {
  useSyncExternalStore(subscribe, getVersion, () => 0);
  return ratingOf(source);
}
