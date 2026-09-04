// Browse — the categories, and which sources each one is made of.
//
// ── WHY A CATEGORY IS A SOURCE SET, NOT A NEW ENDPOINT ──────────────────────
//
// The obvious build is a backend route per category. That would mean five new
// endpoints, five new sets of tests, and a second place where "which platforms
// count as social" is decided — which is exactly how the feed and the search
// page drifted apart before. A category is just an opinion about which of the
// EXISTING sources belong together, so it lives here as data and every row
// fetches the same POST /api/social/feed the timeline already uses.
//
// Adding a category is a few lines in this file. Adding a source to one is a
// single word. Neither needs a deploy of anything but the frontend.
//
// ── `topic` ─────────────────────────────────────────────────────────────────
//
// Most categories are defined by WHERE they read from. Music and Entertainment
// are defined by WHAT they are about, and the same platforms serve both — so
// those carry a seed topic that is sent as the query. Without it, "Music" and
// "Soc" would return the same posts from the same places and the distinction
// would be a label with nothing behind it.
//
// A category with no `topic` gets the feed's own seeding (trending searches,
// then headlines) — see the backend's FeedSeeds.

export const CATEGORIES = [
  {
    id: 'soc',
    label: 'Soc',
    blurb: 'Discussion, across every network that lets you read it',
    // The conversation platforms. Reddit and Lemmy are link-and-comment,
    // Mastodon and Bluesky are timelines, X and Truth Social are read as
    // public pages.
    platforms: ['reddit', 'mastodon', 'bluesky', 'lemmy', 'x', 'truthsocial'],
  },
  {
    id: 'tube',
    label: 'Tube',
    blurb: 'Video, from everywhere that publishes it publicly',
    platforms: ['tiktok', 'rumble', 'community'],
  },
  {
    id: 'live',
    label: 'Live',
    blurb: 'Headlines as they land',
    // News paginates by topic section — world, business, technology, science,
    // health, sports, entertainment — so one source fills this row on its own.
    platforms: ['news'],
  },
  {
    id: 'music',
    label: 'Music',
    blurb: 'What people are listening to and arguing about',
    platforms: ['x', 'reddit', 'community', 'lemmy'],
    topic: 'music',
  },
  {
    id: 'entertainment',
    label: 'Entertainment',
    blurb: 'Creators, film and everything adjacent',
    platforms: ['instagram', 'facebook', 'pinterest', 'x'],
    topic: 'entertainment',
  },
  {
    id: 'creators',
    label: 'Creators',
    blurb: "Truegle's partner roster — new uploads",
    // Curated, not searched — no `topic`, same reasoning as `live`/News: the
    // row is the roster's own latest uploads, not a query against it.
    platforms: ['creators'],
  },
];

export const categoryById = (id) => CATEGORIES.find((c) => c.id === id) || null;

/**
 * The platforms a category may actually ask for.
 *
 * A category names sources optimistically — Reddit is in Soc whether or not
 * Reddit is switched on in Servers. Intersecting with what is enabled is what
 * keeps Browse honest: switching a source off in Servers must switch it off
 * everywhere, or the dropdown is decoration.
 */
export const platformsForCategory = (category, enabledIds = []) => {
  if (!category) return [];
  const enabled = new Set(enabledIds);
  return category.platforms.filter((p) => enabled.has(p));
};
