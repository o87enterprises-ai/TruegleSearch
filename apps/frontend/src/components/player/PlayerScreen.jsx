import { forwardRef } from 'react';
import { Music, Film } from 'lucide-react';
import TruegleWatermark from '../ui/TruegleWatermark';

// The media surface itself — the only place an embed is mounted, so playback
// state lives in exactly one node no matter which presentation is on screen.
//
// Cross-origin embeds run sandboxed. `allow-same-origin` here grants the frame
// ITS OWN origin (youtube-nocookie / player.vimeo / w.soundcloud / tiktok),
// never ours — the embeds need it for storage and won't play without it. What
// is deliberately withheld is `allow-top-navigation*`: that's the permission
// that lets an embed yank the whole tab somewhere else, and withholding it is
// what makes a shared Truegle player link safe to open. Same lesson as the
// 2026-08-01 ad hijack — CSP does not stop top-navigation, only the sandbox
// does.
export const PLAYER_SANDBOX =
  'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox';

const PlayerScreen = forwardRef(function PlayerScreen({ source, mediaRef, onEnded, maxHeight }, ref) {
  if (!source) {
    return (
      <div ref={ref} className="w-full aspect-video bg-black/60 flex flex-col items-center justify-center gap-2">
        <Film size={28} className="text-white/15" />
        <span className="text-[11px] text-white/30">Search or paste a link to start watching</span>
      </div>
    );
  }

  const { kind, src, title } = source;
  const isVideoIframe = kind === 'youtube' || kind === 'vimeo' || kind === 'tiktok';
  const isSoundcloud = kind === 'soundcloud';
  // Shorts / Reels / TikToks are shot 9:16. Boxing them into a 16:9 frame
  // wastes most of the player and shrinks the clip to a stamp.
  const aspectPadding = source.vertical || kind === 'tiktok' ? '177.78%' : '56.25%';

  return (
    <div ref={ref} className="relative w-full bg-black">
      {isSoundcloud ? (
        <iframe
          key={src}
          src={src}
          className="w-full block"
          style={{ height: 166 }}
          title={title || 'SoundCloud player'}
          sandbox={PLAYER_SANDBOX}
          allow="autoplay"
        />
      ) : isVideoIframe ? (
        <div className="relative w-full" style={{ paddingTop: aspectPadding }}>
          <iframe
            key={src}
            src={`${src}${src.includes('?') ? '&' : '?'}autoplay=1`}
            className="absolute inset-0 w-full h-full"
            title={title || 'Video player'}
            sandbox={PLAYER_SANDBOX}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : kind === 'video' ? (
        <video ref={mediaRef} key={src} src={src} controls autoPlay playsInline onEnded={onEnded}
          style={{ maxHeight }} className="w-full bg-black" />
      ) : (
        <div className="flex items-center gap-2 px-3 py-3">
          <Music size={16} className="text-white/40 shrink-0" />
          <audio ref={mediaRef} key={src} src={src} controls autoPlay onEnded={onEnded} className="w-full" />
        </div>
      )}

      {/* Our mark over our viewer — never burned into the creator's video,
          which we neither hold nor have the right to re-encode. */}
      <TruegleWatermark />
    </div>
  );
});

export default PlayerScreen;
