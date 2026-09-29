import { MODE_COLORS } from '../../config/modeTheme';

// EACH LANDING CARD WEARS ITS PILL'S COLOUR (owner, 2026-09-29): the card for a
// mode is the same colour as that mode's pill, so a visitor learns one palette
// and finds it again on the page they land on. Search stands in for the search
// lenses (Blue is the default one); News and Markets are two shades of the
// Feed's yellow, since both are Feed shelves. "Why Truegle?" belongs to no mode
// and keeps the brand purple.
export const CARD_ACCENT = {
  why: MODE_COLORS.purple,
  chat: MODE_COLORS.black,
  tube: MODE_COLORS.tube,
  search: MODE_COLORS.blue,
  feed: MODE_COLORS.yellow,
  news: '#facc15',      // Feed yellow, lighter
  markets: '#ca8a04',   // Feed yellow, deeper
};

const rgb = (hex) => {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** A darker relative of `hex` for the second stop of a gradient. */
export function shade(hex, amount = 0.4) {
  const [r, g, b] = rgb(hex).map((v) => Math.round(v * (1 - amount)));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Black or white, whichever reads on `hex` — Chat's pale grey needs dark ink. */
export function inkOn(hex) {
  const [r, g, b] = rgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#0b0b12' : '#ffffff';
}
