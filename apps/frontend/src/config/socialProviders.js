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
//   'demo'  — an ACCOUNT. Wired to the demo connect flow now, real data behind
//             a credential. Signing in happens on the provider's own site.
//   'open'  — a PUBLIC SOURCE. No account exists to connect and none is ever
//             needed; switching it on is one tap and nothing leaves the
//             browser. Routing these through an OAuth handshake would be
//             theatre — there is nothing to authorise.
//   'soon'  — cannot work yet; pill is disabled and shows `note`. Note this
//             covers two different situations and the note has to say which:
//             a door we have not walked through yet, and a door that is shut.
//
// When a provider's credentials arrive, its status flips and a backend adapter
// stops returning demo data. Nothing else changes.

export const PROVIDERS = [
  {
    id: 'reddit',
    label: 'Reddit',
    colour: '#FF4500',
    // WAS 'demo', AND WAS DESCRIBED AS "the one that fully works". Both were
    // true when written and neither is now.
    //
    // Reddit closed new Data API app registration to everything except
    // moderation tools — r/reddit.com/wiki/api, checked 2026-08-19: "If you
    // have a valid moderation use case, you should submit a request to create
    // new apps with Reddit's Data API." Truegle is not a moderation tool, so
    // there is no application to make and no tier to buy. Devvit, which Reddit
    // points at instead, builds apps that run INSIDE Reddit and cannot read the
    // API from our own backend.
    //
    // That also makes the 403 our deployment gets on keyless reads permanent:
    // Reddit blocks datacenter IPs, and the authenticated path that would lift
    // it is the one now closed to us. We do not route around that.
    // STILL TRUE that Reddit's Data API is shut to us — that has not changed and
    // is not being re-litigated. What changed is that the feed stopped needing
    // it: the backend tries the keyless JSON endpoints first (which work from a
    // laptop and 403 from the deployment), then falls back to reading Reddit's
    // public pages through our own search index, like any other public site.
    status: 'open',
    note: 'Public posts, via search — no account',
  },
  // PUBLIC SOURCES. These used to be smuggled in under Reddit — see
  // BACKEND_PLATFORMS below for what that did — and they are their own pills
  // now because they are their own things. Keyless, accountless, and the note
  // says so rather than inventing a sign-in that does not exist.
  // KEYLESS AND OURS TO KEEP. These two are why the feed stopped depending on
  // whether GitHub felt like answering: News has no key and no observed quota,
  // and Community is our own table, so it answers whenever the database does.
  // Between them the timeline stays full even when every third-party social
  // API refuses at once — which, with Reddit already blocked from the
  // deployment, is not a hypothetical.
  // THE OPEN FEDIVERSE. These are the social platforms that can actually be
  // read: federated networks whose public timelines are public infrastructure,
  // so anonymous reading is the documented purpose of the endpoint rather than
  // a gap. No account, no key, no tier to buy.
  {
    id: 'mastodon',
    label: 'Mastodon',
    colour: '#6364FF',
    status: 'open',
    note: 'Public timeline — no account, no key',
  },
  {
    id: 'bluesky',
    label: 'Bluesky',
    colour: '#0085FF',
    status: 'open',
    note: 'Public API — no account, no key',
  },
  {
    id: 'lemmy',
    label: 'Lemmy',
    colour: '#00BC8C',
    status: 'open',
    note: 'Public — link aggregation, like Reddit but open',
  },
  {
    id: 'news',
    label: 'News',
    colour: '#4285F4',
    status: 'open',
    note: 'Public — Google News, no account, no key',
  },
  {
    id: 'community',
    label: 'Community',
    colour: '#10b981',
    status: 'open',
    // The lawful route to the platforms with no free read API at all: somebody
    // posts a link, it plays through that platform's own embed, the creator
    // keeps the view. Nothing is copied or re-hosted.
    note: 'Links people posted here — no account needed',
  },
  {
    id: 'hackernews',
    label: 'Hacker News',
    colour: '#FF6600',
    status: 'open',
    note: 'Public — no account, no sign-in',
  },
  {
    id: 'github',
    label: 'GitHub',
    colour: '#8B949E',
    status: 'open',
    note: 'Trending repositories — public, no sign-in',
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    colour: '#E60023',
    status: 'open',
    note: 'Public pins, via search — no account',
  },
  // ── READ THROUGH SEARCH, NOT THROUGH AN API ───────────────────────────────
  //
  // These six carried notes explaining an API limitation, and every one of
  // those notes was true: X reads start at $200/mo, Instagram's Basic Display
  // shut down in 2024, Facebook will not grant user_posts to non-partners,
  // TikTok's Display API returns only your own posts. None of that changed.
  //
  // What changed is that we stopped asking for an API. Each of these platforms
  // still publishes pages a signed-out visitor can read and a search engine
  // indexes, and Truegle already runs a SearXNG instance that queries those
  // indexes. So the feed reads them the way a person following a link does —
  // no key, no account, no approval queue, and nothing gated behind a login.
  //
  // The honest caveat, which the note carries: how much any one of them yields
  // depends on how much of that platform is publicly indexed. X post pages are
  // indexed heavily. Instagram and Facebook keep most content behind a login,
  // so expect less from them — the round-robin gives the slot to another source
  // rather than padding the timeline.
  {
    id: 'x',
    label: 'X',
    colour: '#FFFFFF',
    status: 'open',
    note: 'Public posts, via search — no account',
  },
  {
    id: 'truthsocial',
    label: 'Truth Social',
    colour: '#5448EE',
    status: 'open',
    note: 'Public posts, via search — no account',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    colour: '#69C9D0',
    status: 'open',
    note: 'Public videos, via search — no account',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    colour: '#E1306C',
    status: 'open',
    note: 'Public posts only — most of Instagram is behind a login',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    colour: '#1877F2',
    status: 'open',
    note: 'Public posts only — most of Facebook is behind a login',
  },
  {
    id: 'rumble',
    label: 'Rumble',
    colour: '#85C742',
    status: 'open',
    note: 'Public videos, via search — no account',
  },
  // OUR OWN ROSTER, NOT A THIRD-PARTY AD NETWORK. "Sponsored" names Truegle's
  // partner-creator program (content/creators.js, the same roster /creators
  // and FeaturedCreator already use) — their own uploads, fetched via YouTube's
  // free per-channel RSS/Data API, same as every /creator/:slug page. No
  // conflict with the no-advertising policy: nothing is bought or auctioned,
  // it's the site's existing creator relationships surfaced in one more place.
  {
    id: 'creators',
    label: 'Truegle Sponsored Creators',
    colour: '#a855f7',
    status: 'open',
    note: "Our partner creators' own uploads — no account needed",
  },
  // YouTube coverage of today's news and markets, as video. Found by Truegle's
  // own search (a search, not a chosen list of channels — see the backend's
  // NewsVideos.js), and the same clips the landing page's News and Markets
  // cards show. BROWSE ONLY: these are two shelves you open on purpose, not
  // voices for the mixed Home timeline (BROWSE_ONLY below), and each costs a
  // search. The `label` is what the backend stamps on each post, and what the
  // card finds its colour by — keep them in step. Two shades of the Feed's
  // yellow, so the shelves read as part of it.
  {
    id: 'newsvideo',
    label: 'News Video',
    colour: '#facc15',
    status: 'open',
    note: "Today's news on YouTube, found by our search — no account",
  },
  {
    id: 'marketsvideo',
    label: 'Market Analysis',
    colour: '#ca8a04',
    status: 'open',
    note: 'Market analysis on YouTube, found by our search — no account',
  },
];

/** Sources that only ever appear when their Browse category is opened. */
export const BROWSE_ONLY = new Set(['newsvideo', 'marketsvideo']);

export const PROVIDER_IDS = PROVIDERS.map((p) => p.id);
export const byId = (id) => PROVIDERS.find((p) => p.id === id) || null;
// Everything that may appear in the connections list — accounts AND public
// sources. Note this gates STORAGE, not the flow: needsAuth() below is what
// decides whether switching one on involves the provider at all.
export const isConnectable = (id) => ['demo', 'open'].includes(byId(id)?.status);

/**
 * Does switching this on require a trip to the provider?
 *
 * True for an account, false for a public source. A source that needs no
 * sign-in must not be sent through the OAuth handshake: there is no
 * authorisation to grant, and a redirect that pretends otherwise teaches
 * people that Truegle asks for logins it does not need.
 */
export const needsAuth = (id) => byId(id)?.status === 'demo';

/**
 * The platforms a query may actually be sent to.
 *
 * REPORTED: "Feed (reddit) is pulling GitHub results." It was, and this line
 * is why — connecting Reddit used to send
 * `platforms: ['reddit', 'hackernews', 'github']`, on the reasoning that
 * Hacker News and GitHub are keyless so they may as well ride along. What that
 * actually produced was a Reddit feed padded with repositories nobody asked
 * for, and no way to turn them off, because they were not pills.
 *
 * Connecting Reddit means Reddit. Hacker News and GitHub are pills of their
 * own now, switched on by the person who wants them.
 */
export const BACKEND_PLATFORMS = {
  reddit: ['reddit'],
  pinterest: ['pinterest'],
  hackernews: ['hackernews'],
  github: ['github'],
  news: ['news'],
  community: ['community'],
  mastodon: ['mastodon'],
  bluesky: ['bluesky'],
  lemmy: ['lemmy'],
  // Read through SearXNG rather than an API — see the block above.
  x: ['x'],
  instagram: ['instagram'],
  facebook: ['facebook'],
  tiktok: ['tiktok'],
  rumble: ['rumble'],
  truthsocial: ['truthsocial'],
  newsvideo: ['newsvideo'],
  marketsvideo: ['marketsvideo'],
  creators: ['creators'],
};

export const platformsFor = (connectedIds = []) => [
  ...new Set(connectedIds.flatMap((id) => BACKEND_PLATFORMS[id] || [])),
];
