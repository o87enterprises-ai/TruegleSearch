import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

// Landing-page feature cards, collapsed to their coloured title by default.
//
// The page used to open with every explainer fully expanded — a wall of copy
// that confused first-time visitors more than it helped. Now each card is one
// line until somebody shows interest in it:
//
//   PREVIEW  mouse: hover.  touch: a finger RESTING on the card (~150ms).
//            Ends when the pointer leaves / the finger moves (a scroll starts).
//   PIN      a real click or tap. Stays open until the card is scrolled out of
//            view, or another card is previewed or pinned.
//
// Only one card is open at a time, page-wide — hence the shared group.
//
// Why the touch delay: every scroll on a phone begins with a finger landing on
// the page, usually on a card. Opening on touch-down would make cards flap open
// and shut under a scrolling thumb; a short rest separates "looking" from
// "passing through".

const TOUCH_REST_MS = 150;
const TOUCH_SLOP_PX = 10;

const CardGroup = createContext(null);

export function CollapsibleCardGroup({ children }) {
  const [state, setState] = useState({ openId: null, pinned: false });
  const api = useMemo(() => ({
    state,
    preview: (id) => setState((s) => (s.openId === id && s.pinned ? s : { openId: id, pinned: false })),
    endPreview: (id) => setState((s) => (s.openId === id && !s.pinned ? { openId: null, pinned: false } : s)),
    pin: (id) => setState({ openId: id, pinned: true }),
    close: (id) => setState((s) => (s.openId === id ? { openId: null, pinned: false } : s)),
  }), [state]);
  return <CardGroup.Provider value={api}>{children}</CardGroup.Provider>;
}

// Outside a group (a page that forgot the provider), each card manages itself.
function useLocalGroup() {
  const [state, setState] = useState({ openId: null, pinned: false });
  return {
    state,
    preview: (id) => setState((s) => (s.openId === id && s.pinned ? s : { openId: id, pinned: false })),
    endPreview: (id) => setState((s) => (s.openId === id && !s.pinned ? { openId: null, pinned: false } : s)),
    pin: (id) => setState({ openId: id, pinned: true }),
    close: (id) => setState((s) => (s.openId === id ? { openId: null, pinned: false } : s)),
  };
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.header  the always-visible title row (icon + coloured title)
 * @param {React.ReactNode} props.children the body revealed when open
 * @param {string} [props.className]      classes for the card shell (border colour etc.)
 */
export default function CollapsibleCard({ header, children, className = '', ...rest }) {
  const shared = useContext(CardGroup);
  const local = useLocalGroup();
  const group = shared || local;
  const id = useId();
  const bodyId = `${id}-body`;
  const ref = useRef(null);
  const touch = useRef({ timer: null, x: 0, y: 0 });
  const reduceMotion = useReducedMotion();

  const open = group.state.openId === id;
  const pinned = open && group.state.pinned;
  const { preview, endPreview, pin, close } = group;

  const clearTouch = useCallback(() => {
    clearTimeout(touch.current.timer);
    touch.current.timer = null;
  }, []);
  useEffect(() => clearTouch, [clearTouch]);

  // A pinned card closes once it has been scrolled fully out of view.
  useEffect(() => {
    if (!pinned || !ref.current || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) close(id); });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [pinned, id, close]);

  const handlers = {
    onPointerEnter: (e) => { if (e.pointerType === 'mouse') preview(id); },
    onPointerLeave: (e) => {
      if (e.pointerType === 'mouse') endPreview(id);
      else { clearTouch(); endPreview(id); }
    },
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse') return;
      clearTouch();
      touch.current.x = e.clientX;
      touch.current.y = e.clientY;
      touch.current.timer = setTimeout(() => preview(id), TOUCH_REST_MS);
    },
    onPointerMove: (e) => {
      if (e.pointerType === 'mouse' || !touch.current.timer) return;
      if (Math.hypot(e.clientX - touch.current.x, e.clientY - touch.current.y) > TOUCH_SLOP_PX) {
        clearTouch();
        endPreview(id);
      }
    },
    // The browser took the gesture over for scrolling: the finger moved on.
    onPointerCancel: () => { clearTouch(); endPreview(id); },
    onPointerUp: clearTouch,
    onClick: () => pin(id),
  };

  return (
    <div
      ref={ref}
      data-collapsible-card=""
      data-open={open ? (pinned ? 'pinned' : 'preview') : 'closed'}
      className={`rounded-2xl border bg-white/[0.03] backdrop-blur-sm transition-colors duration-300 hover:bg-white/[0.06] ${className}`}
      {...handlers}
      {...rest}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        // Keyboard path: Enter/Space fire click → pin, same as a tap.
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex-1 min-w-0 flex items-center gap-3">{header}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`shrink-0 text-white/40 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId}
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34, opacity: { duration: 0.18 } }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 flex flex-col gap-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
