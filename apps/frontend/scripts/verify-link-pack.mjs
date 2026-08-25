/* Short player links: the round trip, the saving, and the gate.
 *
 * The reported link was ~3,900 characters for 25 tracks — past the point where
 * a URL survives being pasted into SMS or a chat app. Packing carries the ids
 * and a one-character host code instead of 25 copies of the same boilerplate.
 *
 * What actually needs proving, in order of how much it would cost to get wrong:
 *
 *   1. THE GATE STILL HOLDS. Packing is a shorter way to WRITE a link, never a
 *      way around getPlayable. An unpackable-to-anything entry must not become
 *      a way to smuggle a destination past the check that decides what the
 *      player will host.
 *   2. It round-trips. A queue packed and unpacked is the same queue, in the
 *      same order.
 *   3. It is actually shorter, measured against the real reported link rather
 *      than against a guess.
 *   4. Old links keep working. Every /tube link already shared uses u=/t=, and
 *      those must never stop resolving.
 *
 * Run it:  npm run linkpack:test
 */
import { packSources, unpackSources } from '../src/utils/playerLinkPack.js';
import { buildPlayerLink, parsePlayerParams } from '../src/utils/playerLink.js';

let passed = 0;
let failed = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { passed++; console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};

const ORIGIN = 'https://truegle.info';

// The real queue from the report, trimmed to its distinct ids.
const IDS = [
  'hvGT0Z9hdh8', 'io3ncomDCtk', 'JRcos8kQ4dI', 'q5Um9QoQy5A', 'CoypcZK6ZZ4',
  'Af8yi3K9fBo', 'xPPUNFa7k8U', 'SrJCHTnkCnk', 'N07vCIUsD5A', 'b2qeChGSy-A',
  'ymlIknRaq-0', 'ekMscYycAZc', 'zzoME9FCDW8', 'KgAHjNSqyWk', 'X2nWPeRoV1c',
  '6QZrv9Px2F0', 'VB2p93-oKMI', 'VdmNfYmF0SU', 'MnhtZwpcCs4', 'BGFMcK1wk0E',
  'XtGYl4tWMFU', 'BWVxyYdp8Yk', 'sAbXSYN_bHs', '_ZPIaTii72A', 'CV3_2Pb2OC0',
];
const QUEUE = IDS.map((id, i) => ({
  url: `https://www.youtube.com/watch?v=${id}`,
  title: `Lefty Gunplay - Track ${i + 1} (Official Music Video)`,
}));

// ── 1. The gate ────────────────────────────────────────────────────────────
const hostile = packSources([{ url: 'https://evil.example/malware.exe' }]);
ok('an unplayable URL is not packed at all', hostile === null, String(hostile));

ok('a forged raw entry pointing somewhere unplayable unpacks to nothing',
  unpackSources(`1~${encodeURIComponent('https://evil.example/x')}`).length === 0);
ok('an id outside the safe alphabet is refused rather than interpolated',
  unpackSources('1y../../etc/passwd').length === 0);
ok('an unknown version is refused rather than guessed at',
  unpackSources('9yhvGT0Z9hdh8').length === 0);
ok('junk unpacks to an empty queue, not a crash',
  unpackSources('completely-not-a-pack').length === 0);
ok('an empty value is an empty queue', unpackSources('').length === 0);

// ── 2. Round trip ──────────────────────────────────────────────────────────
const packed = packSources(QUEUE);
const back = unpackSources(packed);
ok('every track survives the round trip', back.length === QUEUE.length, `${back.length}/${QUEUE.length}`);
ok('…in the same order, with the same ids',
  back.every((u, i) => u.includes(IDS[i])),
  back.slice(0, 2).join(' , '));

// Per-host round trips.
const hostCases = [
  ['https://youtu.be/hvGT0Z9hdh8', 'hvGT0Z9hdh8', 'youtu.be short link'],
  ['https://www.youtube.com/shorts/abc12345678', 'abc12345678', 'a Short'],
  ['https://vimeo.com/123456789', '123456789', 'Vimeo'],
  ['https://www.dailymotion.com/video/x8rsr3z', 'x8rsr3z', 'Dailymotion'],
];
for (const [url, id, label] of hostCases) {
  const r = unpackSources(packSources([{ url }]));
  ok(`${label} round-trips`, r.length === 1 && r[0].includes(id), r[0] || 'dropped');
}
ok('a Short stays a Short rather than flattening to /watch',
  unpackSources(packSources([{ url: 'https://www.youtube.com/shorts/abc12345678' }]))[0]
    ?.includes('/shorts/'),
  unpackSources(packSources([{ url: 'https://www.youtube.com/shorts/abc12345678' }]))[0]);

// ── 3. The saving ──────────────────────────────────────────────────────────
const longForm = buildPlayerLink(QUEUE, ORIGIN, { compact: false });
const shortForm = buildPlayerLink(QUEUE, ORIGIN, { compact: true });
const saving = 1 - shortForm.length / longForm.length;
ok('the packed link is at least 85% shorter',
  saving >= 0.85, `${longForm.length} -> ${shortForm.length} chars (${Math.round(saving * 100)}% off)`);
ok('…and short enough to survive an SMS', shortForm.length < 480, `${shortForm.length} chars`);

// ── 4. Auto mode, and old links ────────────────────────────────────────────
ok('a queue packs automatically', buildPlayerLink(QUEUE, ORIGIN).includes('?p='));
ok('a single track keeps its title instead of packing',
  buildPlayerLink([QUEUE[0]], ORIGIN).includes('&t=Lefty'),
  buildPlayerLink([QUEUE[0]], ORIGIN));

const parsedShort = parsePlayerParams(new URL(shortForm).search);
ok('a packed link parses back into a full queue',
  parsedShort.sources.length === QUEUE.length, `${parsedShort.sources.length}`);

const parsedLong = parsePlayerParams(new URL(longForm).search);
ok('an already-shared u=/t= link still parses', parsedLong.sources.length === QUEUE.length);
ok('…and still carries its titles',
  parsedLong.sources[0].title === QUEUE[0].title, parsedLong.sources[0].title);

// Both forms in one URL: the packed items come first, and the titled ones keep
// their own titles rather than being shifted onto the wrong track.
const mixed = parsePlayerParams(
  `?p=${packSources([{ url: QUEUE[0].url }])}&u=${encodeURIComponent(QUEUE[1].url)}&t=Second`,
);
ok('a mixed packed + titled link keeps titles aligned',
  mixed.sources.length === 2 && mixed.sources[1].title === 'Second',
  mixed.sources.map((x) => x.title).join(' | '));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
