import { useRef, useCallback, useState, useEffect } from 'react';
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
import { useEmbedPlayback } from '../../hooks/useEmbedPlayback';
import { usePlayerSearch } from '../../hooks/usePlayerSearch';
import { useUpNext } from '../../hooks/useUpNext';
import { useSwipeNav } from '../../hooks/useSwipeNav';
import { useOverlayReveal } from '../../hooks/useOverlayReveal';
import { useLockedGestures } from '../../hooks/useLockedGestures';
import { rate, useRating, signalPlay } from '../../utils/taste';
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
    enqueueMany, playMode, setPlayMode, queueArmed, volume, setVolume,
    feedActive, feed: feedRest, feedNext, activeDeck,
  } = usePlayer();
  // THE FEED DECK PLAYS FEED CONTENT, FULL STOP. Up Next draws on Tube's
  // corpus (creators, trending, search — see useUpNext), which is exactly
  // what the feed player is not for: "the feed player is for viewing the
  // social feed playable content only". So on the feed deck an exhausted
  // feed simply stops, rather than wandering off into Tube's library.
  const onFeedDeck = activeDeck === 'feed';
  const pageMode = usePageMode();
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

  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.().catch(() => { /* denied — stay inline */ });
  }, []);

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
  useEffect(() => {
    if (query.trim().length >= 2) setListOpen(true);
  }, [query]);
  useEffect(() => {
    if (openListNonce) setListOpen(true);
  }, [openListNonce]);

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
  // THE QUEUE ONLY WINS WHEN IT WAS ASKED FOR.
  //
  // This used to read `if (queue.length > 0)`, which made upNext.pick()
  // unreachable whenever anything at all sat in the list — including a list
  // restored from a previous session. Clear the queue, search, play one video,
  // and the next thing up was last week's list again, with no way forward into
  // anything new.
  //
  // `queueArmed` is the difference between a list somebody is following and a
  // list that merely exists (see PlayerContext). Unarmed, an empty player and a
  // player with fifty stored items behave the same way: they go and find
  // something related to what you just watched.
  const followQueue = queueArmed && queue.length > 0;
  // THE FEED OUTRANKS THE QUEUE. Switching on feed autoplay means "play these
  // results", and it stays in charge until it runs out or somebody stops it —
  // at which point playback falls to discovery, not back into a queue nobody
  // restarted. See PlayerContext for why the queue is left untouched
  // underneath rather than replaced.
  const followFeed = feedActive && feedRest.length > 0;
  /* THE QUEUE IS A ONE-SHOT; UP NEXT IS THE DEFAULT.
   *
   * Reported as two complaints that turned out to be one: "currently defaults
   * to queue next but should default to up next", and "Up Next should NEVER
   * play any already indexed videos".
   *
   * Up Next was never the culprit — candidatesFor() filters on hasSeen() and
   * pick() has no bypass, so it returns null rather than a video you have
   * watched. The repeats came from the QUEUE, which this checked FIRST and
   * which holds whatever you put in it, watched or not. `queueArmed` latches
   * true the moment anything is added by hand, so one "Add to queue" captured
   * every subsequent advance for the rest of the session.
   *
   * So the queue keeps its job and loses its grip: while it HAS items it plays,
   * because that is what a queue is for and taking that away would break the
   * button. The moment it empties, `followQueue` goes false on its own and
   * Up Next takes over permanently — no re-arming, no mode to remember.
   * playMode !== 'auto' (repeat-one, shuffle) still wins over both; those are
   * explicit instructions.
   */
  const advance = useCallback(async () => {
    if (followFeed) { feedNext(); return; }
    if (followQueue || playMode !== 'auto' || !current || onFeedDeck) { next(); return; }
    const nextUp = await upNext.pick(current);
    if (nextUp) { play(nextUp); return; }
    next();
  }, [followFeed, feedNext, followQueue, playMode, current, next, play, upNext, onFeedDeck]);

  // A manual Next must always go somewhere. With an empty queue it used to do
  // nothing at all, which is what "I hit next and nothing happened" was: the
  // feed is now what it falls through to, in every play mode, because pressing
  // the button is an explicit instruction that outranks repeat-one.
  const goNext = useCallback(async () => {
    // Swiping or pressing Next during a feed walks the feed — "play the feed as
    // is". Only an exhausted feed falls through to finding something new.
    if (followFeed) { feedNext(); return; }
    if (followQueue || !current || onFeedDeck) { skipNext(); return; }
    const nextUp = await upNext.pick(current);
    if (nextUp) play(nextUp); else skipNext();
  }, [followFeed, feedNext, followQueue, current, upNext, play, skipNext, onFeedDeck]);

  // AN EMPTY VIEWPORT FILLS ITSELF. Landing on the player with nothing playing
  // and nothing queued used to be a dead end — the only way forward was to go
  // and find something to search for, which is the "locating new videos can be
  // a pain" complaint. Now the same taste profile that decides what comes next
  // also decides what to open WITH, and tops the queue back up whenever it runs
  // dry.
  //
  // Guarded three ways, because this fires a backend request:
  //   · once per empty stretch (`filling`), so a slow reply can't stack fills;
  //   · only when the player is actually on screen, so a page that merely
  //     mounts the component in a collapsed bar doesn't fetch a feed nobody
  //     asked for;
  //   · never while locked — the lock means "leave this alone".
  //   · never on the feed deck, which is not Tube's to fill — an empty feed
  //     player is finished, not waiting to be topped up with creators and
  //     trending videos nobody scrolled past.
  const filling = useRef(false);
  const visible = presentation !== 'collapsed';
  useEffect(() => {
    if (locked || !visible || onFeedDeck) return;
    if (current || queue.length > 0) { filling.current = false; return; }
    if (filling.current) return;
    filling.current = true;
    let cancelled = false;
    (async () => {
      const batch = await upNext.fill(null, 6);
      // The user may have started something themselves while we were waiting —
      // dropping a feed on top of that would be the player talking over them.
      if (cancelled || !batch.length) return;
      enqueueMany(batch);
    })();
    return () => { cancelled = true; };
  }, [current, queue.length, locked, visible, upNext, enqueueMany, onFeedDeck]);

  const embed = useEmbedPlayback({
    frameRef,
    source: current,
    onEnded: () => advance(),
    // The embed said it cannot play this. Report it and move on rather than
    // leaving the visitor staring at a black rectangle — this is the whole
    // error-review loop working without anybody having to notice or press
    // anything, which is the only version of it that will actually run.
    onUnplayable: () => {
      if (!current) return;
      reportBroken(current, { auto: true });
      advance();
    },
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
  useEffect(() => {
    if (!embed.canCommand || !current) return;
    embed.command(paused ? 'pause' : 'play');
  }, [paused, current, embed]);

  // ── VOLUME ────────────────────────────────────────────────────────────────
  // Re-applied on every source change, not just when the slider moves: each
  // platform starts a new clip at ITS default, and YouTube additionally starts
  // muted whenever it was autoplayed. Without this the level you set silently
  // reverted one video later, which reads as the control not working.
  //
  // Delayed as well as immediate: the embed ignores commands until its player
  // has booted, and a brand-new iframe usually has not. The retry is the same
  // trick the progress handshake uses.
  useEffect(() => {
    if (!current) return undefined;
    const apply = () => {
      if (embed.canSetVolume) embed.setVolume(volume);
      // Native <audio>/<video> have a real property; no channel needed.
      if (mediaRef.current) mediaRef.current.volume = volume;
    };
    apply();
    const t = [250, 900, 2000].map((d) => setTimeout(apply, d));
    return () => t.forEach(clearTimeout);
  }, [volume, current, embed]);

  // ── SPACEBAR ──────────────────────────────────────────────────────────────
  // The universal play/pause key, and it was bound to nothing. Skipped while
  // the caret is in a text field, where space means space — that is the whole
  // reason a global key handler is normally a bad idea, and the only reason it
  // is a good one here is that the player is genuinely global.
  useEffect(() => {
    if (!current || locked) return undefined;
    const onKey = (e) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      const t = e.target;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
      // A focused button gets space as "press me"; stealing it would break
      // every control on the page.
      if (tag === 'BUTTON' || t?.closest?.('button, a, [role="button"]')) return;
      e.preventDefault(); // or the page scrolls a screen at the same time
      togglePause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, locked, togglePause]);

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

  // ── CLICKING THE PICTURE, ON A DESKTOP ────────────────────────────────────
  //
  // Double-tap-to-seek existed only as a TOUCH gesture (useSwipeNav's
  // doubleTap), so on a mouse there was no way to jump ten seconds at all —
  // reported as "the double tap to fast forward key sequence isn't working on
  // desktop". It was not broken; it was never wired for a pointer.
  //
  // A single click still pauses, so the single action has to WAIT to find out
  // whether a second click is coming. 250ms is the usual double-click window;
  // shorter drops real double-clicks, longer makes pausing feel laggy. Without
  // the wait, a double-click pauses, resumes and then seeks — three things for
  // one gesture.
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

  const clickTimer = useRef(null);
  // Which half of the picture the pending click landed on — read on the first
  // click, used if a second one follows.
  const clickSide = useRef('right');
  useEffect(() => () => clearTimeout(clickTimer.current), []);

  const onScreenClick = useCallback((e) => {
    // A long press summoned the overlay; the click that ends it is not a tap
    // and must not also pause. This is the "if tap/hold is detected the overlay
    // fires" half — without it, every summon would pause what you are watching.
    if (overlay.wasHeld()) return;
    if (!canDoubleTap) { togglePause(); return; }   // nothing to seek: act now
    clearTimeout(clickTimer.current);
    // Which half was clicked decides which way a double-click would seek, so it
    // has to be read here, before the event is recycled.
    const box = e.currentTarget.getBoundingClientRect();
    const left = e.clientX - box.left < box.width / 2;
    clickTimer.current = setTimeout(() => { clickTimer.current = null; togglePause(); }, 250);
    clickSide.current = left ? 'left' : 'right';
  }, [canDoubleTap, togglePause, overlay]);

  const onScreenDoubleClick = useCallback(() => {
    clearTimeout(clickTimer.current);
    clickTimer.current = null;
    seekBy(clickSide.current === 'left' ? -10 : 10);
  }, [seekBy]);

  const swipe = useSwipeNav({
    active: fullscreen && !locked,
    onNext: goNext,
    onPrev: prev,
    // Tapping toggles pause — but ONLY where that can be done in place. On a
    // platform with no control channel, pause means unmount, and a stray touch
    // restarting the video is far worse than a tap doing nothing.
    onTap: () => (current && embed.canCommand ? togglePause() : null),
    doubleTap: canDoubleTap,
    onDoubleTap: (side) => seekBy(side === 'left' ? -10 : 10),
  });

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
      fill={fullscreen}
      compact={presentation === 'popped'}
      maxHeight={presentation === 'popped' ? 320 : 420}
      browse={search.results}
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
      // `relative` so the lock sheet can cover exactly this component and
      // nothing else on the page.
      className={`relative ${fullscreen ? 'flex flex-col w-full h-full bg-black' : className}`}
    >
      {/* `touchDevice &&`: a lock set on a phone and then resumed on a desktop
          (same account, restored state) would otherwise paint a sheet over a
          player whose lock button is no longer offered. The state is left
          alone — it is still locked if that device goes back to touch — but it
          is never ENFORCED where it cannot be turned off. */}
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
        className={`${clipScreen ? 'max-h-0 overflow-hidden' : (fullscreen ? `relative flex flex-1 min-h-0${onFeedDeck ? ' justify-center' : ''}` : 'relative')} transition-[max-height] duration-300 ease-out`}
        // THE VIEWPORT SHRINKS FOR THE VOICE PANEL rather than being covered by
        // it. `max-height` and not `height`: the screen letterboxes itself
        // inside whatever box it is given, so capping the box scales the
        // picture down and keeps it fully visible — setting a height would
        // crop it instead, which is the opposite of the point. The media node
        // is untouched, so nothing reloads and playback does not stutter.
        style={voiceOpen && !clipScreen ? { maxHeight: '38%' } : undefined}
        aria-hidden={clipScreen}
      >
        {/* THE FEED PLAYER IS 9:16, FULL SCREEN INCLUDED. "The feed player is
            only 9x16 even when full screen with a horizontal video playing" —
            so on the feed deck the picture is boxed into a portrait column
            and centred, rather than filling a landscape screen the way Tube's
            does. That shape IS the visible difference between the two
            players: same frame, unmistakably not the same thing. A landscape
            clip letterboxes inside the column, which is the honest result of
            asking for a portrait player. */}
        {onFeedDeck && fullscreen ? (
          <div
            data-player-portrait=""
            className="relative h-full aspect-[9/16] max-w-full mx-auto"
          >
            {screen}
          </div>
        ) : screen}
        {/* The controls that sit ON the picture: thumbs, share, play mode. They
            are always mounted and fade rather than appearing, so nothing pops
            in over the video — and they take no width from the transport row
            underneath, which is what stopped it running out of room in a
            resized window. */}
        {current && !clipScreen && (
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

        {/* CLICK THE PICTURE TO PAUSE, outside full screen.
            The swipe sheet below is full-screen only, and for good reason — it
            sets touch-action to read vertical gestures, which on a docked
            player would eat the page scroll. This one is click-only: no
            touch-action, no preventDefault on touch, so scrolling past the
            player is unaffected and a tap still lands as a click.

            THE TRADE, stated because it is real: an overlay over an iframe
            takes the platform's own controls with it. That is acceptable now
            and was not before — our transport carries play/pause, seek,
            fullscreen and (as of this change) volume, so nothing is lost by
            covering theirs. On a platform we cannot command there is no
            overlay at all: a stray click restarting the video is worse than a
            click doing nothing. */}
        {!swipe && current && embed.canCommand && !locked && !clipScreen && (
          <button
            type="button"
            onClick={onScreenClick}
            onDoubleClick={onScreenDoubleClick}
            {...overlay.handlers}
            aria-label={paused ? 'Play' : 'Pause'}
            className="absolute inset-0 z-10 cursor-default"
            // Bottom 12% left alone so the platform's own progress bar — the
            // one thing our transport cannot fully replace on every embed —
            // stays reachable.
            style={{ bottom: '12%', background: 'transparent' }}
          />
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
          />
        </div>
      )}
    </div>
  );
}
