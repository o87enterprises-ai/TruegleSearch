// WHEN TIKTOK'S PLAYER WILL NOT ANSWER (owner, 2026-11-10: phone and desktop,
// "429 Too Many Requests" inside the player — docs/TIKTOK-429-PLAN.md).
//
// TikTok's controllable player (player/v1) is refused for stretches; the browser
// then shows TikTok's own error page inside our frame, which never says "ready".
// We cannot read that page (cross-origin), so SILENCE after the frame has loaded
// is the only signal. Silence is also what a private window looks like (v1 needs
// third-party storage), and there the simpler card player works — so the answer
// to silence is the card, not giving up.
//
// What this remembers, per browser tab (sessionStorage, never sent anywhere):
//   - that the full player was silent: for 10 minutes the next TikToks start in
//     the card straight away — ONE request per clip instead of two (full player,
//     ten seconds, then card);
//   - when "Try the full player" was last pressed, so it cannot be hammered.
// A full player that says "ready" clears the first at once.
//
// Every storage touch is guarded: private windows and blocked storage throw.

const BLOCKED_KEY = 'truegle_tiktok_v1_blocked_until';
const RETRY_KEY = 'truegle_tiktok_v1_last_retry';

/** After the frame loads, how long the full player has to say it is ready. */
export const TIKTOK_SILENT_AFTER_LOAD_MS = 4000;
/** How long the next TikToks skip the full player after it was silent. */
export const TIKTOK_BLOCK_MS = 10 * 60 * 1000;
/** Least gap between two presses of "Try the full player". */
export const TIKTOK_RETRY_GAP_MS = 30 * 1000;

const store = () => { try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch { return null; } };
const read = (key, storage) => { try { return Number(storage?.getItem(key)) || 0; } catch { return 0; } };
const write = (key, value, storage) => { try { storage?.setItem(key, String(value)); } catch { /* storage blocked */ } };

/** The full player was silent: start the next TikToks in the card. */
export function markTikTokBlocked(now = Date.now(), storage = store()) { write(BLOCKED_KEY, now + TIKTOK_BLOCK_MS, storage); }

/** Is the full player being skipped right now? */
export function tiktokBlocked(now = Date.now(), storage = store()) { return read(BLOCKED_KEY, storage) > now; }

/** The full player answered (or the person chose to retry it): stop skipping it. */
export function clearTikTokBlocked(storage = store()) { try { storage?.removeItem(BLOCKED_KEY); } catch { /* storage blocked */ } }

/** Milliseconds until "Try the full player" may be pressed again (0 = now). */
export function tiktokRetryWaitMs(now = Date.now(), storage = store()) {
  const last = read(RETRY_KEY, storage);
  if (!last) return 0; // never pressed (or storage blocked): nothing to wait for
  return Math.max(0, last + TIKTOK_RETRY_GAP_MS - now);
}

/** Record a press of "Try the full player". */
export function noteTikTokRetry(now = Date.now(), storage = store()) { write(RETRY_KEY, now, storage); }
