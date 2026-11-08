// Pure-logic check for the creator run (utils/creatorRun.js): which feed rows
// count as a roster creator's, and the order their feed plays in.
import { creatorOf, playOrder } from '../src/utils/creatorRun.js';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

check(creatorOf({ platform: 'Truegle Creators', author: 'Roland Martin' })?.slug === 'roland-martin', 'a Truegle Creators row maps to its roster creator');
check(creatorOf({ platform: 'Podcasts', author: 'The BEMA Podcast' })?.slug === 'the-bema-podcast', 'a roster podcast row (platform Podcasts) maps too');
check(creatorOf({ platform: 'Podcasts', author: 'PowerfulJRE' }) === null, 'a generic podcast search hit is not a roster creator');
check(creatorOf({ platform: 'Reddit', author: 'Roland Martin' }) === null, 'a same-named author on another platform is not');
check(creatorOf({ platform: 'Truegle Creators', author: 'Nobody' }) === null, 'an unknown author is not');
check(creatorOf(null) === null && creatorOf({}) === null, 'empty rows are safe');

const s = (n) => ({ pageUrl: `u${n}` });
const feed = [s(1), s(2), s(3), s(4), s(5)];
check(playOrder(feed, 'u3').map((x) => x.pageUrl).join() === 'u4,u5,u1,u2', 'plays on from the clicked post, then catches up on the rest, clicked excluded');
check(playOrder(feed, 'u5').map((x) => x.pageUrl).join() === 'u1,u2,u3,u4', 'the last post wraps to the start');
check(playOrder(feed, 'u1').map((x) => x.pageUrl).join() === 'u2,u3,u4,u5', 'the first post plays the rest in order');
check(playOrder(feed, 'zzz').length === 5, 'a clicked post not in the feed leaves the feed whole');
check(playOrder(null, 'u1').length === 0, 'no feed is safe');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
