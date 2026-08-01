import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { X, Minus, Maximize2, Music, SkipBack, SkipForward, ListMusic } from 'lucide-react';

// Persistent pop-out mini-player. Rendered ABOVE <Routes> (in AppContent) so
// the media node it hosts is never unmounted on navigation — the source keeps
// playing while the user browses elsewhere.
//
// Features: draggable (by the header), resizable (bottom-right grip), a play
// queue with next/prev/jump, and — for native audio/video only — the Media
// Session API so playback continues with the screen off and shows OS
// lock-screen controls. YouTube/Vimeo embeds cannot play in the background
// (platform restriction), so Media Session is wired only for native media.
const DEFAULT_W = 340;
const MIN_W = 260;
const MAX_W = 720;
const BANNER_CLEARANCE = 80; // px above the bottom pre-production banner

export default function MiniPlayer() {
  const { current, queue, history, minimized, next, prev, jump, removeFromQueue, close, toggleMinimize } = usePlayer();
  const mediaRef = useRef(null);
  const drag = useRef(null);
  const [pos, setPos] = useState(null); // {left, top} once dragged; null = docked
  const [width, setWidth] = useState(DEFAULT_W);
  const [dragging, setDragging] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  // ── drag + resize (pointer events; a full-screen overlay during the gesture
  //    stops the iframe from swallowing pointermove) ────────────────────────
  const onMove = useCallback((e) => {
    const d = drag.current;
    if (!d) return;
    if (d.mode === 'move') {
      const left = Math.max(4, Math.min(e.clientX - d.dx, window.innerWidth - 80));
      const top = Math.max(4, Math.min(e.clientY - d.dy, window.innerHeight - 40));
      setPos({ left, top });
    } else {
      const w = Math.max(MIN_W, Math.min(d.startW + (e.clientX - d.startX), MAX_W, window.innerWidth - 16));
      setWidth(w);
    }
  }, []);

  const onUp = useCallback(() => {
    drag.current = null;
    setDragging(false);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  }, [onMove]);

  const startMove = useCallback((e) => {
    if (e.target.closest('button')) return; // let header buttons work
    e.preventDefault();
    const rect = e.currentTarget.closest('[data-mini]').getBoundingClientRect();
    drag.current = { mode: 'move', dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setDragging(true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [onMove, onUp]);

  const startResize = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.closest('[data-mini]').getBoundingClientRect();
    drag.current = { mode: 'resize', startX: e.clientX, startW: rect.width };
    setDragging(true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [onMove, onUp]);

  useEffect(() => () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  }, [onMove, onUp]);

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

  if (!current) return null;

  const { kind, src, title } = current;
  const isVideoIframe = kind === 'youtube' || kind === 'vimeo';
  const isSoundcloud = kind === 'soundcloud';
  const isIframe = isVideoIframe || isSoundcloud;
  const clipWhenMin = (isIframe || kind === 'video') && minimized;

  const style = pos
    ? { left: pos.left, top: pos.top, width }
    : { left: 16, bottom: BANNER_CLEARANCE, width };

  return (
    <>
      {/* Gesture overlay — captures pointer events over the iframe while
          dragging/resizing so the move doesn't get eaten by the embed. */}
      {dragging && (
        <div className="fixed inset-0 z-[9997]" style={{ cursor: drag.current?.mode === 'resize' ? 'nwse-resize' : 'move' }} />
      )}

      <div
        data-mini
        style={style}
        className={`fixed z-[9996] max-w-[calc(100vw-2rem)] rounded-xl overflow-hidden bg-[#0d0d14]/95 border border-white/15 backdrop-blur-xl shadow-2xl ${dragging ? 'select-none' : ''}`}
      >
        {/* Header (drag handle) — title + prev/next + queue + minimize + close */}
        <div onPointerDown={startMove} className="flex items-center gap-1 px-2.5 py-2 border-b border-white/10 cursor-move">
          <Music size={13} className="text-white/50 shrink-0" />
          <span className="text-xs text-white/70 truncate flex-1 min-w-0" title={title}>{title || 'Now playing'}</span>
          <button type="button" onClick={prev} disabled={!history.length} title="Previous"
            className="p-1 rounded text-white/50 enabled:hover:text-white enabled:hover:bg-white/10 disabled:opacity-25 transition-colors">
            <SkipBack size={13} />
          </button>
          <button type="button" onClick={next} disabled={!queue.length} title="Next"
            className="p-1 rounded text-white/50 enabled:hover:text-white enabled:hover:bg-white/10 disabled:opacity-25 transition-colors">
            <SkipForward size={13} />
          </button>
          <button type="button" onClick={() => setShowQueue((v) => !v)} title="Queue"
            className={`relative p-1 rounded hover:bg-white/10 transition-colors ${showQueue ? 'text-white' : 'text-white/50 hover:text-white'}`}>
            <ListMusic size={13} />
            {queue.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[13px] h-[13px] px-0.5 rounded-full bg-cyan-500 text-black text-[8px] font-bold leading-[13px] text-center">{queue.length}</span>
            )}
          </button>
          <button type="button" onClick={toggleMinimize} title={minimized ? 'Expand' : 'Minimize'}
            className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            {minimized ? <Maximize2 size={13} /> : <Minus size={13} />}
          </button>
          <button type="button" onClick={close} title="Close player"
            className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors">
            <X size={13} />
          </button>
        </div>

        {/* Media — kept mounted even while minimized (clipped to 0 height) so
            playback never stops. `key={src}` remounts on a source change. */}
        <div className={clipWhenMin ? 'max-h-0 overflow-hidden' : ''}>
          {isSoundcloud ? (
            // SoundCloud widget URL already carries auto_play; fixed height.
            <iframe
              key={src}
              src={src}
              className="w-full block"
              style={{ height: 166 }}
              title={title || 'SoundCloud player'}
              allow="autoplay"
            />
          ) : isVideoIframe ? (
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              <iframe
                key={src}
                src={`${src}${src.includes('?') ? '&' : '?'}autoplay=1`}
                className="absolute inset-0 w-full h-full"
                title={title || 'Video player'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : kind === 'video' ? (
            <video ref={mediaRef} key={src} src={src} controls autoPlay playsInline onEnded={next} className="w-full max-h-72 bg-black" />
          ) : (
            <audio ref={mediaRef} key={src} src={src} controls autoPlay onEnded={next} className="w-full" />
          )}
        </div>

        {/* Queue panel */}
        {showQueue && !minimized && (
          <div className="max-h-44 overflow-y-auto border-t border-white/10 bg-black/30">
            {queue.length === 0 ? (
              <div className="px-3 py-3 text-[11px] text-white/40">Queue is empty. Hit “pop out” on another result to add it here.</div>
            ) : (
              queue.map((q, i) => (
                <div key={`${q.src}-${i}`} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-white/5 group">
                  <span className="text-[10px] text-white/30 w-4 shrink-0">{i + 1}</span>
                  <button type="button" onClick={() => jump(i)} title="Play now"
                    className="text-[11px] text-white/70 hover:text-white truncate flex-1 text-left">
                    {q.title || q.src}
                  </button>
                  <button type="button" onClick={() => removeFromQueue(i)} title="Remove"
                    className="p-0.5 rounded text-white/30 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={11} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Resize grip in its own footer strip — never overlaps the media
            controls, and the initial grab always lands here (the overlay
            handles the rest of the gesture over the iframe). */}
        {!minimized && (
          <div className="flex justify-end px-1 py-0.5 border-t border-white/10 bg-black/20">
            <div onPointerDown={startResize} title="Drag to resize"
              className="w-4 h-4 cursor-nwse-resize flex items-end justify-end p-0.5">
              <span className="block w-2 h-2 border-r-2 border-b-2 border-white/30" />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
