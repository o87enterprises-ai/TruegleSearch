import { useCallback, useEffect, useRef, useState } from 'react';

// Running the player with the controls locked and the screen apparently off.
//
// THE SHAPE OF THE ASK: "user makes selection, full screen, locks screen, turns
// brightness to 0 as if the screen was off visibly to the user but the full
// functions are still available for expert users."
//
// WHAT "BRIGHTNESS" CAN HONESTLY MEAN HERE. A web page cannot touch the
// device's backlight — there is no API for it, deliberately, and there is not
// going to be one. What it CAN do is paint over itself, so "brightness 0" is a
// black sheet at full opacity: the screen looks off, the audio keeps playing,
// and every gesture below still works. That is the effect being asked for and
// it needs no permission. It is not the backlight, though, so the battery
// saving of a genuinely dark screen only exists on an OLED panel where black
// pixels are actually off — worth saying plainly rather than implying a power
// feature this cannot deliver.
//
// THE GESTURES, and how each is told apart from the others:
//
//   two quick taps                    → play / pause
//   press, hold, then slide           → dim up and down; all the way is dark
//   two taps then hold, LEFT third    → back
//   two taps then hold, MIDDLE third  → voice search
//   two taps then hold, RIGHT third   → skip
//   ONE tap, top band, middle         → bring the last search back
//   shake the phone                   → shuffle
//
// The two kinds of hold are told apart by what came BEFORE them: a hold that
// follows a tap is a command, a hold that follows nothing is the dimmer. That
// is the only ambiguity in the set, and tap count resolves it without either
// gesture needing its own corner of the screen.
//
// THE ONE SINGLE-TAP GESTURE, and why it is safe to have one at all. Every
// other gesture needs two taps precisely because one tap is what a pocket
// produces. Recall gets an exception because it is confined to a small band —
// the middle of the TOP of the picture — and because it is the only harmless
// one in the set: it shows a list. It does not skip, pause, or lose your place.
//
// It waits DOUBLE_MS before firing, so a double-tap that happens to land in
// the band is still a play/pause and not a recall followed by one. The band
// also starts below TOP_SAFE_PCT so it never fights the phone's own
// notification shade, which is the gesture the user is actually reaching for
// when their finger is at the very top of the screen.
//
// Everything here is deliberate and slow on purpose. These run under a LOCK,
// whose whole job is to ignore what a pocket does, so nothing fires on a single
// quick touch — the one thing a pocket reliably produces.

const DOUBLE_MS = 320;     // how long a second tap has to arrive
const HOLD_MS = 420;       // press-and-hold threshold
const TAP_MAX_MS = 260;    // longer than this and it was never a tap
const SLOP_PX = 12;        // a press that moves further than this is a slide
const DIM_TRAVEL_PX = 220; // finger travel for the full range
const SHAKE_DELTA = 24;    // summed acceleration change that counts as a shake
const SHAKE_GAP_MS = 1200; // one shake cannot fire twice
const TOP_BAND_PCT = 0.22; // recall band: the top fifth of the picture…
const TOP_SAFE_PCT = 0.04; // …starting below the phone's own pull-down area
const MID_BAND = [0.25, 0.75]; // …and only its middle, horizontally

/** Which third of the box a press landed in. */
export function zoneOf(x, width) {
  if (!width) return 'middle';
  const third = width / 3;
  if (x < third) return 'left';
  if (x > third * 2) return 'right';
  return 'middle';
}

export function useLockedGestures({
  enabled = false,
  onTogglePause,
  onNext,
  onPrev,
  onVoice,
  onShuffle,
  onRecall,
} = {}) {
  // 0 = normal, 1 = fully dark. It lives here rather than in the player because
  // the gestures own it and nothing else sets it.
  const [dim, setDim] = useState(0);
  // True while a dim slide is in progress, so the sheet can show the level.
  const [sliding, setSliding] = useState(false);

  const press = useRef(null);
  const lastTap = useRef(0);
  const tapCount = useRef(0);
  const holdTimer = useRef(null);
  const dimFrom = useRef(0);
  const acted = useRef(false);   // a hold already fired for this press
  // A single tap in the recall band waits out DOUBLE_MS before it fires, so a
  // double-tap landing there stays a play/pause. Cancelled by the second tap.
  const recallTimer = useRef(null);

  const clearHold = () => { clearTimeout(holdTimer.current); holdTimer.current = null; };
  const clearRecall = () => { clearTimeout(recallTimer.current); recallTimer.current = null; };
  useEffect(() => () => { clearHold(); clearRecall(); }, []);

  // Leaving locked mode gives the screen back. A dim that outlived the lock
  // would be a black rectangle with no gesture left to undo it.
  useEffect(() => {
    if (!enabled) { setDim(0); setSliding(false); tapCount.current = 0; clearRecall(); }
  }, [enabled]);

  const onPointerDown = useCallback((e) => {
    if (!enabled) return;
    const box = e.currentTarget?.getBoundingClientRect?.() || { left: 0, top: 0, width: 0, height: 0 };
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    // The recall band: the middle of the top of the picture, below the strip
    // the phone reserves for its own pull-down.
    const inRecall = box.height > 0 && box.width > 0
      && y >= box.height * TOP_SAFE_PCT
      && y <= box.height * TOP_BAND_PCT
      && x >= box.width * MID_BAND[0]
      && x <= box.width * MID_BAND[1];
    if (Date.now() - lastTap.current > DOUBLE_MS) tapCount.current = 0;
    acted.current = false;
    // A second tap anywhere cancels a recall that was still waiting — that
    // press was the first half of a double, not a recall.
    clearRecall();
    press.current = {
      t: Date.now(), x: e.clientX, y: e.clientY,
      zone: zoneOf(x, box.width), taps: tapCount.current, recall: inRecall,
    };
    dimFrom.current = dim;

    clearHold();
    holdTimer.current = setTimeout(() => {
      acted.current = true;
      const p = press.current;
      if (!p) return;
      if (p.taps >= 1) {
        // A hold that FOLLOWS a tap is a command, and where it landed says which.
        if (p.zone === 'left') onPrev?.();
        else if (p.zone === 'right') onNext?.();
        else onVoice?.();
        tapCount.current = 0;
      } else {
        // A hold that follows nothing is the dimmer, armed and waiting to slide.
        setSliding(true);
      }
    }, HOLD_MS);
  }, [enabled, dim, onPrev, onNext, onVoice]);

  const onPointerMove = useCallback((e) => {
    if (!enabled) return;
    const p = press.current;
    if (!p) return;
    const dy = e.clientY - p.y;
    const dx = e.clientX - p.x;
    // Moving before the hold matured cancels it: that was a drag, not a press.
    if (!acted.current && Math.hypot(dx, dy) > SLOP_PX) clearHold();
    if (!sliding) return;
    // UP is brighter, which is the direction every phone already uses. Screen
    // coordinates run the other way, so up is a negative dy and has to be
    // flipped to read as "less dim".
    setDim(Math.max(0, Math.min(1, dimFrom.current + (dy / DIM_TRAVEL_PX))));
  }, [enabled, sliding]);

  const onPointerUp = useCallback(() => {
    if (!enabled) return;
    clearHold();
    const p = press.current;
    press.current = null;
    if (sliding) { setSliding(false); return; }
    if (acted.current || !p) return;

    if (Date.now() - p.t > TAP_MAX_MS) return;   // a slow press that fired nothing
    tapCount.current += 1;
    lastTap.current = Date.now();
    if (tapCount.current >= 2) {
      // The second tap only counts as a double if no hold followed it, which is
      // why this is decided on the way UP rather than the way down.
      tapCount.current = 0;
      onTogglePause?.();
      return;
    }
    // One tap, in the band, with a search to come back to. Deferred so the
    // double-tap above still wins if a second tap is on its way.
    if (p.recall && onRecall) {
      clearRecall();
      recallTimer.current = setTimeout(() => {
        recallTimer.current = null;
        tapCount.current = 0;
        onRecall();
      }, DOUBLE_MS);
    }
  }, [enabled, sliding, onTogglePause, onRecall]);

  // ── shake to shuffle ──────────────────────────────────────────────────────
  // Listened for only while locked. A motion listener running on every page is
  // a battery cost for nothing, and on iOS it needs a permission prompt that
  // would be inexplicable anywhere else.
  useEffect(() => {
    if (!enabled || !onShuffle) return undefined;
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return undefined;
    let last = { x: 0, y: 0, z: 0, t: 0 };
    let firedAt = 0;
    const onMotion = (e) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const now = Date.now();
      if (now - last.t < 100) return;    // sampled, not integrated
      const delta = Math.abs((a.x || 0) - last.x)
        + Math.abs((a.y || 0) - last.y)
        + Math.abs((a.z || 0) - last.z);
      const first = last.t === 0;
      last = { x: a.x || 0, y: a.y || 0, z: a.z || 0, t: now };
      // The first sample has nothing to compare against; treating it as a delta
      // would fire a shuffle the instant the lock went on.
      if (first) return;
      if (delta > SHAKE_DELTA && now - firedAt > SHAKE_GAP_MS) { firedAt = now; onShuffle(); }
    };
    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [enabled, onShuffle]);

  return {
    dim,
    sliding,
    setDim,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}

export default useLockedGestures;
