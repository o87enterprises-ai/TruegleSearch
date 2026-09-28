// What the pill offers to switch to as you type (utils/queryIntent.detectIntent).
// Run: npm run intent:test
import { detectIntent, parseSocialQuery } from '../src/utils/queryIntent.js';
import { routeFor } from '../src/utils/modeRoute.js';
const cases = [
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'tube'], ['https://soundcloud.com/artist/track', 'tube'],
  ['https://www.reddit.com/r/oregon/comments/abc/some_post/', 'yellow'], ['https://x.com/user/status/123', 'yellow'],
  ['https://example.com/some/page', 'blue'], ['eugene oregon patent lawyers', 'blue'], ['plumber near me', 'blue'],
  ['what is the capital of france', 'black'], ['should I refinance my mortgage?', 'black'],
  ['FB Daniel Oden', 'yellow'], ['daniel oden ig', 'yellow'], ['x @danoden', 'yellow'], ['tiktok charli', 'yellow'],
  ['x men cast', null], ['truth about vaccines', null], ['facebook stock price today news', null], ['facebook login', null], ['tiktok ban news', null],
  ['danoden dan.oden@example.com', 'ocean'], ['dan@example.com', 'ocean'], ['danoden 541-555-0123', 'ocean'], ['(541) 555-0123', 'ocean'],
  ['how to fix a bike chain', null], ['best dentist', null], ['taylor swift tour dates', null], ['node.js', null], ['what', null],
  // A name or title to watch goes to Tube (owner, 2026-09-28)…
  ['Michael Jackson', 'tube'], ['Chippass', 'tube'], ['Trailer Park Boys', 'tube'], ['Game of Thrones', 'tube'], ['Blink 182', 'tube'],
  ['thriller music video', 'tube'], ['breaking bad trailer', 'tube'], ['lofi mix', 'tube'],
  // …but not facts about it, not a question, not an errand, not lower-case prose.
  ['Michael Jackson net worth', null], ['Taylor Swift tour dates', null], ['Who is Michael Jackson', 'black'],
  ['Google', null], ['cheap flights paris', null], ['michael jackson', null], ['covid vaccine', null],
];
let bad = 0;
for (const [t, want] of cases) { const got = detectIntent(t)?.mode ?? null; const ok = got === want; if (!ok) bad++; console.log(ok ? 'PASS' : 'FAIL', JSON.stringify(t), '->', got, ok ? '' : `(want ${want})`); }
console.log(JSON.stringify(parseSocialQuery('FB Daniel Oden')));
console.log(routeFor('black', 'hi there'), routeFor('red', ''), routeFor('yellow', 'x'));
if (bad) { console.log(`${bad} FAILED`); process.exit(1); } else console.log("ALL PASSED");
