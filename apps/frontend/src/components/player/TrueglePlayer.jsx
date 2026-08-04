import { useRef, useCallback, useState, useEffect } from 'react';
import { usePlayer } from '../../context/PlayerContext';
import { buildPlayerLink } from '../../utils/playerLink';
import PlayerScreen from './PlayerScreen';
import PlayerTransport from './PlayerTransport';
import PlayerListSlot from './PlayerListSlot';

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
  showList = true,
  showCollapse = false,
  collapsed = false,
  onToggleCollapse,
  onQueryHandled,
  className = '',
}) {
  const {
    current, queue, history, paused,
    next, prev, stop, togglePause, setPaused, setPoppedOut, poppedOut,
  } = usePlayer();
  const mediaRef = useRef(null);
  const [listOpen, setListOpen] = useState(presentation !== 'popped');
  const [shareState, setShareState] = useState('idle');

  // A native element can really pause; keep the DOM node in step with state.
  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (paused) el.pause();
    else el.play?.().catch(() => { /* autoplay policy — user will press play */ });
  }, [paused, current]);

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
      showList={showList && presentation === 'popped'}
      showCollapse={showCollapse}
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      listOpen={listOpen}
      showPopOut={presentation !== 'popped'}
      shareState={shareState}
      onPlayPause={() => (current ? togglePause() : null)}
      onStop={stop}
      onPrev={prev}
      onNext={next}
      onToggleList={() => setListOpen((v) => !v)}
      onPopOut={() => setPoppedOut(true)}
      onShare={current ? share : undefined}
    />
  );

  // Collapsed lives inside the search bar's own row — no chrome of its own.
  if (presentation === 'collapsed') return transport;

  const listVisible = showList && (presentation !== 'popped' || listOpen);

  return (
    <div className={className}>
      <PlayerScreen
        source={paused ? null : current}
        mediaRef={mediaRef}
        onEnded={next}
        maxHeight={presentation === 'popped' ? 320 : 420}
      />
      {paused && current && (
        <div className="px-3 py-2 text-[11px] text-white/40 bg-black/40 border-t border-white/10">
          Paused — {current.title || 'this clip'}
        </div>
      )}
      <div className="px-1.5 py-1 border-t border-white/10 bg-black/20">{transport}</div>
      {listVisible && (
        <PlayerListSlot
          query={query}
          accent={accent}
          compact={presentation === 'popped'}
          onRevert={onQueryHandled}
        />
      )}
    </div>
  );
}
