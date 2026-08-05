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

// `fill` = take all the height that's going (full screen), instead of sizing
// from the clip's aspect ratio. The controls bar below stays on screen either
// way — that's the whole reason full screen is ours and not the embed's.
// YouTube only pushes state over postMessage when the embed is built with
// enablejsapi=1 (and an origin, which scopes who it will talk to). These are
// added HERE rather than in the shared source builder so what we store, share
// and hand to /w stays a plain embed URL.
function withPlaybackChannel(kind, src) {
  const sep = src.includes('?') ? '&' : '?';
  if (kind === 'youtube') {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${src}${sep}autoplay=1&enablejsapi=1${origin ? `&origin=${encodeURIComponent(origin)}` : ''}`;
  }
  return `${src}${sep}autoplay=1`;
}

const PlayerScreen = forwardRef(function PlayerScreen({ source, mediaRef, frameRef, onEnded, maxHeight, fill = false, compact = false }, ref) {
  if (!source) {
    return (
      <div ref={ref} className={`w-full bg-black/60 flex flex-col items-center justify-center gap-2 ${fill ? 'flex-1 min-h-0' : 'aspect-video'}`}>
        <Film size={28} className="text-white/15" />
        <span className="text-[11px] text-white/30">Search or paste a link to start watching</span>
      </div>
    );
  }

  const { kind, src, title } = source;
  const isVideoIframe = ['youtube', 'vimeo', 'tiktok', 'dailymotion', 'rumble', 'odysee'].includes(kind);
  const isSoundcloud = kind === 'soundcloud';
  // Shorts / Reels / TikToks are shot 9:16. Boxing them into a 16:9 frame
  // wastes most of the player and shrinks the clip to a stamp.
  const vertical = !!source.vertical || kind === 'tiktok';

  // A 9:16 clip is ~1.78× its width tall — at phone width that is taller than
  // the whole viewport, which pushed the transport row off the bottom of the
  // screen and put the controls out of reach exactly when a reel was playing.
  // The box is capped against the VIEWPORT (svh, so the mobile browser's own
  // chrome counts) and letterboxes: the clip narrows and centres rather than
  // growing past what you can see. The floating window gets a tighter cap
  // still — it sits ON TOP of the page, so a tall one covers the very search
  // bar you popped it out to keep using.
  // --truegle-player-cap is set by whatever is hosting the player when it
  // knows the real room available (the docked slot does); the svh figure is
  // the fallback when nobody has measured.
  const cap = compact
    ? '42svh'
    : `min(${vertical ? '58svh' : '62svh'}, var(--truegle-player-cap, 100svh))`;
  const boxStyle = fill ? undefined : {
    aspectRatio: vertical ? '9 / 16' : '16 / 9',
    maxHeight: cap,
    // width:auto lets max-height win and the box shrink sideways rather than
    // overflow — that's what produces the side bars on a reel.
    width: 'auto',
    maxWidth: '100%',
    margin: '0 auto',
  };

  return (
    <div ref={ref} className={`relative w-full bg-black ${fill ? 'flex-1 min-h-0' : ''}`}>
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
        <div className={fill ? 'relative w-full h-full' : 'relative'} style={boxStyle}>
          <iframe
            ref={frameRef}
            key={source.playToken ? `${src}#${source.playToken}` : src}
            src={withPlaybackChannel(kind, src)}
            className="absolute inset-0 w-full h-full"
            title={title || 'Video player'}
            sandbox={PLAYER_SANDBOX}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : kind === 'video' ? (
        <video ref={mediaRef} key={source.playToken ? `${src}#${source.playToken}` : src} src={src} controls autoPlay playsInline onEnded={onEnded}
          style={fill ? undefined : { maxHeight: maxHeight ? `min(${maxHeight}px, ${cap})` : cap }}
          className={fill ? 'w-full h-full bg-black object-contain' : 'w-full bg-black'} />
      ) : (
        <div className="flex items-center gap-2 px-3 py-3">
          <Music size={16} className="text-white/40 shrink-0" />
          <audio ref={mediaRef} key={source.playToken ? `${src}#${source.playToken}` : src} src={src} controls autoPlay onEnded={onEnded} className="w-full" />
        </div>
      )}

      {/* Our mark over our viewer — never burned into the creator's video,
          which we neither hold nor have the right to re-encode. */}
      <TruegleWatermark />
    </div>
  );
});

export default PlayerScreen;
