// The search box's empty-state line, per pill mode. ONE map, so the landing
// bar and the pages a mode opens onto can never disagree about what the box
// says before anyone has typed. Modes not listed keep their own page-level
// placeholder (see the call sites); blue falls back to DEFAULT_PLACEHOLDER.
export const MODE_PLACEHOLDER = {
  tube: 'Like YouTube, but better.',
  black: 'Like ChatGPT, but better.',
  ocean: 'Like the NSA, but better.',
};

// Feed names one at a time, rotating on each visit to the Feed pill or page
// (see nextFeedPlaceholder). The counter lives in this browser only — a
// per-viewer convenience, the same kind as the other remembered preferences.
const FEED_NAMES = ['Facebook', 'Instagram', 'TikTok', 'Twitter', 'Reddit', 'Bluesky', 'Mastodon', 'Threads', 'LinkedIn'];
const FEED_KEY = 'truegle_feed_placeholder_i';

const feedIndex = () => {
  try { return Number(localStorage.getItem(FEED_KEY)) || 0; } catch { return 0; /* no storage: always the first name */ }
};

/** The Feed line for this visit. Read-only: call it when the box renders. */
export function feedPlaceholderNow() {
  return `Like ${FEED_NAMES[feedIndex() % FEED_NAMES.length]}, but better.`;
}

/** Move to the next name — call once per visit, from an effect, so a remount does not skip one. */
export function advanceFeedPlaceholder() {
  try { localStorage.setItem(FEED_KEY, String((feedIndex() + 1) % FEED_NAMES.length)); } catch { /* private mode */ }
}

export const DEFAULT_PLACEHOLDER = 'Like Google, but better.';

/** The empty-state placeholder for a mode, or `fallback` for a mode not listed. */
export const modePlaceholder = (mode, fallback = DEFAULT_PLACEHOLDER) => MODE_PLACEHOLDER[mode] || fallback;
