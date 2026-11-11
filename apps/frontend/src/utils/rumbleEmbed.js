import { useEffect, useState } from 'react';

// RUMBLE'S EMBED ID IS NOT ITS PAGE ID (owner, 2026-11-10: "Video not found").
// rumble.com/v7hhvy2-title.html embeds as rumble.com/embed/v7fbj0k/ — the id
// in the page link answers "not found" (410). Only Rumble's oEmbed knows the
// real one, and it sends no CORS headers, so the backend asks for us
// (GET /api/embed/rumble). Until it answers the frame shows nothing; if it
// cannot answer, the old guess is kept rather than playing nothing at all.
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const known = new Map(); // page url → resolved src | null
const inflight = new Map();

export const isRumblePage = (url) => /^https:\/\/(www\.)?rumble\.com\/v[a-z0-9]+/i.test(url || '');

export function resolveRumbleSrc(pageUrl, fetchImpl = fetch) {
  if (known.has(pageUrl)) return Promise.resolve(known.get(pageUrl));
  if (inflight.has(pageUrl)) return inflight.get(pageUrl);
  const p = fetchImpl(`${BACKEND}/api/embed/rumble?url=${encodeURIComponent(pageUrl)}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (typeof d?.src === 'string' && d.src.startsWith('https://rumble.com/embed/') ? d.src : null))
    .catch(() => null)
    .then((src) => { known.set(pageUrl, src); inflight.delete(pageUrl); return src; });
  inflight.set(pageUrl, p);
  return p;
}

// The src to mount for this source: unchanged for everything but a Rumble
// clip opened from its page link, which waits for the real embed.
export function useRumbleSrc(source) {
  const page = source?.kind === 'rumble' && isRumblePage(source.pageUrl) ? source.pageUrl : null;
  const [resolved, setResolved] = useState(() => (page && known.has(page) ? { page, src: known.get(page) } : null));
  useEffect(() => {
    if (!page) return undefined;
    let live = true;
    resolveRumbleSrc(page).then((src) => { if (live) setResolved({ page, src }); });
    return () => { live = false; };
  }, [page]);
  if (!page) return source?.src;
  if (resolved?.page !== page) return 'about:blank';
  return resolved.src || source.src;
}
