/**
 * The only thing Truegle keeps about a search: an anonymous, short-lived line
 * of text, and only for searches that are safe to keep.
 *
 * WHAT IS STORED, said plainly because the privacy policy now says it too:
 * the lower-cased text of a short search, its mode, and a timestamp — no
 * account, no IP address, no device or session identifier. It exists for two
 * things only: the landing page's "trending" pills (last 24 h) and seeding the
 * Feed (last 48 h). Nothing older than RETENTION_DAYS is kept.
 *
 * WHAT IS NEVER STORED:
 *   - anything from Ocean (OSINT) mode — those searches are, by design, for
 *     looking people and accounts up;
 *   - anything that looks like personal data: an email, a phone number, a
 *     street address, a card or ID number, an IP address;
 *   - a pasted link, and anything too short or too long to be a trending pill.
 *
 * This used to insert every query verbatim and forever, and only masked
 * personal data on the way OUT to the landing page — so an email typed into
 * Ocean mode sat in the table indefinitely while the policy said queries were
 * not stored. The patterns below are the same high-confidence ones
 * frontend/src/utils/sanitizeTrending.js uses; keep the two in step.
 */

const RETENTION_DAYS = 7;
const PURGE_ONE_IN = 50;           // the cleanup rides on writes: no cron to run
const MIN_LEN = 3;
const MAX_LEN = 120;
const NEVER_STORED_MODES = new Set(['ocean', 'osint']);

const PII_PATTERNS = [
  /[\w.+-]+@[\w-]+\.[\w.]{2,}/,                                   // email
  /\b(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/,  // phone
  /\b\d{3}-\d{2}-\d{4}\b/,                                        // US SSN
  /\b(?:\d[ -]?){13,16}\b/,                                       // card number
  /\b\d{1,5}\s+[\w\s]{2,30}\s(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way)\b\.?/i, // street address
  /\b\d{1,3}(?:\.\d{1,3}){3}\b/,                                  // IPv4
];
const LINKISH = /(?:https?:\/\/|www\.)/i;

const normalise = (raw) => String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200);

/** May this search be kept at all? `mode` is the backend's ('blue-pill', 'ocean'…). */
function shouldStore(query, mode) {
  const q = normalise(query);
  if (q.length < MIN_LEN || q.length > MAX_LEN) return false;
  if (NEVER_STORED_MODES.has(String(mode || '').toLowerCase())) return false;
  if (LINKISH.test(q)) return false;
  return !PII_PATTERNS.some((re) => re.test(q));
}

/**
 * Delete what is past retention, plus anything that should never have been
 * kept — which also clears rows written before these rules existed. Postgres
 * regexes mirror the JS patterns above for the two that matter most.
 */
async function purge(db) {
  await db.query(
    `DELETE FROM search_queries
      WHERE created_at < NOW() - make_interval(days => $1)
         OR mode IN ('ocean', 'osint')
         OR query ~ '[[:alnum:]._+-]+@[[:alnum:]-]+[.][[:alnum:].]{2,}'
         OR query ~ '[0-9]{3}[[:space:].-][0-9]{3}[[:space:].-][0-9]{4}'
         OR query ~* '(https?://|www[.])'`,
    [RETENTION_DAYS],
  );
}

/**
 * Record one search if it may be kept. Never throws and never blocks: this must
 * cost a search nothing. `db` is anything with `.query(sql, params)`.
 */
async function recordSearch(rawQuery, mode, db, rand = Math.random) {
  try {
    const q = normalise(rawQuery);
    if (shouldStore(q, mode)) {
      await db.query('INSERT INTO search_queries (query, mode) VALUES ($1, $2)', [q, mode || 'blue-pill']);
    }
    if (rand() < 1 / PURGE_ONE_IN) await purge(db);
  } catch { /* analytics must never break a search */ }
}

module.exports = { recordSearch, shouldStore, purge, normalise, RETENTION_DAYS, PURGE_ONE_IN };
