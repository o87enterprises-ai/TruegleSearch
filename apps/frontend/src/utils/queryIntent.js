import { classifyQuery } from './urlQuery.js';

const QUESTION_WORDS = [
  'who', 'what', 'when', 'where', 'why', 'how', 'which', 'whose',
  'is', 'are', 'was', 'were', 'do', 'does', 'did',
  'can', 'could', 'should', 'would', 'will', 'shall', 'may', 'might',
];

/**
 * Heuristic check for whether a search query is phrased as a question —
 * either ending in "?" or opening with a question word (who/what/how/is/etc).
 * Used to decide when to surface a quick-answer card vs. a sponsored slot.
 */
export function isQuestionQuery(query) {
  if (!query) return false;
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (trimmed.endsWith('?')) return true;

  const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z']/g, '');
  return QUESTION_WORDS.includes(firstWord);
}

/**
 * Pulls the leading sentence out of an AI summary to use as a quick-answer
 * snippet — the backend is asked to answer questions in the first sentence,
 * so this just isolates it for the highlighted card.
 */
export function getQuickAnswer(summary) {
  if (!summary) return '';
  const stripped = summary.replace(/^#+\s*/, '').trim();
  const match = stripped.match(/^.*?[.!?](?:\s|$)/);
  return (match ? match[0] : stripped).trim();
}

/* ── What is the person trying to do? ──────────────────────────────────────
 *
 * Drives the pill's auto-switch: typing a video link offers Tube, a social
 * post offers Feed, a question offers Chat, a local-business search offers
 * Mainstream (where the Truegle Maps card lives). Anything else is an
 * ordinary search and returns null — no suggestion, no countdown.
 *
 * Deliberately conservative: a wrong suggestion costs the visitor a tap on ✕,
 * but a pill that keeps switching under them is worse than none.
 */
const SOCIAL_HOST = /(^|\.)(reddit\.com|redd\.it|x\.com|twitter\.com|bsky\.app|threads\.net|tiktok\.com|instagram\.com|facebook\.com|fb\.watch|mastodon\.[a-z]+|mstdn\.[a-z]+)$/i;
const LOCAL_SERVICE = /\b(lawyers?|attorneys?|law ?firms?|plumb(?:er|ers|ing)|electricians?|accountants?|cpas?|realtors?|roofers?|contractors?|locksmiths?|movers?|mechanics?|auto repair|dentists?|doctors?|clinics?|chiropractors?|therapists?|vets?|veterinarians?|restaurants?|cafes?|coffee shops?|hotels?|motels?|gyms?|pharmac(?:y|ies)|barbers?|salons?)\b/i;
const NEAR_ME = /\b(near me|nearby|around me|close to me|in my area)\b/i;
const LOCAL_FILLER = /^(best|top|cheap|good|find|the|for|and|in|a|rated|reviews?)$/i;

/* ── A person on a platform: "FB Daniel Oden", "danoden ig" ─────────────────
 *
 * A platform's short name plus who to look for. Unambiguous names (fb,
 * insta, tiktok…) take any 1–4 word subject. Short ones that are also
 * ordinary words ("x", "truth", "rumble") need the subject to look like a
 * person — a @handle or Capitalised Names — so "x men cast" stays a search.
 */
const PLATFORM_WORDS = {
  fb: 'facebook', facebook: 'facebook',
  ig: 'instagram', insta: 'instagram', instagram: 'instagram',
  tiktok: 'tiktok', tt: 'tiktok',
  twitter: 'x', tw: 'x', x: 'x',
  reddit: 'reddit',
  bsky: 'bluesky', bluesky: 'bluesky',
  truth: 'truthsocial', truthsocial: 'truthsocial',
  rumble: 'rumble',
  mastodon: 'mastodon',
};
const AMBIGUOUS_PLATFORM_WORDS = new Set(['x', 'tt', 'tw', 'truth', 'rumble']);
// "facebook login", "tiktok stock price": about the platform, not someone on it.
const ABOUT_THE_PLATFORM = /^(login|log|sign|signup|app|apk|download|stock|shares?|price|news|down|outage|account|password|marketplace|support|help|delete|deactivate|update|ads?|dating|reels?|stories|story|videos?|live|messenger|today|near|me|how|what|why|ban|banned|lawsuit|ceo|followers|likes)$/i;
export const PLATFORM_LABEL = {
  facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', x: 'X', reddit: 'Reddit',
  bluesky: 'Bluesky', truthsocial: 'Truth Social', rumble: 'Rumble', mastodon: 'Mastodon',
};
// The platform's own people search, for the part of it only a login can see.
const PROFILE_SEARCH = {
  facebook: (q) => `https://www.facebook.com/search/people/?q=${q}`,
  instagram: (q) => `https://www.instagram.com/explore/search/keyword/?q=${q}`,
  tiktok: (q) => `https://www.tiktok.com/search/user?q=${q}`,
  x: (q) => `https://x.com/search?q=${q}&f=user`,
  reddit: (q) => `https://www.reddit.com/search/?q=${q}&type=user`,
  bluesky: (q) => `https://bsky.app/search?q=${q}`,
  truthsocial: (q) => `https://truthsocial.com/search?q=${q}`,
  rumble: (q) => `https://rumble.com/search/channel?q=${q}`,
  mastodon: (q) => `https://mastodon.social/search?q=${q}`,
};

/**
 * @returns {null | { platform: string, label: string, subject: string, profileUrl: string }}
 */
export function parseSocialQuery(text) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return null;
  const key = (w) => w.toLowerCase().replace(/[:,]$/, '');
  let idx = PLATFORM_WORDS[key(words[0])] ? 0 : PLATFORM_WORDS[key(words[words.length - 1])] ? words.length - 1 : -1;
  if (idx < 0) return null;
  const word = key(words[idx]);
  const subjectWords = words.filter((_, i) => i !== idx);
  if (!subjectWords.every((w) => /^@?[\p{L}\p{N}._'-]+$/u.test(w))) return null;
  if (subjectWords.length > 3 || subjectWords.some((w) => ABOUT_THE_PLATFORM.test(w))) return null;
  const personLike = subjectWords.every((w) => /^@/.test(w) || /^\p{Lu}/u.test(w));
  if (AMBIGUOUS_PLATFORM_WORDS.has(word) && !personLike) return null;
  const platform = PLATFORM_WORDS[word];
  const subject = subjectWords.join(' ');
  return {
    platform,
    label: PLATFORM_LABEL[platform],
    subject,
    profileUrl: PROFILE_SEARCH[platform](encodeURIComponent(subject.replace(/^@/, ''))),
  };
}

// An email address or a phone number is someone to look up, not something to
// read about — OSINT (Ocean) has the tools for that. Alone ("555-201-8890") or
// with a username beside it ("danoden dan@example.com").
const EMAIL = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/;
const PHONE = /(?:^|\s)\+?\d?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?:\s|$)/;

/**
 * @param {string} text what is in the search bar
 * @returns {null | { mode: string, kind: 'social'|'media'|'link'|'local'|'question'|'osint'|'profile', reason: string }}
 */
export function detectIntent(text) {
  const q = (text || '').trim();
  if (q.length < 3) return null;

  // Before links: "dan@example.com" must never read as a site to visit.
  if (EMAIL.test(q) || PHONE.test(q)) {
    return { mode: 'ocean', kind: 'osint', reason: EMAIL.test(q) ? 'Email lookup' : 'Phone lookup' };
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://truegle.info';
  const link = classifyQuery(q, origin);
  if (link) {
    // Social first: a Reddit or TikTok post is also "playable", but it belongs
    // with the rest of the conversation it came from, in the Feed.
    if (SOCIAL_HOST.test(link.host)) return { mode: 'yellow', kind: 'social', reason: 'Social link' };
    if (link.kind === 'playable') return { mode: 'tube', kind: 'media', reason: 'Video or audio link' };
    return { mode: 'blue', kind: 'link', reason: 'Link' };
  }

  const social = parseSocialQuery(q);
  if (social) return { mode: 'yellow', kind: 'profile', reason: `${social.label} search` };

  // A local business needs a service AND somewhere: "patent lawyers eugene",
  // "plumber near me". "best dentist" alone has nowhere to look.
  if (LOCAL_SERVICE.test(q)) {
    const rest = q.replace(LOCAL_SERVICE, ' ').split(/\s+/).filter((w) => w.length > 2 && !LOCAL_FILLER.test(w));
    if (NEAR_ME.test(q) || rest.length > 0) return { mode: 'blue', kind: 'local', reason: 'Local business' };
  }

  // "how to fix a bike chain" is a tutorial search, not a conversation.
  if (/^how to\b/i.test(q)) return null;
  if (isQuestionQuery(q) && q.split(/\s+/).length >= 3) return { mode: 'black', kind: 'question', reason: 'Question' };
  return null;
}
