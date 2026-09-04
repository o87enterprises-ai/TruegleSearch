/* The player's state layer, and the volume wire protocol.
 *
 * WHAT THIS IS FOR. Three things were reported that all live below the UI:
 *
 *   1. "if I clear the queue and search and then play a video in the player it
 *      will automatically default back to my cached queue, making it impossible
 *      to organically discover new content."
 *      Two separate causes, both here: advance() handed control to the queue
 *      whenever the queue was non-empty, and loadState() put last session's
 *      playing item back INTO the queue — so a queue you emptied came back
 *      with something in it and then took over.
 *   2. Volume did not exist. It is a wire protocol now, and a wire protocol
 *      typo fails silently: the embed ignores a message it does not recognise,
 *      which looks exactly like the control not being connected.
 *   3. Pause on an embed had to be real rather than an unmount.
 *
 * The reducer and loadState are pure, so this needs no browser and no React.
 *
 * Run it:  npm run playerengine:test
 */
import { reducer, loadState, INITIAL, QUEUE_KEY } from '../src/context/PlayerContext.jsx';
import { volumeCommands } from '../src/hooks/useEmbedPlayback.js';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

// A real in-memory localStorage — a no-op stub would let a loadState that
// persists nothing pass every test, which is the shape of the bug being tested.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.sessionStorage = globalThis.localStorage;

const vid = (id) => String(id).padEnd(11, 'x').slice(0, 11);
const yt = (id) => ({
  kind: 'youtube',
  src: `https://www.youtube-nocookie.com/embed/${vid(id)}`,
  title: `Video ${id}`,
  pageUrl: `https://youtu.be/${vid(id)}`,
});
const run = (state, ...actions) => actions.reduce(reducer, state);

// ── 1. the queue only takes over when it was asked for ──────────────────────

// Adding to the queue on purpose IS asking for it.
let s = run(INITIAL, { type: 'play', source: yt('a') }, { type: 'enqueue', source: yt('b'), byUser: true });
check(s.queueArmed, 'adding to the queue yourself arms it');
check(s.queue.length === 1, '…and the item is in the list', `${s.queue.length}`);

// The player topping itself up is NOT.
s = run(INITIAL, { type: 'play', source: yt('a') }, { type: 'enqueue', source: yt('b'), byUser: false });
check(!s.queueArmed, 'an automatic top-up does not arm the queue');
check(s.queue.length === 1, '…but it still fills it', `${s.queue.length}`);

// A shared link fills the list without claiming it.
s = run(INITIAL, { type: 'enqueueMany', sources: [yt('a'), yt('b'), yt('c')] });
check(!s.queueArmed, 'a shared link does not arm the queue');
check(!!s.current && s.queue.length === 2, '…and still plays the first with the rest lined up',
  `current=${!!s.current} queue=${s.queue.length}`);

// Pressing play on an entry is the clearest statement there is.
s = run(INITIAL, { type: 'enqueueMany', sources: [yt('a'), yt('b'), yt('c')] }, { type: 'jump', index: 0 });
check(s.queueArmed, 'playing an entry from the list arms it');

// Emptying the list withdraws the instruction to follow it.
s = run(INITIAL, { type: 'play', source: yt('a') }, { type: 'enqueue', source: yt('b'), byUser: true },
  { type: 'clearQueue' });
check(!s.queueArmed && s.queue.length === 0, 'clearing the queue disarms it',
  `armed=${s.queueArmed} n=${s.queue.length}`);

// And an explicit "play the list" control can arm it without adding anything.
s = run(INITIAL, { type: 'enqueueMany', sources: [yt('a')] }, { type: 'armQueue' });
check(s.queueArmed, 'an explicit play-the-list arms it');

// ── 2. a cleared queue stays cleared across a reload ────────────────────────
// THE REPORTED BUG. Last session's playing item used to be restored to the
// FRONT of the queue, so an emptied queue came back non-empty — and a non-empty
// queue then took over autoplay.
store.clear();
localStorage.setItem(QUEUE_KEY, JSON.stringify({
  current: yt('wasplaying'),
  queue: [],
  history: [yt('older')],
  volume: 0.4,
}));
let loaded = loadState();
check(loaded.queue.length === 0, 'a queue emptied last session comes back empty',
  `${loaded.queue.length} item(s): ${loaded.queue.map((q) => q.title).join(', ')}`);
check(loaded.current === null, 'and nothing is playing on arrival');
check(loaded.history.some((h) => h.title === 'Video wasplaying'),
  '…but what was playing is reachable with Back, not lost',
  loaded.history.map((h) => h.title).join(', '));
check(!loaded.queueArmed, 'a restored queue is never armed');
check(loaded.volume === 0.4, 'volume survives a reload', String(loaded.volume));

// A queue the user really did build still comes back in full.
store.clear();
localStorage.setItem(QUEUE_KEY, JSON.stringify({
  current: yt('wasplaying'), queue: [yt('q1'), yt('q2')], history: [],
}));
loaded = loadState();
check(loaded.queue.length === 2, 'a real queue is restored in full', `${loaded.queue.length}`);
check(!loaded.queue.some((q) => q.title === 'Video wasplaying'),
  '…without the thing that happened to be playing pushed into it');
check(!loaded.queueArmed, '…and still unarmed until the user touches it');

// ── 3. the feed outranks the queue without eating it ────────────────────────
// The owner's rule: "the feed interrupts the queue. the queue gets put on
// standby until the user stops the feed … the user essentially would need to
// manually restart the queue for it to resume. the feed is the player's default
// state."
const built = run(INITIAL,
  { type: 'play', source: yt('mine1') },
  { type: 'enqueue', source: yt('mine2'), byUser: true },
  { type: 'enqueue', source: yt('mine3'), byUser: true });
check(built.queueArmed && built.queue.length === 2, 'a hand-built queue starts armed',
  `armed=${built.queueArmed} n=${built.queue.length}`);

const withFeed = run(built, { type: 'startFeed', sources: [yt('f1'), yt('f2'), yt('f3')] });
check(withFeed.feedActive, 'starting a feed takes over');
check(withFeed.current.title === 'Video f1', '…playing the first result', withFeed.current.title);
check(withFeed.queue.length === 2 && withFeed.queue.every((q) => q.title.startsWith('Video mine')),
  '…and the queue is untouched underneath, not replaced or drained',
  withFeed.queue.map((q) => q.title).join(', '));
check(!withFeed.queueArmed,
  '…but is no longer being followed, so it will not resume by itself');

// Walking the feed leaves the queue alone the whole way down.
let walked = run(withFeed, { type: 'feedNext' }, { type: 'feedNext' });
check(walked.current.title === 'Video f3', 'the feed walks in order', walked.current.title);
check(walked.queue.length === 2, '…without consuming the queue', `${walked.queue.length}`);
check(walked.feed.length === 0, '…and runs out at the end rather than looping',
  `${walked.feed.length} left`);
check(run(walked, { type: 'feedNext' }).current.title === 'Video f3',
  'an exhausted feed stays put — the player falls through to discovery instead');

// ── 3a. topping up a running feed (infinite-scroll pages growing it) ────────
// A feed page keeps loading more rows after startFeed already claimed
// `current` — re-calling startFeed for that would replay the "start where
// you already are" jump every time the page grows. appendFeed only ever
// adds to the tail and only while a feed is actually running.
const topped = run(withFeed, { type: 'appendFeed', sources: [yt('f4'), yt('f5')] });
check(topped.feed.length === 4 && topped.feed[topped.feed.length - 1].title === 'Video f5',
  'appendFeed grows the tail of a running feed', topped.feed.map((f) => f.title).join(', '));
check(topped.current.title === 'Video f1', '…without touching what is already playing');

const noDupe = run(withFeed, { type: 'appendFeed', sources: [yt('f1'), yt('f2'), yt('f6')] });
check(noDupe.feed.length === 3 && noDupe.feed.some((f) => f.title === 'Video f6'),
  '…and skips anything already current or already queued in the feed',
  noDupe.feed.map((f) => f.title).join(', '));

check(run(built, { type: 'appendFeed', sources: [yt('f1')] }).feed.length === 0,
  'appendFeed with no feed running is a no-op — nothing to top up');

// Every way a feed ends.
for (const [label, action] of [['Stop', { type: 'stop' }], ['Close', { type: 'close' }],
  ['stopFeed', { type: 'stopFeed' }]]) {
  const ended = run(withFeed, action);
  check(!ended.feedActive && ended.feed.length === 0, `${label} ends the feed`,
    `active=${ended.feedActive} left=${ended.feed.length}`);
  check(ended.queue.length === 2, `…and ${label} still leaves the queue intact`,
    `${ended.queue.length}`);
  check(!ended.queueArmed, `…unarmed, so it waits to be restarted by hand`);
}

// The queue comes back only when asked.
const resumed = run(run(withFeed, { type: 'stopFeed' }), { type: 'armQueue' });
check(resumed.queueArmed && resumed.queue.length === 2, 'the queue resumes on an explicit press',
  `armed=${resumed.queueArmed} n=${resumed.queue.length}`);

// A feed is this sitting's business, not a setting.
store.clear();
localStorage.setItem(QUEUE_KEY, JSON.stringify({
  current: yt('x'), queue: [yt('q')], history: [], feedActive: true, feed: [yt('f')],
}));
const afterReload = loadState();
check(!afterReload.feedActive && afterReload.feed.length === 0,
  'a feed never survives leaving Truegle',
  `active=${afterReload.feedActive} left=${afterReload.feed.length}`);

check(run(INITIAL, { type: 'startFeed', sources: [] }).feedActive === false,
  'a search with nothing playable starts no feed');

// ── 3b. pressing play on a saved list ───────────────────────────────────────
// REPORTED: "it did add to list but combined with que … there were no play
// buttons on the list". Both were the same missing statement of intent: the
// control went through enqueueMany, which APPENDS and — correctly for its other
// callers — never arms the queue. So a list pressed while something was queued
// was mixed into it, and once the first track ended autoplay ignored the
// unarmed queue and went off to discovery instead of playing the list.
{
  const mixed = run(INITIAL,
    { type: 'play', source: yt('other') },
    { type: 'enqueue', source: yt('leftover'), byUser: false });
  const played = run(mixed, { type: 'playList', sources: [yt('l1'), yt('l2'), yt('l3')] });
  check(played.current.title === 'Video l1', 'pressing play on a list starts it', played.current.title);
  check(played.queueArmed, '…and follows it, rather than wandering off after one track');
  check(played.queue.length === 2 && played.queue.every((q) => q.title.startsWith('Video l')),
    '…replacing what was queued rather than mixing into it',
    played.queue.map((q) => q.title).join(', '));
  check(played.history.some((h) => h.title === 'Video other'),
    '…with what was playing kept in history, not discarded');

  // A list outranks a running feed: pressing it is the person saying so.
  const overFeed = run(run(INITIAL, { type: 'startFeed', sources: [yt('f1'), yt('f2')] }),
    { type: 'playList', sources: [yt('l1')] });
  check(!overFeed.feedActive && overFeed.feed.length === 0,
    'a list pressed during a feed ends the feed');
  check(overFeed.queueArmed && overFeed.current.title === 'Video l1',
    '…and the list is what plays', overFeed.current.title);

  check(run(INITIAL, { type: 'playList', sources: [] }).current === null,
    'an empty list does nothing rather than clearing the player');
}

// ── 4. volume ───────────────────────────────────────────────────────────────
const ytCmds = volumeCommands('youtube', 0.5);
check(ytCmds.length === 2, 'YouTube gets a mute-state message and a level message', `${ytCmds.length}`);
check(ytCmds[0].payload.func === 'unMute',
  '…un-muting FIRST, because a muted embed ignores setVolume outright',
  ytCmds[0].payload.func);
check(ytCmds[1].payload.func === 'setVolume' && ytCmds[1].payload.args[0] === 50,
  '…and YouTube counts 0-100', JSON.stringify(ytCmds[1].payload.args));
check(volumeCommands('youtube', 0)[0].payload.func === 'mute',
  'dragging to zero mutes rather than setting an inaudible level');

const vim = volumeCommands('vimeo', 0.5);
check(vim.length === 1 && vim[0].payload.value === 0.5, 'Vimeo counts 0-1',
  JSON.stringify(vim[0]?.payload));
check(vim[0].targetOrigin === 'https://player.vimeo.com',
  '…and is addressed to its own origin, not to *', vim[0].targetOrigin);

check(volumeCommands('youtube', 5)[1].payload.args[0] === 100, 'levels above 1 clamp');
check(volumeCommands('youtube', -3)[1].payload.args[0] === 0, 'levels below 0 clamp');
check(volumeCommands('tiktok', 0.5).length === 0,
  'a platform with no channel gets no messages rather than a broken one');

// ── 5. the reducer still does what it did ───────────────────────────────────
// Guard rails: the queue rule touches enqueue/jump/clearQueue, all of which
// carry behaviour that predates it.
s = run(INITIAL, { type: 'enqueue', source: yt('a'), byUser: true });
check(!!s.current && s.queue.length === 0, 'queueing into an idle player plays it instead',
  `current=${!!s.current} queue=${s.queue.length}`);
s = run(s, { type: 'enqueue', source: yt('a'), byUser: true });
check(s.queue.length === 0, 'the same item is not queued twice', `${s.queue.length}`);
s = run(INITIAL, { type: 'play', source: yt('a') }, { type: 'setVolume', value: 2 });
check(s.volume === 1, 'volume clamps in the reducer too', String(s.volume));

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
