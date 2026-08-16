/* Parsing "coffee near me".
 *
 * A local query has two halves — WHAT and WHERE — and only the second was ever
 * read. Three defects, all on the same journey, all invisible to a test that
 * only asked "did the map open":
 *
 *   "near me" RESOLVED TO THE PLACE "me". The pattern list was ordered
 *     [/(in|at|near)\s+([A-Za-z\s]+)/, …, /near\s+me/] and the first match won,
 *     so "coffee near me" captured the word "me" and geocoded it as a place
 *     name. The geolocation pattern beneath could never be reached — dead code
 *     that read like a working feature.
 *   "nearby", "around me" and "closest" MATCHED NOTHING. They sat in a
 *     LOCATION_KEYWORDS object that no pattern ever consulted, so those queries
 *     were not treated as local at all.
 *   THE SUBJECT WAS ALWAYS DISCARDED. "dentist in austin" geocoded "austin" and
 *     showed a map of Austin with no dentists on it. The one word that made it
 *     a question went nowhere.
 *
 * Run it:  npm run localquery:test
 */
const { parseLocalQuery } = await import('../src/hooks/useLocationDetection.js');

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const expect = (query, want) => {
  const got = parseLocalQuery(query);
  const same = want === null
    ? got === null
    : got && Object.entries(want).every(([k, v]) => got[k] === v);
  check(same, `"${query}"`, same ? describe(got) : `got ${JSON.stringify(got)} · wanted ${JSON.stringify(want)}`);
};
const describe = (g) => (g ? `${g.type}${g.subject ? ` · subject "${g.subject}"` : ''}${g.place ? ` · place "${g.place}"` : ''}${g.zipcode ? ` · zip ${g.zipcode}` : ''}` : 'null');

// ── 1. "near me" means MY POSITION, never the place "me" ────────────────────
expect('coffee near me', { type: 'geolocation', subject: 'coffee' });
expect('hardware store near me', { type: 'geolocation', subject: 'hardware store' });

// ── 2. every way of saying it ───────────────────────────────────────────────
// These were listed as keywords and implemented by nothing.
expect('pizza nearby', { type: 'geolocation', subject: 'pizza' });
expect('gas station around me', { type: 'geolocation', subject: 'gas station' });
expect('pharmacy close to me', { type: 'geolocation', subject: 'pharmacy' });
expect('closest urgent care', { type: 'geolocation', subject: 'urgent care' });

// ── 3. the subject survives ─────────────────────────────────────────────────
// The whole point. Without it the map centres correctly and answers nothing.
expect('dentist in austin', { type: 'place', subject: 'dentist', place: 'austin' });
expect('sushi near portland', { type: 'place', subject: 'sushi', place: 'portland' });
expect('best coffee near me', { type: 'geolocation', subject: 'coffee' });
expect('find me the best tacos nearby', { type: 'geolocation', subject: 'tacos' });

// ── 4. a bare place is still a bare place ───────────────────────────────────
// No subject, so the map centres and does not invent a search.
const bare = parseLocalQuery('austin texas');
check(bare === null, 'a bare place name is left to the general place lookup', describe(bare));

// ── 5. the other intents still work ─────────────────────────────────────────
expect('directions to seattle', { type: 'directions', place: 'seattle' });
expect('urgent care 90210', { type: 'zipcode', zipcode: '90210', subject: 'urgent care' });

// ── 6. nothing local is nothing local ───────────────────────────────────────
expect('how do transformers work', null);
expect('', null);

// ── 7. the subject is never filler ──────────────────────────────────────────
// "near me" on its own is a request to look at where you are, not a search for
// the word "me".
const alone = parseLocalQuery('near me');
check(alone?.type === 'geolocation' && alone.subject === '',
  '"near me" alone asks for your position and searches for nothing', describe(alone));

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
