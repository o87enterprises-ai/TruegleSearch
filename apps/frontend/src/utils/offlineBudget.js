// OFFLINE STORAGE MATH — pure functions, no browser APIs, so they are unit-testable.
//
// Songs saved for offline play live in this browser's storage, which is shared with
// everything else the browser keeps for Truegle. `navigator.storage.estimate()` reports the
// origin's quota and usage; we never fill it to the brim (the page itself, the service-worker
// cache and map tiles need room too), so a slice is held back as headroom.

export const HEADROOM = 0.1; // keep 10% of the quota free
export const MIN_HEADROOM_BYTES = 50 * 1024 * 1024; // …and never less than 50 MB

/**
 * @param {{quota?: number, usage?: number}} estimate  from navigator.storage.estimate()
 * @returns {{quota: number, usage: number, free: number, usable: number, known: boolean}}
 *   `usable` is what a save may still consume; 0 when the estimate is unavailable (known=false)
 *   would be too strict, so unknown storage reports Infinity and the browser's own
 *   QuotaExceededError is the backstop.
 */
export function computeBudget(estimate) {
  const quota = Number(estimate?.quota) || 0;
  const usage = Number(estimate?.usage) || 0;
  if (!quota) return { quota: 0, usage, free: Infinity, usable: Infinity, known: false };
  const free = Math.max(0, quota - usage);
  const reserve = Math.max(quota * HEADROOM, MIN_HEADROOM_BYTES);
  return { quota, usage, free, usable: Math.max(0, free - reserve), known: true };
}

/** Does a file of `size` bytes fit in the usable budget? Unknown size is allowed (checked later). */
export function fits(size, usable) {
  if (!Number.isFinite(usable)) return true;
  if (!Number.isFinite(size) || size <= 0) return true;
  return size <= usable;
}

/** Only direct audio/video links can be kept; embeds (YouTube, Vimeo, TikTok…) never expose a file. */
export function isDirectMedia(item) {
  if (!item || typeof item.src !== 'string') return false;
  if (item.kind !== 'audio' && item.kind !== 'video') return false;
  if (item.src.startsWith('tglocal:') || item.src.startsWith('blob:')) return false;
  return /^https?:\/\//i.test(item.src);
}

/**
 * Splits a list into what to try saving, what is already on the device, and what can never be
 * saved (embeds). `have` is a Set of origin URLs already stored.
 */
export function partitionList(items, have = new Set()) {
  const todo = [];
  const already = [];
  const online = [];
  for (const it of items || []) {
    if (!it || typeof it.src !== 'string') continue;
    if (it.src.startsWith('tglocal:') || have.has(it.src)) already.push(it);
    else if (isDirectMedia(it)) todo.push(it);
    else online.push(it);
  }
  return { todo, already, online };
}

/** "412 MB", "1.3 GB" — one decimal above 1 GB, none below. */
export function formatBytes(n) {
  if (!Number.isFinite(n)) return '—';
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 ** 2) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 ** 3) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}
