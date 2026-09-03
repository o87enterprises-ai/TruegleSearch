/**
 * The one gate left on Truegle.
 *
 * Every other surface — search, chat, maps, tube, reels — is free, unmetered
 * and signed-out-friendly, and the freemium meter that once claimed otherwise
 * has been deleted. OSINT is the exception, because it is the one place where a
 * click costs us something real: a single investigation fans out to third-party
 * IP / DNS / WHOIS / email / phone / username lookups, all on free-tier
 * quotas, and then spends an AI call writing the analyst brief.
 *
 * So a signed-out visitor gets OSINT_FREE_INVESTIGATIONS of them, then is asked
 * to make an account. The account is free — this buys us a name for the quota,
 * not money.
 *
 * WHAT COUNTS AS AN INVESTIGATION: one run of the tools against one subject.
 * Re-running the same subject after adding a tool would be a second one, which
 * would be mean, so the subject is remembered and a repeat of it is free.
 *
 * HONEST ABOUT ITS OWN STRENGTH: this is localStorage. Clearing site data
 * resets it, and the backend routes it fronts are public and unauthenticated.
 * It is a product nudge and nothing more. Real enforcement would be per-IP in
 * apps/backend/routes/osint.js.
 */
import { OSINT_FREE_INVESTIGATIONS } from '../config/access';

const KEY_COUNT = 'truegle_osint_runs';
const KEY_LAST = 'truegle_osint_last_subject';

function lsGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, val); } catch { /* quota / SecurityError — ignore */ }
}

/** Subjects compare case- and whitespace-insensitively, so "  8.8.8.8 " is a repeat. */
function normalize(subject) {
  return (subject || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function investigationsUsed() {
  const n = parseInt(lsGet(KEY_COUNT) || '0', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function investigationsRemaining() {
  return Math.max(0, OSINT_FREE_INVESTIGATIONS - investigationsUsed());
}

/**
 * May this run go ahead?
 *
 * Signed-in visitors always may. So does a repeat of the subject already paid
 * for — adding a tool to an investigation you are in the middle of is the same
 * investigation, not a new one.
 */
export function canInvestigate({ isAuthenticated = false, subject = '' } = {}) {
  if (isAuthenticated) return true;
  if (normalize(subject) && normalize(subject) === lsGet(KEY_LAST)) return true;
  return investigationsRemaining() > 0;
}

/**
 * Record a run. Returns the number of free runs left afterwards.
 * A repeat subject and a signed-in visitor both spend nothing.
 */
export function consumeInvestigation({ isAuthenticated = false, subject = '' } = {}) {
  if (isAuthenticated) return Infinity;
  const norm = normalize(subject);
  if (norm && norm === lsGet(KEY_LAST)) return investigationsRemaining();
  if (norm) lsSet(KEY_LAST, norm);
  lsSet(KEY_COUNT, String(investigationsUsed() + 1));
  return investigationsRemaining();
}

/** Test/debug helper — also what a "start over" control would call. */
export function resetInvestigations() {
  try {
    localStorage.removeItem(KEY_COUNT);
    localStorage.removeItem(KEY_LAST);
  } catch { /* ignore */ }
}
