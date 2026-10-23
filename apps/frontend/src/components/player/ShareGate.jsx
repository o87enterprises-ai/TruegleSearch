import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Play, RotateCcw, Mail } from 'lucide-react';
import { usePlayAll } from '../../hooks/usePlayAll';
import { usePlayer } from '../../context/PlayerContext';
import { mediaKey } from '../../utils/videoEmbed';

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
const CHECK_MS = 3000;
const REPORT_TO = 'truegleai@proton.me';

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

export function reportHref(errors) {
  const body = [
    'Tapped Play on a shared link and the player did not open.',
    '',
    '---',
    `Page: ${location.href}`,
    `Browser: ${navigator.userAgent}`,
    `Errors: ${errors.length ? errors.join(' | ') : 'none caught'}`,
  ].join('\n');
  return `mailto:${REPORT_TO}?subject=${encodeURIComponent('Truegle: shared link would not play')}&body=${encodeURIComponent(body.slice(0, 1800))}`;
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
  useEffect(() => {
    if (phase !== 'starting') return undefined;
    const note = (msg) => { if (msg && errors.current.length < 5) errors.current.push(String(msg).slice(0, 200)); };
    const onErr = (e) => note(e.message || e.error);
    const onRej = (e) => note(e.reason?.message || e.reason);
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);
    const t = setTimeout(() => {
      if (playerOnScreen()) onStart?.(); else setPhase('failed');
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
      fullscreenPlayerWhenReady(requestFullscreen);
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
