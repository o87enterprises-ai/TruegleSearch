import { mediaKey } from './videoEmbed';
import { byNewest, publishedAt } from './published';

// How a page of Tube results is ordered, and the honest limits of each order.
//
// THREE SORTS, AND ONLY ONE OF THEM IS FREE:
//
//   Relevant — the order the search already produced (rankPlayable). No work.
//   Newest   — by publish date. Real, but only for rows that HAVE one; the
//              index supplies it for some providers and not others, so undated
//              rows go last rather than being guessed at.
//   Popular  — by Truegle's OWN anonymous play and 👍/👎 counts. It is NOT a
//              view count: the search index returns none, and YouTube's own
//              would cost a quota unit per video against an allowance shared
//              by the whole site. The label says "Popular on Truegle" for
//              exactly that reason — implying it was the platform's number
//              would be a lie, and a checkable one.
//
// Rows with no popularity signal keep their relevance order BELOW the ones
// that have it. Treating "no signal" as zero would rank a video nobody has
// touched beneath one with a single thumb, which is a strong claim to build on
// one press.

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export const SORTS = [
  { id: 'relevant', label: 'Relevant' },
  { id: 'newest', label: 'Newest' },
  { id: 'popular', label: 'Popular' },
];
export const SORT_IDS = new Set(SORTS.map((s) => s.id));

/** Does this set of rows carry enough dates for a date sort to mean anything? */
export const datedCount = (rows) =>
  (rows || []).filter((r) => publishedAt(r?.published) !== null).length;

/**
 * Apply a sort. Pure, and never mutates the input.
 *
 * @param {Array} rows player sources
 * @param {'relevant'|'newest'|'popular'} sort
 * @param {Object<string, number>} scores media key → Truegle popularity
 */
export function sortResults(rows, sort, scores = {}) {
  const list = Array.isArray(rows) ? rows : [];
  if (sort === 'newest') return [...list].sort(byNewest);
  if (sort === 'popular') {
    // Stable within each group: `index` preserves the relevance order for rows
    // that tie, and for the whole unscored tail.
    return list
      .map((row, index) => ({ row, index, score: scores[mediaKey(row) || row.src] }))
      .sort((a, b) => {
        const aHas = typeof a.score === 'number';
        const bHas = typeof b.score === 'number';
        if (aHas !== bHas) return aHas ? -1 : 1;
        if (aHas && bHas && a.score !== b.score) return b.score - a.score;
        return a.index - b.index;
      })
      .map((x) => x.row);
  }
  // A COPY, even though nothing is reordered. Returning the caller's own array
  // for the default sort means any consumer that later reverses or splices the
  // "sorted" list silently rewrites the search results it came from — the one
  // path out of here that could do that, and the one nobody would look at.
  return [...list];
}

/**
 * Truegle's popularity for these rows. Never throws and never rejects — a
 * popularity sort that cannot reach the backend falls back to the order it
 * already had, which is a worse sort, not an error the reader has to deal with.
 */
export async function fetchScores(rows, signal) {
  const keys = [...new Set((rows || []).map((r) => mediaKey(r) || r?.src).filter(Boolean))].slice(0, 100);
  if (keys.length === 0) return {};
  try {
    const res = await fetch(`${BACKEND}/api/media/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
      signal,
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.scores || {};
  } catch {
    return {};
  }
}
