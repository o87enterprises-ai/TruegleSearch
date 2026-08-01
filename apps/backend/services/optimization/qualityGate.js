/**
 * Quality gate — nothing ships unless it passes. A failing run publishes
 * NOTHING and retries tomorrow; that trade (miss a day) is always better than
 * shipping thin/fabricated/unsafe content, because for a search engine the
 * brand IS trust and scaled thin content gets the whole blog de-indexed.
 */

const { QUALITY } = require('./config');

// Hard identifiers we never want anywhere near a published topic/title.
const EMAIL = /\S+@\S+\.\S+/;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const SSN = /\b\d{3}-\d{2}-\d{4}\b/;
const STREET = /\b\d{1,5}\s+\w+(\s+\w+)?\s+(st|street|ave|avenue|rd|road|blvd|lane|ln|dr|drive|court|ct)\b/i;
const DOX = /\b(dox|home address of|social security|find (the )?address of|phone number of [a-z])\b/i;

// Fabrication tells — house style carries NO citations/stats, so any of these
// in an AI draft is treated as invented and rejected.
const FABRICATION = /(\bet al\.|\bjournal of\b|\baccording to (a|the|one) (study|report|survey|paper)|\ba \d{4} study\b|\bstudies (show|found|suggest)\b|\bresearch (shows|found|suggests)\b|\b\d{1,3}(\.\d+)?%\b)/i;

/** Used by topicSource to keep anything personal out of the topic signal. */
function isSensitiveQuery(q) {
  const s = String(q || '');
  return EMAIL.test(s) || PHONE.test(s) || SSN.test(s) || STREET.test(s) || DOX.test(s);
}

function bodyText(post) {
  const parts = [post.shortAnswer];
  for (const sec of post.sections) {
    if (sec.kind === 'links') continue; // deterministic, not model-authored
    parts.push(...sec.content);
  }
  return parts.join(' ');
}

function countWords(post) {
  return bodyText(post).split(/\s+/).filter(Boolean).length;
}

function firstWords(text, n) {
  return text.split(/\s+/).slice(0, n).join(' ').toLowerCase();
}

/** @returns {{ok:boolean, reasons:string[], words:number}} */
function check(post) {
  const reasons = [];
  const words = countWords(post);

  if (!post.title || post.title.length > QUALITY.MAX_TITLE_LEN)
    reasons.push(`title missing or over ${QUALITY.MAX_TITLE_LEN} chars`);
  if (!post.description || post.description.length < QUALITY.MIN_DESC_LEN || post.description.length > QUALITY.MAX_DESC_LEN)
    reasons.push(`description must be ${QUALITY.MIN_DESC_LEN}-${QUALITY.MAX_DESC_LEN} chars`);

  const opener = firstWords(post.shortAnswer || '', QUALITY.PHRASE_WINDOW_WORDS);
  if (!opener.includes(String(post.targetPhrase).toLowerCase()))
    reasons.push(`target phrase "${post.targetPhrase}" not in first ${QUALITY.PHRASE_WINDOW_WORDS} words of the answer`);

  if (words < QUALITY.MIN_WORDS) reasons.push(`only ${words} words (need >= ${QUALITY.MIN_WORDS})`);

  const contentSections = post.sections.filter((s) => s.kind !== 'links').length;
  if (contentSections < QUALITY.MIN_SECTIONS) reasons.push(`only ${contentSections} content sections (need >= ${QUALITY.MIN_SECTIONS})`);

  if (!Array.isArray(post.faq) || post.faq.length < QUALITY.MIN_FAQ)
    reasons.push(`need >= ${QUALITY.MIN_FAQ} FAQ entries`);

  const text = bodyText(post);
  const fab = text.match(FABRICATION);
  if (fab) reasons.push(`possible fabricated citation/stat: "${fab[0]}" — explain without invented data`);

  const identity = `${post.slug} ${post.title} ${post.shortAnswer}`;
  if (isSensitiveQuery(identity)) reasons.push('contains a personal identifier (email/phone/address) — topic must stay anonymous & evergreen');

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug || '')) reasons.push('slug is not a clean lowercase-hyphen slug');

  return { ok: reasons.length === 0, reasons, words };
}

module.exports = { check, isSensitiveQuery, countWords };
