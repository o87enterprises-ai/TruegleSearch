import { useState } from 'react';
import { LOGO_VARIANTS } from './TruegleLogo';

// A small translucent Truegle mark in the bottom-right of a media surface.
//
// This sits in OUR DOM, over the embed — it is not burned into anybody's
// video. We don't hold the video bytes for a third-party reel (they play from
// YouTube/TikTok in an iframe), and re-encoding a creator's clip under our
// mark would misattribute their work. So the watermark brands the Truegle
// viewing experience, and the Truegle metadata travels with the shared link.
//
// WHICH MARK. It hard-coded the TrueGLE Chat artwork, so the player — which is
// True Tube — was signed with another product's logo. The variants come from
// TruegleLogo now rather than being imported a second time here: two files each
// deciding what "the tube mark" means is exactly how one of them ends up
// wrong, which is what happened.
//
// The tube artwork is served from /public so it can be replaced without a code
// change, which also means it can be absent — so a load failure falls back to
// the default Truegle mark rather than leaving a broken image over the video.
//
// pointer-events-none throughout: it must never eat a tap meant for the
// player controls underneath.
export default function TruegleWatermark({ className = '', size = 'sm', variant = 'tube' }) {
  const [failed, setFailed] = useState(false);
  const px = size === 'lg' ? 46 : size === 'md' ? 34 : 26;
  const chosen = (!failed && LOGO_VARIANTS[variant]) || LOGO_VARIANTS.default;
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute bottom-1.5 right-1.5 z-20 select-none ${className}`}
      style={{ opacity: 0.38 }}
    >
      <img
        src={chosen.src}
        alt=""
        draggable="false"
        onError={() => setFailed(true)}
        style={{
          width: px,
          height: 'auto',
          // The default mark is bright-on-black art and needs 'screen' to drop
          // its backdrop; the transparent marks composite normally and would be
          // washed out by it.
          mixBlendMode: chosen.blend === 'screen' ? 'screen' : 'normal',
          filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.8))',
        }}
      />
    </div>
  );
}
