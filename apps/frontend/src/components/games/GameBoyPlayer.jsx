import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, RotateCcw } from 'lucide-react';
import { gameboyCore, fetchRom } from '../../utils/gameboyCore';
import { createGameboyKeys, GAMEBOY_KEYS } from '../../utils/gameboyKeys';
import { useTouchDevice } from '../../hooks/useTouchDevice';

// Game Boy player: the on-screen d-pad + A/B/Start/Select on a phone, and a
// KEYBOARD on a desktop (owner, 2026-11-11) — arrows or WASD for the d-pad, Space
// = B, Enter = A, E = Start, Q = Select (utils/gameboyKeys.js owns the map and the
// rules). A key press also lights the matching on-screen button. Still no gamepad
// support. The "games" search category promises a game you can play on a phone in a
// browser tab, and now at a desk too.
export default function GameBoyPlayer({ game, onClose }) {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | playing | error
  const [error, setError] = useState(null);
  const overlayRef = useRef(null);
  const touch = useTouchDevice();
  // Which buttons the KEYBOARD is holding, so the on-screen ones can light up.
  const [keyPressed, setKeyPressed] = useState({});

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
        await gameboyCore.loadRom(romBuffer, game.compat?.patches);
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
      // Clear any stuck button state on unmount to prevent phantom inputs.
      ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'].forEach((btn) => {
        gameboyCore.setInput(btn, false);
      });
    };
  }, [game]);

  // THE KEYBOARD. On window, while the player is open: a game does not wait for focus
  // to be in the right place. The rules (which keys, what is left alone, never a stuck
  // button) are in utils/gameboyKeys.js; this only wires them to the DOM and the core.
  useEffect(() => {
    if (!game) return undefined;
    // Take focus off whatever opened the player (usually the game's card, a button):
    // otherwise Enter or Space would press THAT button again instead of the game.
    overlayRef.current?.focus({ preventScroll: true });
    const keys = createGameboyKeys((button, pressed) => {
      setKeyPressed((prev) => (!!prev[button] === pressed ? prev : { ...prev, [button]: pressed }));
      gameboyCore.setInput(button, pressed);
    });
    const onDown = (e) => {
      if (!keys.keydown(e)) return;
      e.preventDefault(); // an arrow or Space would scroll the page behind the game
      if (!e.repeat) gameboyCore.resumeAudio(); // a key press is a user gesture, like a tap
    };
    const onUp = (e) => { if (keys.keyup(e)) e.preventDefault(); };
    const letGo = () => keys.releaseAll();
    const onHidden = () => { if (document.hidden) keys.releaseAll(); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', letGo);          // alt-tab with a key down: no stuck button
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', letGo);
      document.removeEventListener('visibilitychange', onHidden);
      keys.releaseAll();
    };
  }, [game]);

  const createHandler = useCallback((button) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      gameboyCore.resumeAudio();
      gameboyCore.setInput(button, true);
      // Best-effort: capture so a finger sliding off the button still
      // delivers pointerup/pointercancel here instead of going silent.
      // Some browsers reject capture for touch-synthesized pointers that
      // aren't "active" by their bookkeeping — that must never block the
      // actual input above, which is why it's called last, in a try/catch.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Input already registered above; capture is a reliability bonus.
      }
    },
    onPointerUp: (e) => {
      e.preventDefault();
      gameboyCore.setInput(button, false);
    },
    onPointerCancel: (e) => {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Nothing to release — fine.
      }
      gameboyCore.setInput(button, false);
    },
  }), []);

  if (!game) return null;

  const dpadBtn = 'absolute w-12 h-12 flex items-center justify-center bg-white/10 active:bg-white/25 text-white/80 select-none';
  // A key held on the keyboard lights the same on-screen button a finger would.
  const lit = (b) => (keyPressed[b] ? 'true' : undefined);
  const dp = (b) => `${dpadBtn} ${keyPressed[b] ? '!bg-white/35' : ''}`;
  const legend = [
    'Arrows / WASD move',
    ...GAMEBOY_KEYS.filter((k) => ['b', 'a', 'start', 'select'].includes(k.button)).map((k) => `${k.label} = ${k.name}`),
  ].join(' · ');

  // Portalled to <body> — a "fixed" overlay nested inside a Framer Motion
  // ancestor otherwise gets trapped by that ancestor's transform (any
  // motion.div with an active animate/exit creates a new containing block),
  // so it renders inline in the scroll flow instead of covering the viewport.
  return createPortal(
    <motion.div
      ref={overlayRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={game.name}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center px-3 py-3 outline-none"
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
            <button aria-label="Up" data-gb-button="up" data-pressed={lit('up')}
              className={`${dp('up')} top-0 left-1/2 -translate-x-1/2 rounded-t-md`}
              style={{ touchAction: 'none' }}
              {...createHandler('up')}>▲</button>
            <button aria-label="Down" data-gb-button="down" data-pressed={lit('down')}
              className={`${dp('down')} bottom-0 left-1/2 -translate-x-1/2 rounded-b-md`}
              style={{ touchAction: 'none' }}
              {...createHandler('down')}>▼</button>
            <button aria-label="Left" data-gb-button="left" data-pressed={lit('left')}
              className={`${dp('left')} left-0 top-1/2 -translate-y-1/2 rounded-l-md`}
              style={{ touchAction: 'none' }}
              {...createHandler('left')}>◀</button>
            <button aria-label="Right" data-gb-button="right" data-pressed={lit('right')}
              className={`${dp('right')} right-0 top-1/2 -translate-y-1/2 rounded-r-md`}
              style={{ touchAction: 'none' }}
              {...createHandler('right')}>▶</button>
            <div className="absolute w-6 h-6 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/5" />
          </div>

          {/* A / B */}
          <div className="flex items-end gap-3">
            <button aria-label="B" data-gb-button="b" data-pressed={lit('b')} className={`w-14 h-14 rounded-full ${keyPressed.b ? 'bg-rose-400' : 'bg-rose-500/80'} active:bg-rose-400 text-white font-bold text-sm select-none`}
              style={{ touchAction: 'none' }}
              {...createHandler('b')}>B</button>
            <button aria-label="A" data-gb-button="a" data-pressed={lit('a')} className={`w-14 h-14 rounded-full ${keyPressed.a ? 'bg-emerald-400' : 'bg-emerald-500/80'} active:bg-emerald-400 text-white font-bold text-sm select-none -translate-y-3`}
              style={{ touchAction: 'none' }}
              {...createHandler('a')}>A</button>
          </div>
        </div>

        {/* Start / Select */}
        <div className="flex items-center justify-center gap-6 pb-3">
          <button data-gb-button="select" data-pressed={lit('select')} className={`px-4 py-1.5 min-h-11 rounded-full ${keyPressed.select ? 'bg-white/35' : 'bg-white/10'} active:bg-white/20 text-[10px] tracking-wide text-white/70 select-none`}
            style={{ touchAction: 'none' }}
            {...createHandler('select')}>SELECT</button>
          <button data-gb-button="start" data-pressed={lit('start')} className={`px-4 py-1.5 min-h-11 rounded-full ${keyPressed.start ? 'bg-white/35' : 'bg-white/10'} active:bg-white/20 text-[10px] tracking-wide text-white/70 select-none`}
            style={{ touchAction: 'none' }}
            {...createHandler('start')}>START</button>
        </div>

        {/* The keys — shown on a desktop only (a phone has no keyboard to tell about). */}
        {!touch && (
          <p data-gameboy-keys="" className="px-4 pb-3 text-center text-[11px] leading-relaxed text-white/50">
            {legend}
          </p>
        )}

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
          {game.compat?.short && (
            <p data-gameboy-compat="" title={game.compat.note} className="mt-1 text-[10px] leading-snug text-white/30">{game.compat.short}</p>
          )}
        </div>
      </div>
    </motion.div>,
    document.body
  );
}
