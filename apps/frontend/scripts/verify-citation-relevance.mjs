/* Citations must belong to the question that fetched them.
 *
 * THE REPORTED CASE, used verbatim as the fixture: a Tartaria question shipped
 * an answer citing theory.com (a clothing retailer), Merriam-Webster's entry
 * for "theory", and an image that was lucide-static/icons/ampersands.svg — a UI
 * glyph from our own icon set. The search had keyed on the common word
 * "theory". The answer was signed "Research Provided by TrueGLE" with those
 * beneath it as its evidence base.
 *
 * The asymmetry that sets the threshold: dropping a REAL source costs the user
 * evidence they could have checked; keeping one loose link costs a little
 * credibility. So the bar is deliberately low — non-sequiturs only, no
 * curation — and the tests below pin both directions, because a filter that
 * quietly empties the source list would be the worse bug.
 *
 * Run it:  npm run citations:test
 */
import {
  distinctiveTerms, isRelevant, isAssetImage, filterCitations,
} from '../src/utils/citationRelevance.js';

let passed = 0;
let failed = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { passed++; console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};

const QUERY = 'What is the Tartaria theory?';
const terms = distinctiveTerms(QUERY);

ok('"theory" is treated as a common word, not a subject',
  !terms.includes('theory'), terms.join(','));
ok('"tartaria" survives as the distinctive term', terms.includes('tartaria'));

// ── The four sources that actually shipped ─────────────────────────────────
const SHIPPED = [
  { title: 'Theory – Definition, Types, Examples and Use in Research', url: 'https://researchmethod.net/theory/', domain: 'researchmethod.net' },
  { title: 'Theory Official Site | Contemporary Clothing for Women and Men', url: 'https://www.theory.com/', domain: 'theory.com' },
  { title: 'Theory Official Site | Contemporary Clothing for Women and Men', url: 'https://uk.theory.com/', domain: 'uk.theory.com' },
  { title: 'THEORY Definition & Meaning - Merriam-Webster', url: 'https://www.merriam-webster.com/dictionary/theory', domain: 'merriam-webster.com' },
];
for (const s of SHIPPED) {
  ok(`dropped: ${s.domain}`, !isRelevant(s, terms));
}

// ── What must survive ──────────────────────────────────────────────────────
const GOOD = [
  { title: 'The Lost Civilization of Tartaria', url: 'https://youtube.com/watch?v=Ke9wCOAIwf4' },
  { title: 'What is the Truth about Tartaria', url: 'https://youtube.com/watch?v=_9yvFe4tZ7c' },
  { title: 'The Tartarian Empire: The Advanced Civilization Erased From History', url: 'https://youtube.com/watch?v=wIBT28E52sI' },
  { title: 'Map of Great Tartary, 1706', url: 'https://example.org/maps/tartary-1706' },
];
for (const g of GOOD) {
  ok(`kept: ${g.title.slice(0, 46)}`, isRelevant(g, terms));
}
ok('"Tartarian" matches "tartaria" (prefix, so morphology counts)',
  isRelevant({ title: 'The Tartarian Empire' }, terms));

// ── Asset images ───────────────────────────────────────────────────────────
ok('the lucide icon that shipped is rejected',
  isAssetImage({ image: 'https://cdn.jsdelivr.net/npm/lucide-static/icons/ampersands.svg' }));
ok('an SVG anywhere is rejected', isAssetImage({ image: 'https://a.com/x/logo.svg' }));
ok('an /icons/ path is rejected', isAssetImage({ image: 'https://a.com/icons/thing.png' }));
ok('a real photo is kept',
  !isAssetImage({ image: 'https://malevus.com/wp-content/uploads/2023/10/tartaria-map.jpg' }));
ok('an image with no url at all is rejected', isAssetImage({}));

// ── End to end, on the real payload ────────────────────────────────────────
const result = filterCitations({
  links: SHIPPED,
  videos: GOOD.slice(0, 3),
  pics: [
    { image: 'https://cdn.jsdelivr.net/npm/lucide-static/icons/ampersands.svg' },
    { image: 'https://malevus.com/wp-content/uploads/2023/10/tartaria-map-by-bertius.jpg', title: 'Tartaria map by Bertius' },
  ],
}, QUERY);

ok('every bogus link is gone', result.links.length === 0, `${result.links.length} left`);
ok('the three real videos survive', result.videos.length === 3, `${result.videos.length}`);
ok('the icon is gone and the map survives', result.pics.length === 1, `${result.pics.length}`);
ok('the drop count is reported', result.dropped === 5, String(result.dropped));

// ── The failure mode that would be WORSE than the bug ──────────────────────
// A filter that empties the list is not an improvement. These pin the low bar.
ok('a question with NO distinctive terms keeps everything',
  filterCitations({ links: SHIPPED, videos: [], pics: [] }, 'what is a theory?').links.length === 4);
ok('an empty query keeps everything',
  filterCitations({ links: SHIPPED, videos: [], pics: [] }, '').links.length === 4);
ok('a result with no text to judge is kept rather than punished',
  isRelevant({ url: '' }, terms));
ok('null citations pass straight through', filterCitations(null, QUERY) === null);
ok('a one-distinctive-term question still filters',
  filterCitations({ links: [
    { title: 'Sourdough starter guide', url: 'https://a.com/sourdough' },
    { title: 'Contemporary Clothing', url: 'https://theory.com' },
  ], videos: [], pics: [] }, 'how do I make sourdough?').links.length === 1);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
