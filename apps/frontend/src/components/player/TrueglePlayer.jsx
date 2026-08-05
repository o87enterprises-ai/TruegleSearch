import { useRef, useCallback, useState, useEffect } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { usePageMode } from '../../hooks/usePageMode';
import { useNarrowViewport } from '../../hooks/useNarrowViewport';
import { buildPlayerLink } from '../../utils/playerLink';
import PlayerScreen from './PlayerScreen';
import PlayerTransport, { PLAY_MODES } from './PlayerTransport';
import PlayerListSlot from './PlayerListSlot';
import PlayerProgress from './PlayerProgress';
import { useEmbedPlayback } from '../../hooks/useEmbedPlayback';
import { getPlayable } from '../../utils/videoEmbed';
import { titleFromUrl } from '../../utils/playerLink';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

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
    current, queue, history, paused, dock,
    next, skipNext, prev, stop, togglePause, setPoppedOut, setDock, play,
    playMode, setPlayMode,
  } = usePlayer();
  const pageMode = usePageMode();
  const mediaRef = useRef(null);
  const frameRef = useRef(null);
  const rootRef = useRef(null);
  const [listOpen, setListOpen] = useState(false);
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

  // Nothing queued? Keep going anyway — find the next relevant track from
  // what's playing and roll into it, the way an autoplay feed does. Only in
  // 'auto': the other modes are explicit instructions about what comes next,
  // and quietly overriding them would be wrong.
  const seen = useRef(new Set());
  const advance = useCallback(async () => {
    if (queue.length > 0 || playMode !== 'auto' || !current) { next(); return; }
    const seed = current.title || titleFromUrl(current.pageUrl || current.src || '');
    if (!seed) { next(); return; }
    seen.current.add(current.src);
    try {
      const res = await fetch(`${BACKEND}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: seed, filters: { category: 'videos', perPage: 12 } }),
      });
      const data = await res.json();
      const nextUp = (data.results || [])
        .map((r) => {
          const base = getPlayable(r.url);
          return base ? { ...base, title: r.title || titleFromUrl(r.url), pageUrl: r.url, poster: r.image } : null;
        })
        .find((r) => r && !seen.current.has(r.src));
      if (nextUp) { play(nextUp); return; }
    } catch { /* offline or search down — fall through */ }
    next();
  }, [queue.length, playMode, current, next, play]);

  // Platform embeds fire no `ended` event — that is why the queue never
  // advanced by itself for the things people actually queue. This talks
  // postMessage to the iframe we already have (no vendor SDK) and calls the
  // same advance() a native <video> would have.
  const embed = useEmbedPlayback({ frameRef, source: current, onEnded: () => advance() });

  const share = useCallback(async () => {
    const link = buildPlayerLink([current, ...queue].filter(Boolean));
    if (!link) return; // a device file has no shareable URL
    try {
      if (navigator.share) await navigator.share({ title: current?.title || 'Watch on Truegle', url: link });
      else await navigator.clipboard.writeText(link);
      setShareState('done');
      setTimeout(() => setShareState('idle'), 2000);
    } catch { /* user dismissed the sheet */ }
  }, [current, queue]);

  const transport = (
    <PlayerTransport
      playing={!!current && !paused}
      canPrev={history.length > 0}
      canNext={queue.length > 0}
      queueCount={queue.length}
      accent={accent}
      showList={showList}
      showPlayMode
      playMode={playMode}
      onCyclePlayMode={() => setPlayMode(PLAY_MODES[(PLAY_MODES.indexOf(playMode) + 1) % PLAY_MODES.length])}
      listOpen={listOpen}
      showPopOut
      popOutMode={popOutMode}
      adjustOn={moveOn}
      showFullscreen={presentation !== 'collapsed'}
      fullscreen={fullscreen}
      onToggleFullscreen={toggleFullscreen}
      shareState={shareState}
      onPlayPause={() => (current ? togglePause() : null)}
      onStop={stop}
      onPrev={prev}
      onNext={skipNext}
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
      className={fullscreen ? 'flex flex-col w-full h-full bg-black' : className}
    >
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
        className={clipScreen ? 'max-h-0 overflow-hidden' : (fullscreen ? 'flex flex-1 min-h-0' : '')}
        aria-hidden={clipScreen}
      >
        <PlayerScreen
          source={paused ? null : current}
          mediaRef={mediaRef}
          frameRef={frameRef}
          onEnded={advance}
          fill={fullscreen}
          compact={presentation === 'popped'}
          maxHeight={presentation === 'popped' ? 320 : 420}
        />
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
            query={query}
            scope={scope}
            accent={accent}
            compact={presentation === 'popped'}
            onRevert={() => { setListOpen(false); onQueryHandled?.(); }}
          />
        </div>
      )}
    </div>
  );
}
