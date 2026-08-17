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

// ── 8. a shared pin comes back as a place ───────────────────────────────────
// The map's share menu writes /search?q=<lat>,<lng>, so that has to parse back
// into the point it came from. The trap is ZIPCODE: `\b(\d{5})\b` happily
// matches five digits out of the middle of "43.752413", so without the
// coordinate pattern running FIRST a shared pin geocodes as a postcode
// somewhere else entirely.
const pin = parseLocalQuery('43.752413, -123.070256');
check(pin?.type === 'coords', 'a coordinate pair is recognised as a point', describe(pin));
check(pin?.lat === 43.752413 && pin?.lng === -123.070256,
  '…with both numbers intact', `${pin?.lat}, ${pin?.lng}`);
check(parseLocalQuery('43.752413,-123.070256')?.type === 'coords',
  '…with or without the space');
check(parseLocalQuery('-33.8688, 151.2093')?.type === 'coords',
  '…south and east of zero too');

// Not everything with a comma and digits is a location.
check(parseLocalQuery('91.5, 0')?.type !== 'coords',
  'an impossible latitude is not a point', describe(parseLocalQuery('91.5, 0')));
check(parseLocalQuery('0, 181')?.type !== 'coords',
  'nor an impossible longitude', describe(parseLocalQuery('0, 181')));
check(parseLocalQuery('catch 22, revisited')?.type !== 'coords',
  'nor a sentence that merely contains a comma');

// ── 9. "<what> <town> <state>" — no preposition anywhere ────────────────────
// REPORTED: "taxi cottage grove oregon" opened no map, because SUBJECT_IN_PLACE
// needs an "in"/"near"/"at" to split the halves and nobody types one. The
// assistant then wrote "the map pane should already be showing Cottage Grove"
// about a map that had never opened.
expect('taxi cottage grove oregon', { type: 'place', subject: 'taxi', place: 'cottage grove oregon' });
expect('pharmacy cottage grove, OR', { type: 'place', subject: 'pharmacy', place: 'cottage grove OR' });
expect('coffee ann arbor michigan', { type: 'place', subject: 'coffee', place: 'ann arbor michigan' });

// Longest category wins. The alternation lists "gas" before "gas station"
// because it was written for test(), where order does not matter — taking the
// FIRST match would search for "gas" in "station cottage grove oregon".
expect('gas station cottage grove oregon',
  { type: 'place', subject: 'gas station', place: 'cottage grove oregon' });

// The guard: only a category we can actually search for may claim the front of
// the string. Without it a bare town splits into nonsense.
check(parseLocalQuery('cottage grove oregon') === null,
  'a bare town + state stays a plain place lookup',
  describe(parseLocalQuery('cottage grove oregon')));
check(parseLocalQuery('portland oregon') === null,
  '…and so does a one-word town', describe(parseLocalQuery('portland oregon')));
check(parseLocalQuery('taxi oregon') === null,
  'a category with a state but no town is not a local search',
  describe(parseLocalQuery('taxi oregon')));
// Same shape, and the ambiguity is why: "new york" here is the state half of
// the pattern, and there is no way to tell it from the city. Pinning either
// would be a guess, so it falls through to the ordinary place lookup.
check(parseLocalQuery('hotel new york') === null,
  '…including when the state name is also a city', describe(parseLocalQuery('hotel new york')));

// Two-letter state codes are ordinary English words in lower case. Matching
// them case-insensitively would turn half the language into geography.
check(parseLocalQuery('coffee or tea') === null,
  '"or" is not Oregon', describe(parseLocalQuery('coffee or tea')));
check(parseLocalQuery('what is a hotel in') === null,
  '"in" is not Indiana', describe(parseLocalQuery('what is a hotel in')));
check(parseLocalQuery('buy me coffee me') === null,
  '"me" is not Maine', describe(parseLocalQuery('buy me coffee me')));

// The prepositional form still wins where it applies — it knows exactly where
// the split is, so it must not be pre-empted by the looser rule.
expect('dentist in cottage grove oregon',
  { type: 'place', subject: 'dentist', place: 'cottage grove oregon' });

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
