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
// STEPS 4-6 (docs/TIKTOK-429-PLAN.md) add three more pieces of per-tab memory:
//   - how many clips the full player failed on in the last 30 minutes. At three,
//     TikTok is treated as "constant": TikToks stop loading in the player at all and
//     show an Open on TikTok panel instead (no requests to TikTok, no raw error page).
//     The failures age out, so the player retries by itself — a self-healing probe.
//   - "it plays fine here": the person pressed Stay on a TikTok that was only
//     SOMETIMES-looking blocked (a private window, where the card works). That turns
//     off auto-advance and link-out for the tab, because we cannot see inside the card.
//   - the lengths of the two countdowns used when a stream reaches a TikTok.
//
// Every storage touch is guarded: private windows and blocked storage throw.

const BLOCKED_KEY = 'truegle_tiktok_v1_blocked_until';
const RETRY_KEY = 'truegle_tiktok_v1_last_retry';
const SILENT_KEY = 'truegle_tiktok_v1_silent_at';
const STAY_KEY = 'truegle_tiktok_stay';

/** After the frame loads, how long the full player has to say it is ready. */
export const TIKTOK_SILENT_AFTER_LOAD_MS = 4000;
/** How long the next TikToks skip the full player after it was silent. */
export const TIKTOK_BLOCK_MS = 10 * 60 * 1000;
/** Least gap between two presses of "Try the full player". */
export const TIKTOK_RETRY_GAP_MS = 30 * 1000;
/** Full-player failures inside the window that make TikTok "constant" (link-out). */
export const TIKTOK_LINKOUT_AFTER = 3;
export const TIKTOK_LINKOUT_WINDOW_MS = 30 * 60 * 1000;
/** In a stream, how long a possibly-blocked TikTok gets before the stream moves on... */
export const TIKTOK_AUTO_ADVANCE_MS = 15 * 1000;
/** ...and how long the link-out panel stays before it does (nothing is loading). */
export const TIKTOK_LINKOUT_ADVANCE_MS = 5 * 1000;

const store = () => { try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch { return null; } };
const read = (key, storage) => { try { return Number(storage?.getItem(key)) || 0; } catch { return 0; } };
const write = (key, value, storage) => { try { storage?.setItem(key, String(value)); } catch { /* storage blocked */ } };

/** The timestamps of recent full-player failures, newest last, inside the window. */
function silentList(now, storage) {
  try {
    const raw = JSON.parse(storage?.getItem(SILENT_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((t) => Number.isFinite(t) && now - t < TIKTOK_LINKOUT_WINDOW_MS && t <= now + 1000) : [];
  } catch { return []; }
}

/** The full player failed on a clip: start the next TikToks in the card, and count it. */
export function markTikTokBlocked(now = Date.now(), storage = store()) {
  write(BLOCKED_KEY, now + TIKTOK_BLOCK_MS, storage);
  write(SILENT_KEY, JSON.stringify([...silentList(now, storage), now].slice(-10)), storage);
}

/** Is the full player being skipped right now? */
export function tiktokBlocked(now = Date.now(), storage = store()) { return read(BLOCKED_KEY, storage) > now; }

/** The person chose to retry the full player: stop skipping it (the failures still count). */
export function clearTikTokBlocked(storage = store()) { try { storage?.removeItem(BLOCKED_KEY); } catch { /* storage blocked */ } }

/** The full player said "ready": TikTok is working again — forget the block AND the count. */
export function tiktokWorked(storage = store()) {
  try { storage?.removeItem(BLOCKED_KEY); storage?.removeItem(SILENT_KEY); } catch { /* storage blocked */ }
}

/** How many clips the full player has failed on in the last 30 minutes. */
export function tiktokSilentCount(now = Date.now(), storage = store()) { return silentList(now, storage).length; }

/** The person said a blocked-looking TikTok IS playing (the card works here). */
export function markTikTokStay(storage = store()) { write(STAY_KEY, 1, storage); }
export function tiktokStay(storage = store()) { return read(STAY_KEY, storage) === 1; }

/**
 * Has TikTok been refused so steadily that it should stop loading in the player
 * and open on TikTok instead? Never once the person has said it plays here.
 */
export function tiktokLinkOut(now = Date.now(), storage = store()) {
  return !tiktokStay(storage) && tiktokSilentCount(now, storage) >= TIKTOK_LINKOUT_AFTER;
}

/** Milliseconds until "Try the full player" may be pressed again (0 = now). */
export function tiktokRetryWaitMs(now = Date.now(), storage = store()) {
  const last = read(RETRY_KEY, storage);
  if (!last) return 0; // never pressed (or storage blocked): nothing to wait for
  return Math.max(0, last + TIKTOK_RETRY_GAP_MS - now);
}

/** Record a press of "Try the full player". */
export function noteTikTokRetry(now = Date.now(), storage = store()) { write(RETRY_KEY, now, storage); }
