import { mediaKey } from './videoEmbed';
import { tokens } from './taste';

// WHAT YOU ACTUALLY WATCHED, as opposed to what you said about it.
//
// Thumbs are a deliberate statement and almost nobody makes them. Watching is
// the signal everybody gives, every time, for free — so the feed should learn
// from how far through things you get, not only from the handful of videos you
// stopped to rate.
//
// SEPARATE FROM taste.js ON PURPOSE, for two reasons:
//
//   1. THEY ARE DIFFERENT CLAIMS, and mixing them makes both illegible. A 👍 is
//      "I like this"; finishing a video is "I did not leave". The second is
//      weaker and noisier — an autoplaying tab, a video left running, a phone
//      in a pocket — so it gets a fraction of the weight, and the code says so
//      rather than burying the difference inside one number.
//   2. IT IS BEHAVIOUR, NOT SPEECH, and behaviour collected quietly is the
//      thing Truegle exists not to do. So: this browser only, never sent
//      anywhere, and forgetRetention() genuinely destroys it. "Forget my
//      taste" in the UI clears this too — a profile you can delete half of is
//      still a dossier.
//
// THE DEAD BAND IN THE MIDDLE IS THE HONEST PART. Finishing something says
// something. Bouncing in three seconds says something. Watching 40% says
// almost nothing — it is where "I got interrupted", "it was too long" and "it
// was fine" all live — so that range records NOTHING rather than inventing a
// preference out of it.

const KEY = 'truegle_retention_v1';

// Above this, you stayed: treat it as a weak positive.
const KEPT = 0.7;
// Below this, you bounced — and only if the thing was long enough for leaving
// to mean anything. Skipping past a 20-second clip is navigation, not dislike.
const BOUNCED = 0.15;
const MIN_MEANINGFUL_SECONDS = 30;

// A thumb moves a channel weight by 1. Watching moves it by this. Roughly:
// five finished videos from a channel are worth one deliberate 👍, which is
// about the right exchange rate for a signal this noisy.
const WEIGHT = 0.2;

// Word weights are noisier still — a title shares words with half the index —
// so they move at a fraction of the channel rate.
const WORD_WEIGHT = 0.08;

const CAP = 6;          // no single channel can dominate the profile
// The most that WATCHING alone can ever contribute to a pick, in either
// direction. Roughly one deliberate 👍 (tasteScore bases that at 3).
const MAX_SCORE = 3;
const MAX_WORDS = 400;  // keep the store small enough to parse on every load

const EMPTY = { channels: {}, words: {} };

function read() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return { ...EMPTY };
    return {
      channels: raw.channels && typeof raw.channels === 'object' ? raw.channels : {},
      words: raw.words && typeof raw.words === 'object' ? raw.words : {},
    };
  } catch {
    return { ...EMPTY };
  }
}

let state = read();
let version = 0;
const listeners = new Set();

function commit(next) {
  state = next;
  version += 1;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
  listeners.forEach((fn) => fn());
}

const clamp = (n) => Math.max(-CAP, Math.min(CAP, n));

/** Trim the word map so it cannot grow without bound across years of use. */
function prune(words) {
  const keys = Object.keys(words);
  if (keys.length <= MAX_WORDS) return words;
  const kept = keys
    .sort((a, b) => Math.abs(words[b]) - Math.abs(words[a]))
    .slice(0, MAX_WORDS);
  return Object.fromEntries(kept.map((k) => [k, words[k]]));
}

/**
 * Record how much of something was actually watched.
 *
 * @param {object} source the player source that was playing
 * @param {number} watchedSeconds position reached
 * @param {number} durationSeconds total length, if known
 * @returns {'kept'|'bounced'|'ignored'} what was learned, if anything
 */
export function recordRetention(source, watchedSeconds, durationSeconds) {
  if (!source || !mediaKey(source)) return 'ignored';
  const dur = Number(durationSeconds);
  const watched = Number(watchedSeconds);
  // No duration means no fraction. An embed that never reported its length is
  // a gap in what we know, and guessing a denominator would manufacture a
  // preference out of nothing.
  if (!Number.isFinite(dur) || dur <= 0) return 'ignored';
  if (!Number.isFinite(watched) || watched < 0) return 'ignored';

  const fraction = Math.min(watched / dur, 1);
  let direction = 0;
  if (fraction >= KEPT) direction = 1;
  else if (fraction <= BOUNCED && dur >= MIN_MEANINGFUL_SECONDS) direction = -1;
  else return 'ignored';   // the dead band — see the note at the top

  const channels = { ...state.channels };
  if (source.channel) {
    channels[source.channel] = clamp((channels[source.channel] || 0) + direction * WEIGHT);
  }
  const words = { ...state.words };
  for (const w of tokens(source.title)) {
    words[w] = clamp((words[w] || 0) + direction * WORD_WEIGHT);
  }
  commit({ channels, words: prune(words) });
  return direction > 0 ? 'kept' : 'bounced';
}

/**
 * How much this browser's WATCHING (not its votes) likes the look of a source.
 *
 * Same shape as tasteScore so the two can simply be added, and deliberately
 * smaller: this is inferred, and inference should not shout over a statement.
 */
export function retentionScore(source) {
  if (!source) return 0;
  let score = 0;
  if (source.channel) score += (state.channels[source.channel] || 0) * 1.2;
  const ws = tokens(source.title);
  if (ws.length) {
    const hit = ws.reduce((sum, w) => sum + (state.words[w] || 0), 0);
    score += hit / Math.sqrt(ws.length);
  }
  // A CEILING ON THE WHOLE THING, not just on each weight.
  //
  // Per-term clamping is not enough: a title carries several words, each
  // capped independently, and they sum. An autoplaying tab left running
  // overnight pushed every word in one title to the cap and scored ~17 —
  // which would have made a single forgotten tab the loudest voice in the
  // profile, drowning out every deliberate thumb the user had ever pressed.
  //
  // MAX is deliberately near a single 👍 (tasteScore gives one a base of 3):
  // watching, however much of it, is inferred, and inference must not outshout
  // a statement no matter how long it accumulates.
  return Math.max(-MAX_SCORE, Math.min(MAX_SCORE, score));
}

/** Channels this browser keeps WATCHING THROUGH, best first. */
export function watchedChannels(limit = 4) {
  return Object.entries(state.channels)
    .filter(([, n]) => n > 0.3)   // one finished video is not a favourite channel
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}

/** Has anything been learned from watching yet? */
export const hasRetention = () =>
  Object.keys(state.channels).length > 0 || Object.keys(state.words).length > 0;

/** Destroy it. Called by the same control that forgets the taste profile. */
export function forgetRetention() {
  commit({ channels: {}, words: {} });
}

export const retentionVersion = () => version;
export const subscribeRetention = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// Exported for the test, and so the thresholds are nameable from outside.
export const THRESHOLDS = { KEPT, BOUNCED, MIN_MEANINGFUL_SECONDS, WEIGHT, WORD_WEIGHT, CAP, MAX_SCORE };
