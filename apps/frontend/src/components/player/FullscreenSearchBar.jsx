import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, X, Play, Loader2, Mic, ClipboardPaste, ArrowRight } from 'lucide-react';
import { isPlaylistUrl } from '../../utils/playlistImport';
import { usePlayAll } from '../../hooks/usePlayAll';

/* ── The drop-down bar in full screen ───────────────────────────────────────
 *
 * "Add a drop down text bar in full screen mode on mobile."
 *
 * WHY IT HAS TO BE A DROP-DOWN AND NOT JUST A BAR. Full screen is a picture
 * with nothing on it — that is the point of full screen. A search field parked
 * permanently across the top would be a strip of chrome over every video
 * forever, to serve the minority of moments when somebody wants to change what
 * is playing. So the handle is a tab: a thumb-sized target at the top edge that
 * pulls the bar down when it is wanted and puts it away again when it is not.
 *
 * IT DROPS FROM BELOW THE SAFE INSET, deliberately. The row along the very top
 * of a phone screen belongs to the notification shade, and a control placed
 * there loses every race with it — the user swipes for our bar and gets their
 * own settings panel. So the handle starts underneath.
 *
 * THIS IS NOT THE LOCKED PANEL. That one (LockedVoicePanel) is the version for
 * a player whose transport is sealed, reached by holding a microphone, built
 * for a phone on a dashboard. This is the ordinary one for an unlocked full
 * screen, where the keyboard is available and tapping is fine.
 */
export default function FullscreenSearchBar({
  results = [],
  loading = false,
  onSearch,
  onSelect,
  onVoice,          // optional — omitted when the browser has no recogniser
  accent = '#f43f5e',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  // Opening should put the cursor where the user is about to type. Deferred a
  // frame: focusing an element that is still sliding in gets the keyboard and
  // the animation fighting over the viewport on Android.
  useEffect(() => {
    if (!open) return undefined;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Escape closes, because a bar over a video with no visible way out is the
  // thing people press Escape for.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // A playlist link is Play All here too (usePlayAll) — this bar used to hand
  // it to the search, which "played" YouTube's broken playlist embed.
  const { playAll, busy: listBusy } = usePlayAll();

  const submit = useCallback(() => {
    const q = query.trim();
    if (!q) return;
    if (isPlaylistUrl(q)) {
      playAll(q).then((r) => { if (r.ok) { setQuery(''); setOpen(false); } });
      return;
    }
    onSearch?.(q);
  }, [query, onSearch, playAll]);

  // X works like YouTube's: text in the box → clear it and stay; empty → close.
  // It used to close AND clear in one go, which read as "X doesn't clear" —
  // the bar vanished with the text instead of giving an empty box to type in.
  const clearOrClose = useCallback(() => {
    if (query) { setQuery(''); onSearch?.(''); inputRef.current?.focus(); return; }
    setOpen(false);
  }, [query, onSearch]);

  // Our own Paste. In landscape full screen the phone's paste bubble opens
  // ABOVE a field at the top edge — off the screen. Needs a tap (it is one)
  // and clipboard permission; where the browser refuses, the long-press still
  // works, now with room for its bubble (see the top padding below).
  const canPaste = typeof navigator !== 'undefined' && !!navigator.clipboard?.readText;
  const paste = useCallback(async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) { setQuery(text); inputRef.current?.focus(); }
    } catch { inputRef.current?.focus(); }
  }, []);

  const pick = useCallback((r) => {
    if (r?.playlistUrl) { playAll(r.playlistUrl); setQuery(''); setOpen(false); return; }
    onSelect?.(r);
    // Same contract as everywhere else in the player: a selection puts the
    // list away and empties the box. Nobody wants to close their own search
    // after choosing from it.
    setQuery('');
    setOpen(false);
  }, [onSelect]);

  return (
    <div className="absolute inset-x-0 top-0 z-30 pointer-events-none">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ y: '-100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '-100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            className="pointer-events-auto bg-black/95 border-b border-white/15 backdrop-blur-sm"
            // Room above the field for the phone's own paste/copy bubble, which
            // opens above a focused field and fell off the top of the screen.
            style={{ paddingTop: 'max(env(safe-area-inset-top), 40px)' }}
          >
            <div data-fs-search="" className="flex items-center gap-2 px-3 py-2.5">
              <Search size={16} className="text-white/40 flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                enterKeyHint="search"
                inputMode="search"
                placeholder="Search for something to play…"
                aria-label="Search for something to play"
                className="flex-1 min-w-0 bg-transparent text-white text-sm outline-none placeholder:text-white/35"
              />
              {onVoice && (
                <button
                  type="button"
                  onClick={onVoice}
                  title="Say it instead"
                  aria-label="Search by voice"
                  className="p-2 rounded-lg text-white/50 hover:text-white flex-shrink-0"
                >
                  <Mic size={15} />
                </button>
              )}
              {!query && canPaste && (
                <button
                  type="button"
                  onClick={paste}
                  title="Paste"
                  aria-label="Paste"
                  data-fs-paste=""
                  className="p-2 rounded-lg text-white/50 hover:text-white flex-shrink-0"
                >
                  <ClipboardPaste size={15} />
                </button>
              )}
              <button
                type="button"
                onClick={clearOrClose}
                title={query ? 'Clear' : 'Close'}
                aria-label={query ? 'Clear the search' : 'Close search'}
                data-fs-clear=""
                className="p-2 rounded-lg text-white/50 hover:text-white flex-shrink-0"
              >
                <X size={15} />
              </button>
              {/* Enter, as a button: a phone keyboard in landscape full screen
                  often hides its own, and there was no other way to submit. */}
              {query.trim() && (
                <button
                  type="button"
                  onClick={submit}
                  title={isPlaylistUrl(query) ? 'Play All' : 'Search'}
                  aria-label={isPlaylistUrl(query) ? 'Play All' : 'Search'}
                  data-fs-go=""
                  disabled={listBusy}
                  className="flex items-center justify-center w-9 h-9 rounded-full text-black flex-shrink-0 disabled:opacity-60"
                  style={{ background: accent }}
                >
                  {listBusy ? <Loader2 size={15} className="animate-spin" /> : (isPlaylistUrl(query) ? <Play size={15} fill="currentColor" /> : <ArrowRight size={16} />)}
                </button>
              )}
            </div>

            {(loading || results.length > 0) && (
              <div className="max-h-[42vh] overflow-y-auto overscroll-contain border-t border-white/10">
                {loading && (
                  <div className="flex items-center gap-2 px-4 py-5 text-white/50 text-sm">
                    <Loader2 size={14} className="animate-spin" /> Looking…
                  </div>
                )}
                {!loading && results.map((r) => (
                  <button
                    key={r.src || r.url}
                    type="button"
                    onClick={() => pick(r)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left border-b border-white/5 hover:bg-white/5 active:bg-white/10"
                  >
                    <Play size={13} className="text-white/40 flex-shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-white truncate">{r.title || r.url}</span>
                      {r.channel && (
                        <span className="block text-[11px] text-white/40 truncate">{r.channel}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* THE HANDLE. Sized for a thumb rather than a cursor, and centred so it
          is reachable one-handed either way up. It stays put when the bar is
          open so the same target closes it. */}
      <div className="flex justify-center pointer-events-none">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title={open ? 'Hide the search bar' : 'Search without leaving full screen'}
          aria-label={open ? 'Hide the search bar' : 'Show the search bar'}
          aria-expanded={open}
          className="pointer-events-auto flex items-center justify-center w-16 h-7 rounded-b-xl bg-black/70 border border-t-0 border-white/15 text-white/50 hover:text-white transition-colors"
          style={{ color: open ? accent : undefined }}
        >
          <ChevronDown
            size={16}
            className="transition-transform duration-200"
            style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          />
        </button>
      </div>
    </div>
  );
}
