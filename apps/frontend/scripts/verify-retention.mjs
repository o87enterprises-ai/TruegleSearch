/* Learning from how far you actually watch.
 *
 * The feed only ever learned from thumbs, and almost nobody presses one — so
 * for most people the strongest rung of the recommender (channels you like)
 * stayed permanently empty and the "perfect feed" could never form. Watching
 * is the signal everybody gives, every time, for free.
 *
 * It is also a WEAKER and NOISIER signal than a vote, and the three things
 * below are what keep it honest rather than just louder:
 *
 *   THE DEAD BAND. Finishing something means something. Bouncing in three
 *   seconds means something. Watching 40% means almost nothing — it is where
 *   "I got interrupted", "it was too long" and "it was fine" all live — so
 *   that range records NOTHING rather than inventing a preference from it.
 *
 *   NO DURATION, NO FRACTION. An embed that never reported its length is a gap
 *   in what we know; guessing a denominator manufactures a preference.
 *
 *   IT IS BEHAVIOUR, NOT SPEECH. Collected quietly, behaviour is the thing
 *   Truegle exists not to do — so it stays in the browser and forgetting must
 *   genuinely destroy it.
 *
 * Run it:  npm run retention:test
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const OUT = 'dev/.build/retention-test.mjs';
mkdirSync('dev/.build', { recursive: true });

// localStorage, for a module built around it.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

execFileSync(require_.resolve('esbuild/bin/esbuild'), [
  'src/utils/retention.js', '--bundle', '--format=esm', '--platform=node',
  // retention.js pulls tokens() from taste.js, which reads import.meta.env for
  // its backend URL. Nothing here calls the network, but the bundle still
  // evaluates that line at import time.
  '--define:import.meta.env={"DEV":false}',
  '--external:react', `--outfile=${OUT}`, '--log-level=error',
], { stdio: 'inherit' });

const {
  recordRetention, retentionScore, watchedChannels,
  hasRetention, forgetRetention, THRESHOLDS,
} = await import(`../${OUT}`);

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const vid = (id, channel, title) => ({
  kind: 'youtube',
  src: `https://www.youtube-nocookie.com/embed/${id}`,
  channel,
  title,
});
const a = vid('aaaaaaaaaaa', 'Deep Sea Diaries', 'abyssal squid documentary');

// ── 1. the dead band ────────────────────────────────────────────────────────
check(recordRetention(a, 40, 100) === 'ignored',
  'watching 40% teaches nothing — it is where every reason lives at once');
check(recordRetention(a, 60, 100) === 'ignored', 'nor does 60%');
check(!hasRetention(), '…and neither writes anything at all');

// ── 2. what does count ──────────────────────────────────────────────────────
check(recordRetention(a, 95, 100) === 'kept', 'watching it through is a weak yes');
check(hasRetention(), '…and that is remembered');
check(retentionScore(a) > 0, '…and it lifts things like it', String(retentionScore(a)));

const b = vid('bbbbbbbbbbb', 'Deep Sea Diaries', 'hydrothermal vent tour');
check(retentionScore(b) > 0,
  'a different video from the same channel inherits it', String(retentionScore(b)));

// ── 3. bouncing, but only where bouncing means something ────────────────────
// Skipping past a 20-second clip is navigation, not dislike.
const short = vid('ccccccccccc', 'Clip Farm', 'ten second thing');
check(recordRetention(short, 1, 20) === 'ignored',
  'skipping a short clip is navigation, not a verdict');
const long = vid('ddddddddddd', 'Lecture Hall', 'three hour seminar');
check(recordRetention(long, 30, 3600) === 'bounced', 'leaving a long one early is a weak no');
check(retentionScore(vid('eeeeeeeeeee', 'Lecture Hall', 'another seminar')) < 0,
  '…and it pushes that channel down', String(retentionScore(vid('eeeeeeeeeee', 'Lecture Hall', 'x'))));

// ── 4. no duration, no claim ────────────────────────────────────────────────
const unknown = vid('fffffffffff', 'Mystery', 'no length reported');
for (const d of [0, null, undefined, NaN, -5]) {
  check(recordRetention(unknown, 500, d) === 'ignored',
    `a duration of ${String(d)} cannot produce a fraction`);
}
check(recordRetention(unknown, -1, 100) === 'ignored', 'nor can a negative position');
check(recordRetention(null, 90, 100) === 'ignored', 'and nothing is not a video');

// Watched longer than its reported length — a live stream, or a bad duration.
// Clamped to 1 rather than rejected: you certainly did not leave early.
check(recordRetention(vid('ggggggggggg', 'Streamer', 'live'), 9999, 100) === 'kept',
  'watching past the reported end still counts as staying');

// ── 5. a thumb has to outweigh a habit ──────────────────────────────────────
// Retention is inferred; a vote is stated. If watching could shout over
// speech, the profile would stop being the user's.
check(THRESHOLDS.WEIGHT < 1,
  'one finished video moves a channel less than one thumb would',
  `WEIGHT=${THRESHOLDS.WEIGHT}`);
check(THRESHOLDS.WORD_WEIGHT < THRESHOLDS.WEIGHT,
  'and title words move less than channels, being noisier still',
  `${THRESHOLDS.WORD_WEIGHT} < ${THRESHOLDS.WEIGHT}`);

// ── 6. one channel cannot become the whole feed ─────────────────────────────
const hog = vid('hhhhhhhhhhh', 'Autoplay Tab', 'left running overnight');
for (let i = 0; i < 200; i++) recordRetention(hog, 100, 100);
// Per-term caps are NOT enough: a title carries several words, each capped
// independently, and they sum — this scored ~17 before retentionScore grew a
// ceiling of its own, which would have made one forgotten tab louder than
// every thumb the user had ever pressed.
check(retentionScore(hog) <= THRESHOLDS.MAX_SCORE,
  'a tab left running all night cannot take over the profile',
  String(retentionScore(hog)));
check(THRESHOLDS.MAX_SCORE <= 3,
  '…because watching, in total, is worth about one deliberate thumb',
  String(THRESHOLDS.MAX_SCORE));

// ── 7. it is a favourite only after more than one ───────────────────────────
const once = vid('iiiiiiiiiii', 'Seen Once', 'a single video');
recordRetention(once, 100, 100);
check(!watchedChannels().includes('Seen Once'),
  'one finished video is not a favourite channel', watchedChannels().join(', '));
check(watchedChannels().includes('Autoplay Tab'),
  'a channel watched through repeatedly is', watchedChannels().join(', '));

// ── 8. forgetting really forgets ────────────────────────────────────────────
forgetRetention();
check(!hasRetention(), 'forgetting leaves nothing behind');
check(retentionScore(a) === 0, '…and every score falls back to neutral', String(retentionScore(a)));
check(watchedChannels().length === 0, '…including the channel list');

rmSync(OUT, { force: true });
console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
