import { createContext, useContext, useReducer, useCallback, useMemo } from 'react';

// Global media-player state for the persistent pop-out mini-player. Lives ABOVE
// <Routes> so the media node it drives (MiniPlayer) survives SPA navigation —
// the whole point of "pop out and keep playing while I browse elsewhere".
//
// A source is { kind: 'youtube'|'vimeo'|'audio'|'video', src, title, pageUrl,
// poster }. `current` plays now; `queue` is what's next; `history` lets prev()
// walk back. Native audio/video also auto-advance to the next queued item on
// end (see MiniPlayer's onEnded).
const PlayerContext = createContext();

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within a PlayerProvider');
  return ctx;
};

const INITIAL = { current: null, queue: [], history: [], minimized: false };
const sameSrc = (a, b) => !!a && !!b && a.src === b.src;

function reducer(s, a) {
  switch (a.type) {
    case 'play': { // interrupt: play now, remembering what was playing
      if (!a.source?.src) return s;
      const history = s.current && !sameSrc(s.current, a.source) ? [...s.history, s.current] : s.history;
      return { ...s, current: a.source, history, minimized: false };
    }
    case 'enqueue': { // idle → play now; busy → append (dedup against current/queue)
      if (!a.source?.src) return s;
      if (!s.current) return { ...s, current: a.source, minimized: false };
      if (sameSrc(s.current, a.source) || s.queue.some((q) => sameSrc(q, a.source))) return s;
      return { ...s, queue: [...s.queue, a.source] };
    }
    case 'next': {
      if (s.queue.length === 0) return s;
      const [nx, ...rest] = s.queue;
      const history = s.current ? [...s.history, s.current] : s.history;
      return { ...s, current: nx, queue: rest, history };
    }
    case 'prev': {
      if (s.history.length === 0) return s;
      const prev = s.history[s.history.length - 1];
      const queue = s.current ? [s.current, ...s.queue] : s.queue;
      return { ...s, current: prev, queue, history: s.history.slice(0, -1) };
    }
    case 'jump': { // play a queued item now
      const item = s.queue[a.index];
      if (!item) return s;
      const history = s.current ? [...s.history, s.current] : s.history;
      return { ...s, current: item, queue: s.queue.filter((_, i) => i !== a.index), history };
    }
    case 'removeFromQueue':
      return { ...s, queue: s.queue.filter((_, i) => i !== a.index) };
    case 'close':
      return INITIAL;
    case 'toggleMin':
      return { ...s, minimized: !s.minimized };
    default:
      return s;
  }
}

export const PlayerProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  const play = useCallback((source) => dispatch({ type: 'play', source }), []);
  const enqueue = useCallback((source) => dispatch({ type: 'enqueue', source }), []);
  const next = useCallback(() => dispatch({ type: 'next' }), []);
  const prev = useCallback(() => dispatch({ type: 'prev' }), []);
  const jump = useCallback((index) => dispatch({ type: 'jump', index }), []);
  const removeFromQueue = useCallback((index) => dispatch({ type: 'removeFromQueue', index }), []);
  const close = useCallback(() => dispatch({ type: 'close' }), []);
  const toggleMinimize = useCallback(() => dispatch({ type: 'toggleMin' }), []);

  const value = useMemo(
    () => ({ ...state, play, enqueue, next, prev, jump, removeFromQueue, close, toggleMinimize }),
    [state, play, enqueue, next, prev, jump, removeFromQueue, close, toggleMinimize]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};
