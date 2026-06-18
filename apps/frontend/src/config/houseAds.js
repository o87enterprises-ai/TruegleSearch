/*
 * House-ad inventory.
 *
 * These are FIRST-PARTY ads: they point at our own projects and load no
 * external scripts. They fill the ad inventory now and double as live demos of
 * the ad formats we sell on /advertise. When a slot is sold, a paid campaign is
 * just another entry in this list with `sponsor: true` and a flight window —
 * the rendering path is identical, so nothing else has to change.
 *
 * Do NOT add third-party ad-network <script> tags here. The whole point of this
 * system is that it can never get the domain flagged the way Monetag did.
 *
 * Each ad:
 *   id          unique, stable string (used for tracking)
 *   title       short headline
 *   description one line of body copy
 *   cta         button label
 *   url         destination (own project / repo / live site)
 *   category    used later for contextual targeting per search mode
 *   variant     'yellow' | 'blue' | 'purple' | 'green' (card accent)
 *   weight      relative share of impressions (higher = shown more)
 *   sponsor     false for house ads; true once a slot is paid for
 *   flightStart optional ISO date — ad won't show before this
 *   flightEnd   optional ISO date — ad won't show after this
 */

export const HOUSE_ADS = [
  {
    // Advertiser call-to-action. No url — clicking opens the contact modal
    // (HouseAd handles `action: 'contact'`). The "*" footnote = free during launch.
    id: 'advertise-cta',
    title: 'ADVERTISE HERE FOR FREE*',
    description: 'First month free + free Truegle Premium when you advertise. Tap to claim. *Launch offer.',
    cta: 'Claim this spot',
    action: 'contact',
    label: 'Advertise',
    category: 'house',
    variant: 'yellow',
    weight: 4,
    sponsor: false,
  },
  {
    id: 'github-profile',
    title: 'Built by o87 Enterprises',
    description: 'Explore our open-source projects on GitHub.',
    cta: 'View GitHub',
    url: 'https://github.com/o87enterprises-ai',
    label: 'From our projects',
    category: 'dev',
    variant: 'blue',
    weight: 3,
    sponsor: false,
  },
  {
    id: 'openocchio',
    title: 'OpenOcchio — The AI Integrity Gauge',
    description: 'Measure how much of what you read was written by a machine.',
    cta: 'View on GitHub',
    url: 'https://github.com/o87enterprises-ai/OpenOcchio',
    category: 'truth',
    variant: 'green',
    weight: 3,
    sponsor: false,
  },
  {
    id: 'briccd',
    title: 'BriccD',
    description: 'An o87 Enterprises open-source project.',
    cta: 'View on GitHub',
    url: 'https://github.com/o87enterprises-ai/BriccD',
    category: 'dev',
    variant: 'purple',
    weight: 2,
    sponsor: false,
  },
  {
    id: 'open-grants',
    title: 'Open-Grants — Funding, found for you',
    description: 'Automated grant discovery and application, end to end.',
    cta: 'Find Grants',
    url: 'https://github.com/o87enterprises-ai/Open-Grants',
    category: 'tools',
    variant: 'blue',
    weight: 2,
    sponsor: false,
  },
  {
    id: 'abs-webgen',
    title: 'ABS WebGen — Ship a site in minutes',
    description: 'Describe it, generate it, deploy it. A website generator.',
    cta: 'Generate a Site',
    url: 'https://github.com/o87enterprises-ai/ABS-webgen-1.0',
    category: 'dev',
    variant: 'yellow',
    weight: 2,
    sponsor: false,
  },
  {
    id: 'physicain',
    title: 'PhysicAIn — AI for physics research',
    description: 'AI-powered physics research and analysis, open source.',
    cta: 'Open PhysicAIn',
    url: 'https://github.com/o87enterprises-ai/PhysicAIn',
    category: 'research',
    variant: 'blue',
    weight: 1,
    sponsor: false,
  },
  {
    id: 'openfuelecon',
    title: 'OpenFuelEcon — Know your real MPG',
    description: 'An open-source fuel economy tool with no guesswork.',
    cta: 'Try It Free',
    url: 'https://github.com/o87enterprises-ai/OpenFuelEcon',
    category: 'tools',
    variant: 'green',
    weight: 1,
    sponsor: false,
  },
];

/*
 * AFFILIATE OFFERS — real revenue, no infra, on-brand.
 *
 * These pay per signup/sale and double as "demand" that keeps inventory full.
 * They are disclosed to users as "Sponsored" (FTC/EU disclosure requirement).
 *
 * >>> ACTION REQUIRED <<<
 * The `url`s below are PLACEHOLDERS. They will NOT earn anything until you:
 *   1. Apply to each program (links in the comments).
 *   2. Replace the url with YOUR tracked affiliate link (it contains your ID).
 *   3. Verify the program's terms allow placement on a search engine / via paid
 *      and display traffic — a few forbid it.
 * Until then they still render as normal on-brand ads (no harm), they just
 * don't pay. Set `weight: 0` to hide any offer you haven't activated yet.
 *
 * Good privacy-aligned programs to apply to (audience fit + decent payouts):
 *   - Proton (VPN / Pass / Mail) — proton.me/partners  (on-brand; you already use Proton)
 *   - Incogni (data-broker removal) — incogni.com/affiliates  (strong payouts, very on-brand)
 *   - NordVPN / Surfshark — via Impact / CJ affiliate networks
 *   - Private Internet Access — via affiliate networks
 *   - Privacy-friendly hosting (e.g. 1984 Hosting, Njalla) — check each site
 * Don't add anything sketchy here — same rule as the rest of the file.
 */
export const AFFILIATE_OFFERS = [
  {
    id: 'aff-proton-vpn',
    title: 'Proton VPN — Browse without being watched',
    description: 'Swiss-based, no-logs VPN from the makers of Proton Mail.',
    cta: 'Get Proton VPN',
    url: 'https://protonvpn.com/', // TODO: replace with your Proton affiliate link
    label: 'Sponsored',
    category: 'privacy',
    variant: 'purple',
    weight: 3,
    sponsor: true,
    affiliate: true,
  },
  {
    id: 'aff-incogni',
    title: 'Incogni — Erase yourself from data brokers',
    description: 'Automatically removes your personal data from broker lists.',
    cta: 'Remove My Data',
    url: 'https://incogni.com/', // TODO: replace with your Incogni affiliate link
    label: 'Sponsored',
    category: 'privacy',
    variant: 'blue',
    weight: 3,
    sponsor: true,
    affiliate: true,
  },
  {
    id: 'aff-vpn-generic',
    title: 'Top-rated no-logs VPN',
    description: 'Encrypt your connection. Block trackers. Stay anonymous.',
    cta: 'Compare VPNs',
    url: 'https://example.com/', // TODO: replace with NordVPN/Surfshark/PIA affiliate link
    label: 'Sponsored',
    category: 'privacy',
    variant: 'green',
    weight: 0, // hidden until you activate a program — set >0 to enable
    sponsor: true,
    affiliate: true,
  },
];

/*
 * Ad zones (inventory we can sell). Keep these stable — they map to physical
 * placements in the UI and become line items on /advertise and in any future
 * ad-server. `format` is informational; `house` lets you turn house-ad fill on
 * or off per zone (you may want a sold leaderboard to go dark, not fall back to
 * a house ad, depending on the contract).
 */
export const AD_ZONES = {
  'search-inline': { label: 'In-results (native)', format: '300x250', house: true },
  'search-sidebar': { label: 'Search sidebar', format: '300x600', house: true },
  'results-leaderboard': { label: 'Results leaderboard', format: '728x90', house: true },
  'settings-medium': { label: 'Settings', format: '300x250', house: true },
};

/**
 * Pick a house ad to show. Honors flight windows and does weighted selection so
 * higher-weight ads appear more often. `category` optionally biases toward ads
 * matching the current context (search mode), falling back to the full pool.
 *
 * @param {Object}  [opts]
 * @param {string}  [opts.category]  preferred category (soft filter)
 * @param {Date}    [opts.now]       injectable clock for testing
 * @returns {Object|null} a house ad, or null if none are eligible
 */
export function pickHouseAd({ category, now = new Date() } = {}) {
  // Affiliate offers + house ads share the same inventory. Affiliates pay real
  // money, so they carry higher weights; weight: 0 drops an entry out entirely.
  const pool0 = [...AFFILIATE_OFFERS, ...HOUSE_ADS];
  const live = pool0.filter((ad) => {
    if ((ad.weight || 0) <= 0) return false;
    if (ad.flightStart && new Date(ad.flightStart) > now) return false;
    if (ad.flightEnd && new Date(ad.flightEnd) < now) return false;
    return true;
  });

  if (live.length === 0) return null;

  // Soft category preference: if any match, draw from those; else use all.
  const matched = category ? live.filter((ad) => ad.category === category) : [];
  const pool = matched.length > 0 ? matched : live;

  const total = pool.reduce((sum, ad) => sum + (ad.weight || 1), 0);
  let roll = Math.random() * total;
  for (const ad of pool) {
    roll -= ad.weight || 1;
    if (roll <= 0) return ad;
  }
  return pool[pool.length - 1];
}

/** Look up a specific ad by id across house ads + affiliate offers (for pinned slots). */
export function getAdById(id) {
  if (!id) return null;
  return [...HOUSE_ADS, ...AFFILIATE_OFFERS].find((ad) => ad.id === id) || null;
}
