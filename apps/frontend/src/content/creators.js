/**
 * Creator hub roster — single source of truth.
 *
 * Each creator gets a /creator/<slug> page that pulls their latest uploads live
 * from YouTube's free per-channel RSS feed (proxied via
 * /api/creators/:channelId/videos) and plays them in the existing on-site
 * player (utils/videoEmbed.js — YouTube's OFFICIAL embed, so the creator keeps
 * every view and every ad dollar). Add a partner by appending an entry here.
 *
 * `channelId` is the "UC…" id, NOT the @handle — find it via the channel's
 * page source ("channelId") or ytinitialdata. `refCode` (optional) is the
 * per-creator attribution tag for the ?ref traffic split (phase 2).
 */
export const CREATORS = [
  {
    slug: 'example-channel',
    name: 'Example Creator',
    tagline: 'Placeholder — swap for a real partner once the list is in.',
    // NASA channel: a real, stable, public feed so the RSS flow returns live
    // data while this is still a placeholder. Replace with the partner's UC id.
    channelId: 'UCLA_DiR1FfKNvjuUpBHmylQ',
    channelUrl: 'https://www.youtube.com/@NASA',
    avatar: null,
    refCode: 'example',
    featured: true,
    socials: [
      { label: 'YouTube', url: 'https://www.youtube.com/@NASA' },
    ],
  },
];

export const getCreator = (slug) => CREATORS.find((c) => c.slug === slug) || null;
export const getFeaturedCreator = () =>
  CREATORS.find((c) => c.featured) || CREATORS[0] || null;
