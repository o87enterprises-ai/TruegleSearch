/**
 * Color utility functions for LaserFlow components
 */

/**
 * Convert hex color to RGB array (0-1 range)
 */
export const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255,
      ]
    : [1, 0.5, 0.8]; // Default pink color
};

/**
 * Convert RGB to hex string
 */
export const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/**
 * Calculate relative luminance for WCAG contrast
 */
export const getLuminance = (r: number, g: number, b: number): number => {
  const [lr, lg, lb] = [r, g, b].map((val) => {
    val = val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    return val;
  });
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
};

/**
 * Check if color is light or dark
 */
export const isLightColor = (r: number, g: number, b: number): boolean => {
  return getLuminance(r, g, b) > 0.5;
};

/**
 * Get contrast color (black or white) based on background
 */
export const getContrastColor = (r: number, g: number, b: number): string => {
  return isLightColor(r, g, b) ? '#000000' : '#FFFFFF';
};

/**
 * Interpolate between two colors
 */
export const interpolateColor = (
  color1: [number, number, number],
  color2: [number, number, number],
  factor: number
): [number, number, number] => {
  return [
    color1[0] + (color2[0] - color1[0]) * factor,
    color1[1] + (color2[1] - color1[1]) * factor,
    color1[2] + (color2[2] - color1[2]) * factor,
  ];
};

/**
 * Generate color palette based on base color
 */
export const generatePalette = (baseColor: string) => {
  const [r, g, b] = hexToRgb(baseColor);

  return {
    primary: [r, g, b] as [number, number, number],
    lighter: interpolateColor([r, g, b], [1, 1, 1], 0.3) as [
      number,
      number,
      number,
    ],
    darker: interpolateColor([r, g, b], [0, 0, 0], 0.3) as [
      number,
      number,
      number,
    ],
    contrast: getContrastColor(r, g, b),
    isLight: isLightColor(r, g, b),
  };
};

/**
 * Common color presets for LaserFlow
 */
export const colorPresets = {
  electricPurple: '#9D4EDD',
  neonPink: '#FF006E',
  cyberBlue: '#0096C7',
  plasmaGreen: '#00F5FF',
  solarOrange: '#FF6B35',
  quantumRed: '#C1121F',
  cosmicTeal: '#00A8E8',
  neonYellow: '#FFBE0B',
  holographicCyan: '#00F5FF',
  plasmaMagenta: '#FF10F0',
} as const;

/**
 * Performance optimized color conversion cache
 */
const colorCache = new Map<string, [number, number, number]>();

export const cachedHexToRgb = (hex: string): [number, number, number] => {
  if (colorCache.has(hex)) {
    return colorCache.get(hex)!;
  }

  const rgb = hexToRgb(hex);
  colorCache.set(hex, rgb);
  return rgb;
};

/**
 * Clear color cache (useful for memory management)
 */
export const clearColorCache = (): void => {
  colorCache.clear();
};
