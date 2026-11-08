import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Play, RotateCcw, Mail } from 'lucide-react';
import { usePlayAll } from '../../hooks/usePlayAll';
import { usePlayer } from '../../context/PlayerContext';
import { mediaKey } from '../../utils/videoEmbed';
import { reportHref as buildReportHref, envContext, reportEvent } from '../../utils/playerDiagnostics';
import { IS_IOS } from '../../utils/isIOS';
import { trace } from '../../utils/playerTrace';

// THE DOOR A SHARED LINK OPENS ONTO.
//
// Someone taps a Truegle link in a message and should land IN the player, not
// on a page with a player somewhere on it. Browsers only grant full screen and
// sound from inside a tap on the page itself — a tap in another app does not
// count — so this is the one tap: a screen-filling poster shaped like the clip
// (9:16 for Shorts/TikToks/Reels, 16:9 otherwise) with a single Play.
//
// That tap plays the shared clips as a run (auto-advance on, the visitor's own
// queue parked, not mixed in), then takes the player full screen; the player
// itself rotates the phone to match the clip (see TrueglePlayer).

const posterFor = (s) => {
  if (s?.poster) return s.poster;
  const key = mediaKey(s);
  return key.startsWith('youtube:') ? `https://i.ytimg.com/vi/${key.slice(8)}/hqdefault.jpg` : null;
};

export const isTall = (s) => !!s && (!!s.vertical || s.kind === 'tiktok');

// The full player's root — never the collapsed strip in Tube's bar. It mounts
// a frame or two after playback starts, so this waits for it; the tap's
// permission to go full screen lasts a few seconds, plenty for that.
// iPhone Safari has no element full screen, so there it asks the player,
// whose own request falls back to its fixed box.
function fullscreenPlayerWhenReady(askPlayer, tries = 60) {
  const el = document.querySelector('[data-mini] [data-player-root]');
  if (el) {
    if (el.requestFullscreen) el.requestFullscreen().catch(() => { /* denied — plays inline */ });
    else askPlayer();
    return;
  }
  if (tries > 0) requestAnimationFrame(() => fullscreenPlayerWhenReady(askPlayer, tries - 1));
}

// THE SAFETY NET. A tester on an iPhone tapped Play and was left on the bare
// Tube page with no player and no word why (2026-10-22, not reproducible in
// WebKit here). So the tap is now checked: if no player is on screen a few
// seconds later, the visitor gets Try again and a Report that opens THEIR
// mail app with what went wrong. Nothing is sent unless they send it.
// The report itself is built by utils/playerDiagnostics.js, shared with the
// player's own stuck-state reporting (2026-10-23) — one mailto: builder,
// one place that decides what "report a playback problem" looks like.
const CHECK_MS = 3000;

export function playerOnScreen() {
  const el = document.querySelector('[data-mini] [data-player-root]');
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const w = Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
  const h = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
  if (w < 40 || h < 40) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
}

// ── iPHONE ONLY (2026-11-07) ─────────────────────────────────────────────
// Tester recording, again: tap Play, the door vanishes, bare Tube page, the
// collapsed player strip at the bottom — and NO help card. The help card's
// check (playerOnScreen) only asks "is there a >=40px player box", which the
// strip passes. On iPhone "full screen" is our own fixed box (no Fullscreen
// API there), and that box can fail in ways the real API cannot: the request
// lands while the player is still minimised/inert, or the box is trapped by
// an ancestor's transform when the index.css :has() override does not take.
// None of this reproduces in Chromium or desktop WebKit, so instead of one
// guess, every step is checked and repaired — which is safe ONLY on iOS,
// because the fixed box needs no user gesture and can be re-applied at will.
// Android/desktop use the real, gesture-gated API and never enter this path.
// The root lives in <body> while it is the iPhone stage (TrueglePlayer renders
// it there), and inside the docked frame otherwise — look in both.
const playerRoot = () => document.querySelector('[data-pseudo-fullscreen][data-player-root]')
  || document.querySelector('[data-mini] [data-player-root]');

// Not "a player exists" — the player is what is in the middle of the screen.
export function playerCoversScreen() {
  const el = playerRoot();
  // Full screen is our fixed box on iPhone, but iPad has the real API, where
  // the root IS the document's full-screen element and carries no such marker.
  const native = document.fullscreenElement === el || document.webkitFullscreenElement === el;
  if (!el || !(el.hasAttribute('data-pseudo-fullscreen') || native) || el.closest('[inert]')) return false;
  const r = el.getBoundingClientRect();
  if (r.width < window.innerWidth * 0.9 || r.height < window.innerHeight * 0.6) return false;
  const hit = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  return !!hit && el.contains(hit);
}

// Free the fixed box from any ancestor that makes itself its containing
// block (the same list index.css cancels via :has). Inline + !important, and
// put back exactly as it was the moment the box closes, so the floating
// window's drag/animation is untouched afterwards.
const TRAPS = ['transform', 'filter', 'backdrop-filter', '-webkit-backdrop-filter', 'contain', 'will-change', 'perspective'];
function untrap(el) {
  if (el.dataset.iosUntrapped) return;
  const saved = [];
  for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
    saved.push([a, TRAPS.map((k) => [k, a.style.getPropertyValue(k), a.style.getPropertyPriority(k)]),
      [a.style.getPropertyValue('z-index'), a.style.getPropertyPriority('z-index')]]);
    TRAPS.forEach((k) => a.style.setProperty(k, k === 'contain' ? 'none' : (k === 'will-change' ? 'auto' : 'none'), 'important'));
    a.style.setProperty('z-index', '2147483000', 'important');
  }
  el.dataset.iosUntrapped = '1';
  trace('gate', { s: 'untrap', n: saved.length });
  const restore = () => {
    obs.disconnect();
    delete el.dataset.iosUntrapped;
    saved.forEach(([a, props, [z, zp]]) => {
      props.forEach(([k, v, pr]) => (v ? a.style.setProperty(k, v, pr) : a.style.removeProperty(k)));
      if (z) a.style.setProperty('z-index', z, zp); else a.style.removeProperty('z-index');
    });
  };
  const obs = new MutationObserver(() => { if (!el.isConnected || !el.hasAttribute('data-pseudo-fullscreen')) restore(); });
  obs.observe(el, { attributes: true, attributeFilter: ['data-pseudo-fullscreen'] });
  // The root can be removed outright (collapsed strip renders none).
  obs.observe(document.body, { childList: true, subtree: true });
}

// Drive the iPhone box until it really covers the screen, or the window
// closes. Returns a cancel function.
function iosFullscreenUntilCovered({ askPlayer, unminimize }, windowMs = 2800) {
  const t0 = Date.now();
  let lastAsk = -1e9;
  let timer = 0;
  const step = () => {
    if (playerCoversScreen()) { trace('gate', { s: 'covered', ms: Date.now() - t0 }); return; }
    const el = playerRoot();
    if (el) {
      if (el.closest('[inert]')) unminimize();
      else if (!el.hasAttribute('data-pseudo-fullscreen')) {
        if (Date.now() - lastAsk > 300) { lastAsk = Date.now(); trace('gate', { s: 'ask' }); askPlayer(); }
      } else untrap(el);
    }
    if (Date.now() - t0 < windowMs) timer = setTimeout(step, 100);
  };
  step();
  return () => clearTimeout(timer);
}

export function reportHref(errors) {
  return buildReportHref({
    subject: 'Truegle: shared link would not play',
    summary: 'Tapped Play on a shared link and the player did not open.',
    context: { ...envContext(), Errors: errors.length ? errors.join(' | ') : 'none caught' },
  });
}

export default function ShareGate({ sources, onStart, playlistUrl = null }) {
  const { startFeed, setPlayMode, setMinimized, requestFullscreen } = usePlayer();
  // A shared PLAYLIST plays as one (usePlayAll): saved to Lists, the queue
  // replaced, track one first. Its single "videoseries" embed showed "This
  // video is unavailable" and left the old queue playing behind it.
  const { playAll } = usePlayAll();
  const first = sources[0];
  const tall = isTall(first);
  const poster = posterFor(first);

  // Nothing else on the page should scroll behind the door.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // 'door' → the poster; 'starting' → hidden while we check; 'failed' → help.
  const [phase, setPhase] = useState('door');
  const errors = useRef([]);
  const iosCancel = useRef(null);
  useEffect(() => () => iosCancel.current?.(), []);
  useEffect(() => {
    if (phase !== 'starting') return undefined;
    const note = (msg) => { if (msg && errors.current.length < 5) errors.current.push(String(msg).slice(0, 200)); };
    const onErr = (e) => note(e.message || e.error);
    const onRej = (e) => note(e.reason?.message || e.reason);
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    const t = setTimeout(() => {
      // iPhone: pass only if the player really fills the screen — the old
      // check passed on the collapsed strip, which is how the bug hid.
      const okNow = IS_IOS ? playerCoversScreen() : playerOnScreen();
      if (okNow) { onStart?.(); return; }
      if (IS_IOS) {
        const el = playerRoot();
        trace('gate', { s: 'fail', root: !!el, box: !!el?.hasAttribute('data-pseudo-fullscreen'), inert: !!el?.closest('[inert]') });
        reportEvent({ reason: 'gate_ios' });
      }
      setPhase('failed');
    }, CHECK_MS);
    return () => {
      clearTimeout(t);
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
    };
  }, [phase, onStart]);

  const start = () => {
    errors.current = [];
    try {
      setPlayMode('auto');
      if (playlistUrl) playAll(playlistUrl); else startFeed(sources);
      setMinimized(false);
      if (IS_IOS) {
        trace('gate', { s: 'tap' });
        iosCancel.current?.();
        iosCancel.current = iosFullscreenUntilCovered({ askPlayer: requestFullscreen, unminimize: () => setMinimized(false) });
      } else {
        fullscreenPlayerWhenReady(requestFullscreen);
      }
    } catch (e) {
      errors.current.push(String(e?.message || e).slice(0, 200));
    }
    setPhase('starting');
  };

  if (phase === 'starting') return null;

  if (phase === 'failed') {
    return createPortal(
      <div
        data-share-gate-failed
        role="alertdialog"
        aria-label="The player could not start"
        className="fixed inset-0 z-[2147483002] bg-black/95 flex flex-col items-center justify-center p-6 text-center"
      >
        <img src="/truegle.png" alt="" className="w-10 h-10 rounded-lg mb-4 opacity-90" />
        <p className="text-white font-semibold text-base">Couldn&apos;t start the player</p>
        <p className="text-white/60 text-sm mt-1 max-w-xs">Your browser didn&apos;t open it. Tap Try again — that usually does it.</p>
        <button
          type="button"
          data-share-retry
          onClick={start}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-semibold text-sm"
        >
          <RotateCcw size={16} /> Try again
        </button>
        <a
          data-share-report
          href={reportHref(errors.current)}
          className="mt-3 inline-flex items-center gap-1.5 text-white/70 text-xs underline underline-offset-2"
        >
          <Mail size={13} /> Report this (opens your email — nothing is sent unless you send it)
        </a>
        <button type="button" data-share-dismiss onClick={() => onStart?.()} className="mt-4 text-white/45 text-xs">
          Close
        </button>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <motion.div
      data-share-gate={tall ? 'portrait' : 'landscape'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[10001] bg-black flex flex-col items-center justify-center p-4 cursor-pointer"
      onClick={start}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start(); } }}
      aria-label={`Play ${first?.title || 'the shared video'}`}
    >
      <img src="/truegle.png" alt="" className="absolute top-4 left-4 w-8 h-8 rounded-lg opacity-80" />
      <div
        className="relative overflow-hidden rounded-2xl bg-white/5 shadow-2xl"
        style={tall
          ? { height: 'min(78svh, 150vw)', aspectRatio: '9 / 16' }
          : { width: 'min(94vw, 138svh)', aspectRatio: '16 / 9' }}
      >
        {poster && <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30" />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="w-20 h-20 rounded-full bg-white/90 text-black flex items-center justify-center shadow-xl"
          >
            <Play size={34} fill="currentColor" className="ml-1.5" />
          </motion.span>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="text-white font-semibold text-sm leading-snug line-clamp-2">{first?.title || 'Shared on Truegle'}</p>
          <p className="text-white/55 text-[11px] mt-1">
            {sources.length > 1 ? `${sources.length} videos · plays straight through` : 'Plays on into related videos'}
          </p>
        </div>
      </div>
      <p className="mt-4 text-white/60 text-xs tracking-wide uppercase">Tap to play full screen</p>
    </motion.div>,
    document.body,
  );
}
