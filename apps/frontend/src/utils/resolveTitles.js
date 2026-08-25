import { mediaKey } from './videoEmbed.js';
import { learnMeta, metaFor } from './mediaMeta.js';

/* ── Filling in the titles a packed link could not carry ────────────────────
 *
 * A packed share link (playerLinkPack) carries a host code and an id, which is
 * what turns 3,900 characters into 353. Titles are the other half of that
 * length and cannot be derived from an id, so the recipient of a shared queue
 * sees `titleFromUrl` fallbacks — "youtube.com/watch", twenty-five times. The
 * link works perfectly; it just reads like a bug.
 *
 * This asks OUR backend (which asks the provider's keyless oEmbed endpoint) for
 * the real ones. Never the provider directly: that would tell YouTube the
 * visitor's IP is looking at a video before they have played it, and the CSP
 * blocks it anyway. See services/OembedService.js.
 *
 * WHAT IT WILL NOT DO: resolve a whole queue the instant it loads. That is one
 * request naming every track somebody was sent, before they have chosen to play
 * any of them, and it is the difference between "we looked up what you are
 * watching" and "we enumerated your friend's playlist". Callers pass the small
 * window they are actually showing.
 *
 * Results land in mediaMeta, the same store playback already writes duration
 * and channel into, so a title resolved once is remembered and every later
 * appearance of that track shows it.
 */

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// In-flight and settled keys, so a list that re-renders while a request is open
// does not fire the same lookup again.
const pending = new Set();
const asked = new Set();

/**
 * Does this source still need a title?
 *
 * A source "needs" one when what it is showing is a URL rather than a name —
 * which is exactly what titleFromUrl produces: host + path, no spaces, and the
 * host is in it. Deliberately conservative: a real title that happens to look
 * like this is rare, and re-resolving one costs a request, while wrongly
 * REPLACING a good title would be worse than leaving a scruffy one.
 */
export function needsTitle(source) {
  if (!source) return false;
  if (metaFor(source)?.t) return false;           // already learned
  const title = String(source.title || '').trim();
  if (!title) return true;
  if (/\s/.test(title)) return false;             // has a space -> a real title
  let host = '';
  try { host = new URL(source.pageUrl || source.url || source.src).hostname.replace(/^www\./, ''); }
  catch { return false; }
  return !!host && title.startsWith(host);
}

/** The best title we have for a source right now, learned or original. */
export function bestTitle(source) {
  return metaFor(source)?.t || source?.title || '';
}

/**
 * Resolve titles for the given sources, skipping any that do not need one.
 * Fire-and-forget: results arrive in mediaMeta and re-render subscribers.
 *
 * @param {object[]} sources
 * @param {number} [limit] how many to resolve in this pass — see the header
 *   note on why a whole queue is not resolved at once.
 */
export async function resolveTitles(sources, limit = 8) {
  const wanted = [];
  for (const s of sources || []) {
    if (wanted.length >= limit) break;
    const url = s?.pageUrl || s?.url;
    if (!url || !needsTitle(s)) continue;
    const key = mediaKey(s) || url;
    if (pending.has(key) || asked.has(key)) continue;
    pending.add(key);
    wanted.push({ url, key, source: s });
  }
  if (wanted.length === 0) return;

  try {
    const response = await fetch(`${BACKEND}/api/media/titles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: wanted.map((w) => w.url) }),
    });
    if (!response.ok) throw new Error(`titles ${response.status}`);
    const { titles } = await response.json();

    for (const w of wanted) {
      const found = titles?.[w.url];
      // Mark as asked either way. A track with no title available (private,
      // deleted, embedding off) must not be re-asked on every render — the
      // backend caches the miss too, but not asking at all is cheaper.
      asked.add(w.key);
      if (!found?.title) continue;
      learnMeta(w.source, { title: found.title, channel: found.author || undefined });
    }
  } catch {
    // Cosmetic. A queue with fallback titles is still a working queue, so a
    // failure here is silent — and NOT marked asked, so a later pass can retry.
  } finally {
    wanted.forEach((w) => pending.delete(w.key));
  }
}

export default resolveTitles;
