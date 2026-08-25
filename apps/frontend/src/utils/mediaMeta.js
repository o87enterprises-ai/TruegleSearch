import { useSyncExternalStore } from 'react';
import { mediaKey } from './videoEmbed';

// What we only find out by PLAYING something.
//
// A search result carries a title and sometimes a thumbnail. It almost never
// carries a duration, because the index doesn't have one — and there is no
// free API that will tell us for an arbitrary URL. But the embed tells us the
// moment it starts: `useEmbedPlayback` already reads duration off the
// postMessage channel for the progress bar.
//
// So the list learns. Play something once and its length is remembered against
// its media key, and every future appearance of that track in a result list
// shows it — including in somebody else's search later in the same session.
// Cheap, honest, and it fills in exactly the field people miss.
const KEY = 'truegle_media_meta_v1';

const read = () => {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || '{}');
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
};

let meta = read();
let version = 0;
const listeners = new Set();

/**
 * Remember what playback — or a title lookup — taught us. Only writes when
 * something changed.
 *
 * `title` was added for PACKED SHARE LINKS. Those carry an id and no title (it
 * is where the 87% length saving comes from), so a shared queue arrives showing
 * "youtube.com/watch" until something fills it in. utils/resolveTitles asks our
 * backend and lands the answer here, which means it is remembered like duration
 * and channel: resolved once, shown everywhere that track appears afterwards.
 */
export function learnMeta(source, { duration, channel, title } = {}) {
  const key = mediaKey(source);
  if (!key) return;
  const prev = meta[key] || {};
  const next = { ...prev };
  // A duration of 0 is "not known yet", not "zero seconds".
  if (typeof duration === 'number' && duration > 0 && Math.round(duration) !== prev.d) next.d = Math.round(duration);
  if (channel && channel !== prev.c) next.c = String(channel).slice(0, 80);
  if (title && title !== prev.t) next.t = String(title).slice(0, 200);
  if (next.d === prev.d && next.c === prev.c && next.t === prev.t) return;

  meta = { ...meta, [key]: next };
  // Bounded: this is a convenience cache, not a library.
  const keys = Object.keys(meta);
  if (keys.length > 600) keys.slice(0, keys.length - 600).forEach((k) => { delete meta[k]; });
  try { localStorage.setItem(KEY, JSON.stringify(meta)); } catch { /* private mode */ }
  version += 1;
  listeners.forEach((fn) => fn());
}

export const metaFor = (source) => meta[mediaKey(source)] || null;

/** 143 -> "2:23", 3725 -> "1:02:05". */
export function formatDuration(secs) {
  const n = Math.round(Number(secs) || 0);
  if (n <= 0) return null;
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  const pad = (v) => String(v).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const getVersion = () => version;

/** Re-renders when anything new is learned. */
export function useMediaMeta() {
  useSyncExternalStore(subscribe, getVersion, () => 0);
  return metaFor;
}
