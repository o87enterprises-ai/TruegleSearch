/* TRAIL's rules, simulated.
 *
 * state.js is pure — no canvas, no DOM — which is the only reason a game this
 * small gets tested at all. Beyond catching crashes, this is a BALANCE test:
 * it plays 120 runs with a considered policy and 120 careless ones, and fails
 * if arriving becomes a formality or an impossibility. The first tuning
 * simulated 120 wins out of 120 and this is what caught it.
 *
 * Run it (JSON imports need bundling for node):
 *   npx esbuild scripts/verify-trail.mjs --bundle --format=esm --platform=node \
 *     --outfile=/tmp/trail-test.mjs && node /tmp/trail-test.mjs
 */
import {
  newRun, travel, choose, resume, TOTAL, MAX_HP, START, BIOMES, EVENTS, ENDINGS,
} from '../src/games/trail/state.js';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

// localStorage does not exist in node; the persistence helpers already swallow
// that, but stub it so a stray call cannot mask a real failure.
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

/** Play a whole run with a given choice policy. Returns the finished run. */
function play(seed, pick) {
  const run = newRun(seed);
  let guard = 0;
  while (run.phase !== 'over' && guard < 200000) {
    guard += 1;
    if (run.phase === 'travel') travel(run, 1);
    else if (run.phase === 'event') choose(run, pick(run));
    else if (run.phase === 'outcome') resume(run);
  }
  if (guard >= 200000) bad.push(`FAIL run ${seed} never terminates`);
  return run;
}

const first = () => 0;
const greedy = (run) => {
  // Take the choice that adds the most of whatever is scarcest.
  const need = ['fuel', 'water', 'food'].sort((a, b) => run.res[a] - run.res[b])[0];
  let best = 0; let bestScore = -Infinity;
  run.event.choices.forEach((c, i) => {
    const gain = (c.win?.[need] || 0) - (c.cost?.[need] || 0) - (c.risk || 0) * 2 + (c.win?.hp || 0);
    if (gain > bestScore) { bestScore = gain; best = i; }
  });
  return best;
};

// ── 1. content integrity ───────────────────────────────────────────────────
const ids = EVENTS.map((e) => e.id);
check(new Set(ids).size === ids.length, 'no duplicate event ids');
const biomeIds = new Set(BIOMES.map((b) => b.id));
check(EVENTS.every((e) => e.biome === '*' || biomeIds.has(e.biome)),
  'every event targets a real biome',
  EVENTS.filter((e) => e.biome !== '*' && !biomeIds.has(e.biome)).map((e) => e.id).join(',') || 'all ok');
check(EVENTS.every((e) => e.choices?.length >= 2 || e.choices?.length === 1),
  'every event offers at least one choice');
check(EVENTS.every((e) => e.choices.every((c) => c.label && (c.text || c.failText))),
  'every choice has a label and something to say');
check(EVENTS.every((e) => e.choices.every((c) => !c.risk || c.failText)),
  'every RISKY choice has failure text — otherwise a failure reads as a success',
  EVENTS.flatMap((e) => e.choices.filter((c) => c.risk && !c.failText).map(() => e.id)).join(',') || 'all ok');
check(BIOMES.reduce((a, b) => a + b.distance, 0) === TOTAL,
  'the biomes add up to the full journey',
  `${BIOMES.reduce((a, b) => a + b.distance, 0)} vs ${TOTAL}`);
check(['arrive', 'hp', 'fuel', 'water', 'food'].every((k) => ENDINGS[k]?.title && ENDINGS[k]?.lines?.length),
  'every ending the code can reach has text');

// ── 2. the economy is tight but not impossible ─────────────────────────────
// A run with NOTHING going wrong must nearly-but-not-quite exhaust you: that
// is what makes scavenging the game instead of decoration.
const dry = newRun(1);
let steps = 0;
dry.nextEventAt = Infinity; // suppress encounters
while (dry.phase === 'travel' && dry.dist < TOTAL && steps < 5000) {
  // NB: do NOT reset phase inside the loop. An earlier version forced
  // phase='travel' every iteration to keep encounters suppressed, which
  // quietly resurrected a run that had already died and marched the corpse to
  // 500 miles — the assertion below then failed for a reason that had nothing
  // to do with the game.
  travel(dry, 1); steps += 1;
}
// THE CORE INVARIANT. If you CAN drive 500 miles on what you start with, then
// every encounter is a bonus, scavenging is optional, and the choices are
// decoration. The first tuning failed exactly here and simulated 120/120 wins.
check(dry.dist < TOTAL,
  'a no-event run CANNOT reach the end — scavenging is mandatory, not a bonus',
  `stalled at ${Math.round(dry.dist)} of ${TOTAL}`);
check(dry.dist > TOTAL * 0.3,
  '...but it gets a fair way, so the opening is not hopeless',
  `${Math.round(dry.dist)} mi`);
check(dry.res.food > dry.res.fuel,
  'food is the loose resource, so not every choice is the same choice',
  `food ${dry.res.food.toFixed(1)} vs fuel ${dry.res.fuel.toFixed(1)}`);

// ── 3. across many seeds it is winnable, and losable ───────────────────────
const outcomes = { arrive: 0, dead: 0 };
const reached = [];
for (let seed = 1; seed <= 120; seed += 1) {
  const r = play(seed * 7919, greedy);
  reached.push(r.dist);
  if (r.ending === 'arrive') outcomes.arrive += 1; else outcomes.dead += 1;
}
check(outcomes.arrive > 0, 'a good player CAN arrive', `${outcomes.arrive}/120 wins`);
check(outcomes.dead > 0, 'a good player can still die — it is not a walk', `${outcomes.dead}/120 losses`);
const winRate = outcomes.arrive / 120;
check(winRate >= 0.15 && winRate <= 0.7,
  'the win rate sits in a band where arriving means something',
  `${Math.round(winRate * 100)}% — want 15-70%`);
const avg = Math.round(reached.reduce((a, b) => a + b, 0) / reached.length);
check(avg > 120, 'the average run gets meaningfully down the road', `avg ${avg} mi`);

// Careless play should do clearly worse than considered play. If it does not,
// the choices are decoration.
let carelessWins = 0;
for (let seed = 1; seed <= 120; seed += 1) {
  if (play(seed * 7919, first).ending === 'arrive') carelessWins += 1;
}
check(carelessWins < outcomes.arrive,
  'thinking about the choices beats taking the first one every time',
  `careless ${carelessWins} vs considered ${outcomes.arrive}`);

// ── 4. invariants that must never break ────────────────────────────────────
let sane = true; let why = '';
for (let seed = 1; seed <= 60; seed += 1) {
  const run = newRun(seed * 104729);
  let guard = 0;
  while (run.phase !== 'over' && guard < 50000) {
    guard += 1;
    if (run.phase === 'travel') travel(run, 1);
    else if (run.phase === 'event') choose(run, greedy(run));
    else if (run.phase === 'outcome') resume(run);
    if (run.hp > MAX_HP + 1e-9) { sane = false; why = `hp ${run.hp} > max`; break; }
    if (Object.values(run.res).some((v) => v < -1e-9)) { sane = false; why = 'negative resource'; break; }
    if (run.dist > TOTAL) { sane = false; why = `dist ${run.dist} > total`; break; }
  }
  if (!sane) break;
}
check(sane, 'health never exceeds max, resources never go negative, distance never overshoots', why);

// ── 5. the same seed replays identically ───────────────────────────────────
const a = play(424242, greedy);
const b = play(424242, greedy);
check(a.dist === b.dist && a.ending === b.ending && a.log.join() === b.log.join(),
  'a seed replays exactly, so any bug in an event is reproducible',
  `${a.ending}@${a.dist} vs ${b.ending}@${b.dist}`);

// ── 6. running out is a bleed, not a guillotine ────────────────────────────
// There has to be a window in which an encounter can still save you.
const starved = newRun(5);
starved.res.fuel = 0;
const hp0 = starved.hp;
travel(starved, 10);
check(starved.hp < hp0 && starved.hp > 0,
  'an empty tank drains health rather than killing instantly',
  `hp ${hp0} -> ${starved.hp.toFixed(2)}`);
check(START.fuel === 20 && START.water === 12 && START.food === 15 && START.meds === 5,
  'starting amounts match the locked decision sheet');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
