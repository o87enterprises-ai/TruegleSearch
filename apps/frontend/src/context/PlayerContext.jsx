import { createContext, useContext, useReducer, useCallback, useMemo, useEffect } from 'react';

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

// `paused` is best-effort: a native <audio>/<video> really pauses and keeps
// its position, but a cross-origin embed has no pause() we can call without
// loading each platform's SDK, so pausing one unmounts it and resuming starts
// it over. That's the honest trade for not shipping four vendor SDKs.
//
// `poppedOut` decides whether the player floats or lives docked in the Tube
// search bar; `expanded` is whether the docked form is showing its screen.
// Both live here rather than in a component so the presentation can change
// without remounting the media node and restarting playback.
const INITIAL = {
  current: null, queue: [], history: [], minimized: false,
  paused: false, expanded: false, poppedOut: false,
  // Where the popped-out player lives: 'float' = the draggable window,
  // 'footer' = pinned across the bottom of the page above the feedback bar.
  // null = nobody has chosen, so the surface picks: a floating window covers
  // the results it was popped out to sit beside on a phone, so phone-width
  // screens dock to the footer the way every mobile player does. Set only by
  // the pop-out control, and remembered once set.
  dock: null,
  // What the footer dock shows: 'watch' = the picture, 'hidden' = just the
  // controls, with the media still mounted and still playing. Hidden is for
  // "I'm listening while I read the results", which is most of what a dock at
  // the bottom of a page is for.
  footerView: 'watch',
  // auto | repeat-one | shuffle | loop. Auto = play straight through.
  playMode: 'auto',
};
const sameSrc = (a, b) => !!a && !!b && a.src === b.src;

function reducer(s, a) {
  switch (a.type) {
    case 'play': { // interrupt: play now, remembering what was playing
      if (!a.source?.src) return s;
      const history = s.current && !sameSrc(s.current, a.source) ? [...s.history, s.current] : s.history;
      return { ...s, current: a.source, history, minimized: false, paused: false };
    }
    case 'playNow': {
      // Jump the queue WITHOUT losing your place. What was playing goes to the
      // FRONT of the queue, so when this finishes the player drops straight
      // back into it and carries on down the list. Nothing is dropped and
      // nothing is reordered behind it — that's the difference between this
      // and 'play', which simply replaces what's on.
      if (!a.source?.src) return s;
      if (sameSrc(s.current, a.source)) return { ...s, paused: false };
      // If this track was already queued further down, take it from there —
      // otherwise it would play twice.
      const rest = s.queue.filter((q) => !sameSrc(q, a.source));
      const queue = s.current ? [s.current, ...rest] : rest;
      return { ...s, current: a.source, queue, paused: false, minimized: false };
    }
    case 'enqueue': { // idle → play now; busy → append (dedup against current/queue)
      if (!a.source?.src) return s;
      if (!s.current) return { ...s, current: a.source, minimized: false };
      if (sameSrc(s.current, a.source) || s.queue.some((q) => sameSrc(q, a.source))) return s;
      return { ...s, queue: [...s.queue, a.source] };
    }
    case 'enqueueMany': { // used by shared player links: first plays, rest line up
      const list = (a.sources || []).filter((s) => s?.src);
      if (!list.length) return s;
      return list.reduce((acc, source) => reducer(acc, { type: 'enqueue', source }), s);
    }
    case 'next': {
      // Repeat-one replays what's on now; shuffle picks at random; loop sends
      // the finished item to the back so the queue never empties.
      if (s.playMode === 'repeat-one' && s.current) return { ...s, current: { ...s.current } };
      if (s.queue.length === 0) {
        if (s.playMode === 'loop' && s.current) return { ...s, current: { ...s.current } };
        return s;
      }
      const pick = s.playMode === 'shuffle' ? Math.floor(Math.random() * s.queue.length) : 0;
      const nx = s.queue[pick];
      const rest = s.queue.filter((_, i) => i !== pick);
      const history = s.current ? [...s.history, s.current] : s.history;
      const queue = s.playMode === 'loop' && s.current ? [...rest, s.current] : rest;
      return { ...s, current: nx, queue, history };
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
    case 'stop': // stop playback, keep the queue — unlike close, which clears everything
      return { ...s, current: null, paused: false };
    case 'togglePause':
      return { ...s, paused: !s.paused };
    case 'setPaused':
      return { ...s, paused: !!a.value };
    case 'setPlayMode':
      return { ...s, playMode: a.value };
    case 'setExpanded':
      return { ...s, expanded: !!a.value };
    case 'setPoppedOut':
      // Popping out always shows the whole component, so it can never pop out
      // into a collapsed sliver with no visible controls. Docking back into
      // the bar also resets the dock: the next pop-out starts floating again.
      return {
        ...s,
        poppedOut: !!a.value,
        expanded: a.value ? true : s.expanded,
        // Docking back into the bar forgets the choice, so the next pop-out
        // gets the right default for whatever screen it happens on.
        dock: a.value ? s.dock : null,
        minimized: false,
      };
    case 'setDock':
      return { ...s, dock: a.value === 'footer' ? 'footer' : 'float', minimized: false };
    case 'setFooterView':
      return { ...s, footerView: a.value === 'hidden' ? 'hidden' : 'watch' };
    case 'close':
      // Closing puts the player AWAY, it does not throw away the playlist the
      // user built. The X sits a thumb-width from minimize in the popped-out
      // header, and wiping an assembled queue on a mis-tap (with no undo) is
      // what read as "the list erases itself at random". Emptying the queue is
      // now only ever explicit — see clearQueue.
      return { ...s, current: null, paused: false, poppedOut: false, expanded: false, minimized: false };
    case 'clearQueue':
      return { ...s, queue: [] };
    case 'toggleMin':
      return { ...s, minimized: !s.minimized };
    default:
      return s;
  }
}

// A playlist is something the user BUILT, so it outlives the tab that built
// it. It was in sessionStorage, which meant a shared link opened in a new tab,
// a restored tab, or a phone browser recycling the tab in the background all
// came back to an empty queue — indistinguishable, from the outside, from the
// queue erasing itself. localStorage instead, migrating anything a previous
// session left behind.
//
// `blob:` sources (files added from the device) are dropped on save: an object
// URL is only valid for the document that created it, so persisting one would
// restore a queue entry that can never play.
const QUEUE_KEY = 'truegle_player_queue_v2';
const LEGACY_KEY = 'truegle_player_queue';
const persistable = (s) => !!s && typeof s.src === 'string' && !s.src.startsWith('blob:');

function loadState() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
      || sessionStorage.getItem(LEGACY_KEY)
      || localStorage.getItem(LEGACY_KEY);
    const saved = JSON.parse(raw || 'null');
    if (!saved) return INITIAL;
    return {
      ...INITIAL,
      current: persistable(saved.current) ? saved.current : null,
      queue: Array.isArray(saved.queue) ? saved.queue.filter(persistable) : [],
      // Without this, prev() went dead after every reload — another way the
      // player looked like it had forgotten what the user was doing.
      history: Array.isArray(saved.history) ? saved.history.filter(persistable) : [],
      poppedOut: !!saved.poppedOut,
      expanded: !!saved.expanded,
      // Collapsing the player is a decision too; springing back to full size
      // on every reload is the same "it forgot what I did" complaint.
      minimized: !!saved.minimized,
      dock: saved.dock === 'footer' || saved.dock === 'float' ? saved.dock : null,
      footerView: saved.footerView === 'hidden' ? 'hidden' : 'watch',
    };
  } catch {
    return INITIAL;
  }
}

export const PlayerProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify({
        current: persistable(state.current) ? state.current : null,
        queue: state.queue.filter(persistable),
        history: state.history.filter(persistable).slice(-20),
        poppedOut: state.poppedOut,
        expanded: state.expanded,
        minimized: state.minimized,
        dock: state.dock,
        footerView: state.footerView,
      }));
    } catch { /* private mode / quota — the queue just won't survive a reload */ }
  }, [state.current, state.queue, state.history, state.poppedOut, state.expanded, state.minimized, state.dock, state.footerView]);

  const play = useCallback((source) => dispatch({ type: 'play', source }), []);
  const playNow = useCallback((source) => dispatch({ type: 'playNow', source }), []);
  const enqueue = useCallback((source) => dispatch({ type: 'enqueue', source }), []);
  const enqueueMany = useCallback((sources) => dispatch({ type: 'enqueueMany', sources }), []);
  const next = useCallback(() => dispatch({ type: 'next' }), []);
  const prev = useCallback(() => dispatch({ type: 'prev' }), []);
  const jump = useCallback((index) => dispatch({ type: 'jump', index }), []);
  const removeFromQueue = useCallback((index) => dispatch({ type: 'removeFromQueue', index }), []);
  const close = useCallback(() => dispatch({ type: 'close' }), []);
  const clearQueue = useCallback(() => dispatch({ type: 'clearQueue' }), []);
  const toggleMinimize = useCallback(() => dispatch({ type: 'toggleMin' }), []);
  const stop = useCallback(() => dispatch({ type: 'stop' }), []);
  const togglePause = useCallback(() => dispatch({ type: 'togglePause' }), []);
  const setPaused = useCallback((value) => dispatch({ type: 'setPaused', value }), []);
  const setExpanded = useCallback((value) => dispatch({ type: 'setExpanded', value }), []);
  const setPoppedOut = useCallback((value) => dispatch({ type: 'setPoppedOut', value }), []);
  const setDock = useCallback((value) => dispatch({ type: 'setDock', value }), []);
  const setFooterView = useCallback((value) => dispatch({ type: 'setFooterView', value }), []);
  const setPlayMode = useCallback((value) => dispatch({ type: 'setPlayMode', value }), []);

  const value = useMemo(
    () => ({
      ...state,
      play, playNow, enqueue, enqueueMany, next, prev, jump, removeFromQueue, close, clearQueue, toggleMinimize,
      stop, togglePause, setPaused, setExpanded, setPoppedOut, setDock, setFooterView, setPlayMode,
    }),
    [state, play, playNow, enqueue, enqueueMany, next, prev, jump, removeFromQueue, close, clearQueue, toggleMinimize,
      stop, togglePause, setPaused, setExpanded, setPoppedOut, setPlayMode]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};
