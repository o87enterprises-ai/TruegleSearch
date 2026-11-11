/* Which sites Truegle offers to open in-app, and which it does not.
 *
 * WHAT THIS REPLACES. Every result card offered "Open in app", and the preview
 * tried to work out afterwards whether the page had refused:
 *
 *     onLoad={(e) => { try {
 *       if (!e.target.contentDocument || …) setIframeBlocked(true);
 *     } catch { setIframeBlocked(true); } }}
 *
 * `contentDocument` is null for EVERY cross-origin frame by specification,
 * whether or not the site allows framing — so that branch fired on every
 * external result. It was not detection. A refusal (`X-Frame-Options`,
 * `frame-ancestors`) is enforced by the browser and deliberately invisible to
 * the framing page; that is the entire point of the header.
 *
 * So the only honest approach is to know ahead of the press. These tests are
 * about the two ways that list can be wrong, and they are not symmetrical:
 * a host wrongly listed costs a preview that would have worked, and a host
 * wrongly omitted costs a press, a wait and a blank rectangle.
 *
 * Run it:  npm run embeddable:test
 */
import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const dir = mkdtempSync(join(tmpdir(), 'truegle-embed-'));
const out = join(dir, 'embeddable.mjs');
await build({
  entryPoints: [resolve(process.cwd(), 'src/utils/embeddable.js')],
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { canPreview, refusesFraming, opensOnLabel, viewerSrc, REFUSED_HOSTS } = await import(out);

// ── 1. the known refusals are refused ───────────────────────────────────────
for (const url of [
  'https://www.google.com/search?q=x',
  'https://www.facebook.com/somepage',
  'https://x.com/someone/status/123',
  'https://www.reddit.com/r/cats/',
  'https://github.com/anthropics/claude-code',
  'https://www.nytimes.com/2026/01/01/us/story.html',
  'https://www.amazon.com/dp/B000000000',
]) {
  check(!canPreview(url), `not offered in-app: ${new URL(url).hostname}`);
}

// Music and culture sites that explicitly forbid framing (checked against their
// live headers, 2026-11-11), which turned up under an artist search and opened as
// a blank white page.
for (const url of [
  'https://genius.com/artists/Ebk-jaaybo',
  'https://pitchfork.com/artists/ebk-jaaybo/',
  'https://www.passionweiss.com/tag/ebk-jaaybo/',
]) {
  check(!canPreview(url), `not offered in-app: ${new URL(url).hostname} (forbids framing)`);
}
// ...while a site that allows it still is.
check(canPreview('http://last.fm/music/EBK+Jaaybo/_/Out+On+Bail') && canPreview('https://www.last.fm/music/EBK+Jaaybo'), 'Last.fm, which allows framing, is still offered in-app');

// ── 1b. an http result goes into the frame as https ─────────────────────────
// Truegle is https; an http frame inside it is blocked (mixed content) and stays
// blank. Owner, 2026-11-11: http://last.fm/... opened as a white page.
check(viewerSrc('http://last.fm/music/EBK+Jaaybo/_/Out+On+Bail') === 'https://last.fm/music/EBK+Jaaybo/_/Out+On+Bail', 'an http address is framed over https');
check(viewerSrc('HTTP://Example.org/a') === 'https://Example.org/a', '…whatever the case of the scheme');
check(viewerSrc('https://example.org/a') === 'https://example.org/a', 'an https address is left alone');
check(viewerSrc('https://example.org/?u=http://other.example/') === 'https://example.org/?u=http://other.example/', 'an http:// inside the query string is data, not a scheme');
check(viewerSrc(null) === null && viewerSrc(undefined) === undefined, 'nothing in, nothing out');

// ── 2. subdomains count ─────────────────────────────────────────────────────
// A refusal is a property of the site, not of one hostname.
check(refusesFraming('https://news.google.com/topics/x'), 'a subdomain of a listed host is refused too');
check(refusesFraming('https://docs.google.com/document/d/1'), '…including app subdomains');
check(refusesFraming('http://old.reddit.com/r/cats'), '…and on plain http');

// ── 3. THE SUFFIX HOLE ──────────────────────────────────────────────────────
// This is the bug that was found and fixed in getVideoEmbed's host test, where
// `host.endsWith('youtube.com')` also matched `evilyoutube.com` and would have
// iframed an attacker's host as a trusted embed. The same shape of test here
// would only mislabel a site, but it is the same mistake and it is not being
// repeated: matching is on LABEL boundaries.
check(!refusesFraming('https://notgoogle.com/x'),
  'notgoogle.com is NOT google.com', 'suffix match must respect label boundaries');
check(!refusesFraming('https://evilyoutube.com/watch'), 'evilyoutube.com is NOT youtube.com');
check(!refusesFraming('https://myreddit.com/r/x'), 'myreddit.com is NOT reddit.com');
check(refusesFraming('https://m.youtube.com/watch?v=x'), '…while a real subdomain still matches');

// ── 4. everything else is still offered ─────────────────────────────────────
// The list is of hosts worth being SURE about. Being wrong in this direction
// costs a preview that would have worked, so an ordinary site must pass
// through untouched.
for (const url of [
  'https://en.wikipedia.org/wiki/Coffee',
  'https://example.com/article',
  'https://www.gov.uk/guidance',
  'https://arxiv.org/abs/2401.00001',
]) {
  check(canPreview(url), `still offered in-app: ${new URL(url).hostname}`);
}

// ── 5. rubbish in, no crash out ─────────────────────────────────────────────
check(canPreview('not a url') === false || canPreview('not a url') === true,
  'an unparseable URL does not throw');
check(!canPreview(''), 'an empty URL is not previewable');
check(!canPreview(null), 'a missing URL is not previewable');
check(refusesFraming('javascript:alert(1)') === false,
  'a non-http scheme is not matched against the list');

// ── 6. the label names the site ─────────────────────────────────────────────
// "Opens on nytimes.com" tells the reader where they are going before they
// press, which is the whole point of not offering a dead button.
check(opensOnLabel('https://www.nytimes.com/x') === 'Opens on nytimes.com',
  'the label names the host, without www', opensOnLabel('https://www.nytimes.com/x'));
check(opensOnLabel('nonsense') === 'Opens in a new tab',
  '…and degrades to something true when the URL will not parse');

// ── 7. the list itself is well-formed ───────────────────────────────────────
// A stray scheme, path or leading dot silently matches nothing, which would be
// a host quietly falling off the list without anyone noticing.
const malformed = REFUSED_HOSTS.filter((h) => !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h));
check(malformed.length === 0, 'every entry is a bare host', malformed.join(', ') || 'all clean');
const dupes = REFUSED_HOSTS.filter((h, i) => REFUSED_HOSTS.indexOf(h) !== i);
check(dupes.length === 0, '…and none is listed twice', dupes.join(', ') || 'no duplicates');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
