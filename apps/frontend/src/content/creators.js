/**
 * Creator hub roster — single source of truth.
 *
 * Each creator gets a /creator/<slug> page that pulls their latest uploads live
 * from YouTube's free per-channel RSS feed (proxied via
 * /api/creators/:channelId/videos) and plays them in the existing on-site
 * player (utils/videoEmbed.js — YouTube's OFFICIAL embed, so the creator keeps
 * every view and every ad dollar). Add a partner by appending an entry here.
 *
 * `channelId` is the "UC…" id (resolved from each @handle). `tagline` is left
 * blank intentionally — fill with the creator's own words rather than a guess.
 * `refCode` is the per-creator attribution tag for the ?ref traffic split (phase 2).
 */
export const CREATORS = [
  {
    slug: 'dark-waters-9', name: 'Dark Waters 9', tagline: '',
    channelId: 'UCZw8SuiTYSvPKmnMe8LDtpA',
    channelUrl: 'https://www.youtube.com/@darkwaters9',
    avatar: null, refCode: 'dark-waters-9', featured: true,
    socials: [{ label: 'YouTube', url: 'https://www.youtube.com/@darkwaters9' }],
  },
  {
    slug: 'true-story', name: 'True Story', tagline: '',
    channelId: 'UCQT9VG5hpLKp8of41fvDdtw',
    channelUrl: 'https://www.youtube.com/@tstory-a2w',
    avatar: null, refCode: 'true-story', featured: false,
    socials: [{ label: 'YouTube', url: 'https://www.youtube.com/@tstory-a2w' }],
  },
  {
    slug: 'bass-forge', name: 'Bass Forge', tagline: '',
    channelId: 'UCdcfgAjgP1OvNIFTWkbPV8Q',
    channelUrl: 'https://www.youtube.com/@bassforge_us',
    avatar: null, refCode: 'bass-forge', featured: false,
    socials: [{ label: 'YouTube', url: 'https://www.youtube.com/@bassforge_us' }],
  },
  {
    slug: 'wright-7x', name: 'Wright 7x', tagline: '',
    channelId: 'UC-ocTFTWBWI0b-wjYoCKuPg',
    channelUrl: 'https://www.youtube.com/@wright7x',
    avatar: null, refCode: 'wright-7x', featured: false,
    socials: [{ label: 'YouTube', url: 'https://www.youtube.com/@wright7x' }],
  },
  {
    slug: 'bryce-is-right', name: 'Bryce Is Right', tagline: '',
    channelId: 'UCmxXPdAg3iQaepCBO2JHjVA',
    channelUrl: 'https://www.youtube.com/@bryceisrite',
    avatar: null, refCode: 'bryce-is-right', featured: false,
    socials: [{ label: 'YouTube', url: 'https://www.youtube.com/@bryceisrite' }],
  },
  {
    slug: 'jon-levi', name: 'Jon Levi', tagline: '',
    channelId: 'UCCVP1ck3ucAgLJFJNlPWamw',
    channelUrl: 'https://www.youtube.com/@jonlevichannel',
    avatar: null, refCode: 'jon-levi', featured: false,
    socials: [{ label: 'YouTube', url: 'https://www.youtube.com/@jonlevichannel' }],
  },
  {
    slug: 'mind-unveiled', name: 'Mind Unveiled', tagline: '',
    channelId: 'UCQVBGSq7vdLanRbowiu163w',
    channelUrl: 'https://www.youtube.com/@mindunveiled',
    avatar: null, refCode: 'mind-unveiled', featured: false,
    socials: [{ label: 'YouTube', url: 'https://www.youtube.com/@mindunveiled' }],
  },
  {
    slug: 'xevi', name: 'Xevi', tagline: '',
    channelId: 'UC0UpxtDnri_fa5fB_PoAYhw',
    channelUrl: 'https://www.youtube.com/@xeviuniverse',
    avatar: null, refCode: 'xevi', featured: false,
    socials: [{ label: 'YouTube', url: 'https://www.youtube.com/@xeviuniverse' }],
  },
  {
    slug: 'stolen-timelines', name: 'Stolen Timelines', tagline: '',
    channelId: 'UCB9LqQNtyPPdW1prv0h8_5Q',
    channelUrl: 'https://www.youtube.com/@stolentimeline',
    avatar: null, refCode: 'stolen-timelines', featured: false,
    socials: [{ label: 'YouTube', url: 'https://www.youtube.com/@stolentimeline' }],
  },
  {
    slug: 'adam-mockler', name: 'Adam Mockler', tagline: '',
    channelId: 'UC8DA4o0SyaGfyVaBLbF5EXg',
    channelUrl: 'https://www.youtube.com/@adammockler',
    avatar: null, refCode: 'adam-mockler', featured: false,
    socials: [{ label: 'YouTube', url: 'https://www.youtube.com/@adammockler' }],
  },
];

export const getCreator = (slug) => CREATORS.find((c) => c.slug === slug) || null;
export const getFeaturedCreator = () =>
  CREATORS.find((c) => c.featured) || CREATORS[0] || null;
