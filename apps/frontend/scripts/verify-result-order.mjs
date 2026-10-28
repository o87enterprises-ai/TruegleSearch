/* Tube results: the row that says the artist AND the song comes before one that
 * says only the song.
 *
 * Owner, 2026-10-28: searched "larussel tweedlee dee" — artist and song title
 * both in the query — and the actual artist's track sat halfway down the page,
 * under older recordings that only shared the song name.
 *
 *   1. a row naming artist + song outranks a row with just the song
 *   2. a typo (one letter off) and a split/joined word ("tweedlee dee" /
 *      "Tweedledee") still count as the same word
 *   3. the artist in the title with the song only in the description beats a
 *      song-only title (weaker than a full title match, stronger than half)
 *   4. rows that say the same amount keep the order they arrived in (and the
 *      host order), so nothing is shuffled for no reason
 *   5. no usable query → the order is left exactly alone; an explicit platform
 *      or channel still outranks coverage
 *
 * Run it:  npm run resultorder:test
 */
import { createServer } from 'vite';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const server = await createServer({ server: { port: 5316, strictPort: true }, logLevel: 'error' });
await server.listen();
const { rankPlayable, queryCoverage } = await server.ssrLoadModule('/src/utils/playerQuery.js');

const row = (title, extra = {}) => ({ kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${title.slice(0, 8)}`, title, ...extra });
const order = (rows, intent) => rankPlayable(rows, intent).map((r) => r.title);

// What the page looked like: song-only clips first, the real match lower down.
const rows = [
  row('Tweedle Dee (Performed live on The Ed Sullivan Show 11/20/55)', { channel: 'The Ed Sullivan Show' }),
  row('LaVern BAKER and her band - Tomorrow Night', { description: 'Un titre Rock n Roll' }),
  row('Scotty Moore Lesson - How To Play Tweedle Dee', { channel: 'Scotty Moore' }),
  row('La Vern Baker - Tweedlee Dee', { channel: 'LaVern Baker' }),
  row('Tweedle Dee (1954) from Audio Vox'),
  row('LaRussell - Tweedledee (Official Video)', { channel: 'LaRussell' }),
];
const q = 'larussel tweedlee dee';

const ranked = order(rows, { text: q });
check(ranked[0] === 'LaRussell - Tweedledee (Official Video)', '1. the row naming artist + song is first', ranked[0]);

// 2
check(queryCoverage(row('LaRussell - Tweedledee', { channel: 'LaRussell' }), q) === 1, '2. one letter off + "tweedlee dee" vs "Tweedledee" still cover the whole query');
check(queryCoverage(row('Tweedle Dee (1954)'), q) < 0.7, '2. …while a song-only title does not', String(queryCoverage(row('Tweedle Dee (1954)'), q).toFixed(2)));

// 3
const withChapters = row('LaRussell LIVE in Detroit', { channel: 'LaRussell', description: '0:00 Intro 12:30 Tweedle Dee 15:00 Baby Boy' });
const songOnly = row('Tweedle Dee (Performed live on The Ed Sullivan Show)');
const r3 = order([songOnly, withChapters], { text: q });
check(r3[0] === withChapters.title, '3. artist in the title + song in the description beats a song-only title', r3[0]);

// 4
const same = [row('Alpha video one'), row('Beta video two'), row('Gamma video three')];
check(JSON.stringify(order(same, { text: 'zzz qqq' })) === JSON.stringify(same.map((r) => r.title)), '4. rows that say equally little keep their order');
const equalTop = [row('LaRussell Tweedledee A', { channel: 'x' }), row('LaRussell Tweedledee B', { channel: 'x' })];
check(order(equalTop, { text: q })[0].endsWith('A'), '4. rows that say equally much keep their order');

// 5
check(JSON.stringify(order(rows, { text: '' })) === JSON.stringify(rows.map((r) => r.title)), '5. no query → the order is untouched');
check(JSON.stringify(order(rows, { text: 'the official video' })) === JSON.stringify(rows.map((r) => r.title)), '5. a query of only filler words → untouched');
const mixed = [row('LaRussell Tweedledee', { kind: 'vimeo' }), row('Something else', { kind: 'youtube' })];
check(order(mixed, { text: q, platform: 'youtube' })[0] === 'Something else', '5. an explicit platform still outranks coverage');
const byChannel = [row('LaRussell Tweedledee'), row('Other', { channel: 'darkwaters9' })];
check(order(byChannel, { text: q, channel: 'darkwaters9' })[0] === 'Other', '5. an explicit channel still outranks coverage');
check(queryCoverage(row('Тweedle'), 'музыка') === 0 && Number.isFinite(queryCoverage(row('х'), 'музыка песня')), '5. a non-Latin query is handled without throwing');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await server.close();
process.exit(bad.length ? 1 : 0);
