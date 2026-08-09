import { useRef, useCallback, useState, useEffect } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { usePageMode } from '../../hooks/usePageMode';
import { useNarrowViewport } from '../../hooks/useNarrowViewport';
import { buildPlayerLink } from '../../utils/playerLink';
import PlayerScreen from './PlayerScreen';
import PlayerTransport, { PLAY_MODES } from './PlayerTransport';
import PlayerListSlot from './PlayerListSlot';
import PlayerLockOverlay from './PlayerLockOverlay';
import PlayerProgress from './PlayerProgress';
import { useEmbedPlayback } from '../../hooks/useEmbedPlayback';
import { usePlayerSearch } from '../../hooks/usePlayerSearch';
import { useUpNext } from '../../hooks/useUpNext';
import { useSwipeNav } from '../../hooks/useSwipeNav';
import { rate, useRating, signalPlay } from '../../utils/taste';
import { reportBroken } from '../../utils/broken';
import { learnMeta } from '../../utils/mediaMeta';
import { copyText } from '../../utils/clipboard';
import { mediaKey } from '../../utils/videoEmbed';

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
  // Move mode belongs to the floating frame (it owns the geometry), but its
  // control belongs on the transport with everything else.
  moveOn = false,
  onToggleMove,
  onQueryHandled,
  className = '',
}) {
  const {
    current, queue, history, paused, dock, locked, setLocked,
    next, skipNext, prev, stop, togglePause, setPoppedOut, setDock, play,
    playMode, setPlayMode,
  } = usePlayer();
  const pageMode = usePageMode();
  const mediaRef = useRef(null);
  const frameRef = useRef(null);
  const rootRef = useRef(null);
  const [listOpen, setListOpen] = useState(false);
  // ONE search per query, shared by the list below and the browse deck in the
  // viewport. It used to live inside PlayerListSlot; with two consumers that
  // would have been two identical round trips per keystroke.
  const search = usePlayerSearch(query, scope, provider);
  const [shareState, setShareState] = useState('idle');
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
    : onTube ? 'bar' : 'move';

  const cyclePopOut = useCallback(() => {
    if (presentation !== 'popped') { setPoppedOut(true); return; }
    if (onTube) { setPoppedOut(false); return; }
    onToggleMove?.();
  }, [presentation, onTube, setPoppedOut, onToggleMove]);

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
  const advance = useCallback(async () => {
    if (queue.length > 0 || playMode !== 'auto' || !current) { next(); return; }
    const nextUp = await upNext.pick(current);
    if (nextUp) { play(nextUp); return; }
    next();
  }, [queue.length, playMode, current, next, play, upNext]);

  // A manual Next must always go somewhere. With an empty queue it used to do
  // nothing at all, which is what "I hit next and nothing happened" was: the
  // feed is now what it falls through to, in every play mode, because pressing
  // the button is an explicit instruction that outranks repeat-one.
  const goNext = useCallback(async () => {
    if (queue.length > 0 || !current) { skipNext(); return; }
    const nextUp = await upNext.pick(current);
    if (nextUp) play(nextUp); else skipNext();
  }, [queue.length, current, upNext, play, skipNext]);

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

  // Everything that plays counts as seen, however it got here — otherwise
  // picking something by hand and then letting it run could hand you the same
  // clip straight back. The anonymous play counter (no id of any kind, see
  // utils/taste.js) goes out on the same edge, once per piece of media.
  const counted = useRef('');
  useEffect(() => {
    const key = mediaKey(current);
    if (!key || counted.current === key) return;
    counted.current = key;
    upNext.remember(current);
    signalPlay(current);
  }, [current, upNext]);

  // Pause and resume over the channel that is already open. This is what
  // stops a tap in full screen resetting the video: `paused` used to null the
  // source, which unmounted the iframe, so every tap started the track over.
  useEffect(() => {
    if (!embed.canCommand || !current) return;
    embed.command(paused ? 'pause' : 'play');
  }, [paused, current, embed]);

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
      playing={!!current && !paused}
      canPrev={history.length > 0}
      canNext={queue.length > 0 || !!current}
      queueCount={queue.length}
      accent={accent}
      showList={showList}
      showRating={!!current}
      rating={rating}
      onRate={current ? onRate : undefined}
      // FULL SCREEN ONLY. The lock is for watching undisturbed — a pocket, a
      // propped-up phone — and that is exactly when you are in full screen.
      // On the normal row it was an eleventh button competing with the two
      // controls people actually reach for, and it pushed full screen and
      // pop-out off the end.
      showLock={fullscreen}
      onLock={() => setLocked(true)}
      showPlayMode
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
      adjustOn={moveOn}
      showFullscreen={presentation !== 'collapsed'}
      fullscreen={fullscreen}
      onToggleFullscreen={toggleFullscreen}
      shareState={shareState}
      onPlayPause={() => (current ? togglePause() : null)}
      onStop={stop}
      onPrev={prev}
      onNext={goNext}
      onToggleList={() => setListOpen((v) => !v)}
      onPopOut={cyclePopOut}
      onShare={current ? share : undefined}
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

  return (
    <div
      ref={rootRef}
      // `relative` so the lock sheet can cover exactly this component and
      // nothing else on the page.
      className={`relative ${fullscreen ? 'flex flex-col w-full h-full bg-black' : className}`}
    >
      {locked && <PlayerLockOverlay onUnlock={() => setLocked(false)} />}
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
        className={clipScreen ? 'max-h-0 overflow-hidden' : (fullscreen ? 'relative flex flex-1 min-h-0' : '')}
        aria-hidden={clipScreen}
      >
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
        />
        {swipe && current && (
          <div
            {...swipe}
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
