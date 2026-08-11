import { mediaKey } from './videoEmbed';

// How the feed chooses, separated from how it fetches.
//
// Pure functions over already-fetched candidates: no React, no network, no
// browser. useUpNext does the three lookups and hands the results here, which
// is the only reason this part can be tested at all (see
// scripts/verify-player.mjs).

// How many of the top-scoring candidates are eligible for the random draw. Too
// small and it's argmax with extra steps; too large and a genuinely bad match
// gets a real chance at the slot. Ten is enough to make repeats rare across a
// long sitting while still being the top decile of what came back.
export const POOL = 10;

/**
 * Keep the usable candidates with their final score, best first.
 * @param candidates [{ s, boost }]
 * @param usable     (source) => boolean — the seen/disliked/duplicate filter
 * @param scoreOf    (source) => number  — the taste score; -Infinity to exclude
 */
export function scoreCandidates(candidates, usable, scoreOf) {
  const out = [];
  for (const { s, boost } of candidates || []) {
    if (!usable(s)) continue;
    const value = scoreOf(s) + (boost || 0);
    if (!Number.isFinite(value)) continue;
    out.push({ s, value });
  }
  return dedupeScored(out).sort((a, b) => b.value - a.value);
}

/**
 * The channel feed and the platform pool routinely surface the same upload, and
 * a duplicate in the pool would double its odds in the draw. Keeps the
 * higher-scoring copy.
 */
export function dedupeScored(scored) {
  const byKey = new Map();
  for (const entry of scored || []) {
    const k = mediaKey(entry.s);
    if (!k) continue;
    const held = byKey.get(k);
    if (!held || entry.value > held.value) byKey.set(k, entry);
  }
  return [...byKey.values()];
}

/**
 * Draw `count` distinct candidates from the top of the list, with better
 * scores getting proportionally better odds.
 *
 * WHY NOT ARGMAX: taking the single highest-scoring candidate is a pure
 * function of a profile that barely moves between swipes, so swiping away from
 * a video and swiping back handed you the identical "next" one. Scores still
 * decide the ODDS — this is not "play something random", it is "pick among the
 * good ones".
 *
 * Weights are shifted so the WORST candidate in the pool still has a non-zero
 * chance: taste scores are signed (a channel you've never rated sits at 0, one
 * you've thumbed down is excluded long before this), and a raw negative score
 * would make a naive weighted draw either throw or silently always return the
 * same item.
 *
 * @param rand injectable for the test; Math.random in real use.
 */
export function draw(scored, count = 1, rand = Math.random) {
  const pool = (scored || []).slice(0, POOL);
  if (!pool.length) return [];
  const min = Math.min(...pool.map((e) => e.value));
  // +1 so an all-equal pool (everyone at 0, the common cold-start case) is a
  // uniform draw rather than a division by zero.
  const weighted = pool.map((e) => ({ s: e.s, w: e.value - min + 1 }));

  const out = [];
  for (let n = 0; n < count && weighted.length; n += 1) {
    const total = weighted.reduce((sum, e) => sum + e.w, 0);
    let r = rand() * total;
    let idx = weighted.length - 1;
    for (let i = 0; i < weighted.length; i += 1) {
      r -= weighted[i].w;
      if (r <= 0) { idx = i; break; }
    }
    out.push(weighted[idx].s);
    weighted.splice(idx, 1); // without replacement — no duplicates in one batch
  }
  return out;
}
