// `?raw` — Vite inlines the file as a string at build time. No fetch, no
// round trip, no chance of a 404 on a file the page needs to render.
import RAW from './creatorVideos.txt?raw';
import { getPlayable } from '../utils/videoEmbed.js';

/* Reader for the flat-file creator video cache. See creatorVideos.txt for why
 * it is a text file and why the embed URL is derived rather than stored.
 *
 * Parsed ONCE at module load into a slug -> videos map. The file is static for
 * the life of the bundle, so re-parsing per render would be pure waste.
 */

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

function parse(raw) {
  const bySlug = new Map();
  for (const line of String(raw || '').split('\n')) {
    const text = line.trim();
    if (!text || text.startsWith('#')) continue;

    const parts = text.split('|');
    if (parts.length < 3) continue;
    const slug = parts[0].trim();
    const id = parts[1].trim();
    // Re-join the tail: a title may legitimately contain a pipe if somebody
    // pasted one, and dropping everything after it would silently truncate.
    const title = parts.slice(2).join('|').trim();

    // A bad id would be interpolated into an embed URL, so it is checked here
    // rather than trusted — the same rule videoEmbed applies to a playlist id.
    if (!slug || !YT_ID.test(id) || !title) continue;

    const url = `https://www.youtube.com/watch?v=${id}`;
    const playable = getPlayable(url);
    if (!playable) continue;

    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push({ ...playable, id, title, url, pageUrl: url });
  }
  return bySlug;
}

const BY_SLUG = parse(RAW);

/**
 * The cached videos for a creator, or null when that channel is not in the
 * file. NULL, not [] — the caller must be able to tell "cached, and the
 * channel has no videos" from "not cached, go and ask the API".
 */
export function cachedVideos(slug) {
  const list = slug ? BY_SLUG.get(slug) : null;
  return list && list.length ? list : null;
}

/** Which creators are cached — for a build check or a coverage report. */
export const cachedSlugs = () => [...BY_SLUG.keys()];

export default cachedVideos;
