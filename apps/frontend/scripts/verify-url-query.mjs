/* Pasted links: what counts as one, and what happens to it.
 *
 * THE BUG BEING PINNED. A YouTube playlist URL pasted into the search bar came
 * back as a page of web results about HTTP vs HTTPS — the link had been read as
 * prose and matched word by word. Two things were wrong and both are checked
 * here: getVideoEmbed did not recognise /playlist?list=… at all, and nothing on
 * the way in ever asked whether the query was a URL.
 *
 * The other half is the false-positive side, which matters more than it looks.
 * Turning a real search into a link card is a worse failure than missing a
 * link: the user can paste a fuller URL, but they cannot un-hijack a query. So
 * the bare-hostname cases are pinned as SEARCHES on purpose.
 *
 * Run it:  npm run urlquery:test
 */
import { asUrl, classifyQuery, stripTracking, describeLink } from '../src/utils/urlQuery.js';
import { getVideoEmbed, getPlayable } from '../src/utils/videoEmbed.js';

let passed = 0;
let failed = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { passed++; console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};

const ORIGIN = 'https://truegle.info';

// ── The exact link from the report ─────────────────────────────────────────
const REPORTED = 'https://youtube.com/playlist?list=OLAK5uy_kMAnOkGD0XI18gp5vH2X-27eBL_ttccUA&si=RqZF98uk2l5Bowg2';

const reported = classifyQuery(REPORTED, ORIGIN);
ok('the reported playlist link is recognised as a URL at all', reported !== null);
ok('…and as PLAYABLE, not as prose to search',
  reported?.kind === 'playable', reported?.kind);
ok('…embedding as a videoseries playlist',
  reported?.media?.src?.includes('/embed/videoseries?list=OLAK5uy_kMAnOkGD0XI18gp5vH2X-27eBL_ttccUA'),
  reported?.media?.src);
ok('…with the share-tracking token stripped',
  !reported?.url.includes('si=') && !reported?.url.includes('RqZF98uk2l5Bowg2'),
  reported?.url);
ok('…and a /tube link ready to hand back',
  reported?.playerLink?.startsWith(`${ORIGIN}/tube?u=`), reported?.playerLink);
ok('…described as a playlist rather than a single track',
  /playlist/i.test(describeLink(reported)), describeLink(reported));

// ── Playlist embeds ────────────────────────────────────────────────────────
ok('a bare /playlist?list= embeds as videoseries',
  getVideoEmbed('https://www.youtube.com/playlist?list=PL1234567890') ===
    'https://www.youtube.com/embed/videoseries?list=PL1234567890');
ok('/watch?v=X&list=Y keeps the list, so a shared queue stays a queue',
  getVideoEmbed('https://www.youtube.com/watch?v=abc123&list=PL999') ===
    'https://www.youtube.com/embed/abc123?list=PL999');
ok('/watch?v=X alone is still a single video',
  getVideoEmbed('https://www.youtube.com/watch?v=abc123') ===
    'https://www.youtube.com/embed/abc123');
ok('a playlist id outside the id alphabet is refused, not interpolated',
  getVideoEmbed('https://www.youtube.com/playlist?list=%22onerror%3D') === null);
ok('a /playlist with no list at all is not playable',
  getVideoEmbed('https://www.youtube.com/playlist') === null);

// ── What is NOT a URL ──────────────────────────────────────────────────────
for (const prose of [
  'how to make sourdough',
  'node.js',                    // looks like host.tld, is a search
  'example.com',                // bare hostname, no path — stays a search
  '3.14',
  'best cameras 2026',
  'check out youtube.com/watch', // has whitespace, so it is a sentence
  '',
  '   ',
]) {
  ok(`"${prose}" stays a search`, classifyQuery(prose, ORIGIN) === null);
}

// ── What IS a URL ──────────────────────────────────────────────────────────
ok('a scheme-less link WITH a path counts',
  asUrl('youtube.com/watch?v=abc123') === 'https://youtube.com/watch?v=abc123',
  asUrl('youtube.com/watch?v=abc123'));
ok('a full https link counts', asUrl('https://example.com/page') === 'https://example.com/page');

// ── Schemes that must never get through ────────────────────────────────────
for (const hostile of [
  'javascript:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'file:///etc/passwd',
  'vbscript:msgbox(1)',
]) {
  ok(`${hostile.split(':')[0]}: is refused`, asUrl(hostile) === null, String(asUrl(hostile)));
}

// ── Non-playable links become ONE link, not a result list ──────────────────
const article = classifyQuery('https://en.wikipedia.org/wiki/HTTPS', ORIGIN);
ok('an ordinary article link is a link, not playable', article?.kind === 'link', article?.kind);
ok('…and carries no player link', article?.playerLink === null);
ok('…and says where it will actually open',
  describeLink(article).includes('en.wikipedia.org'), describeLink(article));

// ── Tracking strip ─────────────────────────────────────────────────────────
ok('utm_* are stripped',
  stripTracking('https://a.com/x?utm_source=b&utm_medium=c&keep=1') === 'https://a.com/x?keep=1',
  stripTracking('https://a.com/x?utm_source=b&utm_medium=c&keep=1'));
ok('stripping the only param leaves no dangling ?',
  stripTracking('https://a.com/x?si=abc') === 'https://a.com/x',
  stripTracking('https://a.com/x?si=abc'));
ok('a URL with nothing to strip comes back untouched',
  stripTracking('https://a.com/x?v=1') === 'https://a.com/x?v=1');
ok('the video id survives a strip that removes a sibling param',
  getPlayable(stripTracking('https://www.youtube.com/watch?v=abc123&si=xyz'))?.src
    ?.includes('abc123'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
