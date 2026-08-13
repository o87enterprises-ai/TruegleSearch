/* The OSINT toolkit, checked against the failures a real self-lookup exposed.
 *
 * WHY THIS EXISTS: a user ran the toolkit on their own details to validate it
 * and the debrief told them their working Gmail address had "No MX" and their
 * working phone number was "Not a valid number" — then the model, reasoning
 * from those two lines, concluded the contact details were probably fake. Both
 * were parser bugs, and both had been invisible because nothing exercised the
 * extract → lookup → render path end to end.
 *
 * PART ONE runs offline and is the part that matters most: parsing and
 * rendering, no network, so it can never be skipped for being unreachable.
 * Those are the checks that would have caught the bugs above.
 *
 * PART TWO asks the live endpoints whether they still answer from a server,
 * which is the only property of an OSINT source we cannot assert offline.
 * Exit 2 if nothing is reachable — a network result is never a verdict on the
 * code (see verify-news.mjs, same contract).
 *
 * Run:  npm run osint:test          (from apps/backend)
 *       npm run osint:test -- --live-only
 */
import { createRequire } from 'node:module';

// config/env.js validates these at import time; none is used here.
process.env.JWT_SECRET ||= 'test-only';
process.env.ENCRYPTION_KEY ||= '0123456789abcdef0123456789abcdef';
process.env.GOOGLE_API_KEY ||= 'test-only';
process.env.GOOGLE_SEARCH_ENGINE_ID ||= 'test-only';

const require = createRequire(import.meta.url);
const L = require('../services/OsintLookups.js');
const INV = require('../services/OsintInvestigationService.js');
const { RENDER } = require('../services/OsintToolbelt.js');

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);
const liveOnly = process.argv.includes('--live-only');

// ── PART ONE: offline ───────────────────────────────────────────────────────
if (!liveOnly) {
  console.log('→ parsing and rendering (offline)…\n');

  // THE EMAIL BUG: a trailing comma became part of the address, so the domain
  // was "gmail.com," and the MX check honestly reported none.
  const messy = "therealduckyduck@gmail.com, 5416230460, Odin Idesae O'Shea - find everything about me";
  const ents = INV.detectEntities(messy);
  const email = ents.find((e) => e.type === 'email');
  check(!!email, 'email is detected in a comma-separated query');
  check(email?.value === 'therealduckyduck@gmail.com',
    'email carries no trailing punctuation', JSON.stringify(email?.value));
  check(L.RE.email.test(email?.value || ''), 'the detected email validates');
  check(String(email?.value || '').split('@')[1] === 'gmail.com',
    'the mail domain is clean (this is what produced the false "No MX")',
    String(email?.value || '').split('@')[1]);

  // THE PHONE BUG: no country hint, so libphonenumber threw INVALID_COUNTRY and
  // a real number was written up as invalid.
  for (const raw of ['5416230460', '15416230460', '+15416230460', '(541) 623-0460', '541-623-0460']) {
    const p = L.phoneIntel(raw);
    check(p.ok && p.valid === true && p.formats?.e164 === '+15416230460',
      `phone parses: ${JSON.stringify(raw)}`, `valid=${p.valid} e164=${p.formats?.e164 || p.reason || p.error}`);
  }
  const uk = L.phoneIntel('+44 20 7946 0958');
  check(uk.valid === true && uk.country === 'GB', 'a non-US number still parses on its own country code', uk.country);

  // "could not determine" must never render as "invalid" — that distinction is
  // the whole reason the report accused the user of misdirection.
  const undet = RENDER.phone({ phoneIntel: { ok: true, valid: null, parsed: false, reason: 'NOT_A_NUMBER' } });
  check(undet.some((l) => /could not be determined/.test(l)) && !undet.some((l) => /Valid number: no/.test(l)),
    'an unparseable number is reported as undetermined, not invalid', undet[0]);

  const good = RENDER.phone({ phoneIntel: L.phoneIntel('5416230460') });
  check(good.some((l) => /Valid number: yes/.test(l)), 'a real number renders as valid');
  check(good.some((l) => /assumed/.test(l)), 'and says the country was assumed rather than stated');

  // THE RENDER BUG: RENDER.email read fields emailIntel never returns, so the
  // whole section collapsed to one line.
  const lines = RENDER.email({
    emailIntel: { ok: true, domain: 'gmail.com', localPart: 'ducky', mxFound: true, mxRecords: ['mx.google.com'], gravatarExists: true },
    gravatar: { ok: true, found: true, profileUrl: 'https://gravatar.com/x', displayName: 'D', location: 'Oregon', accounts: [{ platform: 'github.com', username: 'd' }], urls: ['https://e.com'] },
    githubByEmail: { ok: true, found: true, users: [{ login: 'ducky' }] },
    usernameCheck: { ok: true, username: 'ducky', results: [{ platform: 'GitHub', found: true }, { platform: 'npm', found: false }] },
  });
  check(lines.length >= 8, 'an email renders a real section, not one stray line', `${lines.length} lines`);
  check(lines.some((l) => /MX present.*yes/.test(l)), '   reports MX correctly');
  check(lines.some((l) => /Gravatar location/.test(l)), '   surfaces self-published profile data');
  check(lines.some((l) => /derived from the address/.test(l)),
    '   labels the handle as DERIVED, never as user-supplied');

  // THE PERSON BUG, from the second self-test: the subject's own name was
  // dropped entirely, so no people-search ran. Two causes, both here.
  //   · the fallback required EVERY word capitalized, so a lowercase middle
  //     name ("Odin idesae O'Shea") was not a name;
  //   · hasContext only accepted a TEN-digit number, so the same phone written
  //     with its country code ("15416230460") supplied no people-search
  //     context at all.
  const PEOPLE = [
    ["Odin idesae O'Shea, 15416230460, therealduckyduck@gmail.com", "Odin Idesae O'Shea"],
    ['John Smith 555-123-4567', 'John Smith'],
    ['look up Maria van der Berg', 'Maria Van Der Berg'],
    ['Ronald McDonald age 45', 'Ronald McDonald'],
    ['Jane Doe (541) 623-0460', 'Jane Doe'],
    ['Peter Parker dob 1995', 'Peter Parker'],
    ['look up leonardo diCaprio 555-123-4567', 'Leonardo DiCaprio'],
  ];
  for (const [q, want] of PEOPLE) {
    const p = INV.detectEntities(q).find((e) => e.type === 'person');
    check(p?.value === want, `person detected: ${JSON.stringify(want)}`, p ? JSON.stringify(p.value) : 'none');
  }
  // Casing must survive — a mangled name goes straight into the search URLs.
  check(!/O'shea|Mcdonald|Dicaprio/.test(PEOPLE.map(([q]) => INV.detectEntities(q).find((e) => e.type === 'person')?.value || '').join(' ')),
    'internal capitals survive (O\'Shea, McDonald, DiCaprio)');

  // And the negatives still hold: an ordinary question is not a person.
  for (const q of ['Please research magnetic moon', 'What is the New York Times', 'how do I bake bread',
    'investigate example.com', 'Tell me about quantum computing', 'Compare Python Django to Ruby Rails']) {
    const p = INV.detectEntities(q).find((e) => e.type === 'person');
    check(!p, `not a person: ${JSON.stringify(q.slice(0, 34))}`, p ? JSON.stringify(p.value) : '');
  }

  // The pivot has to actually be wired into gather(), not just exist.
  const src = require('node:fs').readFileSync(new URL('../services/OsintInvestigationService.js', import.meta.url), 'utf8');
  check(/usernameCheck\(localPart\)/.test(src), 'gather() pivots the email local-part into username checks');
  check(/gravatarProfile\(ent\.value\)/.test(src) && /githubByEmail\(ent\.value\)/.test(src),
    'gather() runs the Gravatar profile and GitHub-by-email lookups');
}

// ── PART TWO: live ──────────────────────────────────────────────────────────
console.log('\n→ upstreams (live)…');
const PROBES = [
  ['dns.google', 'https://dns.google/resolve?name=gmail.com&type=MX'],
  ['gravatar', 'https://gravatar.com/205e460b479e2e5b48aec07710c08d50.json'],
  ['api.github.com', 'https://api.github.com/users/octocat'],
  ['hacker-news', 'https://hacker-news.firebaseio.com/v0/user/pg.json'],
  ['keybase', 'https://keybase.io/_/api/1.0/user/lookup.json?username=chris'],
  ['chess.com', 'https://api.chess.com/pub/player/erik'],
  ['lichess', 'https://lichess.org/api/user/thibault'],
  ['codeberg', 'https://codeberg.org/api/v1/users/gitea'],
  ['wikipedia', 'https://en.wikipedia.org/w/api.php?action=query&list=users&ususers=Jimbo_Wales&format=json'],
];

let reachedAny = false;
for (const [name, url] of PROBES) {
  try {
    const r = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'TruegleOSINT/1.0 (+https://truegle.info)' },
    });
    if (r.ok) reachedAny = true;
    console.log(`   ${r.ok ? '✓' : '✗'} ${name} — HTTP ${r.status}`);
    if (!liveOnly) check(r.ok, `live: ${name} answers a server request`, `HTTP ${r.status}`);
  } catch (err) {
    console.log(`   ✗ ${name} — ${err.message}`);
    if (!liveOnly) check(false, `live: ${name} answers a server request`, err.message);
  }
}

if (!reachedAny) {
  const offlineFailures = bad.filter((l) => l.includes('live:')).length;
  console.log('\nNo upstream was reachable from here — a NETWORK result, not a shape result.');
  console.log('The offline checks above still stand on their own; re-run somewhere with');
  console.log('outbound access to confirm the sources still answer.\n');
  const realFailures = bad.length - offlineFailures;
  ok.filter((l) => !l.includes('live:')).forEach((l) => console.log(l));
  bad.filter((l) => !l.includes('live:')).forEach((l) => console.log(l));
  if (realFailures > 0) { console.log(`\n${realFailures} offline checks FAILED`); process.exit(1); }
  console.log(`All ${ok.filter((l) => !l.includes('live:')).length} offline checks passed; live pass skipped (unreachable).`);
  process.exit(2);
}

console.log('');
ok.forEach((l) => console.log(l));
if (bad.length) {
  console.log('');
  bad.forEach((l) => console.log(l));
  console.log(`\n${bad.length} failed, ${ok.length} passed`);
  process.exit(1);
}
console.log(`\nall ${ok.length} passed`);
