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

// ── 3. volume ───────────────────────────────────────────────────────────────
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

// ── 4. the reducer still does what it did ───────────────────────────────────
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
