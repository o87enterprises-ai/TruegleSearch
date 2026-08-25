/* Which sources need a title looked up, and which already have one.
 *
 * THE ASYMMETRY THAT DRIVES THIS. Missing a scruffy title costs one extra
 * request. REPLACING a good title costs the user the name of the thing they
 * are looking at. So needsTitle is deliberately conservative: it only says yes
 * when what is on screen is unmistakably a URL rather than a name.
 *
 * "Unmistakably a URL" is what titleFromUrl produces — host + path, no spaces,
 * beginning with the host. A real title with a space in it is never touched,
 * which covers essentially every real title.
 *
 * Run it:  npm run titles:test
 */
import { needsTitle, bestTitle } from '../src/utils/resolveTitles.js';

let passed = 0;
let failed = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { passed++; console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};

const src = (title, url = 'https://www.youtube.com/watch?v=abc123') => ({
  title, url, pageUrl: url, src: 'https://www.youtube-nocookie.com/embed/abc123',
});

// ── The case this exists for ───────────────────────────────────────────────
ok('a titleFromUrl fallback needs resolving',
  needsTitle(src('youtube.com/watch')) === true);
ok('…and so does a bare host with a path',
  needsTitle(src('vimeo.com/123456', 'https://vimeo.com/123456')) === true);
ok('an empty title needs resolving',
  needsTitle(src('')) === true);
ok('a missing title needs resolving',
  needsTitle(src(undefined)) === true);

// ── What must never be clobbered ───────────────────────────────────────────
ok('a real title is left alone',
  needsTitle(src('Lefty Gunplay - Blue Print')) === false);
ok('…even a short one, because it has a space',
  needsTitle(src('Sub Zero')) === false);
ok('a one-word real title is left alone (does not start with the host)',
  needsTitle(src('Blueprint')) === false);
ok('a title that merely CONTAINS the host is left alone',
  needsTitle(src('Why youtube.com changed')) === false);

// ── Junk in, no crash out ──────────────────────────────────────────────────
ok('a null source needs nothing', needsTitle(null) === false);
ok('undefined needs nothing', needsTitle(undefined) === false);
ok('a source with an unparseable url and a one-word title is left alone',
  needsTitle({ title: 'something', url: 'not a url' }) === false);
ok('a source with no url at all does not throw',
  needsTitle({ title: 'x' }) === false);

// ── bestTitle falls back rather than blanking ──────────────────────────────
ok('bestTitle returns the original when nothing was learned',
  bestTitle(src('Lefty Gunplay - Blue Print')) === 'Lefty Gunplay - Blue Print');
ok('bestTitle on a null source is an empty string, not a throw',
  bestTitle(null) === '');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
