import { getPlayable } from './videoEmbed';
import { playlists } from './playlists';

// RESULT ROWS FOR THE "LISTS" SCOPE.
//
// Two kinds, both shaped like any other player source (kind / src / title /
// poster / channel / pageUrl) so every list, card and deck that already shows
// results can show them — plus the fields that say what tapping one DOES:
//
//   savedListId  one of YOUR lists. Play = playList(its items), no network.
//   playlistUrl  a public playlist. Play = Play All (usePlayAll → imports the
//                tracks, then plays them). Never the YouTube playlist embed,
//                which shows "This video is unavailable" here.
//
// `isList` marks both, so a renderer can swap Play now / Add for ListRowActions.

const norm = (s) => String(s || '').toLowerCase();

/**
 * Your saved lists, as rows.
 *
 * `onlyMatches` true (the default — what the search ladder wants): just the lists
 * whose name or any track title matches the query.
 * `onlyMatches` false: EVERY list, matches first. This is what the Lists scope
 * shows under the player — your lists are always there (owner, 2026-10-23), a
 * typed query only decides which float to the top.
 */
function listRows(query, onlyMatches) {
  const q = norm(query).trim();
  if (onlyMatches && q.length < 2) return [];
  const rows = [];
  for (const list of playlists()) {
    if (!list.items.length) continue;
    const byName = q.length >= 2 && norm(list.name).includes(q);
    const byTrack = !byName && q.length >= 2 && list.items.some((it) => norm(it.title).includes(q));
    if (onlyMatches && !byName && !byTrack) continue;
    const first = list.items[0];
    rows.push({
      kind: first.kind || 'youtube',
      src: first.src,
      title: list.name,
      channel: `${list.items.length} saved video${list.items.length === 1 ? '' : 's'}`,
      poster: first.poster || '',
      pageUrl: `truegle-list:${list.id}`,
      savedListId: list.id,
      listCount: list.items.length,
      origin: list.origin || null,
      isList: true,
      _rank: byName ? 0 : (byTrack ? 1 : 2),
    });
  }
  return rows.sort((a, b) => a._rank - b._rank).map(({ _rank, ...row }) => row);
}

/** Your saved lists whose name — or any track title — matches the query. */
export const savedListRows = (query) => listRows(query, true);

/** EVERY saved list, the ones matching the query first. */
export const allSavedListRows = (query) => listRows(query, false);

/** /api/creators/playlists/search rows → player-source-shaped list rows. */
export function publicListRows(playlistsFound) {
  return (playlistsFound || []).map((p) => {
    const url = p.url || `https://www.youtube.com/playlist?list=${p.playlistId}`;
    const base = getPlayable(url);
    return {
      kind: 'youtube',
      src: base?.src || url,
      title: p.title || 'YouTube playlist',
      channel: p.channel || null,
      poster: p.thumbnail || '',
      pageUrl: url,
      playlistUrl: url,
      listCount: p.count || null,
      isList: true,
    };
  });
}
