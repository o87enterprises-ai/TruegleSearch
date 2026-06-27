export const logoPath = '/og-image.png';

export const defaultLogoConfig = {
  src: logoPath,
  alt: 'Truegle Logo',
  position: {
    vertical: 'bottom',
    horizontal: 'right',
  },
  size: {
    width: 120,
    height: 40,
  },
  style: {
    opacity: 0.8,
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

export const logoSizes = {
  small: { width: 80, height: 27 },
  medium: { width: 120, height: 40 },
  large: { width: 160, height: 53 },
};

export const getLogoPosition = (position) => {
  const pos = logoPositions[position] || logoPositions.bottomRight;
  return {
    position: 'absolute',
    [pos.vertical]: '16px',
    [pos.horizontal]: '16px',
  };
};

export const getLogoSize = (size = 'medium') => {
  return logoSizes[size] || logoSizes.medium;
};