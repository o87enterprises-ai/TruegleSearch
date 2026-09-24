// What the pill offers to switch to as you type (utils/queryIntent.detectIntent).
// Run: npm run intent:test
import { detectIntent } from '../src/utils/queryIntent.js';
import { routeFor } from '../src/utils/modeRoute.js';
const cases = [
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'tube'], ['https://soundcloud.com/artist/track', 'tube'],
  ['https://www.reddit.com/r/oregon/comments/abc/some_post/', 'yellow'], ['https://x.com/user/status/123', 'yellow'],
  ['https://example.com/some/page', 'blue'], ['eugene oregon patent lawyers', 'blue'], ['plumber near me', 'blue'],
  ['what is the capital of france', 'black'], ['should I refinance my mortgage?', 'black'],
  ['how to fix a bike chain', null], ['best dentist', null], ['taylor swift tour dates', null], ['node.js', null], ['what', null],
];
let bad = 0;
for (const [t, want] of cases) { const got = detectIntent(t)?.mode ?? null; const ok = got === want; if (!ok) bad++; console.log(ok ? 'PASS' : 'FAIL', JSON.stringify(t), '->', got, ok ? '' : `(want ${want})`); }
console.log(routeFor('black', 'hi there'), routeFor('red', ''), routeFor('yellow', 'x'));
if (bad) { console.log(`${bad} FAILED`); process.exit(1); } else console.log("ALL PASSED");
