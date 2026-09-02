import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, RotateCcw } from 'lucide-react';
import { gameboyCore, fetchRom } from '../../utils/gameboyCore';

// Touch-only Game Boy player. No physical-controller support by design —
// the on-screen d-pad + A/B/Start/Select are the entire input surface,
// which is what the "games" search category promises: playable without
// a keyboard or gamepad, on a phone in a browser tab.
export default function GameBoyPlayer({ game, onClose }) {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | playing | error
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const canvas = canvasRef.current;
    if (!canvas || !game) return;

    (async () => {
      try {
        setStatus('loading');
        await gameboyCore.initialize(canvas);
        const romBuffer = await fetchRom(game.romPath);
        if (!mounted) return;
        await gameboyCore.loadRom(romBuffer);
        if (!mounted) return;
        await gameboyCore.start();
        if (!mounted) return;
        setStatus('playing');
      } catch (err) {
        console.error('[GameBoyPlayer] failed to start', err);
        if (mounted) {
          setError(err.message || 'Failed to start this game');
          setStatus('error');
        }
      }
    })();

    return () => {
      mounted = false;
      gameboyCore.stop();
    };
  }, [game]);

  const press = useCallback((button) => (e) => {
    e.preventDefault();
    gameboyCore.resumeAudio();
    gameboyCore.setInput(button, true);
  }, []);

  const release = useCallback((button) => (e) => {
    e?.preventDefault();
    gameboyCore.setInput(button, false);
  }, []);

  if (!game) return null;

  const dpadBtn = 'absolute w-9 h-9 flex items-center justify-center bg-white/10 active:bg-white/25 text-white/80 select-none touch-none';

  // Portalled to <body> — a "fixed" overlay nested inside a Framer Motion
  // ancestor otherwise gets trapped by that ancestor's transform (any
  // motion.div with an active animate/exit creates a new containing block),
  // so it renders inline in the scroll flow instead of covering the viewport.
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center px-3 py-3"
    >
      <div className="w-full max-w-sm max-h-full rounded-2xl bg-gradient-to-b from-[#1a1a2e] to-[#0f0f1a] border-2 border-white/10 shadow-2xl overflow-y-auto flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 shrink-0">
          <span className="text-sm font-semibold text-white truncate">{game.name}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => gameboyCore.reset()}
              title="Reset"
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Screen */}
        <div className="relative bg-black flex items-center justify-center py-2 shrink-0">
          {status === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 z-10">
              <span className="text-2xl">{game.icon}</span>
              <span className="text-xs text-white/60">Loading {game.name}…</span>
            </div>
          )}
          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/90 z-10 px-6 text-center">
              <span className="text-xs text-red-400">{error}</span>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white"
              >
                Back
              </button>
            </div>
          )}
          <canvas
            ref={canvasRef}
            width={160}
            height={144}
            className="w-full max-w-[220px] aspect-[10/9] image-rendering-pixelated"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        {/* Touch controls */}
        <div className="flex items-center justify-between px-6 py-3 bg-black/30 shrink-0">
          {/* D-pad */}
          <div className="relative w-24 h-24">
            <button aria-label="Up" className={`${dpadBtn} top-0 left-1/2 -translate-x-1/2 rounded-t-md`}
              onTouchStart={press('up')} onTouchEnd={release('up')}
              onMouseDown={press('up')} onMouseUp={release('up')} onMouseLeave={release('up')}>▲</button>
            <button aria-label="Down" className={`${dpadBtn} bottom-0 left-1/2 -translate-x-1/2 rounded-b-md`}
              onTouchStart={press('down')} onTouchEnd={release('down')}
              onMouseDown={press('down')} onMouseUp={release('down')} onMouseLeave={release('down')}>▼</button>
            <button aria-label="Left" className={`${dpadBtn} left-0 top-1/2 -translate-y-1/2 rounded-l-md`}
              onTouchStart={press('left')} onTouchEnd={release('left')}
              onMouseDown={press('left')} onMouseUp={release('left')} onMouseLeave={release('left')}>◀</button>
            <button aria-label="Right" className={`${dpadBtn} right-0 top-1/2 -translate-y-1/2 rounded-r-md`}
              onTouchStart={press('right')} onTouchEnd={release('right')}
              onMouseDown={press('right')} onMouseUp={release('right')} onMouseLeave={release('right')}>▶</button>
            <div className="absolute w-9 h-9 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/5" />
          </div>

          {/* A / B */}
          <div className="flex items-end gap-3">
            <button aria-label="B" className="w-12 h-12 rounded-full bg-rose-500/80 active:bg-rose-400 text-white font-bold text-sm select-none touch-none"
              onTouchStart={press('b')} onTouchEnd={release('b')}
              onMouseDown={press('b')} onMouseUp={release('b')} onMouseLeave={release('b')}>B</button>
            <button aria-label="A" className="w-12 h-12 rounded-full bg-emerald-500/80 active:bg-emerald-400 text-white font-bold text-sm select-none touch-none -translate-y-3"
              onTouchStart={press('a')} onTouchEnd={release('a')}
              onMouseDown={press('a')} onMouseUp={release('a')} onMouseLeave={release('a')}>A</button>
          </div>
        </div>

        {/* Start / Select */}
        <div className="flex items-center justify-center gap-6 pb-5">
          <button className="px-4 py-1.5 rounded-full bg-white/10 active:bg-white/20 text-[10px] tracking-wide text-white/70 select-none touch-none"
            onTouchStart={press('select')} onTouchEnd={release('select')}
            onMouseDown={press('select')} onMouseUp={release('select')} onMouseLeave={release('select')}>SELECT</button>
          <button className="px-4 py-1.5 rounded-full bg-white/10 active:bg-white/20 text-[10px] tracking-wide text-white/70 select-none touch-none"
            onTouchStart={press('start')} onTouchEnd={release('start')}
            onMouseDown={press('start')} onMouseUp={release('start')} onMouseLeave={release('start')}>START</button>
        </div>

        {/* Attribution — required by the game's license */}
        <div className="px-4 pb-3 text-center">
          <a
            href={game.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
          >
            {game.name} by {game.developer} · {game.license}
          </a>
        </div>
      </div>
    </motion.div>,
    document.body
  );
}
