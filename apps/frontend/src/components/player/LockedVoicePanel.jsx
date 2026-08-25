import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Play, X, SpellCheck, Loader2 } from 'lucide-react';
import { useVoiceDictation } from '../../hooks/useVoiceDictation';

/* ── Speaking to a locked player ────────────────────────────────────────────
 *
 * THE SHAPE OF THE ASK, in the user's own summary:
 *
 *   - Mic button on lock unlocks portions outside of viewport for user
 *     selections
 *   - can distinguish letters, punctuation, directional commands, etc.
 *   - uses user input directly into player
 *   - list drops down, viewport shrinks
 *   - user makes selection / play
 *   - list retracts & input disappears
 *
 * THE IDEA THAT MAKES IT COHERENT: the lock is about the TRANSPORT, not about
 * the screen. What the lock exists to prevent is a pocket skipping the track —
 * so play, pause, next and seek stay sealed, and everything else can be
 * reachable without weakening it at all. Choosing what to play next was never
 * the danger; a leg does not read a list and tap a row.
 *
 * So this panel sits ABOVE the lock sheet and is the one region that takes
 * input, and the viewport shrinks to make room for it rather than the list
 * covering the video. Shrinking is the honest version: a list floating over the
 * picture means picking a track blind, and this is meant to be usable while
 * driving, where looking twice is the cost that matters.
 *
 * THE MIC IS REVEALED, NOT PERSISTENT. It appears on a touch and fades out
 * again, for the same reason the lock exists: a button that is always live
 * under a locked sheet is a button a pocket can find.
 */

const REVEAL_MS = 4000;   // how long the mic stays visible after a touch

export default function LockedVoicePanel({
  visible,            // the screen was touched, so the controls are revealed
  dim = 0,
  volume,
  onVolume,
  onSearch,           // (query) => void   — run the search, fill the list
  onDismiss,          // close the panel and give the viewport back
  results = [],       // what the search found, for the drop-down list
  loading = false,
  onSelect,           // (result) => void  — play it; list retracts after
  onOpenPlaylist,     // the playlist button: opens the lists menu instead
}) {
  const [open, setOpen] = useState(false);      // the panel + list are showing
  const [query, setQuery] = useState('');
  const [holding, setHolding] = useState(false);
  const hideTimer = useRef(null);

  const voice = useVoiceDictation({
    onText: setQuery,
    onAction: (action, text) => {
      if (action === 'submit') { runSearch(text); return; }
      if (action === 'cancel') { setQuery(''); close(); return; }
      if (action === 'stop') voice.stop();
    },
    getVolume: () => volume,
    setVolume: onVolume,
  });

  const runSearch = useCallback((text) => {
    const q = String(text || '').trim();
    if (!q) return;
    voice.stop();
    setOpen(true);
    onSearch?.(q);
  }, [onSearch, voice]);

  const close = useCallback(() => {
    voice.stop();
    setOpen(false);
    setQuery('');
    onDismiss?.();
  }, [voice, onDismiss]);

  // Hold to talk. Releasing ends the utterance and runs what was heard —
  // push-to-talk rather than a toggle, because a microphone left open under a
  // lock is a microphone open in a pocket.
  const startHold = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setHolding(true);
    setOpen(true);
    voice.start(query);
  }, [voice, query]);

  const endHold = useCallback((e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!holding) return;
    setHolding(false);
    voice.stop();
    // A hold that produced words searches on release. Saying "search" ends it
    // early; this is for everyone who just lets go.
    if (query.trim()) runSearch(query);
  }, [holding, voice, query, runSearch]);

  // The reveal timer. Any touch on the sheet re-arms it.
  useEffect(() => {
    clearTimeout(hideTimer.current);
    if (!visible || open) return undefined;
    hideTimer.current = setTimeout(() => { /* fades via `visible` upstream */ }, REVEAL_MS);
    return () => clearTimeout(hideTimer.current);
  }, [visible, open]);

  // A selection retracts the list and clears the input, per the ask. The
  // player stays locked throughout — only this panel was ever unlocked.
  const pick = useCallback((r) => {
    onSelect?.(r);
    setQuery('');
    setOpen(false);
    onDismiss?.();
  }, [onSelect, onDismiss]);

  if (!voice.supported && !open) return null;

  return (
    <>
      {/* ── The microphone, under the padlock ────────────────────────────────
          Placed below the lock button because that is where the ask puts it and
          because the padlock is the thing already at the centre — the two
          controls that exist under a lock belong together rather than in
          opposite corners. */}
      <AnimatePresence>
        {visible && !open && voice.supported && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerCancel={endHold}
            onPointerLeave={endHold}
            onContextMenu={(e) => e.preventDefault()}
            title="Hold to say what you want to hear next"
            aria-label="Hold to search by voice"
            className="absolute left-1/2 -translate-x-1/2 top-1/2 mt-12 flex items-center justify-center w-12 h-12 rounded-full bg-black/70 border border-white/20 text-white/80"
            style={{ touchAction: 'none' }}
          >
            <Mic size={18} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── The panel ────────────────────────────────────────────────────────
          Bottom-anchored, so the viewport shrinking above it reveals the list
          rather than the list covering the video. */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
            className="absolute inset-x-0 bottom-0 z-50 max-h-[62%] flex flex-col bg-black/95 border-t border-white/15"
            // The panel is the ONE region that takes input while locked, so it
            // must not inherit the sheet's swallow-everything handlers.
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              // It dims with the screen, like everything else under the lock —
              // otherwise turning the brightness down leaves one bright panel
              // glowing in the dark.
              opacity: 1 - dim * 0.9,
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10">
              <button
                type="button"
                onPointerDown={startHold}
                onPointerUp={endHold}
                onPointerCancel={endHold}
                aria-label="Hold to speak"
                className={`flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0 border transition-colors ${
                  voice.listening
                    ? 'bg-red-500/25 border-red-400/60 text-red-200'
                    : 'bg-white/5 border-white/20 text-white/70'
                }`}
                style={{ touchAction: 'none' }}
              >
                <Mic size={17} />
              </button>

              <div className="min-w-0 flex-1">
                <input
                  value={query + (voice.heard ? ` ${voice.heard}` : '')}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') runSearch(query); }}
                  placeholder={voice.listening ? 'Listening…' : 'Hold the mic and say what you want'}
                  aria-label="What to play next"
                  className="w-full bg-transparent text-white text-sm outline-none placeholder:text-white/35"
                />
                <p className="text-[10px] text-white/35 mt-0.5">
                  {voice.error
                    ? voice.error
                    : voice.spelling
                      ? 'Spelling — say letters, "space", "period". Say "stop spelling" to go back.'
                      : 'Say "spelling" to spell a name out, or "search" to run it.'}
                </p>
              </div>

              {/* Spelling is reachable by voice ("spelling"), but it is also a
                  button, because discovering a spoken trigger requires being
                  told about it first. */}
              <button
                type="button"
                onClick={() => voice.setSpelling((v) => !v)}
                title="Spell it out letter by letter"
                aria-label="Toggle spelling mode"
                aria-pressed={voice.spelling}
                className={`p-2 rounded-lg flex-shrink-0 ${voice.spelling ? 'text-cyan-300 bg-cyan-500/15' : 'text-white/45'}`}
              >
                <SpellCheck size={16} />
              </button>

              <button
                type="button"
                onClick={close}
                title="Close and give the picture back"
                aria-label="Close voice search"
                className="p-2 rounded-lg text-white/45 flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>

            {/* ── The list ─────────────────────────────────────────────────
                Selectable while the transport stays locked — see the header
                note on why that is not a hole in the lock. */}
            <div className="overflow-y-auto overscroll-contain flex-1">
              {loading && (
                <div className="flex items-center gap-2 px-4 py-6 text-white/50 text-sm">
                  <Loader2 size={14} className="animate-spin" /> Looking…
                </div>
              )}
              {!loading && results.length === 0 && query.trim() && (
                <p className="px-4 py-6 text-white/40 text-sm">Nothing found for that.</p>
              )}
              {!loading && results.map((r) => (
                <button
                  key={r.src || r.url}
                  type="button"
                  onClick={() => pick(r)}
                  // Deliberately tall: this is meant to be usable at arm's
                  // length in a car, where a 32px row is a missed tap.
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-white/5 active:bg-white/10"
                >
                  <Play size={14} className="text-white/40 flex-shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-white truncate">{r.title || r.url}</span>
                    {r.channel && (
                      <span className="block text-[11px] text-white/40 truncate">{r.channel}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>

            {onOpenPlaylist && (
              // "If the playlist button is selected however, the input /
              // results DO NOT return, and the lists menu opens." So this
              // leaves rather than searching — a different destination, not a
              // different filter.
              <button
                type="button"
                onClick={() => { setQuery(''); setOpen(false); onOpenPlaylist(); }}
                className="px-4 py-3 text-left text-xs text-white/50 border-t border-white/10 active:bg-white/5"
              >
                Open your playlists instead
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
