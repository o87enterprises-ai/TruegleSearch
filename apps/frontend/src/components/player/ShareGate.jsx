import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
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
function fullscreenPlayerWhenReady(tries = 60) {
  const el = document.querySelector('[data-mini] [data-player-root]');
  if (el && el.requestFullscreen) {
    el.requestFullscreen().catch(() => { /* iPhone Safari: no element full screen — plays inline */ });
    return;
  }
  if (tries > 0) requestAnimationFrame(() => fullscreenPlayerWhenReady(tries - 1));
}

export default function ShareGate({ sources, onStart, playlistUrl = null }) {
  const { startFeed, setPlayMode, setMinimized } = usePlayer();
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

  const start = () => {
    setPlayMode('auto');
    if (playlistUrl) playAll(playlistUrl); else startFeed(sources);
    setMinimized(false);
    fullscreenPlayerWhenReady();
    onStart?.();
  };

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
