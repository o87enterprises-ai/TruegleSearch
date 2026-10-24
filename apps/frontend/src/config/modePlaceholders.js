// The search box's empty-state line, per pill mode. ONE map, so the landing
// bar and the pages a mode opens onto can never disagree about what the box
// says before anyone has typed. Modes not listed keep their own page-level
// placeholder (see the call sites); blue falls back to DEFAULT_PLACEHOLDER.
export const MODE_PLACEHOLDER = {
  tube: 'Like YouTube, but better.',
  yellow: 'Like Facebook (Instagram / TikTok / Twitter / etc), but better.',
  black: 'Like ChatGPT, but better.',
  ocean: 'Like the NSA, but better.',
};

export const DEFAULT_PLACEHOLDER = 'Like Google, but better.';

/** The empty-state placeholder for a mode, or `fallback` for a mode not listed. */
export const modePlaceholder = (mode, fallback = DEFAULT_PLACEHOLDER) => MODE_PLACEHOLDER[mode] || fallback;
