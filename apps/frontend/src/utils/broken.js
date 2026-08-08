import { useSyncExternalStore } from 'react';
import { mediaKey } from './videoEmbed';

// "This one doesn't play."
//
// A search result can look perfectly playable and be dead: the upload was
// removed, the uploader disabled embedding, it is region-locked, or the host
// 404s inside the iframe. None of that is visible from the URL, so
// getPlayable() cannot filter it — every visitor finds out the same way, by
// pressing play and getting a black rectangle.
//
// TWO LAYERS, mirroring taste.js:
//
//   1. YOUR report takes effect instantly, in your browser, and is never sent
//      with anything identifying attached. A thing you flagged is gone from
//      your lists before the request has even left.
//   2. The PLATFORM aggregates the same reports anonymously. Once enough
//      people (or the embeds themselves) call a key dead it stops being
//      offered to anyone, and every visitor fetches that blocklist once and
//      filters against it locally.
//
// Reversible on purpose: a region lock is dead for some viewers and fine for
// others, so the threshold scales with how many people liked it, and this is a
// filter rather than a delete.
const KEY = 'truegle_broken_v1';
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const read = () => {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
};

let mine = read();
let platform = new Set();
let version = 0;
const listeners = new Set();

const bump = () => { version += 1; listeners.forEach((fn) => fn()); };

/** Is this thing known not to play? */
export function isBroken(source) {
  const k = mediaKey(source);
  return !!k && (mine.has(k) || platform.has(k));
}

/**
 * Report a source as unplayable.
 * @param auto true when the EMBED told us (an error event), false when a
 *   person pressed the flag. Both count the same platform-side; the
 *   distinction exists so an automatic report never shows a toast at someone
 *   who didn't do anything.
 */
export function reportBroken(source, { auto = false } = {}) {
  const key = mediaKey(source);
  if (!key || mine.has(key)) return false;
  mine.add(key);
  try { localStorage.setItem(KEY, JSON.stringify([...mine].slice(-400))); } catch { /* private mode */ }
  bump();

  try {
    fetch(`${BACKEND}/api/media/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        key,
        broken: true,
        kind: source.kind,
        title: source.title,
        pageUrl: source.pageUrl,
        channel: source.channel,
      }),
    }).catch(() => { /* offline — the local flag still stands */ });
  } catch { /* fetch unavailable */ }
  return !auto;
}

/** Undo a report — a region lock lifts, an upload comes back. */
export function unreportBroken(source) {
  const key = mediaKey(source);
  if (!key || !mine.delete(key)) return;
  try { localStorage.setItem(KEY, JSON.stringify([...mine])); } catch { /* noop */ }
  bump();
}

export const reportedByMe = (source) => {
  const k = mediaKey(source);
  return !!k && mine.has(k);
};

// The platform blocklist. Fetched once per page load — it changes on the scale
// of days, and re-asking per search would be a request per keystroke.
let loaded = false;
export function loadBrokenList() {
  if (loaded) return;
  loaded = true;
  fetch(`${BACKEND}/api/media/broken`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d?.keys?.length) return;
      platform = new Set(d.keys);
      bump();
    })
    .catch(() => { /* the local set still filters */ });
}

/** Drop everything known-dead from a result list. */
export const withoutBroken = (rows) => (rows || []).filter((r) => !isBroken(r));

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const getVersion = () => version;

/**
 * Subscribe to the blocklist itself. A list filtered only at FETCH time keeps
 * showing a row you just flagged until the next search — the report worked,
 * the screen disagreed. Anything rendering results calls this so it re-filters
 * the moment something is flagged, or the moment the platform list lands.
 */
export function useBrokenVersion() {
  return useSyncExternalStore(subscribe, getVersion, () => 0);
}

/** Re-renders when anything is flagged. Returns whether THIS browser flagged it. */
export function useBrokenFlag(source) {
  useSyncExternalStore(subscribe, getVersion, () => 0);
  return reportedByMe(source);
}
