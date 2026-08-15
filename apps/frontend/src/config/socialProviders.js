// The social providers the Feed page offers, and the honest truth about each.
//
// ONE SOURCE OF TRUTH. The pills, the greyed-out state, the "why not yet" note
// and the list of platforms a search is allowed to touch all read from here.
// Splitting that across a component and a backend switch is how a UI ends up
// promising something the API cannot deliver.
//
// ── WHY MOST OF THESE ARE GREY ──────────────────────────────────────────────
//
// Reading somebody's own feed is not purchasable at any price on most of these
// platforms. It is not a budget problem and it will not go away when there is
// money — the endpoints do not exist. The `note` on each provider is the real
// reason, not a placeholder, and it is what the pill shows.
//
// `status`:
//   'demo'  — wired to the demo connect flow now, real data behind a credential
//   'soon'  — cannot work yet; pill is disabled and shows `note`
//
// When a provider's credentials arrive, its status flips and a backend adapter
// stops returning demo data. Nothing else changes.

export const PROVIDERS = [
  {
    id: 'reddit',
    label: 'Reddit',
    colour: '#FF4500',
    status: 'demo',
    // The only one that genuinely works: free OAuth app, 100 queries/min, and
    // a real home feed at the end of it.
    note: 'Free OAuth — the one that fully works',
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    colour: '#E60023',
    status: 'soon',
    note: 'Needs app review before it can read your boards',
  },
  {
    id: 'x',
    label: 'X',
    colour: '#FFFFFF',
    status: 'soon',
    // The free tier is effectively write-only; meaningful reads start at $200
    // a month, which is revenue-gated per the $0 budget.
    note: 'Read access starts at $200/mo — waiting on revenue',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    colour: '#69C9D0',
    status: 'soon',
    // The Display API returns the logged-in user's OWN videos. That is not a
    // feed, and calling it one on the pill would be a lie.
    note: 'Their API returns only your own posts, not a feed',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    colour: '#E1306C',
    status: 'soon',
    // Basic Display shut down in Dec 2024. Graph needs a Professional account
    // plus a linked Page plus review, and still will not hand over a home feed.
    note: 'Basic Display shut down in 2024; Graph will not serve a home feed',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    colour: '#1877F2',
    status: 'soon',
    note: 'user_posts is not granted to non-partners',
  },
];

export const PROVIDER_IDS = PROVIDERS.map((p) => p.id);
export const byId = (id) => PROVIDERS.find((p) => p.id === id) || null;
export const isConnectable = (id) => byId(id)?.status === 'demo';

/**
 * The platforms a query may actually be sent to.
 *
 * The backend's keyless feed speaks Reddit, Hacker News and GitHub. Reddit is
 * the only one of those a person "connects", so connecting it is what opens
 * that door — the others ride along with it rather than pretending to be
 * accounts somebody signed into.
 */
export const BACKEND_PLATFORMS = { reddit: ['reddit', 'hackernews', 'github'] };

export const platformsFor = (connectedIds = []) => [
  ...new Set(connectedIds.flatMap((id) => BACKEND_PLATFORMS[id] || [])),
];
