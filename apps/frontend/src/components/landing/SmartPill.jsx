import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import PillModeRow from './PillModeRow';
import { MODE_COLORS, searchModeLabel } from '../../config/modeTheme';
import { detectIntent } from '../../utils/queryIntent';
import { routeFor } from '../../utils/modeRoute';

// The pill, plus the two things that make it move you:
//
//   CLICK   the mode changes at once and a 5-second countdown starts; when it
//           runs out you land on that mode's page with what you typed. ✕
//           cancels (and puts the pill back). Clicking again moves on to the
//           next mode and restarts the clock. Holding (2.2s) goes to Chat now.
//   TYPE    ~0.7s after you stop typing, a video link offers Tube, a social
//           post Feed, a question Chat, a local-business search Mainstream —
//           same countdown, with the reason shown. ✕ stops suggestions for
//           that text.
//
// On the Chat page only links and local searches pull you away: typing there
// is talking to the AI, so questions and topics stay put.

const COUNTDOWN_MS = 5000;
const DEBOUNCE_MS = 700;
const SEARCH_MODES = ['blue', 'green', 'red', 'ocean'];

const labelFor = (mode) => (mode === 'black' ? 'Chat' : mode === 'yellow' ? 'Feed' : searchModeLabel(mode));

/**
 * @param {string}   activeMode the pill's current mode
 * @param {Function} onSelect   stage a mode on the page (same as before)
 * @param {string|null} pageMode the mode this page already IS (null = landing, which is none)
 * @param {string}   query      what is in the search bar right now
 */
export default function SmartPill({ activeMode, onSelect, pageMode = null, query = '' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [run, setRun] = useState(null); // { mode, reason, from, startedAt }
  const [now, setNow] = useState(Date.now());
  const suppressed = useRef(null);
  const queryRef = useRef(query);
  queryRef.current = query;

  const stop = useCallback(() => setRun(null), []);

  const go = useCallback((mode) => {
    setRun(null);
    navigate(routeFor(mode, queryRef.current));
  }, [navigate]);

  // Start (or restart) a countdown towards `mode`. `from` is what ✕ restores.
  const start = useCallback((mode, reason) => {
    // Reset the clock with the run: `now` otherwise still holds the time of the
    // last tick (or of mount), and the first frame read "in 18…".
    setNow(Date.now());
    setRun((cur) => {
      const from = cur ? cur.from : activeMode;
      if (pageMode && mode === pageMode) return null; // already here — nothing to go to
      return { mode, reason, from, startedAt: Date.now() };
    });
  }, [activeMode, pageMode]);

  // The clock. One interval while a countdown runs; it navigates at zero.
  useEffect(() => {
    if (!run) return undefined;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t - run.startedAt >= COUNTDOWN_MS) { clearInterval(id); go(run.mode); }
    }, 100);
    return () => clearInterval(id);
  }, [run, go]);

  // Leaving the page (Enter, a link, the back button) ends any countdown.
  useEffect(() => { setRun(null); }, [location.pathname, location.search]);

  // Typing detection.
  useEffect(() => {
    const text = query.trim();
    if (!text || suppressed.current === text) return undefined;
    const id = setTimeout(() => {
      const intent = detectIntent(text);
      if (!intent) return;
      if (pageMode === 'black' && !['social', 'media', 'link', 'local', 'osint', 'profile'].includes(intent.kind)) return;
      // Already somewhere that handles it: a link or local search on any search
      // page, a local search on Mainstream or Green (both show the Maps card).
      const here = activeMode;
      if (intent.kind === 'link' && SEARCH_MODES.includes(here)) return;
      if (intent.kind === 'local' && (here === 'blue' || here === 'green')) return;
      if (intent.mode === here) return;
      onSelect(intent.mode);
      start(intent.mode, intent.reason);
    }, DEBOUNCE_MS);
    return () => clearTimeout(id);
    // activeMode deliberately left out: switching the pill must not re-run detection.
  }, [query, pageMode]);

  const onPill = useCallback((next) => {
    onSelect(next);
    start(next, null);
  }, [onSelect, start]);

  const cancel = useCallback(() => {
    if (run?.from) onSelect(run.from);
    if (run?.reason) suppressed.current = queryRef.current.trim();
    stop();
  }, [run, onSelect, stop]);

  const left = run ? Math.min(COUNTDOWN_MS, Math.max(0, COUNTDOWN_MS - (now - run.startedAt))) : 0;
  const color = run ? (MODE_COLORS[run.mode] || '#22d3ee') : undefined;

  return (
    <div className="flex flex-col items-center">
      <PillModeRow activeMode={activeMode} onSelect={onPill} onHold={() => { onSelect('black'); go('black'); }} />
      <AnimatePresence>
        {run && (
          <motion.div
            key="countdown"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-2 flex items-center gap-2 rounded-full border border-white/15 bg-black/60 backdrop-blur px-3 py-1 text-xs text-white/85 overflow-hidden relative"
          >
            <span>
              {run.reason ? <span className="text-white/55">{run.reason} · </span> : null}
              Going to <strong style={{ color }}>{labelFor(run.mode)}</strong> in {Math.ceil(left / 1000)}…
            </span>
            <button
              type="button"
              onClick={() => go(run.mode)}
              className="text-white/60 hover:text-white underline-offset-2 hover:underline"
            >
              Go now
            </button>
            <button type="button" onClick={cancel} aria-label="Cancel switching mode" className="p-0.5 rounded-full hover:bg-white/15">
              <X size={13} />
            </button>
            {/* The drain: full at the start, empty at zero. */}
            <span
              aria-hidden="true"
              className="absolute left-0 bottom-0 h-[2px]"
              style={{ width: `${(left / COUNTDOWN_MS) * 100}%`, background: color, transition: 'width 100ms linear' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
