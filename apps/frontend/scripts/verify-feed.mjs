/* useUpNext, driven against a fake backend.
 *
 * verify-player.mjs tests the PURE parts — the draw, the pool arithmetic, the
 * seen ledger. This tests the part where they meet the network, which is where
 * the looping actually lived: the maths was already right and the feed still
 * went round in circles, because every lookup asked the same question.
 *
 * What it proves, and could not be proven any other way:
 *
 *   1. A fixed fraction of picks really does reach a page of the pool that the
 *      score ordering never surfaces. Not "the code calls exploreOffset" —
 *      the actual outbound request carries a non-zero offset, at the stated
 *      rate, measured over hundreds of picks.
 *   2. As the seen-ledger fills, the feed pages DEEPER on its own, without
 *      waiting for the coin flip. This is the difference between a feed that
 *      degrades into the same few stragglers and one that keeps moving.
 *   3. An exploration that comes back empty does not cost the swipe.
 *   4. fill() returns the batch size asked for, with no duplicates, and spends
 *      part of it on exploration by construction rather than by luck.
 *
 * React is stubbed to identity functions — useUpNext only uses useCallback and
 * useMemo for referential stability, so nothing under test needs a renderer.
 *
 * Run it:  npm run feed:test
 */
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const dir = mkdtempSync(join(tmpdir(), 'truegle-feed-'));
const shim = join(dir, 'react.js');
writeFileSync(shim, [
  'export const useCallback = (f) => f;',
  'export const useMemo = (f) => f();',
  'export const useSyncExternalStore = (s, g) => g();',
  'export default {};',
].join('\n'));

// ONE bundle re-exporting both, deliberately. Bundling seen.js separately gives
// it its own copy of the module-level Set, so forgetSeen() would clear a ledger
// nothing under test is reading — and every "fresh ledger" measurement would
// silently be a measurement of a full one. (That mistake was made once here.)
const src = (p) => resolve(process.cwd(), p);
const entry = join(dir, 'entry.js');
writeFileSync(entry, [
  `export { useUpNext } from '${src('src/hooks/useUpNext.js')}';`,
  `export { forgetSeen, seenCount } from '${src('src/utils/seen.js')}';`,
].join('\n'));

const out = join(dir, 'bundle.mjs');
await build({
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  outfile: out,
  platform: 'neutral',
  define: { 'import.meta.env.VITE_BACKEND_URL': '"http://fake.test"' },
  alias: { react: shim },
});

// ── the fake backend ────────────────────────────────────────────────────────
// Trending rows encode the offset they came from, so a test can see which PAGE
// a request actually reached rather than trusting that it asked.
let calls = [];
let poolDepth = Infinity; // how many rows the pool has, for the empty-tail case

globalThis.fetch = async (url, opts) => {
  const u = String(url);
  calls.push(u);
  if (u.includes('/api/media/trending')) {
    const q = new URL(u).searchParams;
    const off = Number(q.get('offset') || 0);
    const lim = Number(q.get('limit') || 24);
    const rows = [];
    for (let i = 0; i < lim && off + i < poolDepth; i += 1) {
      const id = String(off + i).padStart(11, 'o');
      rows.push({
        mediaKey: `yt:${id}`, pageUrl: `https://youtu.be/${id}`,
        title: `Pool ${off + i}`, channel: 'pool', score: 0.5,
      });
    }
    return { ok: true, json: async () => ({ results: rows }) };
  }
  if (u.includes('/api/search')) {
    const q = JSON.parse(opts.body).query;
    return { ok: true, json: async () => ({ results: Array.from({ length: 8 }, (_, i) => ({
      url: `https://youtu.be/${`s${i}${q.length}`.padEnd(11, 'q')}`, title: `${q} ${i}`,
    })) }) };
  }
  return { ok: false, json: async () => null };
};

const { useUpNext, forgetSeen, seenCount } = await import(out);
const hook = useUpNext();
const CURRENT = {
  kind: 'youtube',
  src: 'https://www.youtube-nocookie.com/embed/currentxxxx',
  title: 'Current',
  pageUrl: 'https://youtu.be/currentxxxx',
};

// The normal path always asks for offset=0 FIRST; an exploration's first (and
// only) trending call carries the random depth. So the first call is the
// discriminator — and it under-counts slightly, because roughly one
// exploration in ten legitimately draws offset 0. The head is not banned.
const firstTrendingOffset = () => {
  const first = calls.find((u) => u.includes('/api/media/trending'));
  return first ? Number(new URL(first).searchParams.get('offset') || 0) : null;
};

// ── 1. exploration, on a ledger that never fills ────────────────────────────
const RUNS = 600;
let explored = 0; let returned = 0;
for (let i = 0; i < RUNS; i += 1) {
  forgetSeen(); calls = [];
  if (await hook.pick(CURRENT)) returned += 1;
  if (firstTrendingOffset() > 0) explored += 1;
}
const rate = explored / RUNS;
check(returned === RUNS, 'every pick returns something to play', `${returned}/${RUNS}`);
check(
  rate > 0.12 && rate < 0.26,
  'about one pick in five reaches a page the ranking never surfaces',
  `${(rate * 100).toFixed(1)}% (≈10% of explorations legitimately draw offset 0)`,
);
check(explored > 0 && explored < RUNS, 'exploration is a fraction, not all-or-nothing');

// ── 2. a filling ledger pages deeper on its own ─────────────────────────────
// THE POINT: this must NOT depend on the coin flip. A browser deep into a
// sitting has exhausted the head, and re-ranking it again is what produced the
// same handful of stragglers over and over.
forgetSeen();
let deepWhenExhausted = 0;
for (let i = 0; i < 120; i += 1) {
  calls = [];
  await hook.pick(CURRENT);
  const offsets = calls.filter((u) => u.includes('/api/media/trending'))
    .map((u) => Number(new URL(u).searchParams.get('offset') || 0));
  if (offsets.some((o) => o > 0)) deepWhenExhausted += 1;
}
check(seenCount() > 60, 'a long sitting fills the ledger past the exclude list', `${seenCount()} keys`);
check(
  deepWhenExhausted / 120 > rate + 0.15,
  'and the feed then pages deeper far more often than the coin flip alone would',
  `${((deepWhenExhausted / 120) * 100).toFixed(0)}% vs ${(rate * 100).toFixed(0)}% baseline`,
);

// ── 3. an empty tail must not cost the swipe ────────────────────────────────
// A young platform has no page four. Exploration finds nothing, and the pick
// has to fall back rather than handing the player a null and stalling.
forgetSeen();
poolDepth = 12; // shallower than a single page — every exploration comes back empty
let survived = 0;
for (let i = 0; i < 60; i += 1) {
  forgetSeen(); calls = [];
  if (await hook.pick(CURRENT)) survived += 1;
}
check(survived === 60, 'an exploration with nothing to offer falls back instead of stalling', `${survived}/60`);
poolDepth = Infinity;

// ── 4. fill() ───────────────────────────────────────────────────────────────
forgetSeen(); calls = [];
const batch = await hook.fill(CURRENT, 6);
const offsets = calls.filter((u) => u.includes('/api/media/trending'))
  .map((u) => Number(new URL(u).searchParams.get('offset') || 0));
check(batch.length === 6, 'a launch queue is the length asked for', `${batch.length}`);
check(new Set(batch.map((s) => s.src)).size === batch.length, 'with nothing repeated inside it');
check(offsets.length >= 2, 'and it spends part of the batch exploring, by construction not by luck',
  `trending offsets: ${offsets.join(', ')}`);

// A queue drawn twice in a row must not be the same queue.
forgetSeen();
const a = await hook.fill(CURRENT, 6);
forgetSeen();
const b = await hook.fill(CURRENT, 6);
const overlap = a.filter((s) => b.some((t) => t.src === s.src)).length;
check(overlap < 6, 'two launches in a row are not the same six videos', `${overlap}/6 shared`);

// ── report ──────────────────────────────────────────────────────────────────
ok.forEach((l) => console.log(l));
bad.forEach((l) => console.log(l));
console.log(bad.length ? `\n${bad.length} of ${ok.length + bad.length} FAILED` : `\nall ${ok.length} passed`);
process.exit(bad.length ? 1 : 0);
