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
  tube: 'bg-gradient-to-b from-[#151a21] via-black to-[#0b0e12]',
  // Feed had none, so a reduced-motion or low-tier visitor got the BLUE
  // fallback (LITE_BG[mode] || LITE_BG.blue in SearchPageShell) on a page
  // whose pill is yellow — the one surface where the fallback never matched
  // the mode it was standing in for. Dark amber rather than a literal yellow
  // field, same restraint every other entry here uses (a wash of the colour,
  // not the colour itself, since this sits behind white text).
  yellow: 'bg-gradient-to-b from-[#221a03] via-black to-[#1a1203]',
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
  tube: '#9aa7b8',
  // Unhinged is a REGISTER, not a research lens — it gets its own colour so a
  // selector makes that obvious at a glance.
  unhinged: '#f43f5e',
};

// The Truegle rainbow, for surfaces that belong to no single mode (landing,
// shared player links). Used as a gradient border so the player still reads
// as "ours" on a page that hasn't picked a colour.
export const BRAND_GRADIENT =
  'linear-gradient(135deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7)';

/* RETIRED PILL MODES.
 *
 * 'orange' (Rewards) was funded by advertising, which was removed on
 * 2026-08-24, and its /rewards route is commented out in App.jsx. The pill was
 * already gone from PillModeRow's CYCLE — but that is not enough on its own,
 * because the chosen mode is PERSISTED. A visitor who picked Rewards before it
 * was retired still has `truegle_pill_mode_pref: 'orange'` in local storage,
 * and `/search?mode=orange` is still a URL anyone can hold. Both routes led
 * straight to the 404 page on the next search.
 *
 * normalizePillMode is the single gate: anything retired or unrecognised
 * resolves to Chat. Retiring a mode in future means adding it here, not
 * hunting for every navigate() that mentions it.
 */
const RETIRED_MODES = new Set(['orange']);

export const normalizePillMode = (stored) => {
  const m = typeof stored === 'string' ? stored : '';
  if (!m || RETIRED_MODES.has(m)) return 'black';
  return m;
};

export const MODE_LABELS = {
  blue: 'Mainstream',
  red: 'Rabbit Hole',
  // Perspectives is now WONDERLAND, and it is the re-ask fold inside the
  // Rabbit Hole rather than a lens of its own. ?mode=purple still resolves.
  purple: 'Wonderland',
  ocean: 'Privacy / OSINT',
  green: 'Summarize',
  // orange: 'Rewards' — RETIRED 2026-08-24 with advertising. See
  // RETIRED_MODES above; normalizePillMode() maps it back to Chat.
  // RESTORED 2026-09-02. Feed was commented out and the pill repointed at
  // /creators, which left /feed reachable only by typing the URL — the
  // aggregated feed had no way in at all. Creators is not lost: it becomes a
  // BROWSE CATEGORY inside the feed ("Entertainment"), which is where the
  // rehaul spec puts it, rather than owning a top-level pill of its own.
  yellow: 'Feed',
  // yellow: 'Creators',
  black: 'Chat',
  tube: 'Tube',
  unhinged: 'Unhinged',
};

// One-line explanations for the hover-hint tutorial (HoverHint on the
// landing pill). Deliberately short — the full write-up per mode already
// lives in TutorialModal's STEPS; this is a hover popover, not a modal.
export const MODE_HINT_TEXT = {
  black: "Chat: talk directly with TrueGLE's AI instead of searching — ask follow-ups, brainstorm, or just chat.",
  tube: 'Tube mode searches video-first, across TrueTube and other video sources.',
  blue: 'Mainstream: clean, fast, unbiased results from multiple sources — the everyday default.',
  green: 'Summarize/Green: raw, unprocessed results — no AI summaries, no smart features, nothing added.',
  red: 'Rabbit Hole: surfaces perspectives across the whole political/ideological spectrum, each one labeled.',
  ocean: 'Privacy / OSINT: open-source intelligence tools for research and investigation.',
  yellow: 'Feed: every source you follow in one timeline — social, news, video and community posts.',
};

// GREEN MEANS TWO DIFFERENT THINGS, and this is where they part company.
//
// On CHAT it is a lens: "Summarize", concise plain-language answers — which is
// an AI behaviour and needs a model to run.
// On SEARCH it is the opposite: green is in AI_FREE_MODES (UniversalSearch),
// so no summary, no answer card and no assistant request fires at all.
//
// One shared label therefore had the search pill reading "Summarize" over a
// mode that generates nothing. Rather than force the two surfaces to share a
// word that is wrong on one of them, the search side overrides here. Anything
// not listed falls through to MODE_LABELS.
const SEARCH_LABEL_OVERRIDES = {
  green: 'Green',
};

/** The label for a mode as the SEARCH pill should show it. */
export const searchModeLabel = (mode) => SEARCH_LABEL_OVERRIDES[mode] || MODE_LABELS[mode];

// Optional metallic finish per mode, for surfaces that fill with the mode
// colour. A flat mid-grey reads as "disabled", so steel needs a highlight and
// a shadow edge to read as brushed metal. Modes without an entry keep their
// flat MODE_COLORS fill.
export const MODE_GRADIENT = {
  tube: 'linear-gradient(160deg, #eef2f7 0%, #b9c4d2 22%, #8794a6 52%, #6d7a8c 74%, #aab6c6 100%)',
};

// Mode colors that are light enough that a solid fill needs dark text for
// readable contrast (used when a mode button is selected → solid mode color).
export const LIGHT_MODES = new Set(['black', 'yellow', 'tube']);
export const solidTextClass = (mode) => (LIGHT_MODES.has(mode) ? 'text-neutral-900' : 'text-white');

// Per-mode container accent — each page takes its theme color. (green uses
// higher opacity / lighter text for contrast on the LetterGlitch background)
export const MODE_ACCENT = {
  blue:   { border: 'border-cyan-500/40 hover:border-cyan-500/60',     title: 'text-cyan-400 group-hover:text-cyan-300',     link: 'text-cyan-400 hover:text-cyan-300',     iframeBorder: 'border-cyan-500/20',   count: 'text-cyan-300' },
  ocean:  { border: 'border-cyan-500/40 hover:border-cyan-500/60',     title: 'text-cyan-400 group-hover:text-cyan-300',     link: 'text-cyan-400 hover:text-cyan-300',     iframeBorder: 'border-cyan-500/20',   count: 'text-cyan-300' },
  red:    { border: 'border-red-500/40 hover:border-red-500/60',       title: 'text-red-400 group-hover:text-red-300',       link: 'text-red-400 hover:text-red-300',       iframeBorder: 'border-red-500/20',    count: 'text-red-300' },
  purple: { border: 'border-purple-500/40 hover:border-purple-500/60', title: 'text-purple-300 group-hover:text-purple-200', link: 'text-purple-300 hover:text-purple-200', iframeBorder: 'border-purple-500/20', count: 'text-purple-300' },
  green:  { border: 'border-green-500/50 hover:border-green-500/70',   title: 'text-green-300 group-hover:text-green-200',   link: 'text-green-300 hover:text-green-200',   iframeBorder: 'border-green-500/30',  count: 'text-green-300' },
  tube:   { border: 'border-slate-400/40 hover:border-slate-400/60',   title: 'text-slate-200 group-hover:text-white',       link: 'text-slate-200 hover:text-white',       iframeBorder: 'border-slate-400/25',  count: 'text-slate-200' },
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
  // Tube is a media surface, not a different lens on the answer — it reuses
  // the plain search prompt rather than inventing a backend context that
  // MODE_PROMPTS doesn't define (an unknown key silently falls back to the
  // generic assistant, which reads as a bug with no error).
  tube: 'search_results',
  // Its own backend prompt key — picked alone it is a conversation, not a
  // search, so it must not resolve to the search context.
  unhinged: 'unhinged',
};

export function getModeAccent(mode) {
  return MODE_ACCENT[mode] || MODE_ACCENT.blue;
}

// Which SearchBar theme belongs to which pill mode.
//
// The landing page used to hardcode themeColor="green" no matter what was
// selected, so picking Privacy/OSINT lit a teal pill above a green search bar.
// SearchBar's palettes are keyed by Tailwind hue rather than by mode name (they
// have to be — Tailwind only sees literal class names), so this is the
// translation between the two vocabularies. Keep it in step with MODE_COLORS.
export const MODE_SEARCH_THEME = {
  blue: 'blue',
  red: 'red',
  purple: 'purple',
  ocean: 'cyan',      // teal pill, cyan bar — the closest hue Tailwind gives us
  green: 'green',
  orange: 'orange',
  yellow: 'yellow',
  black: 'neutral',   // Chat: the pill is near-white
  tube: 'slate',
};

export const searchThemeFor = (mode) => MODE_SEARCH_THEME[mode] || 'blue';

// The submit button's gradient and the magnifier, per mode — same reason as
// above: literal classes only.
export const MODE_SEARCH_GRADIENT = {
  blue: 'from-blue-600 to-blue-700',
  red: 'from-red-600 to-red-800',
  purple: 'from-purple-600 to-violet-700',
  ocean: 'from-cyan-600 to-teal-600',
  green: 'from-green-600 to-emerald-600',
  orange: 'from-orange-500 to-amber-600',
  yellow: 'from-yellow-500 to-amber-600',
  black: 'from-neutral-300 to-neutral-500',
  tube: 'from-slate-400 to-slate-600',
};

export const MODE_SEARCH_ICON = {
  blue: 'text-blue-500/80',
  red: 'text-red-500/80',
  purple: 'text-purple-500/80',
  ocean: 'text-cyan-500/80',
  green: 'text-green-500/80',
  orange: 'text-orange-500/80',
  yellow: 'text-yellow-500/80',
  black: 'text-neutral-300/80',
  tube: 'text-slate-400/80',
};

export const searchGradientFor = (mode) => MODE_SEARCH_GRADIENT[mode] || MODE_SEARCH_GRADIENT.blue;
export const searchIconFor = (mode) => MODE_SEARCH_ICON[mode] || MODE_SEARCH_ICON.blue;
