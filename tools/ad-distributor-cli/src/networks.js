// Ground-truth metadata for each ad-distributor network Truegle is considering.
// URLs/timelines/requirements verified against each network's own publisher docs.
//
// This file is data only — no network call, form-fill, or submission logic lives
// here or anywhere else in this tool. See README.md for why.

export const NETWORKS = {
  ethicalads: {
    name: 'EthicalAds',
    kind: 'ad-network',
    status: 'available',
    applyUrl: 'https://www.ethicalads.io/publishers/',
    reviewTime: '~2 business days',
    requirements: [
      'Site live and publicly reachable (no login wall on the pages that would carry ads)',
      'Roughly 50,000+ monthly pageviews (their stated minimum bar)',
      'No contract to sign — privacy-respecting, non-tracking positioning lines up with Truegle directly',
    ],
    notes:
      'Approved sites get test ads first, then real ads after a placement review. $50 minimum payout.',
    credentialFields: ['PUBLISHER_ID', 'PLACEMENT_ID'],
    envTarget: 'apps/backend/config/env.js -> ETHICALADS_PUBLISHER_ID',
  },
  carbonads: {
    name: 'Carbon Ads',
    kind: 'ad-network',
    status: 'available',
    applyUrl: 'https://www.carbonads.net/join',
    reviewTime: '5-7 business days',
    requirements: [
      'Site URL + traffic stats ready to paste into the application',
      'Curated network (350+ publishers) — approval is reviewed, not automatic',
    ],
    notes: 'Provides a serve/zone ID + script snippet once approved.',
    credentialFields: ['SERVE_ID', 'ZONE_ID'],
    envTarget: 'apps/backend/config/env.js -> CARBONADS_SERVE_ID',
  },
  impact: {
    name: 'Impact.com',
    kind: 'affiliate',
    status: 'in_progress',
    applyUrl: 'https://app.impact.com/login/login-input.ihtml',
    reviewTime: 'No official waiting period documented. Review: ~2 business days (72hrs per another help page).',
    requirements: [
      'Previously declined 2026-06-21 for "limited reach" / unverifiable site content - root cause '
        + 'fixed (commit 8df0535) and verified LIVE in production: real prerendered HTML on every '
        + 'public route (not an empty <div id="root">), real 404s instead of soft-404s, robots.txt, '
        + 'and sitemap.xml. Confirmed via curl against truegle.info on 2026-06-21.',
      'Media property verification: DONE - <meta name="impact-site-verification"> is live in '
        + 'apps/frontend/index.html and confirmed present in the production response.',
      'Before resubmitting, in the Impact dashboard itself (outside this repo): complete profile '
        + '(company logo 150x150, business description, content/interest keywords, business model), '
        + 'designate a point-of-contact user, and accept the Partner User Agreement + Master Campaign '
        + 'Agreement if prompted again.',
      'Unknown/unverifiable from code: actual traffic volume. Impact\'s own decline reasons include '
        + '"media properties lack enough traffic or audience" - no published numeric minimum. '
        + 'HANDOFF.md estimates ~32,440 monthly requests; have current traffic stats ready in case '
        + 'the application or a PDM follow-up asks for them.',
      'No self-serve "reapply" button is documented - resubmit via the Marketplace tab in your '
        + 'existing account first; if that is not available, contact your Partner Development '
        + 'Manager (per Impact\'s help center) and reference that the site-content issue is fixed.',
    ],
    notes:
      'Do NOT create a new Impact account to reapply - the existing account already has the '
        + 'verification tag live and matches the domain. Once approved, swap the 3 placeholder URLs '
        + 'in houseAds.js (AFFILIATE_OFFERS, around lines 151/164/177) for real tracked links.',
    credentialFields: ['ACCOUNT_SID', 'AUTH_TOKEN'],
    envTarget: 'apps/frontend/src/config/houseAds.js -> AFFILIATE_OFFERS[].url',
  },
  cj: {
    name: 'CJ Affiliate',
    kind: 'affiliate',
    status: 'in_progress',
    applyUrl: 'https://signup.cj.com/member/signup/publisher/',
    reviewTime: 'Account: near-instant after email confirmation. Per advertiser program: varies.',
    requirements: [
      'Confirm the signup email, then "Create my CJ Publisher Account"',
      'Apply separately to each advertiser program you want, via the CJ Account Manager',
      'W-9/W-8BEN + payment details required before payouts',
    ],
    notes:
      'Account live (publisher ID 7995117, created 2026-06-21). Applying broadly, not just '
        + 'privacy-keyword advertisers — Truegle\'s audience isn\'t privacy-niche-only, so any '
        + 'on-brand, decent-EPC advertiser that gets approved is fair game. 27 pending / 2 '
        + 'auto-approved (incl. O&O Software) from the first "privacy" keyword batch. First real '
        + 'tracked link (O&O ShutUp10, link ID 17293513) is live in AFFILIATE_OFFERS as '
        + '`aff-oo-shutup10`. As more advertisers approve, pull their CJ links export and add one '
        + 'AFFILIATE_OFFERS entry per advertiser, same pattern.',
    credentialFields: ['WEBSITE_ID', 'PERSONAL_ACCESS_TOKEN'],
    envTarget: 'apps/frontend/src/config/houseAds.js -> AFFILIATE_OFFERS',
  },
  awin: {
    name: 'Awin',
    kind: 'affiliate',
    status: 'available',
    applyUrl: 'https://ui.awin.com/publisher-signup/en/awin/',
    reviewTime: 'Near real-time with an invite code, otherwise within 2 business days',
    requirements: [
      'Region, promo types, website URL, company/personal address',
      'Either an invitation code OR a refundable signup fee',
      'Tax/payment details required before payouts',
    ],
    notes: 'Tracked links go into AFFILIATE_OFFERS in houseAds.js.',
    credentialFields: ['PUBLISHER_ID', 'API_TOKEN'],
    envTarget: 'apps/frontend/src/config/houseAds.js -> AFFILIATE_OFFERS',
  },
  shareasale: {
    name: 'ShareASale',
    kind: 'affiliate',
    status: 'available',
    applyUrl: 'https://www.shareasale.com/',
    reviewTime: '2-3 business days',
    requirements: [
      'No stable direct deep-link to the signup form — go to the homepage and click "Affiliate Sign Up"',
      '5-page signup form (site info, payment info, tax info, etc.)',
    ],
    notes: 'Tracked links go into AFFILIATE_OFFERS in houseAds.js.',
    credentialFields: ['AFFILIATE_ID', 'API_TOKEN', 'API_SECRET'],
    envTarget: 'apps/frontend/src/config/houseAds.js -> AFFILIATE_OFFERS',
  },
  medianet: {
    name: 'Media.net',
    kind: 'ad-network',
    status: 'available',
    applyUrl: 'https://www.media.net/ads/publishers/',
    reviewTime: '4-5 business days, sometimes about a week',
    requirements: [
      'Name / email / website registration form, then email verification',
      'High-quality, primarily-English content (their stated review bar)',
    ],
    notes: 'Provides a site/ad-unit ID once approved.',
    credentialFields: ['SITE_ID', 'AD_UNIT_ID'],
    envTarget: 'apps/backend/config/env.js -> MEDIANET_SITE_ID',
  },
};

// Networks that must NOT be re-applied to without first fixing the reason they
// were removed. Source of truth: HANDOFF.md. Listed here so the CLI actively
// steers you away from repeating a past mistake instead of staying silent.
export const BLOCKED_NETWORKS = {
  adsense: {
    name: 'Google AdSense',
    reason:
      'Rejected by Google ("ads on screens without publisher-content") and fully removed 2026-06-17. Re-applying without first fixing the underlying placement issue will likely be rejected again.',
    source: 'HANDOFF.md',
  },
  monetag: {
    name: 'Monetag',
    reason:
      "Truegle's domain was flagged malicious and DNS-sinkholed while this network was active; removed 2026-06-15. Do not re-add.",
    source: 'HANDOFF.md',
  },
  adsterra: {
    name: 'Adsterra',
    reason:
      'Same malvertising-flagged-domain incident as Monetag, removed 2026-06-15. Do not re-add, or any other instant-approval network with a malvertising reputation.',
    source: 'HANDOFF.md',
  },
};
