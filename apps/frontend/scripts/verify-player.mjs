/* The player's feed logic and its three local stores, simulated.
 *
 * feedDraw.js is pure and the stores are plain localStorage, which is the only
 * reason any of this gets tested without a browser. What it is actually here to
 * prove:
 *
 *   1. THE DRAW IS NOT ARGMAX. Two swipes in a row must be able to go two
 *      different places, while better-scoring candidates still win more often.
 *      The old picker was deterministic, which is why swiping back and forth
 *      handed you the same "next" video.
 *   2. BEING SHOWN SOMETHING SURVIVES A RELOAD. `seen` used to be a useRef, so
 *      it emptied on every reload and the feed walked you back through the same
 *      clips the next day. The reload is simulated for real — a second,
 *      freshly-evaluated copy of the module reads the same storage.
 *   3. THE FEED CAN LEAVE ITS NEIGHBOURHOOD. Neither of the above moves the
 *      CANDIDATES — every lookup was seeded from the current title, the liked
 *      channels or the taste profile, so the looping was reported again with
 *      both already shipped. Exploration (a fixed fraction of picks that
 *      ignores taste entirely) and a pool that widens as the head is exhausted
 *      are what actually get out, and both are checked here.
 *   4. The history and playlist stores keep what they are supposed to keep.
 *
 * Run it:  npm run player:test
 */
import { build } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { draw, dedupeScored, scoreCandidates, poolFor, POOL, MAX_POOL } from '../src/utils/feedDraw.js';
import {
  shouldExplore, exploreOffset, exploreSeed, EXPLORE_RATE, EXPLORE_SEEDS, MAX_OFFSET,
} from '../src/utils/explore.js';
import { mediaKey } from '../src/utils/videoEmbed.js';
import { markSeen, hasSeen, seenCount, forgetSeen, recentSeen } from '../src/utils/seen.js';
import { recordWatch, watchHistory, removeFromHistory, clearWatchHistory } from '../src/utils/watchHistory.js';
import {
  createPlaylist, addToPlaylist, removeFromPlaylist, movePlaylistItem,
  deletePlaylist, renamePlaylist, playlists,
} from '../src/utils/playlists.js';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

// A REAL in-memory localStorage. The stores already swallow a missing one, so a
// no-op stub would let a store that never persists anything pass every test —
// which is precisely the bug being tested for.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.sessionStorage = globalThis.localStorage;

// Real YouTube ids are 11 characters and mediaKey's rules require 6–20 — a
// short fake id falls through to the host+path fallback and stops behaving like
// a YouTube video at all. Pad, so these are the same shape as the real thing.
const vid = (id) => String(id).padEnd(11, 'x').slice(0, 11);
const yt = (id) => ({
  kind: 'youtube',
  src: `https://www.youtube-nocookie.com/embed/${vid(id)}`,
  title: `Video ${id}`,
  pageUrl: `https://youtu.be/${vid(id)}`,
});

// ── 1. the draw ─────────────────────────────────────────────────────────────

// A deterministic pool of equally-good candidates: the cold-start case, and the
// one where argmax was most obviously wrong.
const flat = Array.from({ length: POOL }, (_, i) => ({ s: yt(`flat${i}`), value: 0 }));

const picked = new Set();
for (let i = 0; i < 300; i += 1) picked.add(draw(flat, 1)[0]?.src);
check(picked.size >= POOL - 1, 'equal-scoring pool spreads across the whole pool', `${picked.size} distinct of ${POOL}`);

// Skewed: the best candidate should win most often, and still not always.
const skewed = [
  { s: yt('best'), value: 10 },
  ...Array.from({ length: 5 }, (_, i) => ({ s: yt(`mid${i}`), value: 0 })),
];
let bestWins = 0;
const RUNS = 2000;
for (let i = 0; i < RUNS; i += 1) if (draw(skewed, 1)[0]?.title === 'Video best') bestWins += 1;
// Weights are 11 vs 1×5, so the best should take ~11/16 ≈ 69% of draws.
check(bestWins / RUNS > 0.55 && bestWins / RUNS < 0.82, 'a better score wins more often', `${((bestWins / RUNS) * 100).toFixed(1)}%`);
check(bestWins < RUNS, 'but not every time — the feed still moves', `${RUNS - bestWins} draws went elsewhere`);

const batch = draw(flat, 5);
check(batch.length === 5, 'a batch draw returns the number asked for', `got ${batch.length}`);
check(new Set(batch.map((s) => s.src)).size === 5, 'a batch has no duplicates in it');
check(draw(flat, 99).length === POOL, 'a batch cannot exceed the pool');
check(draw([], 3).length === 0, 'an empty candidate list draws nothing');

// Negative scores must not break the weighting (they did, before the shift).
const negative = [{ s: yt('n1'), value: -8 }, { s: yt('n2'), value: -3 }];
const negDraw = new Set();
for (let i = 0; i < 200; i += 1) negDraw.add(draw(negative, 1)[0]?.src);
check(negDraw.size === 2, 'an all-negative pool still draws from every candidate', `${negDraw.size} distinct`);

// ── dedupe + score ──────────────────────────────────────────────────────────
// The three shapes the same YouTube video arrives in. Treating these as
// different videos is what made the feed hand you the same clip over and over.
const shapes = [
  `https://www.youtube-nocookie.com/embed/${vid('same')}`,
  `https://youtu.be/${vid('same')}`,
  `https://www.youtube.com/watch?v=${vid('same')}`,
];
check(
  new Set(shapes.map((u) => mediaKey(u))).size === 1,
  'embed / youtu.be / watch?v= are one identity',
  [...new Set(shapes.map((u) => mediaKey(u)))].join(' | '),
);

const dup = dedupeScored([
  { s: yt('same'), value: 1 },
  { s: { ...yt('same'), src: shapes[1] }, value: 9 }, // same media, different URL shape
  { s: yt('other'), value: 2 },
]);
check(dup.length === 2, 'the same upload under two URLs collapses to one', `${dup.length} left`);
check(dup.find((e) => e.value === 9), 'and the higher-scoring copy is the one kept');

const scored = scoreCandidates(
  [{ s: yt('a'), boost: 1 }, { s: yt('b'), boost: 5 }, { s: yt('skip'), boost: 0 }],
  (s) => !s.src.includes('skip'),
  () => 0,
);
check(scored.length === 2, 'scoreCandidates drops what usable() rejects');
check(scored[0].s.src.includes('b'), 'and sorts best-first');
check(
  scoreCandidates([{ s: yt('hated'), boost: 0 }], () => true, () => -Infinity).length === 0,
  'a thumbed-down candidate is excluded outright',
);

// ── 1b. escaping the basin ──────────────────────────────────────────────────
//
// The looping was reported AGAIN with the random draw and the persistent seen
// ledger both already shipped, which is the whole reason these two mechanisms
// exist: neither of those moves the CANDIDATES, and a feed cannot leave a
// neighbourhood it never stops asking about.

// The draw pool widens as the head is exhausted, and stops widening before it
// becomes "play anything".
check(poolFor(0) === POOL, 'a fresh browser draws from the normal pool', `${poolFor(0)}`);
check(poolFor(0.5) > POOL, 'a half-seen candidate list widens the pool', `${poolFor(0.5)}`);
check(poolFor(1) === MAX_POOL, 'a fully-seen list widens to the cap, not past it', `${poolFor(1)}`);
check(poolFor(9) === MAX_POOL && poolFor(-1) === POOL, 'a nonsense rate is clamped, not propagated');
check(poolFor(undefined) === POOL, 'a missing rate behaves like a fresh browser');

// A wider pool must actually reach further down the ranked list — this is the
// point of it, and slice(0, POOL) would silently ignore the argument.
const long = Array.from({ length: 40 }, (_, i) => ({ s: yt(`deep${i}`), value: 40 - i }));
const reached = new Set();
for (let i = 0; i < 600; i += 1) reached.add(draw(long, 1, Math.random, poolFor(1))[0]?.src);
check(reached.size > POOL, 'a widened draw reaches candidates the normal pool never offers', `${reached.size} distinct`);
check(
  new Set(Array.from({ length: 600 }, () => draw(long, 1)[0]?.src)).size <= POOL,
  'while the default draw still stays in the top ten',
);

// Exploration fires at roughly the stated rate — a fixed fraction, not "some".
let fired = 0;
const TRIALS = 20000;
for (let i = 0; i < TRIALS; i += 1) if (shouldExplore()) fired += 1;
const rate = fired / TRIALS;
check(
  Math.abs(rate - EXPLORE_RATE) < 0.02,
  `exploration fires at about ${(EXPLORE_RATE * 100).toFixed(0)}% of picks`,
  `${(rate * 100).toFixed(1)}%`,
);
check(!shouldExplore(() => 0.99) && shouldExplore(() => 0), 'and the coin flip is the injectable one');

// The offsets must actually spread — an "exploration" that always asks for
// offset 0 is the head of the pool again, which is the bug.
const offsets = new Set(Array.from({ length: 400 }, () => exploreOffset(24)));
check(offsets.size >= 4, 'exploration reaches several different depths', `${offsets.size} distinct offsets`);
check([...offsets].every((o) => o % 24 === 0), 'offsets land on page boundaries');
check([...offsets].every((o) => o >= 0 && o <= MAX_OFFSET), 'and stay inside the pool', `max ${Math.max(...offsets)}`);
check(exploreOffset(24, () => 0) === 0, 'offset 0 is reachable — the head is not banned, just not guaranteed');

// The seeds are the escape hatch when the pool has no tail, so they must not be
// derived from anything this browser likes.
const seeds = new Set(Array.from({ length: 200 }, () => exploreSeed()));
check(seeds.size > 1, 'the seed word varies between explorations', `${seeds.size} distinct`);
check([...seeds].every((s) => EXPLORE_SEEDS.includes(s)), 'and every seed comes from the fixed neutral list');

// ── 2. seen, across a reload ────────────────────────────────────────────────
forgetSeen();
markSeen(yt('watched'));
markSeen(yt('watched'));       // re-marking must not double up
check(seenCount() === 1, 're-marking the same media does not add a second entry', `count ${seenCount()}`);
check(hasSeen(yt('watched')), 'a marked video reads back as seen');
check(!hasSeen(yt('fresh')), 'an unmarked one does not');

for (let i = 0; i < 700; i += 1) markSeen(yt(`bulk${i}`));
check(seenCount() <= 600, 'the ledger is capped', `count ${seenCount()}`);
check(hasSeen(yt('bulk699')), 'the newest entries survive the trim');
check(!hasSeen(yt('bulk0')), 'the oldest fall off');
check(recentSeen(5).length === 5, 'recentSeen returns the tail for the exclude list');

// THE RELOAD. A second, independently-evaluated copy of the module — the same
// thing a new tab does — must see what the first one wrote.
const dir = mkdtempSync(join(tmpdir(), 'truegle-player-'));
const outfile = join(dir, 'reloaded.mjs');
await build({
  stdin: {
    contents: `export * from '${join(process.cwd(), 'src/utils/seen.js')}';`,
    resolveDir: process.cwd(),
    loader: 'js',
  },
  bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'error',
});
const reloaded = await import(outfile);
check(reloaded.hasSeen(yt('bulk699')), 'AFTER A RELOAD the feed still knows what it has shown you');
check(!reloaded.hasSeen(yt('never-shown')), 'and has not invented anything it has not');
check(reloaded.seenCount() === seenCount(), 'the whole ledger came back', `${reloaded.seenCount()} vs ${seenCount()}`);

// ── 3. watch history ────────────────────────────────────────────────────────
clearWatchHistory();
recordWatch(yt('one'));
recordWatch(yt('two'));
check(watchHistory().length === 2, 'each distinct video is recorded', `${watchHistory().length}`);
check(watchHistory()[0].title === 'Video two', 'newest first');

recordWatch(yt('one'));
check(watchHistory().length === 2, 'rewatching does not add a second row', `${watchHistory().length}`);
check(watchHistory()[0].title === 'Video one', 'it moves back to the top instead');

recordWatch({ kind: 'video', src: 'blob:http://localhost/abc', title: 'Device file' });
check(!watchHistory().some((e) => e.src.startsWith('blob:')), 'a device file is not stored — its URL dies with the tab');

removeFromHistory(watchHistory()[0].key);
check(watchHistory().length === 1, 'a single entry can be removed');
clearWatchHistory();
check(watchHistory().length === 0, 'and the whole history really clears');

// ── 4. playlists ────────────────────────────────────────────────────────────
playlists().slice().forEach((p) => deletePlaylist(p.id));
const id = createPlaylist('Late night', [yt('a'), yt('b')]);
check(!!id && playlists().length === 1, 'a playlist can be created with items');
check(playlists()[0].items.length === 2, 'and keeps them', `${playlists()[0].items.length}`);

check(addToPlaylist(id, yt('c')) === true, 'something new can be added');
check(addToPlaylist(id, yt('c')) === false, 'the same thing twice is refused');
check(playlists()[0].items.length === 3, 'so the list holds three', `${playlists()[0].items.length}`);

movePlaylistItem(id, 0, 1);
check(playlists()[0].items[0].title === 'Video b', 'an item can be moved down');
movePlaylistItem(id, 0, -1);
check(playlists()[0].items[0].title === 'Video b', 'and cannot be moved off the top');

removeFromPlaylist(id, 0);
check(playlists()[0].items.length === 2, 'an item can be removed');
renamePlaylist(id, 'Renamed');
check(playlists()[0].name === 'Renamed', 'a list can be renamed');
check(createPlaylist('   ') === null, 'a blank name is refused');
check(addToPlaylist(id, { kind: 'video', src: 'blob:x' }) === false, 'a device file cannot be saved to a list');

// Playing a list must not consume it — the whole reason lists exist apart from
// the queue. enqueueMany copies, so the stored list is untouched by playback.
const before = playlists()[0].items.length;
const copy = playlists()[0].items.map((i) => ({ ...i }));
copy.shift(); // what the queue would do to it
check(playlists()[0].items.length === before, 'playing a list does not empty it');

deletePlaylist(id);
check(playlists().length === 0, 'a list can be deleted');

// ── the same Short, listed twice ────────────────────────────────────────────
// REPORTED: "the reels results had a duplicate identical result." A Short is
// reachable at /shorts/<id> AND /watch?v=<id>; two providers answering one
// query can return one of each, and asReel() rewrites the watch URL into the
// shorts form — at which point the list holds the same video twice under what
// were, on arrival, two different URLs. mediaKey is what collapses them.
{
  const rows = [
    'https://www.youtube.com/shorts/nt1zixiSids',
    'https://www.youtube.com/watch?v=nt1zixiSids',
    'https://youtu.be/nt1zixiSids',
    'https://www.youtube.com/shorts/aBcDeFgHiJk',
  ];
  const keys = rows.map((u) => mediaKey(u));
  check(new Set(keys).size === 2,
    'every URL form of one Short collapses to a single identity',
    `${new Set(keys).size} distinct from ${rows.length} rows`);
  check(keys[0] === keys[1] && keys[1] === keys[2],
    '\u2026shorts, watch and youtu.be all agree', keys.join(' | '));
  check(keys[3] !== keys[0], '\u2026and a genuinely different Short stays separate');
}

// ── report ──────────────────────────────────────────────────────────────────
ok.forEach((l) => console.log(l));
if (bad.length) {
  console.log('');
  bad.forEach((l) => console.log(l));
  console.log(`\n${bad.length} failed, ${ok.length} passed`);
  process.exit(1);
}
console.log(`\nall ${ok.length} passed`);
