// Backend-side mirror of the creator roster's channel ids.
//
// The full roster (tagline, socials, refCode, featured flag) lives in the
// frontend at apps/frontend/src/content/creators.js — that file drives the
// /creators and /creator/:slug pages and has no reason to exist on the
// server. This file carries only what the feed adapter (routes/creators.js
// fetchCreatorsFeed) needs: id, name, and the YouTube channelId.
//
// KEPT IN SYNC BY HAND. Frontend and backend are separate module systems
// here (ESM vs CJS, separate deploys) with no shared package between them —
// the same duality already exists for PROVIDERS (frontend, socialProviders.js)
// vs BACKEND_PLATFORMS (backend, social.js). Add or remove a creator in BOTH
// files.
module.exports = [
  { slug: 'dark-waters-9', name: 'Dark Waters 9', channelId: 'UCZw8SuiTYSvPKmnMe8LDtpA' },
  { slug: 'true-story', name: 'True Story', channelId: 'UCQT9VG5hpLKp8of41fvDdtw' },
  { slug: 'bass-forge', name: 'Bass Forge', channelId: 'UCdcfgAjgP1OvNIFTWkbPV8Q' },
  { slug: 'wright-7x', name: 'Wright 7x', channelId: 'UC-ocTFTWBWI0b-wjYoCKuPg' },
  { slug: 'bryce-is-right', name: 'Bryce Is Right', channelId: 'UCmxXPdAg3iQaepCBO2JHjVA' },
  { slug: 'jon-levi', name: 'Jon Levi', channelId: 'UCCVP1ck3ucAgLJFJNlPWamw' },
  { slug: 'mind-unveiled', name: 'Mind Unveiled', channelId: 'UCQVBGSq7vdLanRbowiu163w' },
  { slug: 'xevi', name: 'Xevi', channelId: 'UC0UpxtDnri_fa5fB_PoAYhw' },
  { slug: 'stolen-timelines', name: 'Stolen Timelines', channelId: 'UCB9LqQNtyPPdW1prv0h8_5Q' },
  { slug: 'epicdaily', name: 'epicdaily', channelId: 'UCimX2_A-ncFiU9QoSOTJ12A' },
  { slug: 'barry-stepp', name: 'Barry Stepp', channelId: 'UCSwx_jY_zYBJtrIa1i-osMA' },
  { slug: 'space-weather-news', name: 'SpaceWeatherNews', channelId: 'UCTiL1q9YbrVam5nP2xzFTWQ' },
];
