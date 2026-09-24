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

/**
 * @param {string} text what is in the search bar
 * @returns {null | { mode: string, kind: 'social'|'media'|'link'|'local'|'question', reason: string }}
 */
export function detectIntent(text) {
  const q = (text || '').trim();
  if (q.length < 3) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://truegle.info';
  const link = classifyQuery(q, origin);
  if (link) {
    // Social first: a Reddit or TikTok post is also "playable", but it belongs
    // with the rest of the conversation it came from, in the Feed.
    if (SOCIAL_HOST.test(link.host)) return { mode: 'yellow', kind: 'social', reason: 'Social link' };
    if (link.kind === 'playable') return { mode: 'tube', kind: 'media', reason: 'Video or audio link' };
    return { mode: 'blue', kind: 'link', reason: 'Link' };
  }

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
