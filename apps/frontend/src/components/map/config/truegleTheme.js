import { BASEMAP_STYLES } from './basemap';

export const TRUEGLE_BRAND_COLORS = {
  primary: '#4e22ab',
  secondary: '#ef0700',
  accent: '#019734',
  highlight: '#fcce00',
  blue: '#00bcdd',
  orange: '#fd4000',
  purple: '#9d00ff',
  teal: '#00d4ff',
  red: '#ff0033',
  green: '#39ff14',
  dark: '#0a0a0a',
  light: '#ffffff',
};

export const TRUEGLE_THEME = {
  colors: TRUEGLE_BRAND_COLORS,
  mapStyles: { ...BASEMAP_STYLES },
  marker: {
    size: 32,
    anchor: 'bottom',
    scale: 1,
    shadow: {
      color: 'rgba(0, 0, 0, 0.3)',
      blur: 10,
      offsetX: 0,
      offsetY: 2,
    },
  },
  cluster: {
    colors: {
      low: TRUEGLE_BRAND_COLORS.green,
      medium: TRUEGLE_BRAND_COLORS.highlight,
      high: TRUEGLE_BRAND_COLORS.red,
    },
    sizes: {
      small: 40,
      medium: 50,
      large: 60,
    },
  },
  popup: {
    maxWidth: 300,
    backgroundColor: 'rgba(10, 10, 10, 0.95)',
    textColor: '#ffffff',
    borderColor: TRUEGLE_BRAND_COLORS.blue,
    borderWidth: 2,
    borderRadius: 8,
    padding: 12,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
  },
  route: {
    colors: {
      primary: TRUEGLE_BRAND_COLORS.blue,
      alternative: TRUEGLE_BRAND_COLORS.purple,
      selected: TRUEGLE_BRAND_COLORS.orange,
    },
    widths: {
      default: 4,
      selected: 6,
      hover: 5,
    },
    opacity: {
      default: 0.7,
      selected: 1.0,
      hover: 0.9,
    },
  },
  controls: {
    backgroundColor: 'rgba(10, 10, 10, 0.9)',
    borderColor: TRUEGLE_BRAND_COLORS.blue,
    borderRadius: 8,
    padding: 8,
    iconColor: '#ffffff',
    iconHoverColor: TRUEGLE_BRAND_COLORS.teal,
  },
  layers: {
    traffic: {
      low: '#39ff14',
      medium: '#fcce00',
      high: '#ff0033',
      severe: '#ef0700',
    },
    emergency: {
      fire: '#ef0700',
      flood: '#00bcdd',
      storm: '#9d00ff',
      earthquake: '#fd4000',
    },
  },
  logo: {
    position: 'bottom-right',
    opacity: 0.8,
    size: 'medium',
    maxWidth: 150,
  },
  animation: {
    duration: 300,
    easing: 'ease-in-out',
  },
};

export const THEME_VARIANTS = {
  TRUEGLE_STANDARD: 'truegle_standard',
  TRUEGLE_DARK: 'truegle_dark',
  TRUEGLE_LIGHT: 'truegle_light',
};

export const getThemeColors = (variant = THEME_VARIANTS.TRUEGLE_STANDARD) => {
  switch (variant) {
    case THEME_VARIANTS.TRUEGLE_DARK:
      return {
        background: '#0a0a0a',
        text: '#ffffff',
        accent: TRUEGLE_BRAND_COLORS.blue,
      };
    case THEME_VARIANTS.TRUEGLE_LIGHT:
      return {
        background: '#ffffff',
        text: '#0a0a0a',
        accent: TRUEGLE_BRAND_COLORS.primary,
      };
    default:
      return {
        background: '#0a0a0a',
        text: '#ffffff',
        accent: TRUEGLE_BRAND_COLORS.teal,
      };
  }
};