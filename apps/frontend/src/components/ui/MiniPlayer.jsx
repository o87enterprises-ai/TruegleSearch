import { usePlayer } from '../../context/PlayerContext';
import { X, Minus, Maximize2, Music } from 'lucide-react';

// Persistent pop-out mini-player, pinned bottom-left. Rendered ABOVE <Routes>
// (in AppContent) so the media node it hosts is never unmounted on navigation —
// the source keeps playing while the user browses elsewhere. Single active
// source (no queue in MVP); usePlayer().play() replaces whatever's playing.
export default function MiniPlayer() {
  const { current, minimized, close, toggleMinimize } = usePlayer();
  if (!current) return null;

  const { kind, src, title } = current;
  const isIframe = kind === 'youtube' || kind === 'vimeo';
  // Only video/iframe get clipped when minimized; audio has no picture, so its
  // slim controls row stays visible (and the single node keeps playing).
  const clipWhenMin = (isIframe || kind === 'video') && minimized;

  return (
    <div className="fixed bottom-4 left-4 z-[9996] w-80 max-w-[calc(100vw-2rem)] rounded-xl overflow-hidden bg-[#0d0d14]/95 border border-white/15 backdrop-blur-xl shadow-2xl">
      {/* Header — title + minimize/expand + close */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <Music size={13} className="text-white/50 shrink-0" />
        <span className="text-xs text-white/70 truncate flex-1" title={title}>{title || 'Now playing'}</span>
        <button
          type="button"
          onClick={toggleMinimize}
          title={minimized ? 'Expand' : 'Minimize'}
          className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          {minimized ? <Maximize2 size={13} /> : <Minus size={13} />}
        </button>
        <button
          type="button"
          onClick={close}
          title="Close player"
          className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X size={13} />
        </button>
      </div>

      {/* Media — kept mounted even while minimized (clipped to 0 height) so
          playback never stops. `key={src}` remounts on a source change. */}
      <div className={clipWhenMin ? 'max-h-0 overflow-hidden' : ''}>
        {isIframe ? (
          <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
            <iframe
              key={src}
              src={`${src}${src.includes('?') ? '&' : '?'}autoplay=1`}
              className="absolute inset-0 w-full h-full"
              title={title || 'Video player'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : kind === 'video' ? (
          <video key={src} src={src} controls autoPlay className="w-full max-h-64 bg-black" />
        ) : (
          <audio key={src} src={src} controls autoPlay className="w-full" />
        )}
      </div>
    </div>
  );
}
