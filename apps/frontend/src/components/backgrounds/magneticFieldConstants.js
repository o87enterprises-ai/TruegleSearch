export const COLORS = {
  primary: '#00d2ff',
  secondary: '#ff0055',
  background: '#0a0505',
  surface: 'rgba(20, 20, 30, 0.6)',
  surfaceBorder: 'rgba(255, 255, 255, 0.1)',
  cubePalette: [
    '#ef4444',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#06b6d4',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
  ],
};

export const ANIMATION_CONFIG = {
  duration: 24.0,
  particleCount: 20000,
  fieldLineCount: 64,
  morphSpeed: 0.4,
};

export const PHYSICS = {
  magneticStrength: 2.5,
  turbulence: 0.3,
  flowSpeed: 0.5,
};

export const MORPH_PHASES = {
  POINT: 0,
  CIRCLE: 1,
  SPHERE: 2,
  TORUS: 3,
  FIELD: 4,
};
