import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import {
  X, Minus, Maximize2, Music, SkipBack, SkipForward, ListMusic,
  Move, Plus, Share2, Check, GripHorizontal, Minimize2,
} from 'lucide-react';
import QueueAddMenu from './QueueAddMenu';
import { buildPlayerLink } from '../../utils/playerLink';

// Persistent pop-out mini-player. Rendered ABOVE <Routes> (in AppContent) so
// the media node it hosts is never unmounted on navigation — the source keeps
// playing while the user browses elsewhere.
//
// Features: draggable, resizable, a play queue with next/prev/jump and a "+"
// that adds from device / link / search, share-as-Truegle-player-link, and —
// for native audio/video only — the Media Session API so playback continues
// with the screen off and shows OS lock-screen controls. YouTube/Vimeo embeds
// cannot play in the background (platform restriction), so Media Session is
// wired only for native media.
//
// MOBILE: every drag surface sets `touch-action: none`. Without it the browser
// claims the touch for page scrolling before pointermove ever fires, which is
// what made the player feel immovable on a phone. Handles are also sized for a
// thumb, and "Adjust" mode turns the whole player into one big drag target
// with oversized grips so you don't have to hit a 16px corner.
const DEFAULT_W = 340;
const MIN_W = 240;
const MAX_W = 900;
const STEP = 60;              // px per tap of the −/+ size buttons
const BANNER_CLEARANCE = 80;  // px above the bottom pre-production banner
const GEOM_KEY = 'truegle_player_geom';

// Cross-origin embeds run sandboxed. `allow-same-origin` here grants the frame
// ITS OWN origin (youtube-nocookie/vimeo/soundcloud), never ours — the embeds
// need it for storage and won't play without it. What's deliberately withheld
// is `allow-top-navigation*`: that's the permission that lets an embed yank the
// whole tab somewhere else, and withholding it is what makes a shared Truegle
// player link safe to open. Same lesson as the 2026-08-01 ad hijack: CSP does
// not stop top-navigation, only the sandbox does.
const PLAYER_SANDBOX = 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox';

const clampW = (w) => Math.max(MIN_W, Math.min(w, MAX_W, window.innerWidth - 16));

const loadGeom = () => {
  try {
    const g = JSON.parse(localStorage.getItem(GEOM_KEY) || 'null');
    return g && typeof g.width === 'number' ? g : null;
  } catch { return null; }
};

export default function MiniPlayer() {
  const {
    current, queue, history, minimized,
    next, prev, jump, removeFromQueue, close, toggleMinimize,
  } = usePlayer();
  const mediaRef = useRef(null);
  const drag = useRef(null);
  const saved = useRef(loadGeom());

  const [pos, setPos] = useState(saved.current?.pos || null); // {left, top}; null = docked
  const [width, setWidth] = useState(saved.current?.width || DEFAULT_W);
  const [dragging, setDragging] = useState(false);
  const [adjust, setAdjust] = useState(false);   // mobile stretch/shrink/drag mode
  const [showQueue, setShowQueue] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [shared, setShared] = useState(false);

  // ── drag + resize ────────────────────────────────────────────────────────
  const onMove = useCallback((e) => {
    const d = drag.current;
    if (!d) return;
    e.preventDefault();
    if (d.mode === 'move') {
      const left = Math.max(4, Math.min(e.clientX - d.dx, window.innerWidth - 80));
      const top = Math.max(4, Math.min(e.clientY - d.dy, window.innerHeight - 40));
      setPos({ left, top });
    } else {
      setWidth(clampW(d.startW + (e.clientX - d.startX)));
    }
  }, []);

  const onUp = useCallback(() => {
    drag.current = null;
    setDragging(false);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  }, [onMove]);

  const begin = useCallback((e, spec) => {
    e.preventDefault();
    drag.current = spec;
    setDragging(true);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }, [onMove, onUp]);

  const startMove = useCallback((e) => {
    if (e.target.closest('button, input, a')) return; // let controls work
    const rect = e.currentTarget.closest('[data-mini]').getBoundingClientRect();
    begin(e, { mode: 'move', dx: e.clientX - rect.left, dy: e.clientY - rect.top });
  }, [begin]);

  const startResize = useCallback((e) => {
    e.stopPropagation();
    const rect = e.currentTarget.closest('[data-mini]').getBoundingClientRect();
    begin(e, { mode: 'resize', startX: e.clientX, startW: rect.width });
  }, [begin]);

  useEffect(() => () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  }, [onMove, onUp]);

  // Remember where the user put it — re-dragging the player on every visit was
  // half of what made it feel fiddly.
  useEffect(() => {
    try { localStorage.setItem(GEOM_KEY, JSON.stringify({ pos, width })); } catch { /* private mode */ }
  }, [pos, width]);

  // A rotate or a smaller window must not strand the player off-screen.
  useEffect(() => {
    const onResize = () => {
      setWidth((w) => clampW(w));
      setPos((p) => (p ? {
        left: Math.max(4, Math.min(p.left, window.innerWidth - 80)),
        top: Math.max(4, Math.min(p.top, window.innerHeight - 40)),
      } : p));
    };
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Media Session: lock-screen controls + background audio (native only) ──
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const isNative = current && (current.kind === 'audio' || current.kind === 'video');
    if (!isNative) { try { navigator.mediaSession.metadata = null; } catch { /* noop */ } return; }
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: current.title || 'Truegle',
        artist: 'Truegle',
        artwork: current.poster ? [{ src: current.poster }] : [],
      });
    } catch { /* MediaMetadata unsupported */ }
    const set = (act, fn) => { try { navigator.mediaSession.setActionHandler(act, fn); } catch { /* unsupported action */ } };
    set('play', () => mediaRef.current?.play());
    set('pause', () => mediaRef.current?.pause());
    set('previoustrack', history.length ? prev : null);
    set('nexttrack', queue.length ? next : null);
    return () => ['play', 'pause', 'previoustrack', 'nexttrack'].forEach((act) => set(act, null));
  }, [current, history.length, queue.length, next, prev]);

  // ── share the current queue as a Truegle player link ─────────────────────
  const share = useCallback(async () => {
    const link = buildPlayerLink([current, ...queue].filter(Boolean));
    if (!link) return; // e.g. a local file — nothing shareable about a blob URL
    const title = current?.title || 'Watch on Truegle';
    try {
      if (navigator.share) await navigator.share({ title, url: link });
      else await navigator.clipboard.writeText(link);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch { /* user dismissed the sheet */ }
  }, [current, queue]);

  if (!current) return null;

  const { kind, src, title } = current;
  const isVideoIframe = kind === 'youtube' || kind === 'vimeo';
  const isSoundcloud = kind === 'soundcloud';
  const isIframe = isVideoIframe || isSoundcloud;
  const clipWhenMin = (isIframe || kind === 'video') && minimized;
  const shareable = !!buildPlayerLink([current, ...queue].filter(Boolean));

  const style = pos
    ? { left: pos.left, top: pos.top, width }
    : { left: 16, bottom: BANNER_CLEARANCE, width };

  // Every control is a ≥36px square. The old 13px icons packed edge to edge
  // were the other half of the "hard to maneuver" problem.
  const ctrl = 'flex items-center justify-center w-9 h-9 rounded-lg text-white/60 enabled:hover:text-white enabled:hover:bg-white/10 disabled:opacity-25 transition-colors';

  return (
    <>
      {/* Gesture overlay — captures pointer events over the iframe while
          dragging/resizing so the move doesn't get eaten by the embed. */}
      {dragging && (
        <div
          className="fixed inset-0 z-[9997]"
          style={{ touchAction: 'none', cursor: drag.current?.mode === 'resize' ? 'nwse-resize' : 'move' }}
        />
      )}

      <div
        data-mini
        style={style}
        className={`fixed z-[9996] max-w-[calc(100vw-1rem)] rounded-xl overflow-hidden bg-[#0d0d14]/95 backdrop-blur-xl shadow-2xl transition-shadow ${
          adjust
            ? 'border-2 border-cyan-400 shadow-[0_0_0_4px_rgba(34,211,238,0.15)]'
            : 'border border-white/15'
        } ${dragging ? 'select-none' : ''}`}
      >
        {/* ── Grab bar. Thick on purpose: 44px tall, full width, with a visible
            grip so it reads as "hold here to move me". ── */}
        <div
          onPointerDown={startMove}
          style={{ touchAction: 'none' }}
          className={`flex items-center gap-1.5 px-2 min-h-[44px] border-b cursor-move ${
            adjust ? 'bg-cyan-400/15 border-cyan-400/30' : 'border-white/10'
          }`}
        >
          <GripHorizontal size={18} className={adjust ? 'text-cyan-300 shrink-0' : 'text-white/40 shrink-0'} />
          {kind === 'audio' && <Music size={13} className="text-white/40 shrink-0" />}
          <span className="text-xs text-white/70 truncate flex-1 min-w-0" title={title}>
            {title || 'Now playing'}
          </span>
          <button type="button" onClick={toggleMinimize} title={minimized ? 'Expand' : 'Minimize'} className={ctrl}>
            {minimized ? <Maximize2 size={16} /> : <Minus size={16} />}
          </button>
          <button type="button" onClick={close} title="Close player" className={ctrl}>
            <X size={16} />
          </button>
        </div>

        {/* Media — kept mounted even while minimized (clipped to 0 height) so
            playback never stops. `key={src}` remounts on a source change. */}
        <div className={`relative ${clipWhenMin ? 'max-h-0 overflow-hidden' : ''}`}>
          {isSoundcloud ? (
            // SoundCloud widget URL already carries auto_play; fixed height.
            <iframe
              key={src}
              src={src}
              className="w-full block"
              style={{ height: 166 }}
              title={title || 'SoundCloud player'}
              sandbox={PLAYER_SANDBOX}
              allow="autoplay"
            />
          ) : isVideoIframe ? (
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              <iframe
                key={src}
                src={`${src}${src.includes('?') ? '&' : '?'}autoplay=1`}
                className="absolute inset-0 w-full h-full"
                title={title || 'Video player'}
                sandbox={PLAYER_SANDBOX}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : kind === 'video' ? (
            <video ref={mediaRef} key={src} src={src} controls autoPlay playsInline onEnded={next}
              style={{ maxHeight: Math.round(width * 0.75) }} className="w-full bg-black" />
          ) : (
            <audio ref={mediaRef} key={src} src={src} controls autoPlay onEnded={next} className="w-full" />
          )}

          {/* In Adjust mode the media becomes a drag surface: the shield stops
              the iframe swallowing the touch, so you can grab the video itself
              and move the player instead of hunting for the title bar. */}
          {adjust && !clipWhenMin && (
            <div
              onPointerDown={startMove}
              style={{ touchAction: 'none' }}
              className="absolute inset-0 z-10 cursor-move bg-cyan-400/5 flex items-center justify-center"
            >
              <span className="px-3 py-1.5 rounded-full bg-black/70 border border-cyan-400/40 text-[11px] text-cyan-200 pointer-events-none">
                Drag to move
              </span>
            </div>
          )}
        </div>

        {/* ── Adjust bar: stretch / shrink without needing a precise grip ── */}
        {adjust && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-t border-cyan-400/20 bg-cyan-400/10">
            <span className="text-[10px] text-cyan-200/70 uppercase tracking-wider mr-auto">Size</span>
            <button type="button" onClick={() => setWidth((w) => clampW(w - STEP))} title="Shrink"
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-black/30 text-cyan-200 hover:bg-black/50 transition-colors">
              <Minus size={16} />
            </button>
            <button type="button" onClick={() => setWidth((w) => clampW(w + STEP))} title="Stretch"
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-black/30 text-cyan-200 hover:bg-black/50 transition-colors">
              <Plus size={16} />
            </button>
            <button type="button" onClick={() => { setPos(null); setWidth(DEFAULT_W); }} title="Snap back to the corner"
              className="flex items-center justify-center w-9 h-9 rounded-lg bg-black/30 text-cyan-200 hover:bg-black/50 transition-colors">
              <Minimize2 size={15} />
            </button>
            <button type="button" onClick={() => setAdjust(false)}
              className="px-3 h-9 rounded-lg bg-cyan-400 text-black text-xs font-semibold hover:bg-cyan-300 transition-colors">
              Done
            </button>
          </div>
        )}

        {/* ── Transport row: prev / next / queue / add / share / adjust ── */}
        <div className="flex items-center gap-0.5 px-1.5 py-1 border-t border-white/10 bg-black/20">
          <button type="button" onClick={prev} disabled={!history.length} title="Previous" className={ctrl}>
            <SkipBack size={16} />
          </button>
          <button type="button" onClick={next} disabled={!queue.length} title="Next" className={ctrl}>
            <SkipForward size={16} />
          </button>
          <button
            type="button"
            onClick={() => { setShowQueue((v) => !v); setShowAdd(false); }}
            title="Queue"
            className={`relative ${ctrl} ${showQueue ? 'text-white bg-white/10' : ''}`}
          >
            <ListMusic size={16} />
            {queue.length > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-cyan-500 text-black text-[9px] font-bold leading-[14px] text-center">
                {queue.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => { setShowAdd((v) => !v); setShowQueue(true); }}
            title="Add media to the queue — device, link, or search"
            // Distinct from the per-result "Add to queue" buttons out on the
            // page: this one opens the picker, it doesn't add anything itself.
            aria-label="Add media to queue"
            className={`${ctrl} ${showAdd ? 'text-white bg-white/10' : ''}`}
          >
            <Plus size={18} />
          </button>

          <div className="ml-auto flex items-center gap-0.5">
            {shareable && (
              <button type="button" onClick={share} title="Share a Truegle player link — opens inside Truegle's sandboxed player"
                className={`${ctrl} ${shared ? 'text-green-400' : ''}`}>
                {shared ? <Check size={16} /> : <Share2 size={16} />}
              </button>
            )}
            <button
              type="button"
              onClick={() => setAdjust((v) => !v)}
              title={adjust ? 'Finish moving/resizing' : 'Move and resize the player'}
              aria-pressed={adjust}
              className={`${ctrl} ${adjust ? 'text-black bg-cyan-400 hover:bg-cyan-300 hover:text-black' : ''}`}
            >
              <Move size={16} />
            </button>
          </div>
        </div>

        {/* Queue panel */}
        {showQueue && !minimized && (
          <div className="border-t border-white/10 bg-black/30">
            {showAdd && <QueueAddMenu onClose={() => setShowAdd(false)} />}
            <div className="max-h-44 overflow-y-auto">
              {queue.length === 0 ? (
                <div className="px-3 py-3 text-[11px] text-white/40">
                  Queue is empty. Hit <Plus size={11} className="inline -mt-0.5" /> to add from your device, a link, or a search
                  — or “add to queue” on any playable result while you scroll.
                </div>
              ) : (
                queue.map((q, i) => (
                  <div key={`${q.src}-${i}`} className="flex items-center gap-2 px-2 hover:bg-white/5 group">
                    <span className="text-[10px] text-white/30 w-4 shrink-0">{i + 1}</span>
                    <button type="button" onClick={() => jump(i)} title="Play now"
                      className="text-[11px] text-white/70 hover:text-white truncate flex-1 text-left min-h-[36px]">
                      {q.title || q.src}
                    </button>
                    <button type="button" onClick={() => removeFromQueue(i)} title="Remove"
                      className="flex items-center justify-center w-8 h-8 rounded text-white/30 hover:text-white hover:bg-white/10 transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Resize grip in its own footer strip — never overlaps the media
            controls. Doubles in size in Adjust mode so a thumb can find it. */}
        {!minimized && (
          <div className={`flex justify-end border-t ${adjust ? 'border-cyan-400/20 bg-cyan-400/10' : 'border-white/10 bg-black/20'}`}>
            <div
              onPointerDown={startResize}
              title="Drag to resize"
              style={{ touchAction: 'none' }}
              className={`cursor-nwse-resize flex items-end justify-end p-1.5 ${adjust ? 'w-11 h-11' : 'w-8 h-6'}`}
            >
              <span className={`block border-r-2 border-b-2 ${adjust ? 'w-4 h-4 border-cyan-300' : 'w-2.5 h-2.5 border-white/40'}`} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
