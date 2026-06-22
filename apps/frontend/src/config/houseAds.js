/*
 * House-ad inventory.
 *
 * This is now just the pinned "advertise here" promo — a permanent CTA that
 * sells our own open ad inventory. It is NOT part of the auto-pick rotation
 * (see pickHouseAd, which draws only from AFFILIATE_OFFERS); it only ever
 * shows where a slot explicitly pins `adId="advertise-cta"`.
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
 *   category    soft contextual bucket (search mode / vertical)
 *   keywords    words/phrases that should pull this ad up for a matching search
 *                query (see pickHouseAd) — same idea as CJ/affiliate KEYWORDS
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
];

/*
 * AFFILIATE OFFERS — real revenue, no infra, on-brand.
 *
 * These pay per signup/sale and double as "demand" that keeps inventory full.
 * They are disclosed to users as "Sponsored" (FTC/EU disclosure requirement).
 *
 * >>> SOME OF THESE ARE STILL PLACEHOLDERS <<<
 * Any `url` with a TODO comment is a placeholder — it will NOT earn anything
 * until you apply to the program and swap in your tracked affiliate link.
 * Entries without a TODO (e.g. `aff-oo-shutup10`) are real, live, tracked links.
 * Until activated, placeholders still render as normal on-brand ads (no harm),
 * they just don't pay. Set `weight: 0` to hide any offer you haven't activated.
 *
 * Audience is NOT privacy-niche-only — Truegle's pitch ("everyone deserves
 * privacy, free search, and to see the perspectives of the outlets they
 * visit") is universal, not gatekept. So: apply broadly via CJ/Impact/etc,
 * not just to privacy-keyword advertisers, and add whatever gets approved —
 * not every entry here needs `category: 'privacy'`.
 *   - Proton (VPN / Pass / Mail) — proton.me/partners  (on-brand; you already use Proton)
 *   - Incogni (data-broker removal) — incogni.com/affiliates  (strong payouts, very on-brand)
 *   - NordVPN / Surfshark — via Impact / CJ affiliate networks
 *   - Private Internet Access — via affiliate networks
 *   - Privacy-friendly hosting (e.g. 1984 Hosting, Njalla) — check each site
 *   - Whatever else CJ/Impact approve you for — see tools/ad-distributor-cli
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
    keywords: ['vpn', 'proton', 'browse anonymously', 'hide my ip', 'encrypt traffic'],
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
    keywords: ['data broker', 'remove my data', 'opt out', 'personal data removal', 'people search site'],
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
    keywords: ['vpn', 'no logs vpn', 'anonymous browsing', 'best vpn'],
    variant: 'green',
    weight: 0, // hidden until you activate a program — set >0 to enable
    sponsor: true,
    affiliate: true,
  },
  {
    // CJ Affiliate, O&O Software (auto-approved, link ID 17293513). Real tracked
    // link — first live affiliate offer, not a placeholder. Keywords lifted
    // straight from the advertiser's own CJ links export.
    id: 'aff-oo-shutup10',
    title: 'O&O ShutUp10 — Stop Windows from spying on you',
    description: 'Locks down Windows telemetry and data collection with one click. Free tool.',
    cta: 'Get ShutUp10',
    url: 'https://www.anrdoezrs.net/click-101807644-17293513',
    label: 'Sponsored',
    category: 'privacy',
    keywords: ['windows', 'windows 10', 'windows 11', 'microsoft', 'telemetry', 'data protection', 'spying'],
    variant: 'blue',
    weight: 2,
    sponsor: true,
    affiliate: true,
  },
  // CJ Affiliate, O&O Software (same advertiser/link ID as aff-oo-shutup10 above).
  // The advertiser's CJ inventory has 49 link variants total — mostly the same
  // handful of products repeated across banner sizes and German/English copy.
  // One canonical English text-link entry per distinct product is enough here
  // since HouseAd renders its own card, not the advertiser's banner image.
  {
    id: 'aff-oo-diskrecovery',
    title: 'O&O DiskRecovery — Get deleted files back',
    description: 'Recovers deleted or lost files, even from formatted or damaged drives.',
    cta: 'Recover My Files',
    url: 'https://www.tkqlhce.com/click-101807644-17065234',
    label: 'Sponsored',
    category: 'tools',
    keywords: ['diskrecovery', 'data recovery', 'recover deleted files', 'undelete', 'lost files', 'formatted drive', 'disaster recovery'],
    variant: 'blue',
    weight: 2,
    sponsor: true,
    affiliate: true,
  },
  {
    id: 'aff-oo-safeerase',
    title: 'O&O SafeErase — Permanently wipe your data',
    description: 'Securely erases files and drives so deleted data can never be recovered.',
    cta: 'Erase Securely',
    url: 'https://www.jdoqocy.com/click-101807644-17065229',
    label: 'Sponsored',
    category: 'privacy',
    keywords: ['safeerase', 'wipe drive', 'secure delete', 'data wipe', 'overwrite data', 'ssd wipe', 'dod wipe', 'gutmann method'],
    variant: 'purple',
    weight: 2,
    sponsor: true,
    affiliate: true,
  },
  {
    id: 'aff-oo-diskimage',
    title: 'O&O DiskImage — Full backups, one click',
    description: 'Backs up, clones, or images your entire PC so a crash never costs you your data.',
    cta: 'Back Up Now',
    url: 'https://www.jdoqocy.com/click-101807644-11045083',
    label: 'Sponsored',
    category: 'tools',
    keywords: ['diskimage', 'backup software', 'clone drive', 'disk clone', 'system image', 'data backup'],
    variant: 'green',
    weight: 2,
    sponsor: true,
    affiliate: true,
  },
  {
    id: 'aff-oo-defrag',
    title: 'O&O Defrag — Speed up a slow PC',
    description: 'Defragments your drive for noticeably faster load and access times.',
    cta: 'Speed It Up',
    url: 'https://www.tkqlhce.com/click-101807644-10565919',
    label: 'Sponsored',
    category: 'tools',
    keywords: ['defrag', 'defragmentation', 'slow pc', 'speed up computer', 'fragmented hard disk', 'disk performance'],
    variant: 'yellow',
    weight: 2,
    sponsor: true,
    affiliate: true,
  },
  {
    id: 'aff-oo-bluecon',
    title: "O&O BlueCon — When Windows won't boot",
    description: 'A bootable rescue toolkit for password resets, repairs, and disaster recovery.',
    cta: 'Get the Rescue Kit',
    url: 'https://www.jdoqocy.com/click-101807644-12056858',
    label: 'Sponsored',
    category: 'tools',
    keywords: ['bluecon', "windows won't boot", 'disaster recovery', 'boot rescue', 'password reset', 'blue screen', 'system repair'],
    variant: 'blue',
    weight: 2,
    sponsor: true,
    affiliate: true,
  },
  {
    id: 'aff-oo-diskcommander',
    title: 'O&O DiskCommander — Find what is eating your storage',
    description: 'Analyzes drives and folders so you can find and clear out space-wasting files fast.',
    cta: 'Free Up Space',
    url: 'https://www.tkqlhce.com/click-101807644-17233055',
    label: 'Sponsored',
    category: 'tools',
    keywords: ['diskcommander', 'storage space', 'disk usage', 'duplicate files', 'clean up disk', 'full disk'],
    variant: 'green',
    weight: 2,
    sponsor: true,
    affiliate: true,
  },
  {
    id: 'aff-oo-diskstat',
    title: 'O&O DiskStat — See where your storage went',
    description: 'Visual breakdown of what is using your disk space, on one PC or across a network.',
    cta: 'Check My Storage',
    url: 'https://www.tkqlhce.com/click-101807644-17065238',
    label: 'Sponsored',
    category: 'tools',
    keywords: ['diskstat', 'storage space', 'disk usage', 'space wasters', 'network storage'],
    variant: 'purple',
    weight: 2,
    sponsor: true,
    affiliate: true,
  },
  {
    id: 'aff-oo-powerpack',
    title: 'O&O PowerPack — Backup, speed, security, sync',
    description: 'Bundles DiskImage, Defrag, SafeErase, and AutoBackup at one price.',
    cta: 'Get the Bundle',
    url: 'https://www.dpbolvw.net/click-101807644-11928760',
    label: 'Sponsored',
    category: 'tools',
    keywords: ['powerpack', 'o&o bundle', 'backup and speed', 'windows toolkit'],
    variant: 'yellow',
    weight: 2,
    sponsor: true,
    affiliate: true,
  },
  {
    id: 'aff-oo-win11-migration',
    title: 'Migrating to Windows 11? Do it the easy way',
    description: 'Windows 10 support is ending — this kit handles the switch to Windows 11 for you.',
    cta: 'Start Migration',
    url: 'https://www.jdoqocy.com/click-101807644-17277834',
    label: 'Sponsored',
    category: 'tools',
    keywords: ['windows 10', 'windows 11', 'migration', 'upgrade windows', 'end of support'],
    variant: 'blue',
    weight: 2,
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

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** True if any word in `queryTokens` also appears in one of `ad.keywords`. */
function matchesQuery(ad, queryTokens) {
  if (!ad.keywords || ad.keywords.length === 0) return false;
  const keywordTokens = new Set(ad.keywords.flatMap(tokenize));
  return queryTokens.some((token) => keywordTokens.has(token));
}

/**
 * Pick a house ad to show. Honors flight windows and does weighted selection so
 * higher-weight ads appear more often.
 *
 * Two soft filters narrow the pool before weighting, applied in priority order
 * — each only kicks in if it actually has a match, otherwise it falls through:
 *   1. `query`    — ad.keywords vs. the words in the user's search query
 *   2. `category` — ad.category vs. the current context (search mode)
 * No query/category match → draws from the full live pool.
 *
 * @param {Object}  [opts]
 * @param {string}  [opts.query]     the user's search query (contextual targeting)
 * @param {string}  [opts.category]  preferred category (soft filter)
 * @param {Date}    [opts.now]       injectable clock for testing
 * @returns {Object|null} a house ad, or null if none are eligible
 */
export function pickHouseAd({ category, query, now = new Date() } = {}) {
  // Auto-pick draws only from paid/affiliate inventory — HOUSE_ADS is just the
  // pinned "advertise here" promo and never enters random rotation.
  const pool0 = AFFILIATE_OFFERS;
  const live = pool0.filter((ad) => {
    if ((ad.weight || 0) <= 0) return false;
    if (ad.flightStart && new Date(ad.flightStart) > now) return false;
    if (ad.flightEnd && new Date(ad.flightEnd) < now) return false;
    return true;
  });

  if (live.length === 0) return null;

  const queryTokens = tokenize(query);
  const keywordMatched = queryTokens.length > 0 ? live.filter((ad) => matchesQuery(ad, queryTokens)) : [];
  const categoryMatched = category ? live.filter((ad) => ad.category === category) : [];

  const pool = keywordMatched.length > 0 ? keywordMatched
    : categoryMatched.length > 0 ? categoryMatched
    : live;

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
