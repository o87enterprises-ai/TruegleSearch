import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MODE_COLORS, MODE_GRADIENT, searchModeLabel, solidTextClass } from '../../config/modeTheme';

// Pill Mode — lives ABOVE the search bar (spec #2). This is the SEARCH mode
// selector: a single pill, not a row. Clicking it cycles to the next mode
// (never navigates by itself — navigation happens when the query is actually
// submitted, via the search bar's Enter/play button). Black = Chat. The
// landing page opens on Tube (LandingPage); Chat is the last stop in the cycle.
// A small non-clickable "Chat"/"Search" label sits directly above it as a
// passive status indicator.
// 'orange' (Rewards) removed 2026-07-24 — ad-pay/rewards program paused.
// 'purple' (Perspectives) removed 2026-08-08 — folded into the Rabbit Hole as
// the re-ask fold, so it is a control on Red rather than a mode of its own.
// ?mode=purple still resolves (see FOLDED_MODES in UniversalSearch).
//
// ORDER (owner, 2026-10-18): Tube · Feed · Green · Mainstream · Rabbit Hole ·
// Privacy/OSINT · Chat. Tube leads because it is where the landing page opens;
// Chat comes last. The landing cards list the modes in this same order.
const CYCLE = ['tube', 'yellow', 'green', 'blue', 'red', 'ocean', 'black'];

// The passive status word above the pill — what the current mode is FOR, in
// plain words, not which mode it is (the pill itself already says that in its
// own label). Owner, 2026-10-18, in the pill's order:
//   Tube → Play · Feed → Socials · Green → AI Free · Mainstream → Search ·
//   Rabbit Hole → Deep Dive · OSINT → Investigate · Chat → Chat / Search
// (Chat answers, but it searches first to ground the answer, so it says both.)
export const ACTIVITY_LABEL = {
  tube: 'Play',
  yellow: 'Socials',
  green: 'AI Free',
  blue: 'Search',
  red: 'Deep Dive',
  ocean: 'Investigate',
  black: 'Chat / Search',
};
// THE INVITATION (index.css, .pill-invite-*): until the pill has been pressed once
// in this browser, the landing page's pill animates to say "this does something".
// Per-viewer convenience only, so storage is wrapped — blocked storage means the
// invitation simply shows each visit (six cycles, then it rests).
const INVITE_KEY = 'truegle_pill_invite_done_v1';
const inviteDone = () => { try { return localStorage.getItem(INVITE_KEY) === '1'; } catch { return false; } };
// Someone who asked their device for less motion is not given any (the app's
// global reduced-motion rule would flatten it anyway; this just never renders it).
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// Eight points around the pill's edge: [position, size px].
const SPARKS = [
  [{ top: -10, left: '9%' }, 15], [{ top: -13, left: '48%' }, 11], [{ top: -8, right: '6%' }, 14],
  [{ top: '24%', right: -13 }, 11], [{ bottom: -10, right: '14%' }, 12], [{ bottom: -13, left: '40%' }, 9],
  [{ bottom: -8, left: '4%' }, 14], [{ top: '28%', left: -13 }, 11],
];
const HOLD_MS = 2200; // press-and-hold this long (mobile long-press or desktop click-hold) to jump straight to Chat

export default function PillModeRow({ activeMode, onSelect, onHold, invite = false }) {
  const [holding, setHolding] = useState(false);
  // Shown only where the page asks (the landing page) and only until the first press.
  const [inviting, setInviting] = useState(() => invite && !inviteDone() && !reducedMotion());
  const endInvite = () => {
    if (!inviting) return;
    setInviting(false);
    try { localStorage.setItem(INVITE_KEY, '1'); } catch { /* shows again next visit — harmless */ }
  };
  const holdTimerRef = useRef(null);
  const firedRef = useRef(false); // true once the hold completes, so the trailing click doesn't also cycle

  const cycle = () => {
    endInvite();
    if (firedRef.current) { firedRef.current = false; return; } // long-press already handled the switch
    const idx = CYCLE.indexOf(activeMode);
    onSelect(CYCLE[(idx + 1) % CYCLE.length]);
  };

  const startHold = () => {
    endInvite();
    if (activeMode === 'black') return; // already on Chat, nothing to reset
    setHolding(true);
    holdTimerRef.current = setTimeout(() => {
      firedRef.current = true;
      setHolding(false);
      // quick jump straight back to Chat, skipping the full cycle. `onHold`
      // lets a page treat it as "go now" rather than a staged pick.
      if (onHold) onHold(); else onSelect('black');
    }, HOLD_MS);
  };
  const cancelHold = () => {
    clearTimeout(holdTimerRef.current);
    setHolding(false);
  };

  const color = MODE_COLORS[activeMode];
  // A mode may ask for a metallic finish instead of a flat fill (steel).
  const gradient = MODE_GRADIENT[activeMode];
  // searchModeLabel, not MODE_LABELS: this pill drives SEARCH, where green
  // generates nothing, so the shared chat label "Summarize" is wrong here.
  const label = activeMode === 'black' ? 'Chat' : searchModeLabel(activeMode);
  const activity = ACTIVITY_LABEL[activeMode] || 'Search';

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-widest text-white/35 font-semibold select-none">
        {activity}
      </span>
      <motion.button
        type="button"
        onClick={cycle}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onContextMenu={(e) => activeMode !== 'black' && e.preventDefault()} // long-press shouldn't open a context menu
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        title={activeMode === 'black' ? 'Click to switch mode' : 'Click to switch mode — hold to jump to Chat'}
        data-pill-invite={inviting ? '' : undefined}
        // overflow is NOT clipped on the button any more: the sparkles and the
        // ripple sit outside its edge. What has to be clipped (the highlight and
        // the hold fill) lives in the clip layer below.
        className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 select-none ${solidTextClass(activeMode)}${inviting ? ' pill-invite-tap' : ''}`}
        style={{
          '--pill-glow': color,
          // touch-action:none is what makes the 2.2s hold actually reachable on
          // a phone. Without it the platform claims the gesture first — Android
          // begins a text selection at ~500ms and iOS pops the callout, both far
          // under HOLD_MS — so the hold was being cancelled by the browser
          // before it could fire, and the user got a highlighted label instead
          // of a jump to Chat. Panning from a pill this small is not a gesture
          // anyone wants, so there is nothing to trade away here.
          touchAction: 'none',
          background: gradient || color,
          borderColor: gradient ? 'rgba(255,255,255,0.45)' : color,
          boxShadow: gradient ? 'inset 0 1px 0 rgba(255,255,255,0.75), inset 0 -1px 0 rgba(0,0,0,0.25)' : undefined,
        }}
      >
        <span aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
        {/* Specular highlight across the top half — what turns a grey fill
            into something that reads as polished metal. */}
        {gradient && (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1/2 pointer-events-none rounded-t-full"
            style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.55), rgba(255,255,255,0))' }}
          />
        )}
        {/* Hold-progress fill — sweeps left→right over HOLD_MS; resets instantly if released early */}
        {holding && (
          <motion.span
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: HOLD_MS / 1000, ease: 'linear' }}
            className="absolute inset-y-0 left-0 bg-black/25 pointer-events-none"
          />
        )}
        </span>
        {/* The invitation: decorative, so hidden from assistive tech, and never
            in the way of a tap. See index.css (.pill-invite-*). */}
        {inviting && (
          <>
            <span aria-hidden="true" className="pill-invite-glow absolute inset-0 rounded-full pointer-events-none" />
            <span aria-hidden="true" className="pill-invite-ripple absolute inset-0 rounded-full pointer-events-none" />
            {SPARKS.map(([pos, size], i) => (
              <svg
                key={i}
                aria-hidden="true"
                data-pill-spark=""
                viewBox="0 0 24 24"
                width={size}
                height={size}
                className="pill-invite-spark absolute pointer-events-none"
                style={{ ...pos, animationDelay: `${2 + i * 0.09}s` }}
              >
                <path fill="currentColor" d="M12 0 14.5 9.5 24 12 14.5 14.5 12 24 9.5 14.5 0 12 9.5 9.5Z" />
              </svg>
            ))}
            <span
              aria-hidden="true"
              data-pill-invite-label=""
              className="pill-invite-label absolute top-1/2 -translate-y-1/2 pointer-events-none whitespace-nowrap rounded-full border border-white/25 bg-black/45 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-white backdrop-blur-sm"
              style={{ left: 'calc(100% + 10px)' }}
            >
              Click me
            </span>
          </>
        )}
        <span className="relative w-2 h-2 rounded-full flex-shrink-0 bg-current" />
        <span className="relative">{label}</span>
      </motion.button>
    </div>
  );
}
