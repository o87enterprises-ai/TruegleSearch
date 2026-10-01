import { useRef, useCallback, useState, useEffect } from 'react';
import { X, Bookmark, SkipBack, SkipForward, Play, Pause, ChevronUp, ChevronDown } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { usePageMode } from '../../hooks/usePageMode';
import { useNarrowViewport } from '../../hooks/useNarrowViewport';
import { useTouchDevice } from '../../hooks/useTouchDevice';
import { buildPlayerLink } from '../../utils/playerLink';
import PlayerScreen from './PlayerScreen';
import PlayerTransport, { PLAY_MODES, PLAY_MODE_LABEL } from './PlayerTransport';
import PlayerOverlay from './PlayerOverlay';
import PlayerListSlot from './PlayerListSlot';
import PlayerLockOverlay from './PlayerLockOverlay';
import FullscreenSearchBar from './FullscreenSearchBar';
import PlayerProgress from './PlayerProgress';
import PlayerBrowse from './PlayerBrowse';
import { useEmbedPlayback } from '../../hooks/useEmbedPlayback';
import { usePlayerSearch } from '../../hooks/usePlayerSearch';
import { useUpNext } from '../../hooks/useUpNext';
import { useSwipeNav } from '../../hooks/useSwipeNav';
import { useOverlayReveal } from '../../hooks/useOverlayReveal';
import { useLockedGestures } from '../../hooks/useLockedGestures';
import { rate, useRating, signalPlay } from '../../utils/taste';
import { playlists, createPlaylist, addToPlaylist } from '../../utils/playlists';
import { recordRetention } from '../../utils/retention';
import { reportBroken } from '../../utils/broken';
import { learnMeta } from '../../utils/mediaMeta';
import { recordWatch } from '../../utils/watchHistory';
import { copyText } from '../../utils/clipboard';
import { mediaKey } from '../../utils/videoEmbed';
import { useSearchStashContext } from '../../context/SearchStashContext';

// THE player. There is only one, and this is it.
//
// Three presentations, one component, one piece of state (PlayerContext):
//
//   collapsed — just the transport row, rendered inside the Tube search bar.
//               The bar IS the player.
//   expanded  — screen + transport + list, dropping out of the bottom of that
//               same bar so it reads as one continuous surface.
//   popped    — the identical stack, hosted by MiniPlayer's floating frame.
//               Same controls, same order, same look, on every page.
//
// Because the media node lives in PlayerScreen and the state lives in context,
// switching presentation never remounts the embed — playback carries straight
// through docking, popping out and navigating between pages.
export default function TrueglePlayer({
  presentation = 'expanded',
  accent = '#f43f5e',
  query = '',
  scope = 'all',
  provider = 'all',
  showList = true,
  hideScreen = false,
  // Bumped by the host when the user SUBMITS a search, so the list opens even
  // when the text hasn't changed since last time — pressing enter and seeing
  // nothing happen is what made the popped-out player feel broken.
  openListNonce = 0,
  // A host that has a voice search can hand it in; the locked player's middle
  // third calls it. Absent, that gesture does nothing rather than pretending
  // there is a microphone.
  onVoiceSearch,
  onQueryHandled,
  className = '',
}) {
  const {
    current, queue, history, paused, dock, locked, setLocked,
    next, skipNext, prev, stop, togglePause, setPoppedOut, setDock, play,
    playMode, setPlayMode, volume, setVolume,
    feedActive, feed: feedRest, feedNext, activeDeck, fullscreenNonce, setMinimized,
    list: playingList, listNext, resumeQueue, nextNonce,
    queueStandby, listStandby, currentStandby, resumeStandby, setPaused, jump: jumpToQueued,
  } = usePlayer();
  const pageMode = usePageMode();
  // ONE PLAYER, AND ON THE FEED PAGE IT NEVER AUTOPLAYS RANDOM LINKS. Feed
  // plays the feed's own timeline in order; Up Next (Tube's corpus of
  // creators, trending and search) never picks what plays next here, and an
  // empty player is not topped up with it either.
  const onFeedPage = pageMode === 'yellow';
  const stash = useSearchStashContext();
  // The lock is a phone feature — see useTouchDevice.
  const touchDevice = useTouchDevice();
  const mediaRef = useRef(null);
  const frameRef = useRef(null);
  const rootRef = useRef(null);
  const [listOpen, setListOpen] = useState(false);
  // ONE search per query, shared by the list below and the browse deck in the
  // viewport. It used to live inside PlayerListSlot; with two consumers that
  // would have been two identical round trips per keystroke.
  const search = usePlayerSearch(query, scope, provider);
  // ── THE LOCKED VOICE PANEL ────────────────────────────────────────────────
  // Its own query and therefore its own search: the host's `query` is the page's
  // search bar, and speaking into a locked player must not rewrite what is in a
  // box the user cannot see. Empty until something is actually said, so this
  // costs one no-op hook and no request.
  const [voiceQuery, setVoiceQuery] = useState('');
  const voiceSearch = usePlayerSearch(voiceQuery, scope, provider);
  // Drives the viewport shrink: "list drops down, viewport shrinks to
  // accommodate". The picture gets smaller rather than being covered, because
  // a list over the video means picking a track blind — and this exists to be
  // used while driving.
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [shareState, setShareState] = useState('idle');
  // ── FULL SCREEN IS THE FULLSCREEN API AGAIN ───────────────────────────────
  //
  // REVERTED 2026-08-25, and the reason is worth keeping because the idea
  // sounded good. The ask was to keep the phone's notification shade reachable
  // in full screen, which the Fullscreen API genuinely cannot do — hiding the
  // system bars is what entering fullscreen MEANS on Android. So full screen
  // was reimplemented on touch devices as a fixed box filling 100dvh with the
  // safe-area inset left clear.
  //
  // It worked, and it cost more than it was worth. A fixed box is not a
  // fullscreen element: it does not get the browser's own layout guarantees,
  // it fights the address bar as that shows and hides, and the flex chain
  // through to the picture resolved differently — which is how the video ended
  // up small and letterboxed inside a large black field. The owner's verdict
  // after living with it: "I didn't realize that making the native clock
  // visible would break functionality so much."
  //
  // So the status bar loses. It is one swipe and an exit away in real full
  // screen, and a player whose picture fills the screen is worth more than a
  // clock that is visible while it doesn't. The drop-down search bar and the
  // playlist — the parts that were WANTED — are untouched by this and stay.
  const [fullscreen, setFullscreen] = useState(false);

  // Full screen is OURS, not the embed's. Handing it to YouTube's own button
  // gives their iframe the whole screen and takes our transport and list with
  // it; requesting it on this container keeps the controller bar and the
  // retracting list exactly where they were.
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  // FULL SCREEN TAKES THE CLIP'S OWN SHAPE on a phone: a 9:16 Short, TikTok
  // or Reel locks the screen upright, anything else turns it sideways — the
  // way YouTube's own full screen behaves. Android honours the lock (only
  // while in full screen, which is exactly when this runs); iOS has no lock
  // API and simply follows how the phone is held. Re-locks if the next clip
  // is the other shape; released on the way out.
  const clipIsTall = !!current && (!!current.vertical || current.kind === 'tiktok');
  useEffect(() => {
    const o = typeof window !== 'undefined' ? window.screen?.orientation : null;
    if (!o?.lock) return;
    if (fullscreen && touchDevice) {
      o.lock(clipIsTall ? 'portrait' : 'landscape').catch(() => { /* not allowed here */ });
    } else if (!fullscreen) {
      try { o.unlock?.(); } catch { /* nothing locked */ }
    }
  }, [fullscreen, touchDevice, clipIsTall]);

  // FIRST TIME IN FULL SCREEN ON A PHONE: show what the gestures are. Once
  // per browser, gone after five seconds or the first touch.
  const [swipeHint, setSwipeHint] = useState(false);
  useEffect(() => {
    if (!fullscreen || !touchDevice || locked) return undefined;
    try {
      if (localStorage.getItem('truegle_swipe_hint_seen')) return undefined;
      localStorage.setItem('truegle_swipe_hint_seen', '1');
    } catch { /* private mode: show it this once anyway */ }
    setSwipeHint(true);
    const t = setTimeout(() => setSwipeHint(false), 5000);
    return () => clearTimeout(t);
  }, [fullscreen, touchDevice, locked]);

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.().catch(() => { /* denied — stay inline */ });
  }, []);

  // ASKED FOR FROM OUTSIDE: "Open in app" on a feed card plays the card and
  // takes the player full screen in the same press, so the card becomes the
  // whole view without leaving the feed. Only the deck that was asked for
  // responds — this component renders for both decks, and both reacting
  // would fight over the one fullscreen element.
  //
  // A REQUEST, NOT A STATE. The nonce means a second Open-in-app is
  // distinguishable from the first; skipping the initial value means merely
  // mounting the player never forces full screen on anybody. Browsers only
  // grant this from inside the gesture that asked, which is why the request
  // travels rather than a flag being set and read later.
  // ── the feed's one save ─────────────────────────────────────────────────
  // "A singular save for creating a playlist from feed content." One button,
  // one list, no picker: choosing a destination is the friction that stops
  // people saving anything at all mid-scroll, and the feed's saves are one
  // collection by definition. The list is made on the first save and added
  // to after that; the full playlist machinery (rename, reorder, delete)
  // already exists in the library for anyone who wants it later.
  const FEED_SAVES = 'Feed saves';
  const [savedState, setSavedState] = useState('idle'); // idle | saved | already
  const saveToFeedList = useCallback(() => {
    if (!current) return;
    const existing = playlists().find((p) => p.name === FEED_SAVES);
    const id = existing ? existing.id : createPlaylist(FEED_SAVES, []);
    if (!id) return;
    // addToPlaylist refuses a duplicate, which is the honest answer to
    // pressing save twice — say so rather than showing a tick that lied.
    setSavedState(addToPlaylist(id, current) ? 'saved' : 'already');
    setTimeout(() => setSavedState('idle'), 1800);
  }, [current]);

  const seenFullscreenNonce = useRef(fullscreenNonce);
  useEffect(() => {
    if (fullscreenNonce === seenFullscreenNonce.current) return;
    seenFullscreenNonce.current = fullscreenNonce;
    if (presentation === 'collapsed') return;
    if (document.fullscreenElement) return;
    rootRef.current?.requestFullscreen?.().catch(() => { /* denied — stay inline */ });
  }, [fullscreenNonce, presentation]);

  // The transport's right-hand control, which changes with where the player
  // is — one button, one meaning, at all times:
  //
  //   docked in a page  → pop out
  //   popped on Tube    → dock back into the search bar (its home is there)
  //   popped elsewhere  → MOVE. Off Tube there is nowhere to dock back into,
  //                       and moving the window was buried behind its own
  //                       separate toggle: press pop-out, press move, drag,
  //                       press move again, press pop-out again. The frame's
  //                       X already closes it, so the useful thing to put here
  //                       is the one that was hardest to reach.
  const narrow = useNarrowViewport();
  const atFooter = dock === 'footer' || (!dock && narrow);
  const onTube = pageMode === 'tube';
  const popOutMode = presentation !== 'popped'
    ? 'pop'
    : onTube ? 'bar' : (atFooter ? 'float' : 'footer');

  const cyclePopOut = useCallback(() => {
    if (presentation !== 'popped') { setPoppedOut(true); return; }
    if (onTube) { setPoppedOut(false); return; }
    // Away from Tube there is nothing to dock back into, so this moves the
    // player between its two homes. It used to toggle a move/resize MODE; the
    // window drags from its bar and resizes from its corner now, like any other
    // window, so the mode had nothing left to do.
    setDock(atFooter ? 'float' : 'footer');
  }, [presentation, onTube, setPoppedOut, setDock, atFooter]);

  // Typing opens the list; it retreats again once the user has made their
  // selection (PlayerListSlot's post-add timer calls onRevert).
  // Not for the query the player MOUNTS with: a search remembered from last
  // time comes back in the box, but reopening its results on every page load
  // would be the player talking first.
  //
  // NOTHING ACTIVELY PLAYING (nothing loaded, or paused): the results go to
  // the VIEWPORT instead, and the list — with the queue and whatever was
  // playing on standby behind it — stays tucked away. Opening it offers
  // Resume / Return (see PlayerListSlot's standby layer).
  const activelyPlaying = !!current && !paused;
  const mountQuery = useRef(query);
  useEffect(() => {
    if (query === mountQuery.current) return;
    mountQuery.current = null;
    if (query.trim().length >= 2) setListOpen(activelyPlaying);
  }, [query]);
  useEffect(() => {
    if (openListNonce) setListOpen(activelyPlaying);
  }, [openListNonce]);
  // Paused under a search: the results cover the paused picture (which stays
  // mounted, on standby) until something is picked or play is pressed.
  const hasResults = query.trim().length >= 2 && (search.results?.length || 0) > 0;
  const browseOverScreen = !!current && paused && hasResults;
  // The queue, a saved list or the clip that was on is waiting behind the
  // current activity — the list offers to Resume it or Return to it.
  const standby = (!activelyPlaying && (queue.length > 0 || !!current))
    || (feedActive && (queueStandby || !!listStandby || !!currentStandby));
  const resumeFromStandby = useCallback(() => {
    if (feedActive && (queueStandby || listStandby || currentStandby)) resumeStandby();
    else if (current && paused) setPaused(false);
    else if (!current && queue.length) jumpToQueued(0);
    setListOpen(false);
  }, [feedActive, queueStandby, listStandby, currentStandby, resumeStandby, current, paused, setPaused, queue.length, jumpToQueued]);

  // A native element can really pause; keep the DOM node in step with state.
  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (paused) el.pause();
    else el.play?.().catch(() => { /* autoplay policy — user will press play */ });
  }, [paused, current]);

  // Nothing queued? Keep going anyway — build the next thing from this
  // browser's own 👍/👎 profile and the platform's anonymous vote pool, the way
  // an autoplay feed does. Only in 'auto': the other play modes are explicit
  // instructions about what comes next and quietly overriding them would be
  // wrong.
  const upNext = useUpNext();
  // THE QUEUE IS FOLLOWED WHENEVER IT HAS SOMETHING IN IT — unless it is on
  // standby behind a feed run (feed clips, or picks from the viewport deck),
  // in which case it waits untouched until Resume, leaving the Feed, or an
  // add. It used to need "arming" in the current sitting, so after a reload
  // (phone browsers recycle background tabs) a perfectly good queue was
  // ignored and Next went to Up Next's picks instead — reported as "it
  // defaults to shuffle even though shuffle isn't selected".
  const followQueue = queue.length > 0 && !feedActive;
  // A feed run outranks the queue while it has clips left.
  const followFeed = feedActive && feedRest.length > 0;
  // A feed run that has played its last clip. The queue is still parked
  // behind it, so nothing here may step into it by accident.
  const feedSpent = feedActive && feedRest.length === 0;

  const advance = useCallback(async () => {
    // A saved list outranks everything: it plays in order and ends where it
    // ends. See PlayerContext's `list`.
    if (playingList) { listNext(false); return; }
    if (followFeed) { feedNext(); return; }
    // ON THE FEED PAGE, AN EXHAUSTED PLAYER GETS OUT OF THE WAY: the queue
    // stays parked and nothing random plays. Repeat-one and loop are explicit
    // instructions to keep playing, so they outrank this.
    if (onFeedPage && current && !followQueue && playMode === 'auto') { setMinimized(true); return; }
    // Anywhere else, a run of picks that has finished hands back to the
    // queue (or saved list) it parked, and carries on from there.
    if (feedSpent) { resumeQueue(); if (queue.length) { next(); return; } }
    if (followQueue || playMode !== 'auto' || !current || onFeedPage) { next(); return; }
    const nextUp = await upNext.pick(current);
    if (nextUp) { play(nextUp); return; }
    next();
  }, [playingList, listNext, followFeed, feedNext, feedSpent, resumeQueue, queue.length, followQueue, playMode, current, next, play, upNext, onFeedPage, setMinimized]);

  // A manual Next. A playing list walks the list; a feed run walks the feed
  // and, once spent, STAYS PUT — it never dips into the parked queue (that is
  // how a queue "immediately resumed" under a feed clip); otherwise the queue
  // in order, and only with nothing queued does Up Next find something new.
  const goNext = useCallback(async () => {
    if (playingList) { listNext(true); return; }
    if (followFeed) { feedNext(); return; }
    if (feedSpent) return;
    if (followQueue || !current || onFeedPage) { skipNext(); return; }
    const nextUp = await upNext.pick(current);
    if (nextUp) play(nextUp); else skipNext();
  }, [playingList, listNext, followFeed, feedNext, feedSpent, followQueue, current, upNext, play, skipNext, onFeedPage]);

  // Next pressed OUTSIDE the player (minimized bar, lock-screen keys, the
  // map's transport) arrives as a nonce so it runs the same rules as above.
  // Only the full player answers, never the collapsed strip in the Tube bar.
  const seenNextNonce = useRef(nextNonce);
  useEffect(() => {
    if (nextNonce === seenNextNonce.current) return;
    seenNextNonce.current = nextNonce;
    if (presentation === 'collapsed') return;
    goNext();
  }, [nextNonce, presentation, goNext]);

  // AN EMPTY VIEWPORT FILLS ITSELF — WITH THUMBNAILS, NOT PLAYBACK. With
  // nothing playing, the same taste profile that decides what comes next picks
  // a deck of things to show in the viewport, scrollable, each with Play now /
  // Queue / List. It used to push them into the QUEUE, which started one
  // playing on its own; nothing plays now until somebody chooses it.
  //
  // Guarded, because this fires a backend request:
  //   · once per empty stretch (`filling`), so a slow reply can't stack fills;
  //   · only when the player is actually on screen, so a page that merely
  //     mounts the component in a collapsed bar doesn't fetch a feed nobody
  //     asked for;
  //   · never while locked — the lock means "leave this alone".
  //   · never on the Feed page, where Tube's picks don't belong.
  const filling = useRef(false);
  const [idleDeck, setIdleDeck] = useState([]);
  const visible = presentation !== 'collapsed';
  useEffect(() => {
    if (locked || !visible || onFeedPage) return undefined;
    if (current) { filling.current = false; return undefined; }
    if (filling.current) return undefined;
    filling.current = true;
    let cancelled = false;
    (async () => {
      const batch = await upNext.fill(null, 12);
      if (!cancelled && batch.length) setIdleDeck(batch);
    })();
    return () => { cancelled = true; };
  }, [current, locked, visible, upNext, onFeedPage]);

  // Report a clip that cannot play and move on. Shared by the embeds (via
  // onUnplayable) and the native <video>/<audio> (via onError) — a direct
  // file that 403s or won't decode used to leave the run stopped on a dead
  // frame, which is most of what "the feed won't keep playing" was.
  const skipBroken = useCallback(() => {
    if (!current) return;
    reportBroken(current, { auto: true });
    advance();
  }, [current, advance]);

  const embed = useEmbedPlayback({
    frameRef,
    source: current,
    onEnded: () => advance(),
    // The embed said it cannot play this. Report it and move on rather than
    // leaving the visitor staring at a black rectangle — this is the whole
    // error-review loop working without anybody having to notice or press
    // anything, which is the only version of it that will actually run.
    onUnplayable: () => skipBroken(),
  });

  // The list can't know how long anything is — the index doesn't carry it and
  // no free API will say. The embed does, the moment it starts, so remember it
  // against this media key and every future appearance of the track shows its
  // length. Same for the channel, which some result rows arrive without.
  useEffect(() => {
    if (!current || !embed?.duration) return;
    learnMeta(current, { duration: embed.duration, channel: current.channel });
  }, [current, embed?.duration]);

  // HOW FAR YOU GOT, recorded when you leave — see utils/retention.js.
  //
  // The position has to be captured on the way OUT, which is the whole
  // awkwardness: by the time `current` has changed, embed.time already belongs
  // to the new video. So the live position is mirrored into a ref every render
  // and read back when the source swaps, along with the source it belonged to.
  //
  // Fires on the swap AND on unmount, because closing the player, navigating
  // away or ending a session are all ordinary ways to finish watching
  // something, and only counting the ones that led to another video would
  // learn from a biased half of them.
  const watching = useRef({ source: null, time: 0, duration: 0 });
  // Mirrored in an effect rather than during render: writing to a ref while
  // rendering is the kind of thing that works until concurrent rendering
  // replays a render and quietly does it twice.
  useEffect(() => {
    if (!current || mediaKey(current) !== mediaKey(watching.current.source)) return;
    if (embed?.time) watching.current.time = embed.time;
    if (embed?.duration) watching.current.duration = embed.duration;
  }, [current, embed?.time, embed?.duration]);
  useEffect(() => {
    const previous = watching.current;
    if (previous.source && mediaKey(previous.source) !== mediaKey(current)) {
      recordRetention(previous.source, previous.time, previous.duration);
    }
    watching.current = { source: current, time: 0, duration: embed?.duration || 0 };
  }, [mediaKey(current)]);
  useEffect(() => () => {
    const last = watching.current;
    if (last.source) recordRetention(last.source, last.time, last.duration);
  }, []);

  // Everything that plays counts as seen, however it got here — otherwise
  // picking something by hand and then letting it run could hand you the same
  // clip straight back. The anonymous play counter (no id of any kind, see
  // utils/taste.js) goes out on the same edge, once per piece of media, and so
  // does the watch-history entry that makes it replayable later.
  const counted = useRef('');
  useEffect(() => {
    const key = mediaKey(current);
    if (!key || counted.current === key) return;
    counted.current = key;
    upNext.remember(current);
    recordWatch(current);
    signalPlay(current);
  }, [current, upNext]);

  // Pause and resume over the channel that is already open. This is what
  // stops a tap in full screen resetting the video: `paused` used to null the
  // source, which unmounted the iframe, so every tap started the track over.
  //
  // DEPENDS ON THE COMMAND, NOT ON `embed`. useEmbedPlayback returns a fresh
  // object every render, and the embed reports its position twice a second —
  // so with `embed` as a dependency this re-sent "play" twice a second
  // forever, undoing any pause a moment after it landed. That was "nothing
  // stops it except the space bar" (player suite, 2026-10-01).
  const embedCommand = embed.command;
  const embedCanCommand = embed.canCommand;
  useEffect(() => {
    if (!embedCanCommand || !current) return;
    embedCommand(paused ? 'pause' : 'play');
  }, [paused, current, embedCanCommand, embedCommand]);

  // ── VOLUME ────────────────────────────────────────────────────────────────
  // Re-applied on every source change, not just when the slider moves: each
  // platform starts a new clip at ITS default, and YouTube additionally starts
  // muted whenever it was autoplayed. Without this the level you set silently
  // reverted one video later, which reads as the control not working.
  //
  // Delayed as well as immediate: the embed ignores commands until its player
  // has booted, and a brand-new iframe usually has not. The retry is the same
  // trick the progress handshake uses.
  // Same rule as above: the stable setter, not the whole `embed` object, or
  // this re-sent mute/setVolume (with three retries) on every progress tick.
  const embedSetVolume = embed.setVolume;
  const embedCanSetVolume = embed.canSetVolume;
  useEffect(() => {
    if (!current) return undefined;
    const apply = () => {
      if (embedCanSetVolume) embedSetVolume(volume);
      // Native <audio>/<video> have a real property; no channel needed.
      if (mediaRef.current) mediaRef.current.volume = volume;
    };
    apply();
    const t = [250, 900, 2000].map((d) => setTimeout(apply, d));
    return () => t.forEach(clearTimeout);
  }, [volume, current, embedCanSetVolume, embedSetVolume]);


  // 👍/👎. The thumb steers what plays next; a dislike also guarantees this
  // never comes back. It deliberately does NOT skip — you may be halfway
  // through and simply registering an opinion, and losing your place to a
  // mis-tap is the same complaint that made the queue feel unsafe.
  const rating = useRating(current);
  const onRate = useCallback((dir) => { if (current) rate(current, dir); }, [current]);

  // Swipe up = next, swipe down = back, tap = play/pause. Only in full screen:
  // reading the gesture at all needs a transparent sheet over the embed (an
  // iframe swallows touches), and that sheet costs the platform's own
  // controls — a fair trade only when our controller bar is already pinned to
  // the bottom of the screen, which is exactly what full screen is.
  // Double-tap a side to jump ten seconds, the gesture every video app has
  // trained people to make. It works on the platforms whose play head we
  // actually track, and on a native <video>/<audio> where it is just a
  // property. Elsewhere it is off entirely rather than silently doing nothing:
  // with `canDoubleTap` false the single tap also stops waiting on the
  // double-tap window, so play/pause keeps its immediate response.
  const nativeMedia = current?.kind === 'file' || current?.kind === 'audio' || current?.kind === 'video';
  const canDoubleTap = !!current && (embed.canSeek || nativeMedia);
  // The jump has to be VISIBLE. Ten seconds of a talking head looks identical
  // to ten seconds earlier, and ten seconds of audio has no picture at all —
  // without a flash, a working jump is indistinguishable from a dead zone.
  const [jump, setJump] = useState(null); // { dir: -1 | 1, at }
  const jumpTimer = useRef(null);
  const seekBy = useCallback((delta) => {
    const el = mediaRef.current;
    if (el && typeof el.currentTime === 'number') {
      el.currentTime = Math.max(0, Math.min(el.currentTime + delta, (el.duration || Infinity) - 0.5));
    } else if (!embed.seek(delta)) {
      return; // no channel — say nothing rather than flashing a jump that didn't happen
    }
    setJump({ dir: delta < 0 ? -1 : 1, at: Date.now() });
    clearTimeout(jumpTimer.current);
    jumpTimer.current = setTimeout(() => setJump(null), 600);
  }, [embed]);
  useEffect(() => () => clearTimeout(jumpTimer.current), []);

  // The rail of controls over the picture, and the narrow set of gestures that
  // summons it. Disabled while locked — the lock exists so a pocket cannot
  // reach anything, and a rail that appears on a hold would be exactly that.
  const overlay = useOverlayReveal({ enabled: !!current && !locked });

  // ── RUNNING IT LOCKED, AND DARK ───────────────────────────────────────────
  // The lock used to mean "no controls at all". It means "different controls"
  // now: a set of deliberate gestures on the sheet that a pocket cannot
  // produce, so the player is fully usable with the screen apparently off.
  // See useLockedGestures for what each one is and how they are told apart.
  const lockedGestures = useLockedGestures({
    enabled: locked && !!current,
    onTogglePause: togglePause,
    onNext: goNext,
    onPrev: prev,
    onShuffle: () => setPlayMode('shuffle'),
    // Voice belongs to the page's search bar, not the player, so it is passed
    // in from outside when a host offers one. Absent, the middle third simply
    // does nothing rather than pretending.
    onVoice: onVoiceSearch,
    // One tap in the middle of the top band brings back the list you picked
    // from — the counterpart to Tube clearing it when you pressed play. Passed
    // only when there IS something to come back to, so the gesture is inert
    // rather than mysteriously doing nothing on a page with no stashed search.
    onRecall: stash.hasStash ? stash.recall : undefined,
  });

  // OUTSIDE FULL SCREEN A TAP NEVER PAUSES. Tapping anywhere on the docked,
  // floating or footer player used to toggle pause, and on a phone that fired
  // on every stray touch. Now a tap brings up the heads-up display (title,
  // thumbnail, play head, on-screen controls) and only the play buttons pause.
  // Full screen keeps tap-to-pause via the swipe sheet below. A double-click
  // still jumps ten seconds on a desktop.
  const onScreenDoubleClick = useCallback((e) => {
    const box = e.currentTarget.getBoundingClientRect();
    seekBy(e.clientX - box.left < box.width / 2 ? -10 : 10);
  }, [seekBy]);

  const swipe = useSwipeNav({
    active: fullscreen && !locked,
    onNext: goNext,
    onPrev: prev,
    // Tapping toggles pause — but ONLY where that can be done in place. On a
    // platform with no control channel, pause means unmount, and a stray touch
    // restarting the video is far worse than a tap doing nothing.
    // Full screen: a tap pauses/plays AND brings up the heads-up display, the
    // way YouTube's own player answers a tap.
    onTap: () => { overlay.reveal(); if (current && embed.canCommand) togglePause(); },
    doubleTap: canDoubleTap,
    onDoubleTap: (side) => seekBy(side === 'left' ? -10 : 10),
  });

  // ── THE KEYBOARD, AS YOUTUBE HAS IT ───────────────────────────────────────
  // Owner, 2026-10-01: "I want this player to ACT like YouTube." Only Space
  // used to work outside full screen, and IN full screen two handlers both
  // answered Space (so it paused and resumed in the same keystroke) while the
  // arrows changed track instead of seeking. One handler now, everywhere:
  //   Space / K  play–pause        J / L   −10 / +10 s
  //   ← / →      −5 / +5 s         ↑ / ↓   volume ±5 %
  //   M          mute              F       full screen
  //   Shift+N    next              Shift+P previous
  //   0–9        jump to 0–90 % of the clip
  // Never while typing, never with Ctrl/⌘/Alt (browser shortcuts), never on a
  // collapsed strip (the full player answers), and Space/Enter on a focused
  // button stays that button's.
  const lastVolume = useRef(volume || 0.8);
  useEffect(() => { if (volume > 0) lastVolume.current = volume; }, [volume]);
  useEffect(() => {
    if (!current || locked || presentation === 'collapsed') return undefined;
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      const t = e.target;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
      const k = e.key;
      const onButton = !!t?.closest?.('button, a, [role="button"]');
      const act = (fn) => { e.preventDefault(); fn(); };
      if (k === ' ' || e.code === 'Space') { if (!onButton) act(togglePause); return; }
      if (k === 'k' || k === 'K') return act(togglePause);
      if (k === 'j' || k === 'J') return act(() => seekBy(-10));
      if (k === 'l' || k === 'L') return act(() => seekBy(10));
      if (k === 'ArrowLeft') return act(() => seekBy(-5));
      if (k === 'ArrowRight') return act(() => seekBy(5));
      if (k === 'ArrowUp') return act(() => setVolume(Math.min(1, Math.round((volume + 0.05) * 100) / 100)));
      if (k === 'ArrowDown') return act(() => setVolume(Math.max(0, Math.round((volume - 0.05) * 100) / 100)));
      if (k === 'm' || k === 'M') return act(() => setVolume(volume > 0 ? 0 : lastVolume.current || 0.8));
      if (k === 'f' || k === 'F') return act(toggleFullscreen);
      if (k === 'N' && e.shiftKey) return act(goNext);
      if (k === 'P' && e.shiftKey) return act(prev);
      if (/^[0-9]$/.test(k) && embed.duration > 0) return act(() => seekBy((Number(k) / 10) * embed.duration - embed.time));
      return undefined;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, locked, presentation, togglePause, seekBy, setVolume, volume, toggleFullscreen, goNext, prev, embed.duration, embed.time]);

  // Platform embeds fire no `ended` event — that is why the queue never
  // advanced by itself for the things people actually queue. This talks
  // postMessage to the iframe we already have (no vendor SDK) and calls the
  // same advance() a native <video> would have.
  const share = useCallback(async () => {
    const link = buildPlayerLink([current, ...queue].filter(Boolean));
    if (!link) return; // a device file has no shareable URL
    try {
      if (navigator.share) {
        await navigator.share({ title: current?.title || 'Watch on Truegle', url: link });
      } else if (!(await copyText(link))) {
        // Say so rather than showing a tick over a clipboard that still holds
        // the last thing copied.
        setShareState('failed');
        setTimeout(() => setShareState('idle'), 2500);
        return;
      }
      setShareState('done');
      setTimeout(() => setShareState('idle'), 2000);
    } catch { /* user dismissed the sheet */ }
  }, [current, queue]);

  const transport = (
    <PlayerTransport
      // Offered for the embeds we can command AND for native media, where the
      // element has a real .volume. Withheld only where neither is true.
      showVolume={!!current && (embed.canSetVolume || current.kind === 'audio' || current.kind === 'video')}
      volume={volume}
      onVolume={setVolume}
      playing={!!current && !paused}
      canPrev={history.length > 0}
      canNext={queue.length > 0 || !!current}
      queueCount={queue.length}
      accent={accent}
      showList={showList}
      // FULL SCREEN ONLY. The lock is for watching undisturbed — a pocket, a
      // propped-up phone — and that is exactly when you are in full screen.
      // On the normal row it was an eleventh button competing with the two
      // controls people actually reach for, and it pushed full screen and
      // pop-out off the end.
      // TOUCH DEVICES ONLY, as well as full screen only. The lock exists to
      // stop a pocket from skipping the track; a desktop has no pocket and no
      // stray presses, so there the control only ever removes the controls and
      // then demands a 700ms hold to get them back. Removed rather than
      // disabled — a visibly dead button is its own support question.
      showLock={fullscreen && touchDevice}
      onLock={() => setLocked(true)}
      playMode={playMode}
      onCyclePlayMode={() => setPlayMode(PLAY_MODES[(PLAY_MODES.indexOf(playMode) + 1) % PLAY_MODES.length])}
      listOpen={listOpen}
      // NOT IN FULL SCREEN. This one button is pop-out / dock-back / MOVE
      // depending on where the player is, and in full screen all three are
      // nonsense: there is nowhere to pop out to, nothing to dock back into,
      // and moving or resizing a window that IS the screen does nothing you
      // can see. It was still rendering as the Move control, so full screen
      // had a drag handle on it that appeared to do nothing.
      //
      // Move/resize belongs to the popped-out window and nowhere else —
      // docked, minimized and full screen all have their geometry decided for
      // them, which is the point of each of those states.
      showPopOut={!fullscreen}
      popOutMode={popOutMode}
      showFullscreen={presentation !== 'collapsed'}
      fullscreen={fullscreen}
      onToggleFullscreen={toggleFullscreen}
      shareState={shareState}
      onPlayPause={() => (current ? togglePause() : null)}
      onPrev={prev}
      onNext={goNext}
      onToggleList={() => setListOpen((v) => !v)}
      onPopOut={cyclePopOut}
    />
  );

  // Collapsed lives inside the search bar's own row — no chrome of its own.
  //
  // THE FEED PLAYER HAS NO COLLAPSED STATE. Its three states are: in the
  // centred card, docked bottom-right at 9:16, or gone. "No player default
  // on the search bar… it needs a completely collapsed state that
  // disappears and never drops out of the search bar" — so on the feed deck
  // this renders NOTHING rather than a transport strip wedged into a bar.
  // Nothing is lost: the docked corner window is the state that carries the
  // controls, and it is one press away.
  if (presentation === 'collapsed') return transport;

  // The list retracts into the player rather than staying pinned open — the
  // bottom list button is the only thing that shows or hides it.
  const listVisible = showList && listOpen;
  // Full screen always shows the picture. Hidden clips the screen to nothing,
  // and keeping that clip in full screen produced a full screen of black with
  // the controls floating on it — asking for full screen IS asking to watch.
  const clipScreen = hideScreen && !fullscreen;

  // Built once and placed by the branch below, rather than written twice —
  // the feed deck boxes it into a portrait column, everything else lets it
  // fill its container, and the props are identical either way.
  const screen = (
    <PlayerScreen
      // Unmounting is now the LAST resort, not the definition of pause.
      // An embed we can command pauses in place and keeps its position;
      // only the platforms that give us no control channel still have to
      // be torn down, and those are the ones where resuming restarts.
      source={paused && !embed.canCommand ? null : current}
      mediaRef={mediaRef}
      frameRef={frameRef}
      onEnded={advance}
      onError={skipBroken}
      fill={fullscreen}
      compact={presentation === 'popped'}
      maxHeight={presentation === 'popped' ? 320 : 420}
      browse={search.results?.length ? search.results : (query.trim().length >= 2 ? search.results : idleDeck)}
      browseLoading={search.loading}
      browseMore={search.more}
      onBrowseMore={search.loadMore}
      browseLoadingMore={search.loadingMore}
    />
  );

  return (
    <div
      ref={rootRef}
      // Which player this is. The feed deck and the Tube deck share this
      // component and are not the same player — see the two-deck note in
      // PlayerContext — so the surface says which one is on screen, for
      // styling and for the browser tests that assert they stay separate.
      data-player-deck={activeDeck}
      // The player is an appliance, not a document: this marks the whole
      // subtree non-selectable (styles/no-select.css) so rapid taps in full
      // screen stop smearing a highlight across the overlay text. Inputs
      // inside it are exempted there.
      data-player-root=""
      onTouchStartCapture={swipeHint ? () => setSwipeHint(false) : undefined}
      // `relative` so the lock sheet can cover exactly this component and
      // nothing else on the page.
      className={`relative ${fullscreen ? 'flex flex-col w-full h-full bg-black' : className}`}
    >
      {/* THE WAY BACK TO THE FEED, one press, top corner. The feed player's
          full screen IS the feed card blown up, so leaving it has to feel
          like closing a card rather than exiting a video player — the
          transport's own full-screen toggle is at the bottom of the screen
          and reads as neither. Feed deck only: Tube's full screen is a
          destination in itself, not something a reader is passing through.
          Never while locked, which is the one state that means "ignore
          every control". */}
      {fullscreen && onFeedPage && !locked && (
        <button
          type="button"
          data-feed-fullscreen-close=""
          aria-label="Close and return to the feed"
          title="Back to the feed"
          onClick={() => document.exitFullscreen?.()}
          className="absolute top-3 right-3 z-40 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm
                     flex items-center justify-center text-white/90 hover:bg-black/80 hover:text-white
                     transition-colors"
        >
          <X size={20} />
        </button>
      )}

      {/* THE FEED'S ONE SAVE. Feed deck only — Tube has the full library and
          its own add-to-playlist menu; this is the one-press version for
          something you are watching mid-scroll and want to keep. */}
      {onFeedPage && current && !locked && (
        <button
          type="button"
          data-feed-save=""
          data-saved={savedState}
          aria-label={savedState === 'already' ? 'Already in your feed saves' : 'Save to your feed playlist'}
          title={savedState === 'already' ? 'Already saved' : 'Save to Feed saves'}
          onClick={saveToFeedList}
          className={`absolute ${fullscreen ? 'top-3 left-3 w-10 h-10' : 'top-2 left-2 w-8 h-8'} z-40 rounded-full
                      bg-black/60 backdrop-blur-sm flex items-center justify-center transition-colors
                      hover:bg-black/80 ${savedState === 'idle' ? 'text-white/80 hover:text-white' : 'text-emerald-300'}`}
        >
          <Bookmark size={fullscreen ? 18 : 15} fill={savedState === 'saved' ? 'currentColor' : 'none'} />
        </button>
      )}

      {/* `touchDevice &&`: a lock set on a phone and then resumed on a desktop
          (same account, restored state) would otherwise paint a sheet over a
          player whose lock button is no longer offered. The state is left
          alone — it is still locked if that device goes back to touch — but it
          is never ENFORCED where it cannot be turned off. */}
      {swipeHint && fullscreen && (
        <div data-swipe-hint="" aria-hidden="true"
          className="absolute inset-0 z-40 pointer-events-none flex flex-col items-center justify-center gap-6 bg-black/45">
          <div className="flex flex-col items-center gap-1 text-white animate-bounce">
            <ChevronUp size={40} strokeWidth={2.5} />
            <span className="text-sm font-semibold">Swipe up · next</span>
          </div>
          <span className="px-3 py-1.5 rounded-full bg-black/60 text-white/85 text-xs">Tap · pause &amp; controls</span>
          <div className="flex flex-col items-center gap-1 text-white/80 animate-bounce" style={{ animationDelay: '0.5s' }}>
            <span className="text-sm font-semibold">Swipe down · previous</span>
            <ChevronDown size={40} strokeWidth={2.5} />
          </div>
        </div>
      )}
      {/* The drop-down bar. Full screen only — inline, the page's own search
          bar is right there — and never while locked, where the microphone
          panel is the way in instead. */}
      {fullscreen && !locked && (
        <FullscreenSearchBar
          accent={accent}
          results={voiceSearch.results || []}
          loading={voiceSearch.loading}
          onSearch={setVoiceQuery}
          onSelect={(r) => { play(r); setVoiceQuery(''); }}
          onVoice={onVoiceSearch}
        />
      )}

      {locked && touchDevice && (
        <PlayerLockOverlay
          onUnlock={() => setLocked(false)}
          gestures={lockedGestures}
          voice={{
            volume,
            setVolume,
            results: voiceSearch.results || [],
            loading: voiceSearch.loading,
            onSearch: (q) => { setVoiceQuery(q); setVoiceOpen(true); },
            onDismiss: () => { setVoiceQuery(''); setVoiceOpen(false); },
            // A pick plays it and the list retracts — the player never leaves
            // the locked state, because only the panel was ever unlocked.
            onSelect: (r) => { play(r); setVoiceQuery(''); setVoiceOpen(false); },
            // "If the playlist button is selected however, the input / results
            // DO NOT return, and the lists menu opens." A different
            // destination, so it clears the voice query on the way.
            onOpenPlaylist: () => {
              setVoiceQuery('');
              setVoiceOpen(false);
              setListOpen(true);
            },
          }}
        />
      )}
      {/* 'hidden' clips the picture to nothing rather than unmounting it: an
          unmounted iframe stops playing and starts over when it comes back,
          which is the opposite of what "hide the video, keep listening" means.
          The transport below stays exactly where it was. */}
      {/* This wrapper exists to CLIP the picture in Hidden mode. It also sits
          in the flex chain in full screen, so it has to pass the available
          height through — without `flex-1 min-h-0 flex` the screen below it
          resolved to zero height and full screen was a black rectangle with
          controls on it. */}
      <div
        // `relative` outside full screen too: the click-to-pause overlay below
        // positions against this box, and without it the overlay escaped to
        // whichever ancestor happened to be positioned.
        className={`${clipScreen ? 'max-h-0 overflow-hidden' : (fullscreen ? 'relative flex flex-1 min-h-0' : 'relative')} transition-[max-height] duration-300 ease-out`}
        // THE VIEWPORT SHRINKS FOR THE VOICE PANEL rather than being covered by
        // it. `max-height` and not `height`: the screen letterboxes itself
        // inside whatever box it is given, so capping the box scales the
        // picture down and keeps it fully visible — setting a height would
        // crop it instead, which is the opposite of the point. The media node
        // is untouched, so nothing reloads and playback does not stutter.
        style={voiceOpen && !clipScreen ? { maxHeight: '38%' }
          : (browseOverScreen && !fullscreen ? { minHeight: presentation === 'popped' ? 'min(34svh, var(--truegle-player-cap, 100svh))' : 'min(52svh, var(--truegle-player-cap, 100svh))' } : undefined)}
        aria-hidden={clipScreen}
      >
        {/* THE FEED PLAYER IS 9:16 IN EVERY STATE — docked, popped out and
            full screen alike, with anything wider letterboxed into it. That
            shape is what makes the feed player recognisably not the Tube
            player rather than the same frame at a different size.
            The box itself belongs to PlayerScreen (`portrait`), NOT to a
            wrapper here: wrapping it broke the flex chain full screen relies
            on and collapsed the picture to zero height — audio over a black
            screen. See the note by boxStyle in PlayerScreen.jsx. */}
        {screen}
        {browseOverScreen && (
          <div data-player-standby-browse="" className="absolute inset-0 z-[15] flex flex-col">
            <PlayerBrowse
              rows={search.results}
              loading={search.loading}
              compact={presentation === 'popped'}
              fill
              more={search.more}
              onMore={search.loadMore}
              loadingMore={search.loadingMore}
            />
          </div>
        )}
        {/* The controls that sit ON the picture: thumbs, share, play mode. They
            are always mounted and fade rather than appearing, so nothing pops
            in over the video — and they take no width from the transport row
            underneath, which is what stopped it running out of room in a
            resized window. */}
        {current && !clipScreen && !browseOverScreen && (
          <PlayerOverlay
            visible={overlay.visible && !locked}
            rating={rating}
            onRate={current ? onRate : undefined}
            onShare={current ? share : undefined}
            shareState={shareState}
            playMode={playMode}
            playModeLabel={PLAY_MODE_LABEL[playMode]}
            onCyclePlayMode={() => setPlayMode(PLAY_MODES[(PLAY_MODES.indexOf(playMode) + 1) % PLAY_MODES.length])}
            accent={accent}
          />
        )}

        {/* TAP THE PICTURE TO SEE WHAT'S PLAYING, outside full screen — never
            to pause (only the play buttons pause here). Click-only: no
            touch-action and no preventDefault on touch, so scrolling past the
            player is unaffected. It covers the embed's own controls, which
            our transport and this HUD replace; on a platform we cannot
            command there is no layer at all. */}
        {!swipe && current && embed.canCommand && !locked && !clipScreen && !browseOverScreen && (
          <button
            type="button"
            onClick={overlay.reveal}
            onDoubleClick={onScreenDoubleClick}
            {...overlay.handlers}
            aria-label="Show what's playing and the controls"
            className="absolute inset-0 z-10 cursor-default"
            style={{ background: 'transparent' }}
          />
        )}
        {/* THE HEADS-UP DISPLAY: thumbnail, title and channel across the top,
            the play head along the bottom, the on-screen controls (above) at
            the side — all summoned by the tap and faded out again by
            useOverlayReveal's timer. Pointer-transparent except the seek bar. */}
        {current && !clipScreen && !locked && !browseOverScreen && (
          <div
            data-player-hud={overlay.visible ? 'shown' : 'hidden'}
            aria-hidden={!overlay.visible}
            className={`absolute inset-0 z-20 flex flex-col justify-between pointer-events-none transition-opacity duration-200 ${overlay.visible ? 'opacity-100' : 'opacity-0'}`}
          >
            <div className={`flex items-center gap-2 p-2 pr-14 bg-gradient-to-b from-black/75 to-transparent ${onFeedPage ? (fullscreen ? 'pl-16' : 'pl-12') : ''}`}>
              {current.poster && (
                <img src={current.poster} alt="" className="w-12 h-8 rounded object-cover shrink-0 border border-white/15" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate">{current.title || 'Now playing'}</p>
                {current.channel && <p className="text-[10px] text-white/60 truncate">{current.channel}</p>}
              </div>
            </div>
            {/* Back · play/pause · forward, centred on the picture like the
                controls YouTube shows on a tap. Live only while shown, so an
                invisible button can never catch a stray touch. */}
            {/* The ROW stays touch-transparent; only its three buttons take
                touches. A full-width live row sat across the middle of the
                picture and swallowed the second tap of every double-tap, so
                "double-tap to skip 10s" never worked (player suite). */}
            <div data-player-hud-transport="" className={`flex items-center justify-center gap-6 pointer-events-none ${overlay.visible ? '[&>button]:pointer-events-auto' : ''}`}>
              <button type="button" onClick={() => { overlay.reveal(); prev(); }} disabled={!history.length}
                aria-label="Previous" tabIndex={overlay.visible ? 0 : -1}
                className="flex items-center justify-center w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm text-white disabled:opacity-30">
                <SkipBack size={20} fill="currentColor" />
              </button>
              <button type="button" onClick={() => { overlay.reveal(); togglePause(); }}
                aria-label={paused ? 'Play' : 'Pause'} tabIndex={overlay.visible ? 0 : -1}
                className="flex items-center justify-center w-14 h-14 rounded-full bg-black/55 backdrop-blur-sm text-white">
                {paused ? <Play size={26} fill="currentColor" className="ml-1" /> : <Pause size={26} fill="currentColor" />}
              </button>
              <button type="button" onClick={() => { overlay.reveal(); goNext(); }}
                aria-label="Next" tabIndex={overlay.visible ? 0 : -1}
                className="flex items-center justify-center w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm text-white">
                <SkipForward size={20} fill="currentColor" />
              </button>
            </div>
            <div className={overlay.visible ? 'pointer-events-auto' : ''}>
              <PlayerProgress
                mediaRef={mediaRef}
                source={current}
                playing={!paused}
                accent={accent}
                embedTime={embed.time}
                embedDuration={embed.duration}
              />
            </div>
          </div>
        )}
        {swipe && current && (
          <div
            {...swipe}
            {/* The reveal gesture rides alongside the swipe sheet in full
                screen: useSwipeNav listens on TOUCH events and this on POINTER
                ones, so they observe the same gestures without either
                intercepting the other. */ ...overlay.handlers}
            style={{
              // Vertical panning has to be ours or the browser starts scrolling
              // the page and the gesture never completes.
              touchAction: 'pan-x',
              // THE MIDDLE BAND, not the whole screen.
              //
              // The top and bottom edges of a full-screen surface belong to the
              // device: the status bar and notch above, the home indicator
              // below, and on both iOS and Android an edge strip the OS claims
              // for its own pull-down, back and home gestures. A sheet spanning
              // inset-0 sat under all of it — so reaching for the status bar
              // started one of our swipes, and the system gesture and ours
              // fought over the same drag. Neither one wins that cleanly.
              //
              // Leaving the gutters open costs nothing: nobody swipes a feed
              // from the very top or bottom edge of the glass. The min() keeps
              // the band from collapsing on a short viewport (a phone held in
              // landscape), where a fixed gutter would eat the whole screen.
              top: 'calc(env(safe-area-inset-top, 0px) + min(76px, 14svh))',
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + min(96px, 18svh))',
            }}
            className="absolute inset-x-0 z-10"
            data-swipe-sheet=""
            aria-hidden="true"
          />
        )}

        {/* The jump, made visible. Sits on the half that was tapped, so it
            also confirms WHICH way — a badge in the middle would leave you
            guessing whether you hit back or forward. */}
        {jump && (
          <div
            className={`absolute inset-y-0 z-20 flex items-center justify-center pointer-events-none
              ${jump.dir < 0 ? 'left-0' : 'right-0'}`}
            style={{ width: '38%' }}
            aria-hidden="true"
          >
            <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-2xl bg-black/55 backdrop-blur-sm truegle-jump-flash">
              <span className="text-white text-lg leading-none">{jump.dir < 0 ? '«' : '»'}</span>
              <span className="text-white/90 text-xs font-semibold tabular-nums">10s</span>
            </div>
          </div>
        )}
        {/* Announced separately for anyone not watching the flash. */}
        <span className="sr-only" role="status" aria-live="polite">
          {jump ? `Skipped ${jump.dir < 0 ? 'back' : 'forward'} 10 seconds` : ''}
        </span>
      </div>
      {/* With the picture hidden there is nothing on screen saying anything is
          happening — so the play head goes here. */}
      {clipScreen && current && (
        <PlayerProgress
          mediaRef={mediaRef}
          source={current}
          playing={!paused}
          accent={accent}
          embedTime={embed.time}
          embedDuration={embed.duration}
        />
      )}
      {paused && current && (
        <div className="px-3 py-2 text-[11px] text-white/40 bg-black/40 border-t border-white/10">
          Paused — {current.title || 'this clip'}
        </div>
      )}
      {/* The controller bar keeps its place in full screen — same row, same
          order, just pinned to the bottom of the screen instead of the card. */}
      {/* relative z-30 keeps the controls ABOVE the frame's move overlay (z-20).
          Without it, arming move mode covered the very button that disarms it. */}
      <div className="relative z-30 shrink-0 px-1.5 py-1 border-t border-white/10 bg-black/20">{transport}</div>
      {listVisible && (
        <div className={fullscreen ? 'shrink-0 max-h-[45vh] overflow-y-auto' : ''}>
          <PlayerListSlot
            search={search}
            query={query}
            scope={scope}
            provider={provider}
            accent={accent}
            compact={presentation === 'popped'}
            onRevert={() => { setListOpen(false); onQueryHandled?.(); }}
            standby={standby}
            onResume={resumeFromStandby}
          />
        </div>
      )}
    </div>
  );
}
