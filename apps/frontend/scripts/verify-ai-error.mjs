/* What a failed AI turn tells you.
 *
 * REPORTED as a shared link with nothing in it to act on: the thread rendered
 * fine — sources, pics and videos all there — and where the answer should have
 * been sat "Sorry, I couldn't reach the AI just now — try again in a moment."
 *
 * That sentence was the catch-all for every failure: a rate limit, a missing
 * API key, an oversized image, a rejected request, a dropped connection and a
 * provider outage all printed it. Fine for one of those, misleading for the
 * rest — it sends somebody off to wait a moment when the real answer is "that
 * image is too large" or "you are offline", neither of which a moment fixes.
 *
 * And it gets SAVED. A share is a snapshot of its messages, so an unexplained
 * failure becomes a permanent link that explains nothing.
 *
 * Run it:  npm run aierror:test
 */
import { aiErrorMessage } from '../src/utils/aiError.js';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const withStatus = (status, data) => ({ response: { status, data } });

// ── the server said something useful; say it ────────────────────────────────
check(aiErrorMessage(withStatus(429, { error: 'Rate limit exceeded', message: 'AI usage limit reached. Please try again later.' }))
  === 'AI usage limit reached. Please try again later.',
  'a rate limit repeats the server’s own words rather than inventing new ones');

check(/temporarily unavailable/.test(aiErrorMessage(withStatus(500,
  { error: 'AI service configuration error', message: 'AI service is temporarily unavailable due to configuration issues.' }))),
  'a configuration fault says so, instead of blaming the connection');

check(/too large/i.test(aiErrorMessage(withStatus(413, { error: 'Image too large', message: 'That image is too large.' }))),
  'an oversized image is named as the problem');

// ── the server said nothing useful; still be specific ───────────────────────
check(/minute/i.test(aiErrorMessage(withStatus(429, {}))),
  'a bare 429 still advises waiting');
check(/smaller/i.test(aiErrorMessage(withStatus(413, {}))),
  'a bare 413 still says to shrink the image');
check(/not something retrying will fix quickly/i.test(aiErrorMessage(withStatus(503, {}))),
  'a bare 5xx does not promise that retrying soon will help');
check(/could not read/i.test(aiErrorMessage(withStatus(400, {}))),
  'a bare 400 blames the request, not the network');
check(/[Ss]igning in/.test(aiErrorMessage(withStatus(403, {}))),
  'a refusal suggests the thing that might actually help');

// ── no response at all ──────────────────────────────────────────────────────
// The one case where the advice is completely different: nothing about the
// question is wrong.
// Node 22 makes globalThis.navigator a getter, so it is redefined rather than
// assigned — the alternative is threading a fake navigator through the function
// signature, which would exist only for this test.
const setOnline = (value) => Object.defineProperty(globalThis, 'navigator',
  { value: { onLine: value }, configurable: true, writable: true });

setOnline(false);
check(/offline/i.test(aiErrorMessage(new Error('Network Error'))),
  'being offline is reported as being offline');
setOnline(true);
const netMsg = aiErrorMessage(new Error('Network Error'));
check(/could not be reached/i.test(netMsg), 'an unreachable backend is reported as unreachable', netMsg);
// Chat is the only caller, and chat has no "search results above" — the old
// line pointed at something that wasn't there. It says what to DO instead.
check(!/search results/i.test(netMsg) && /send it again/i.test(netMsg),
  '…and tells the chat user what to do, without pointing at results that are not there',
  netMsg);

// ── a machine code is not a sentence ────────────────────────────────────────
// routes/ai.js puts a code in `error` and prose in `message`. A one-word code
// shown to somebody is worse than the generic line it replaced.
const coded = aiErrorMessage(withStatus(500, { error: 'feedback_failed' }));
check(!/feedback_failed/.test(coded), 'a bare machine code is never shown as the explanation', coded);
check(aiErrorMessage(withStatus(500, { error: 'AI request failed' })) === 'AI request failed',
  '…but a server phrase that reads as English is passed through');

// ── junk in ─────────────────────────────────────────────────────────────────
check(typeof aiErrorMessage(undefined) === 'string' && aiErrorMessage(undefined).length > 0,
  'no error object still produces something to read');
check(typeof aiErrorMessage({ response: {} }) === 'string',
  'a malformed response does not throw');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
