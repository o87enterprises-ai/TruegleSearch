import { useSyncExternalStore } from 'react';
import { mediaKey } from './videoEmbed';

// What you actually watched, so you can put it back on.
//
// NOT the same thing as PlayerContext's `history`. That is the back-stack for
// the Prev button: prev() POPS from it and hands the item back to the queue, so
// walking backwards two tracks erases the fact that you ever played them. It is
// also capped at 20 and shares a localStorage entry with the queue. Useful for
// what it does; useless as "what did I watch yesterday".
//
// This is the append-only log instead: every distinct piece of media that
// actually started playing, newest first, with enough of the source to play it
// again without another search.
//
// Local only. It is a record of what someone watched — the single most
// sensitive thing this player holds — so it is written to their device and
// nowhere else, and clearWatchHistory() really does destroy it.
const KEY = 'truegle_watch_history_v1';
const CAP = 200;

// Only what's needed to replay it. Storing the whole source object would drag
// along playToken and whatever else the reducer hangs on an entry.
const trim = (s, at) => ({
  key: mediaKey(s),
  src: s.src,
  kind: s.kind,
  title: s.title || '',
  pageUrl: s.pageUrl || '',
  poster: s.poster || '',
  channel: s.channel || '',
  at,
});

// A blob: URL from a device file dies with the document that made it, so
// persisting one would restore an entry that can never play.
const replayable = (e) => !!e && typeof e.src === 'string' && !e.src.startsWith('blob:');

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return Array.isArray(raw) ? raw.filter(replayable).slice(0, CAP) : [];
  } catch {
    return [];
  }
}

let entries = read();
// A version counter rather than the array: useSyncExternalStore compares
// snapshots by identity, and a fresh array on every read loops forever.
let version = 0;
const listeners = new Set();

function commit(next) {
  entries = next;
  version += 1;
  try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* private mode */ }
  listeners.forEach((fn) => fn());
}

/**
 * Record that this started playing. Watching something again moves it to the
 * top and updates its timestamp rather than adding a second row — a history
 * with the same video in it eleven times is a log, not a history.
 */
export function recordWatch(source) {
  const key = mediaKey(source);
  if (!key || !replayable(source)) return;
  const now = Date.now();
  const rest = entries.filter((e) => e.key !== key);
  // Nothing changed except the timestamp and it was already on top — skip the
  // write so a re-render can't turn into a localStorage loop.
  if (rest.length === entries.length - 1 && entries[0]?.key === key && now - (entries[0].at || 0) < 1000) return;
  commit([trim(source, now), ...rest].slice(0, CAP));
}

export const watchHistory = () => entries;

export function removeFromHistory(key) {
  const next = entries.filter((e) => e.key !== key);
  if (next.length !== entries.length) commit(next);
}

export function clearWatchHistory() {
  if (entries.length) commit([]);
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const getVersion = () => version;
const serverVersion = () => 0;

/** Re-renders whenever anything is watched or removed. */
export function useWatchHistory() {
  useSyncExternalStore(subscribe, getVersion, serverVersion);
  return entries;
}
