/* Every kind getPlayable() can return must be a kind PlayerScreen can render.
 *
 * WHY THIS EXISTS. Four kinds — twitter, instagram, facebook, truthsocial —
 * were added to getPlayable() without being added to PlayerScreen's iframe
 * list. Nothing failed loudly. The cards classified as playable, showed a
 * play badge, offered "Open in app", and then mounted the LAST branch of
 * PlayerScreen: an <audio> element pointed at an HTML embed page. A dead
 * transport, no picture, no error. Reported months later as "the inline
 * iframe centered player is not properly firing" — and it wasn't the iframe,
 * there was no iframe.
 *
 * The bug was not in either file. It was in the GAP between two lists that
 * have to agree and had nothing keeping them honest. So this reads the real
 * list out of PlayerScreen.jsx rather than restating it — a copy here would
 * be a third list to drift.
 *
 * No network and no browser: getPlayable is pure URL logic, which is exactly
 * the part that broke.
 *
 * Run it:  npm run embedkinds:test
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { getPlayable } from '../src/utils/videoEmbed.js';
import { gatedSite } from '../src/utils/externalSites.js';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const here = dirname(fileURLToPath(import.meta.url));
const screenSrc = readFileSync(resolve(here, '../src/components/player/PlayerScreen.jsx'), 'utf8');

// The literal array from `const isVideoIframe = [...].includes(kind)`.
const listed = /const isVideoIframe = \[([^\]]+)\]/.exec(screenSrc);
check(!!listed, 'PlayerScreen still declares its iframe-kind list where this test can read it');
const IFRAME_KINDS = listed
  ? [...listed[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1])
  : [];
check(IFRAME_KINDS.length >= 7, 'the iframe-kind list parsed', IFRAME_KINDS.join(','));

// The other branches PlayerScreen can take, so "renderable" means all of
// them and not only the iframe path.
const RENDERABLE = new Set([...IFRAME_KINDS, 'soundcloud', 'video', 'audio']);

// One representative URL per rule getPlayable actually has. A kind that
// cannot be produced by any URL here is a kind this test cannot vouch for,
// so add a row when adding a rule.
const CASES = [
  ['YouTube watch', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  ['YouTube short', 'https://www.youtube.com/shorts/dQw4w9WgXcQ'],
  ['Vimeo', 'https://vimeo.com/123456789'],
  ['TikTok video', 'https://www.tiktok.com/@someone/video/7234567890123456789'],
  ['Dailymotion', 'https://www.dailymotion.com/video/x8abcde'],
  ['Rumble', 'https://rumble.com/v4abcde-some-title.html'],
  ['Odysee', 'https://odysee.com/@channel:1/some-video:2'],
  ['Reddit post', 'https://www.reddit.com/r/news/comments/abc123/some_title/'],
  ['X status', 'https://x.com/someone/status/1960482938475839201'],
  ['Truth Social', 'https://truthsocial.com/@RealUser/113344556677889900'],
  ['SoundCloud', 'https://soundcloud.com/artist/track-name'],
  ['direct mp4', 'https://example.com/clip.mp4'],
  ['direct mp3', 'https://example.com/song.mp3'],
];

for (const [label, url] of CASES) {
  const p = getPlayable(url);
  if (!p) { check(false, `${label} is classified at all`, 'getPlayable returned null'); continue; }
  check(RENDERABLE.has(p.kind),
    `${label} → kind '${p.kind}' is one PlayerScreen can actually render`,
    RENDERABLE.has(p.kind) ? '' : `'${p.kind}' falls through to the <audio> branch`);
}

// ── Meta is deliberately not playable ───────────────────────────────────────
// Instagram and Facebook embeds were written from the documentation, never
// loaded from the sandbox (every outbound host is blocked here), and did not
// render on a real device. Rather than ship a frame that fails in front of
// somebody, they are not playable at all and following one warns first.
const META = [
  ['Instagram post', 'https://www.instagram.com/p/CxAbCdEfGhI/', 'Instagram'],
  ['Instagram reel', 'https://www.instagram.com/reel/CxAbCdEfGhI/', 'Instagram'],
  ['Facebook post', 'https://www.facebook.com/somepage/posts/1234567890', 'Facebook'],
  ['Facebook watch', 'https://www.facebook.com/watch/?v=1234567890', 'Facebook'],
  ['fb.watch short', 'https://fb.watch/abc123/', 'Facebook'],
];
for (const [label, url, site] of META) {
  check(getPlayable(url) === null,
    `${label} is NOT playable — no play badge, no embed to fail in front of anyone`);
  check(gatedSite(url) === site,
    `…and following it warns that it leaves Truegle for ${site}`, gatedSite(url) || 'no warning');
}

// A URL with no embeddable id is honestly unplayable rather than guessed at.
for (const [label, url] of [
  ['an X profile', 'https://x.com/someone'],
  ['a TikTok share link', 'https://vm.tiktok.com/ZMabcdef/'],
  ['a bare YouTube channel', 'https://www.youtube.com/@someone'],
]) {
  check(getPlayable(url) === null, `${label} carries no id, so it is not claimed as playable`);
}

// And nothing else drags in the warning — it stays rare enough to mean
// something, which is the whole reason it is a short list.
for (const url of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://x.com/a/status/123456789', 'https://example.com/x']) {
  check(gatedSite(url) === null, `no leaving-Truegle warning for ${new URL(url).hostname}`);
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
