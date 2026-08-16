// The map's watermark, and the one place its brand is decided.
//
// There used to be THREE Truegle logos stacked in the bottom-right corner of an
// open map, each with a different treatment:
//
//   TruegleMap drew '/og-image.png' — the 1200x630 SOCIAL SHARE CARD, not the
//     logo — squashed into a 120x40 box, so the mark was both the wrong artwork
//     and the wrong aspect ratio.
//   MapViewWrapper drew the real mark again at h-8, a few pixels away.
//   LogoOverlay drew it a THIRD time at 100px, with a border-radius and a
//     box-shadow that exist nowhere else in the product, and with no
//     mixBlendMode — so the mark's black backdrop sat on the map as a grey card.
//
// One watermark now, and it is the legacy mark that the rest of the site uses
// (assets/images/truegle.webp, the same file TruegleLogo's default variant
// loads). That art is bright-on-black RGB, so it needs mixBlendMode 'screen' to
// drop its backdrop against a dark map — exactly as documented in
// components/ui/TruegleLogo.jsx. It is square, 1024x1024, so it is sized by
// HEIGHT with the width left to follow; the old fixed 120x40 stretched it.
import legacyMark from '../../../assets/images/truegle.webp';

export const logoPath = legacyMark;

export const defaultLogoConfig = {
  src: logoPath,
  alt: 'Truegle',
  position: {
    vertical: 'bottom',
    horizontal: 'right',
  },
  size: 'medium',
  style: {
    opacity: 0.75,
    // Screen blend, not a rounded card. See above.
    mixBlendMode: 'screen',
    // Decoration must never eat a click meant for the map.
    pointerEvents: 'none',
    zIndex: 10,
  },
};

export const logoPositions = {
  topRight: { vertical: 'top', horizontal: 'right' },
  topLeft: { vertical: 'top', horizontal: 'left' },
  bottomRight: { vertical: 'bottom', horizontal: 'right' },
  bottomLeft: { vertical: 'bottom', horizontal: 'left' },
};

// Height only. The mark is square and must not be stretched into a letterbox.
export const logoSizes = {
  small: { height: '32px', width: 'auto' },
  medium: { height: '44px', width: 'auto' },
  large: { height: '64px', width: 'auto' },
};

export const getLogoPosition = (position) => {
  const pos = logoPositions[position] || logoPositions.bottomRight;
  return {
    position: 'absolute',
    [pos.vertical]: '16px',
    [pos.horizontal]: '16px',
  };
};

export const getLogoSize = (size = 'medium') => logoSizes[size] || logoSizes.medium;
