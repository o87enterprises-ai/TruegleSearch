import { CREATORS } from '../content/creators.js';

// A "creator run": when a post from a roster creator is played in the Feed, the
// player follows ONLY that creator's posts (their own feed), not the rest of the
// mixed timeline. Pure helpers; the wiring is in hooks/useFeedCursor.js.

// Backend stamps these on roster rows (routes/creators.js, PodcastVideoService).
const CREATOR_PLATFORMS = new Set(['Truegle Creators', 'Podcasts']);

/** The roster creator a feed row belongs to, or null (not a roster post). */
export function creatorOf(row) {
  if (!row || !CREATOR_PLATFORMS.has(row.platform) || !row.author) return null;
  return CREATORS.find((c) => c.name === row.author) || null;
}

/**
 * The creator's feed in play order: the posts AFTER the clicked one first (in
 * feed order), then the ones before it, so it plays on from where you tapped
 * and then catches up on the rest. The clicked post itself is excluded (it is
 * already playing). Items are matched on `pageUrl`.
 */
export function playOrder(sources, clickedPageUrl) {
  const list = (sources || []).filter(Boolean);
  const i = list.findIndex((s) => s.pageUrl === clickedPageUrl);
  if (i < 0) return list;
  return [...list.slice(i + 1), ...list.slice(0, i)];
}
