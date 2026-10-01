import { getPlayable } from './videoEmbed';
import { upsertImportedPlaylist } from './playlists';

// Bringing a YouTube playlist in, whole.
//
// The ask was "captures ALL available links", and the word doing the work is
// available. Two things make that less than "all":
//
//   THE KEYLESS PATH IS CAPPED. Without a YOUTUBE_API_KEY the backend can only
//   read the playlist's RSS feed, which returns the most recent ~15 entries and
//   has no page parameter. That is a complete answer for a short playlist and a
//   partial one for a long list — and importing 15 of somebody's 200 saved
//   videos while reporting success would be the worst outcome available here,
//   because they would only discover it later, by missing something.
//
//   PRIVATE AND DELETED ENTRIES HAVE NO ID. They stay in a playlist as
//   placeholders and cannot be played by anyone, us included. They are skipped,
//   which is why an import can legitimately be smaller than the number YouTube
//   shows on the playlist.
//
// So `importPlaylist` reports what it got AND whether that was everything, and
// the UI says so rather than rounding it up to "done".

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/** Does this look like a YouTube playlist link? Cheap enough to run per keystroke. */
export function isPlaylistUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return false;
  try {
    const u = new URL(raw);
    if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(u.hostname)) return false;
    const list = u.searchParams.get('list');
    return !!list && /^[A-Za-z0-9_-]{12,64}$/.test(list);
  } catch {
    return false;
  }
}

/** A readable default name from the URL, since the feed does not always title itself. */
export function playlistNameFrom(input, videos = []) {
  const channel = videos.find((v) => v.channel)?.channel;
  if (channel) return `${channel} — playlist`;
  try {
    const list = new URL(String(input)).searchParams.get('list') || '';
    return `YouTube playlist ${list.slice(0, 8)}`;
  } catch {
    return 'YouTube playlist';
  }
}

/**
 * Fetch a playlist and save it as one of this browser's lists.
 *
 * @param {string} url what the user pasted
 * @param {{name?: string, signal?: AbortSignal}} [opts]
 * @returns {Promise<{ok: boolean, id?: string, count?: number, complete?: boolean,
 *                    source?: string, name?: string, reason?: string}>}
 *   Never throws. A failed import is a message, not an exception the caller has
 *   to catch in the middle of a paste.
 */
export async function importPlaylist(url, { name, signal } = {}) {
  if (!isPlaylistUrl(url)) return { ok: false, reason: 'not_a_playlist' };
  let data;
  try {
    const res = await fetch(`${BACKEND}/api/creators/playlist?url=${encodeURIComponent(url)}`, { signal });
    if (res.status === 404) return { ok: false, reason: 'not_found' };
    if (!res.ok) return { ok: false, reason: 'unreachable' };
    data = await res.json();
  } catch (e) {
    if (e?.name === 'AbortError') return { ok: false, reason: 'aborted' };
    return { ok: false, reason: 'unreachable' };
  }

  // Through getPlayable, exactly like a search result: a row the player cannot
  // host has no business in a list whose every entry is meant to be pressable.
  const sources = (data.videos || []).map((v) => {
    const base = getPlayable(v.url);
    return base ? {
      ...base,
      title: v.title || '',
      pageUrl: v.url,
      poster: v.thumbnail || '',
      channel: v.channel || null,
      published: v.published || null,
    } : null;
  }).filter(Boolean);

  if (sources.length === 0) return { ok: false, reason: 'empty' };

  const listName = String(name || '').trim() || playlistNameFrom(url, data.videos || []);
  // Keyed by the playlist id, so the same playlist pasted twice (or with a
  // different &si= tracking tail) refreshes one list rather than adding copies.
  const listKey = (() => { try { return `yt:${new URL(url).searchParams.get('list')}`; } catch { return url; } })();
  const id = upsertImportedPlaylist(listKey, listName, sources);
  if (!id) return { ok: false, reason: 'empty' };

  return {
    ok: true,
    id,
    name: listName,
    // The tracks themselves, so Play All can start them without a second read.
    sources,
    count: sources.length,
    // False means "there are more we could not reach", not "something failed".
    complete: data.complete !== false,
    source: data.source || 'rss',
  };
}

/** One line of plain English for whatever came back. */
export function importMessage(result) {
  if (!result) return '';
  if (result.ok) {
    const n = `${result.count} video${result.count === 1 ? '' : 's'}`;
    return result.complete
      ? `Saved ${n} to “${result.name}”.`
      : `Saved ${n} to “${result.name}” — that is everything this playlist will hand over `
        + 'without a YouTube API key, so a longer list may have more in it.';
  }
  switch (result.reason) {
    case 'not_a_playlist': return 'That is not a YouTube playlist link.';
    case 'not_found': return 'That playlist is private, deleted, or does not exist.';
    case 'empty': return 'Nothing in that playlist can play here — every entry was private, deleted, or unplayable.';
    case 'aborted': return '';
    default: return 'Could not reach that playlist just now.';
  }
}
