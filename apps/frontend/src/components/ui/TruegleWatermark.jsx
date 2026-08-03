import logoMark from '../../assets/images/truegle-chat-transparent.webp';

// A small translucent Truegle mark in the bottom-right of a media surface.
//
// This sits in OUR DOM, over the embed — it is not burned into anybody's
// video. We don't hold the video bytes for a third-party reel (they play from
// YouTube/TikTok in an iframe), and re-encoding a creator's clip under our
// mark would misattribute their work. So the watermark brands the Truegle
// viewing experience, and the Truegle metadata travels with the shared link.
//
// pointer-events-none throughout: it must never eat a tap meant for the
// player controls underneath.
export default function TruegleWatermark({ className = '', size = 'sm' }) {
  const px = size === 'lg' ? 46 : size === 'md' ? 34 : 26;
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute bottom-1.5 right-1.5 z-20 select-none ${className}`}
      style={{ opacity: 0.38 }}
    >
      <img
        src={logoMark}
        alt=""
        draggable="false"
        style={{ width: px, height: 'auto', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))' }}
      />
    </div>
  );
}
