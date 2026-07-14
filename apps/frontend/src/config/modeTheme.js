/**
 * Shared per-mode theme — single source of truth for pill-mode colors,
 * search-result accents, and AI context mapping. Previously duplicated
 * inline in UniversalSearch.jsx and AIChatOverlay.jsx; both now import from
 * here so a new mode-aware surface (e.g. TruegleChat) stays in sync with the
 * search pages automatically.
 */

// WebGL-safe CSS gradient backgrounds — used as the low-end-device fallback
// on the search pages, and as the full background on TruegleChat (never
// WebGL there, per the crash history: WebGL backgrounds must always ship
// with a plain-CSS escape hatch).
export const LITE_BG = {
  blue: 'bg-gradient-to-b from-[#0a0e27] via-black to-[#0a0e27]',
  red: 'bg-gradient-to-b from-[#2a0a0a] via-black to-black',
  purple: 'bg-gradient-to-br from-[#1a0a2e] via-black to-[#16213e]',
  ocean: 'bg-gradient-to-b from-[#001f3f] via-[#001020] to-black',
  green: 'bg-gradient-to-br from-green-950 via-black to-emerald-950',
};

// Hex accent per mode — for anything that needs a raw color value rather
// than a Tailwind class (radial-gradient tints, inline SVG, etc).
export const MODE_COLORS = {
  blue: '#3b82f6',
  red: '#ef4444',
  purple: '#a855f7',
  ocean: '#14b8a6',
  green: '#22c55e',
  orange: '#f97316',
  yellow: '#eab308',
  black: '#e5e7eb',
};

export const MODE_LABELS = {
  blue: 'Mainstream',
  red: 'Alternative',
  purple: 'Perspectives',
  ocean: 'Privacy / OSINT',
  green: 'Simplified',
  orange: 'Rewards',
  yellow: 'Transcripts',
  black: 'Chat',
};

// Per-mode container accent — each page takes its theme color. (green uses
// higher opacity / lighter text for contrast on the LetterGlitch background)
export const MODE_ACCENT = {
  blue:   { border: 'border-cyan-500/40 hover:border-cyan-500/60',     title: 'text-cyan-400 group-hover:text-cyan-300',     link: 'text-cyan-400 hover:text-cyan-300',     iframeBorder: 'border-cyan-500/20',   count: 'text-cyan-300' },
  ocean:  { border: 'border-cyan-500/40 hover:border-cyan-500/60',     title: 'text-cyan-400 group-hover:text-cyan-300',     link: 'text-cyan-400 hover:text-cyan-300',     iframeBorder: 'border-cyan-500/20',   count: 'text-cyan-300' },
  red:    { border: 'border-red-500/40 hover:border-red-500/60',       title: 'text-red-400 group-hover:text-red-300',       link: 'text-red-400 hover:text-red-300',       iframeBorder: 'border-red-500/20',    count: 'text-red-300' },
  purple: { border: 'border-purple-500/40 hover:border-purple-500/60', title: 'text-purple-300 group-hover:text-purple-200', link: 'text-purple-300 hover:text-purple-200', iframeBorder: 'border-purple-500/20', count: 'text-purple-300' },
  green:  { border: 'border-green-500/50 hover:border-green-500/70',   title: 'text-green-300 group-hover:text-green-200',   link: 'text-green-300 hover:text-green-200',   iframeBorder: 'border-green-500/30',  count: 'text-green-300' },
};

// Bias badge classes — matches the label categorizeByBias attaches to results.
export const PERSPECTIVE_COLORS = {
  left: 'bg-red-500/20 border border-red-500/50 text-red-400',
  center: 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-400',
  right: 'bg-blue-500/20 border border-blue-500/50 text-blue-400',
  unbiased: 'bg-green-500/20 border border-green-500/50 text-green-400',
  neutral: 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400',
  mainstream: 'bg-purple-500/20 border border-purple-500/50 text-purple-400',
};

// Frontend pill mode -> backend /api/ai/chat context key (nepheshPrompts.js
// MODE_PROMPTS). Purple/ocean map to their own dedicated prompts there.
export const MODE_TO_CONTEXT = {
  blue: 'search_results',
  green: 'search_results',
  red: 'red_pill',
  purple: 'biased_results',
  ocean: 'osint',
};

export function getModeAccent(mode) {
  return MODE_ACCENT[mode] || MODE_ACCENT.blue;
}
