import { createContext, useContext, useReducer, useCallback, useMemo, useEffect } from 'react';
import { sameMedia } from '../utils/videoEmbed';

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
// ── TWO DECKS, ONE FRAME ────────────────────────────────────────────────────
//
// Tube and Feed are separate players that happen to share a frame. Playing
// something from the feed must not inherit Tube's queue, and starting a feed
// clip must not throw away the album somebody had lined up in Tube — "the
// tube player will keep its own state in memory when shifting to the feed
// scroll play function", and going back to Tube afterwards finds it exactly
// as it was.
//
// HOW, WITHOUT REWRITING EVERY CONSUMER: the ACTIVE deck's media state stays
// flat on the state object, exactly where `current`/`queue`/`history` have
// always been, so every reducer case and every usePlayer() caller is
// untouched. The INACTIVE deck's copy of those same six fields waits in
// `stashed`. Switching decks swaps them over. That is the whole mechanism —
// no per-deck plumbing threaded through thirty call sites, and the pure
// reducer tests in verify-player-engine.mjs keep testing what they always did.
export const DECK_MEDIA_KEYS = ['current', 'queue', 'history', 'queueArmed', 'feedActive', 'feed'];
const EMPTY_MEDIA = {
  current: null, queue: [], history: [], queueArmed: false, feedActive: false, feed: [],
};

export const INITIAL = {
  current: null, queue: [], history: [], minimized: false,
  paused: false, expanded: false, poppedOut: false,
  // Which deck's media is currently flat on this object: 'tube' or 'feed'.
  // Tube is the default because it is every surface that is not the feed —
  // search, creators, a pasted link, the Tube page itself.
  activeDeck: 'tube',
  // The other deck's six media fields, held verbatim until it is switched
  // back to. Session-only: like `feed` below, a deck you were half way
  // through is something you are doing now, not a setting — see loadState.
  stashed: {},
  // A counter, not a boolean. "Take me full screen" is an EVENT — the second
  // request has to be distinguishable from the first, and the browser will
  // only grant it from inside the gesture that asked, so the player watches
  // this bump and calls requestFullscreen() itself. A boolean would latch,
  // and leaving full screen would then fight whatever set it.
  fullscreenNonce: 0,
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
  // Controls ignored so a pocket can't skip the track. Deliberately survives a
  // reload: you locked it on purpose, and quietly unlocking itself when the tab
  // is recycled is the exact failure the lock exists to prevent.
  locked: false,
  // 0..1, applied to whatever is playing through the embed control channel.
  // Persisted: a volume that resets every reload is one you have to set every
  // reload.
  volume: 1,
  // HAS THE USER ACTUALLY ASKED FOR THE QUEUE?
  //
  // Autoplay used to hand control to the queue whenever the queue was
  // non-empty, which sounds right and is not: a queue restored from a previous
  // session is STORAGE, not intent. Clearing the queue, searching, and playing
  // one video dropped you straight back into last week's list, and there was no
  // way to browse forward into anything new — the exact "impossible to
  // organically discover new content" report.
  //
  // Armed by touching the queue on purpose: adding to it, playing an entry from
  // it, or pressing play on the list. NOT armed by anything automatic, and
  // deliberately NOT restored from storage — see loadState.
  queueArmed: false,
  // ── THE FEED ──────────────────────────────────────────────────────────────
  // The search results, playing through the player. This is the player's
  // DEFAULT state: switch feed autoplay on and the results are what plays next,
  // ahead of the queue.
  //
  // IT INTERRUPTS THE QUEUE, IT DOES NOT CONSUME IT. `queue` is left exactly as
  // it was and is never walked or drained while a feed is running — a list
  // somebody spent time building must still be there afterwards. Starting a
  // feed only clears `queueArmed`, which is what makes the queue need restarting
  // by hand rather than silently resuming the moment the feed runs out.
  //
  // Session-only, like queueArmed: a feed is something you are doing now, not a
  // setting. Leaving and coming back starts with no feed.
  feedActive: false,
  // What the feed has left to play, newest search first. Separate from `queue`
  // for the reason above.
  feed: [],
};
// Identity is the MEDIA, not the URL string. The same YouTube video arrives as
// a watch link, a youtu.be link and an /embed/ URL with a ?si= suffix, and
// comparing `src` called those three different videos — which is how the queue
// ended up holding the same clip several times over and how auto-advance kept
// "advancing" onto another copy of what had just finished. See mediaKey().
const sameSrc = (a, b) => !!a && !!b && (a.src === b.src || sameMedia(a, b));

// Playing the SAME source again needs a changed identity, or the media node
// (keyed on src) is never recreated and the "replay" is invisible. This token
// is the only thing that differs, and it never leaves the client.
const replay = (source) => ({ ...source, playToken: (source.playToken || 0) + 1 });

// Exported for scripts/verify-player-engine.mjs. The reducer and loadState are
// pure functions and are where the queue-versus-discovery rule actually lives,
// so testing them directly is testing the thing rather than a React wrapper
// around it.
// The actions that MEAN "start playing this thing", as opposed to the
// transport actions that move around inside whatever is already playing.
// Only these can move the player between decks, and only when the caller
// says so: `dispatch({ type:'play', source, deck:'feed' })`. Everything
// else — Next, Prev, pause, the feed cursor — stays on whichever deck is
// already live, so an automatic advance can never yank the frame from one
// deck to the other underneath somebody.
const ORIGIN_ACTIONS = new Set(['play', 'playNow', 'enqueue', 'enqueueMany', 'playList', 'startFeed']);

export function reducer(s, a) {
  // An origin action naming a deck other than the live one switches first,
  // then plays into it — so the deck it lands in is the one it asked for,
  // with that deck's own queue and history underneath it.
  if (ORIGIN_ACTIONS.has(a.type) && a.deck && a.deck !== s.activeDeck) {
    const moved = reducer(s, { type: 'switchDeck', name: a.deck });
    return reducer(moved, { ...a, deck: undefined });
  }

  switch (a.type) {
    case 'requestFullscreen':
      return { ...s, fullscreenNonce: s.fullscreenNonce + 1 };
    case 'switchDeck': {
      const name = a.name === 'feed' ? 'feed' : 'tube';
      if (name === s.activeDeck) return s;
      // What is on the table goes back in its own box; the incoming deck's
      // box is emptied onto the table. A deck that has never been used comes
      // back empty rather than undefined, so the flat fields are always the
      // shape every consumer expects.
      const outgoing = {};
      for (const k of DECK_MEDIA_KEYS) outgoing[k] = s[k];
      const incoming = s.stashed?.[name] || EMPTY_MEDIA;
      return {
        ...s,
        ...incoming,
        activeDeck: name,
        stashed: { ...s.stashed, [s.activeDeck]: outgoing },
        // Whatever the incoming deck was doing, it is not mid-pause from a
        // session the user has since forgotten about.
        paused: false,
      };
    }
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
      // `byUser` distinguishes somebody pressing Add to queue from the player
      // topping itself up. Only the former is a statement about what should
      // play next — see queueArmed.
      const armed = a.byUser ? true : s.queueArmed;
      if (!s.current) return { ...s, current: a.source, minimized: false, queueArmed: armed };
      if (sameSrc(s.current, a.source) || s.queue.some((q) => sameSrc(q, a.source))) {
        return armed === s.queueArmed ? s : { ...s, queueArmed: armed };
      }
      return { ...s, queue: [...s.queue, a.source], queueArmed: armed };
    }
    case 'enqueueMany': { // used by shared player links: first plays, rest line up
      const list = (a.sources || []).filter((s) => s?.src);
      if (!list.length) return s;
      return list.reduce((acc, source) => reducer(acc, { type: 'enqueue', source }), s);
    }
    case 'next': {
      // `manual` = the user pressed Next. Play mode describes what happens
      // AUTOMATICALLY when something finishes; it must never make the skip
      // button do nothing, which is exactly how repeat-one behaved — it re-set
      // the same track and the press looked ignored.
      if (!a.manual && s.playMode === 'repeat-one' && s.current) return { ...s, current: replay(s.current) };
      if (s.queue.length === 0) {
        // Nothing queued: loop restarts the current track, and so does an
        // automatic repeat-one. A manual press with an empty queue has
        // nowhere to go, so it leaves things alone.
        if (!a.manual && s.playMode === 'loop' && s.current) return { ...s, current: replay(s.current) };
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
      // Pressing play on a queue entry is the clearest possible statement that
      // the queue is what you want playing.
      return { ...s, current: item, queue: s.queue.filter((_, i) => i !== a.index), history, queueArmed: true };
    }
    case 'removeFromQueue':
      return { ...s, queue: s.queue.filter((_, i) => i !== a.index) };
    case 'stop': // stop playback, keep the queue — unlike close, which clears everything
      // Stop ends the feed. It is the one control that means "I am done with
      // what you are doing", and a feed that survived it would immediately put
      // the next result on.
      return { ...s, current: null, paused: false, feedActive: false, feed: [] };
    case 'togglePause':
      return { ...s, paused: !s.paused };
    case 'setPaused':
      return { ...s, paused: !!a.value };
    case 'setPlayMode':
      return { ...s, playMode: a.value };
    case 'setLocked':
      return { ...s, locked: !!a.value };
    case 'setVolume':
      return { ...s, volume: Math.max(0, Math.min(1, Number(a.value) || 0)) };
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
      return { ...s, current: null, paused: false, poppedOut: false, expanded: false, minimized: false, feedActive: false, feed: [] };
    case 'startFeed': {
      // The results become what plays next. The queue is put on standby:
      // contents untouched, but no longer followed — so when the feed ends,
      // playback falls to discovery and the queue waits to be restarted by
      // hand, which is what "the feed is the player's default state" means.
      const list = (a.sources || []).filter((x) => x?.src);
      if (!list.length) return s;
      const [first, ...rest] = list;
      const history = s.current && !sameSrc(s.current, first) ? [...s.history, s.current] : s.history;
      return {
        ...s,
        current: first,
        feed: rest,
        feedActive: true,
        queueArmed: false,
        history,
        paused: false,
        minimized: false,
      };
    }
    case 'feedNext': {
      if (!s.feedActive || s.feed.length === 0) return s;
      const [nx, ...rest] = s.feed;
      const history = s.current ? [...s.history, s.current] : s.history;
      return { ...s, current: nx, feed: rest, history, paused: false };
    }
    case 'appendFeed': {
      // Tops up the ALREADY-RUNNING feed as more rows load — an infinite-scroll
      // page's feed grows after startFeed already claimed `current`, and
      // re-calling startFeed for that would replay the "start where you
      // already are" jump on every page load. This only ever appends to the
      // tail, and only while a feed is actually active: a page with nothing
      // playing has no feed to top up.
      if (!s.feedActive) return s;
      const list = (a.sources || []).filter((x) => x?.src);
      if (!list.length) return s;
      const known = [s.current, ...s.feed].filter(Boolean);
      const fresh = list.filter((x) => !known.some((k) => sameSrc(k, x)));
      if (!fresh.length) return s;
      return { ...s, feed: [...s.feed, ...fresh] };
    }
    case 'stopFeed':
      // The feed's remaining items go with it. They are search results, not a
      // list anybody assembled — keeping them would mean a stopped feed quietly
      // resumes later, which is the behaviour being removed.
      return { ...s, feedActive: false, feed: [] };
    case 'clearQueue':
      // Emptying the list also withdraws the instruction to follow it —
      // otherwise the next thing added would silently inherit the old intent.
      return { ...s, queue: [], queueArmed: false };
    case 'armQueue':
      return { ...s, queueArmed: true };
    case 'playList': {
      // PRESSING PLAY ON A SAVED LIST. Unambiguously "follow this", so it arms
      // the queue and ends any feed — the one case where the queue outranks the
      // feed, because the person just said so.
      //
      // It replaces rather than appends: this used to go through enqueueMany,
      // which appends AND (correctly, for its other callers) never arms. So a
      // list pressed while something was queued was mixed into whatever was
      // already there — "it did add to list but combined with que" — and, once
      // the first track ended, autoplay ignored the unarmed queue and went off
      // to discovery instead of playing the list. Both halves of that were the
      // same missing statement of intent.
      const list = (a.sources || []).filter((x) => x?.src);
      if (!list.length) return s;
      const [first, ...rest] = list;
      const history = s.current ? [...s.history, s.current] : s.history;
      return {
        ...s,
        current: first,
        queue: rest,
        queueArmed: true,
        feedActive: false,
        feed: [],
        history,
        paused: false,
        minimized: false,
      };
    }
    case 'toggleMin':
      return { ...s, minimized: !s.minimized };
    case 'setMinimized':
      // Explicit, where toggleMin is relative. The end-of-queue rule in
      // TrueglePlayer needs to say "be small", not "be the other thing" — a
      // toggle fired at a player that is already small would open it back up
      // at exactly the moment there is nothing left to put in it.
      return s.minimized === !!a.value ? s : { ...s, minimized: !!a.value };
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
export const QUEUE_KEY = 'truegle_player_queue_v2';
const LEGACY_KEY = 'truegle_player_queue';
const persistable = (s) => !!s && typeof s.src === 'string' && !s.src.startsWith('blob:');

export function loadState() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
      || sessionStorage.getItem(LEGACY_KEY)
      || localStorage.getItem(LEGACY_KEY);
    const saved = JSON.parse(raw || 'null');
    if (!saved) return INITIAL;
    // NOTHING AUTO-PLAYS ON LAUNCH, and nothing is silently added to the list
    // either.
    //
    // What was playing used to be restored as `current`, which the screen
    // mounts with autoplay=1, so last session's clip started by itself. That
    // was fixed by moving it to the FRONT OF THE QUEUE instead — which fixed
    // the autoplay and created a subtler one: a queue the user had emptied came
    // back with an item in it on the next load, and a non-empty queue used to
    // take over autoplay. Emptying the queue therefore did not stay emptied.
    //
    // It is simply dropped now. Nothing is lost that the user asked to keep:
    // the queue itself is restored in full, and what was merely PLAYING when a
    // tab closed was never a list entry — it is in `history`, which is where
    // "what was I just watching" belongs and what prev() walks back through.
    const restored = Array.isArray(saved.queue) ? saved.queue.filter(persistable) : [];
    const wasPlaying = persistable(saved.current) ? saved.current : null;
    const priorHistory = Array.isArray(saved.history) ? saved.history.filter(persistable) : [];
    return {
      ...INITIAL,
      current: null,
      queue: restored,
      // Without this, prev() went dead after every reload — another way the
      // player looked like it had forgotten what the user was doing. What was
      // playing at the end of last session goes on the end of it, so Back
      // reaches it.
      history: wasPlaying ? [...priorHistory, wasPlaying] : priorHistory,
      poppedOut: !!saved.poppedOut,
      expanded: !!saved.expanded,
      // ALWAYS STARTS MINIMIZED (owner, 2026-09-25): opening the Feed came up
      // with last session's player filling the screen over the posts. It used
      // to restore whatever size it was left at; now every visit starts with
      // the small bar, and pressing play on anything opens it (every play
      // action clears `minimized`), so nothing chosen is ever hidden.
      minimized: true,
      dock: saved.dock === 'footer' || saved.dock === 'float' ? saved.dock : null,
      footerView: saved.footerView === 'hidden' ? 'hidden' : 'watch',
      locked: !!saved.locked,
      volume: typeof saved.volume === 'number' ? Math.max(0, Math.min(1, saved.volume)) : 1,
      // DELIBERATELY NOT PERSISTED. Arming the queue is a statement about this
      // sitting, not a setting. Restoring it would mean a list assembled days
      // ago quietly takes over autoplay again on the next visit, which is the
      // whole behaviour this flag exists to stop.
      queueArmed: false,
      // Same reasoning, and the owner's rule directly: leaving Truegle ends the
      // feed. Coming back starts with none.
      feedActive: false,
      feed: [],
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
        locked: state.locked,
        volume: state.volume,
        // queueArmed is absent on purpose — see loadState.
      }));
    } catch { /* private mode / quota — the queue just won't survive a reload */ }
  }, [state.current, state.queue, state.history, state.poppedOut, state.expanded, state.minimized, state.dock, state.footerView, state.locked, state.volume]);

  // `deck` is optional on every origin action below. Omitted, the media
  // lands on whichever deck is already live — which is what an automatic
  // advance or an in-place control wants. Passed ('feed' from the feed's own
  // play paths, 'tube' from Tube/search/creators), it moves the frame to
  // that deck first, finding that deck's own queue and history intact.
  const play = useCallback((source, deck) => dispatch({ type: 'play', source, deck }), []);
  const playNow = useCallback((source, deck) => dispatch({ type: 'playNow', source, deck }), []);
  const switchDeck = useCallback((name) => dispatch({ type: 'switchDeck', name }), []);
  // "Open in app" on a feed card: play it AND take the player full screen, so
  // the card becomes the whole view without the reader leaving the feed.
  const requestFullscreen = useCallback(() => dispatch({ type: 'requestFullscreen' }), []);
  // `byUser` says a person pressed Add to queue, as opposed to the player
  // topping itself up. Defaults TRUE: every existing call site is a button, and
  // a default that silently disarmed the queue would be the more surprising of
  // the two mistakes. Automatic fills pass false explicitly.
  const enqueue = useCallback((source, { byUser = true, deck } = {}) => dispatch({ type: 'enqueue', source, byUser, deck }), []);
  // Shared links and automatic top-ups: these put things in the list without
  // anyone asking for the list to take over, so they never arm it.
  const enqueueMany = useCallback((sources, deck) => dispatch({ type: 'enqueueMany', sources, deck }), []);
  // Automatic advance (a track ended) honours the play mode; the transport's
  // Next button passes manual so it always moves.
  const next = useCallback(() => dispatch({ type: 'next' }), []);
  const skipNext = useCallback(() => dispatch({ type: 'next', manual: true }), []);
  const prev = useCallback(() => dispatch({ type: 'prev' }), []);
  const jump = useCallback((index) => dispatch({ type: 'jump', index }), []);
  const removeFromQueue = useCallback((index) => dispatch({ type: 'removeFromQueue', index }), []);
  const close = useCallback(() => dispatch({ type: 'close' }), []);
  const clearQueue = useCallback(() => dispatch({ type: 'clearQueue' }), []);
  // For a "play the list" control: follow the queue from here on without having
  // to add to it or pick an entry first.
  const armQueue = useCallback(() => dispatch({ type: 'armQueue' }), []);
  // Play a saved list: it becomes the queue, and the queue is followed.
  const playList = useCallback((sources, deck) => dispatch({ type: 'playList', sources, deck }), []);
  // Play the search results, ahead of the queue. See the reducer for what this
  // does and does not do to the queue.
  const startFeed = useCallback((sources, deck) => dispatch({ type: 'startFeed', sources, deck }), []);
  const appendFeed = useCallback((sources) => dispatch({ type: 'appendFeed', sources }), []);
  const feedNext = useCallback(() => dispatch({ type: 'feedNext' }), []);
  const stopFeed = useCallback(() => dispatch({ type: 'stopFeed' }), []);
  const setVolume = useCallback((value) => dispatch({ type: 'setVolume', value }), []);
  const toggleMinimize = useCallback(() => dispatch({ type: 'toggleMin' }), []);
  const setMinimized = useCallback((value) => dispatch({ type: 'setMinimized', value }), []);
  const stop = useCallback(() => dispatch({ type: 'stop' }), []);
  const togglePause = useCallback(() => dispatch({ type: 'togglePause' }), []);
  const setPaused = useCallback((value) => dispatch({ type: 'setPaused', value }), []);
  const setExpanded = useCallback((value) => dispatch({ type: 'setExpanded', value }), []);
  const setPoppedOut = useCallback((value) => dispatch({ type: 'setPoppedOut', value }), []);
  const setDock = useCallback((value) => dispatch({ type: 'setDock', value }), []);
  const setFooterView = useCallback((value) => dispatch({ type: 'setFooterView', value }), []);
  const setPlayMode = useCallback((value) => dispatch({ type: 'setPlayMode', value }), []);
  const setLocked = useCallback((value) => dispatch({ type: 'setLocked', value }), []);

  const value = useMemo(
    () => ({
      ...state,
      play, playNow, enqueue, enqueueMany, next, skipNext, prev, jump, removeFromQueue, close, clearQueue, armQueue, toggleMinimize, setMinimized,
      startFeed, appendFeed, feedNext, stopFeed, playList, switchDeck, requestFullscreen,
      stop, togglePause, setPaused, setExpanded, setPoppedOut, setDock, setFooterView, setPlayMode, setLocked, setVolume,
    }),
    [state, play, playNow, enqueue, enqueueMany, next, skipNext, prev, jump, removeFromQueue, close, clearQueue, armQueue, toggleMinimize, setMinimized,
      startFeed, appendFeed, feedNext, stopFeed, playList, switchDeck, requestFullscreen,
      stop, togglePause, setPaused, setExpanded, setPoppedOut, setPlayMode, setLocked, setVolume]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};
