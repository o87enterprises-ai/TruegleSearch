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
  newRun, travel, choose, resume, setThrottle, defaultChoice, choiceValue, fuelMultiplier, eventGap,
  TOTAL, MAX_HP, START, BIOMES, EVENTS, ENDINGS, MAX_SPEED, EVENT_SECONDS, WARN_AT,
} from '../src/games/trail/state.js';

const DT = 1 / 30; // the slice the sim advances by, ~a frame

// How long the bot spends on an encounter before committing, in seconds.
//
// This has to be a DURATION rather than a threshold on the clock, or the sim
// silently re-tunes itself every time the decision window changes: the old
// test decided at `eventLeft < 4.2`, which meant 0.8 s of thought at a 5 s
// window and would have meant 35.8 s of it at 40 s — measuring a player who
// dithers to the buzzer every single time and calling it the balance.
const THINK = 0.8;
// …and a second, slower bot. A real person reads the prose before choosing,
// and every one of those seconds is water. If the game only balances for
// somebody who answers instantly, it does not balance.
const DELIBERATE = 8;

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

// localStorage does not exist in node; the persistence helpers already swallow
// that, but stub it so a stray call cannot mask a real failure.
globalThis.localStorage = { getItem: () => null, setItem: () => {} };

/**
 * Play a whole run.
 *
 * `pace` is either a fixed number or a function of the run — because the
 * speed dial is half the game, and a bot that never touches it measures
 * something other than how the game plays. Both are used below: the fixed-pace
 * bot shows what ignoring the dial costs, the adaptive one stands in for
 * somebody who is paying attention.
 */
function play(seed, pick, pace = 6, think = THINK) {
  const run = newRun(seed);
  const setPace = () => setThrottle(run, typeof pace === 'function' ? pace(run) : pace);
  setPace();
  let guard = 0;
  while (run.phase !== 'over' && guard < 400000) {
    guard += 1;
    if (run.phase === 'outcome') resume(run);
    else if (run.phase === 'event' && run.eventLeft <= EVENT_SECONDS - think) choose(run, pick(run));
    else travel(run, DT);
    setPace();
  }
  if (guard >= 400000) bad.push(`FAIL run ${seed} never terminates`);
  return run;
}

// What a thinking player does: ease off when the tank is the problem (a lower
// multiplier stretches every litre), press on when the canteen is (less time
// on the road means less drunk). This is the dial being USED.
const adaptive = (run) => {
  const left = TOTAL - run.dist;
  if (left <= 0) return 6;
  const fuelPerMile = run.res.fuel / left;
  const waterSeconds = run.res.water / 0.07;      // rough, biome-averaged
  const secondsLeft = left / (0.5 * Math.max(1, run.speed));
  if (run.res.fuel < 3) return 3;                 // limp
  if (fuelPerMile < 0.05) return 4;               // fuel is the binding one
  if (waterSeconds < secondsLeft * 0.8) return 9; // thirst is: hurry
  return 6;
};

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

// ── 2. the speed dial has to have two bad ends ─────────────────────────────
// If crawling were free, the optimal play would be speed 1 forever and the
// dial would be decoration. Fuel is charged per MILE (worse fast); water and
// food per SECOND (worse slow). Both ends must therefore hurt.
function dryRun(pace) {
  const run = newRun(1);
  setThrottle(run, pace);
  run.nextEventAt = Infinity;         // no encounters, no resupply
  let guard = 0;
  while (run.phase === 'travel' && run.dist < TOTAL && guard < 400000) {
    guard += 1; travel(run, DT); setThrottle(run, pace); run.nextEventAt = Infinity;
  }
  return run;
}
const slow = dryRun(2);
const mid = dryRun(6);
const fast = dryRun(10);

check(mid.dist < TOTAL,
  'a no-event run CANNOT reach the end — scavenging is mandatory, not a bonus',
  `stalled at ${Math.round(mid.dist)} of ${TOTAL}`);
check(mid.dist > TOTAL * 0.25, '...but it gets a fair way, so the opening is not hopeless', `${Math.round(mid.dist)} mi`);
check(fast.dying === 'fuel', 'flat out, it is FUEL that kills you', `died of ${fast.dying} at ${Math.round(fast.dist)} mi`);
check(slow.dying === 'water' || slow.dying === 'food',
  'crawling, it is WATER or FOOD that kills you — so slow is not free',
  `died of ${slow.dying} at ${Math.round(slow.dist)} mi`);
check(fuelMultiplier(0) === 1 && fuelMultiplier(10) === 3, 'the fuel penalty matches the brief (1 + speed/5)');
check(eventGap(0) === 30 && eventGap(10) === 20 && eventGap(25) === 10,
  'encounter spacing matches the brief (max(10, 30 - speed))');

// There must be a middle that beats both ends, or the dial still has one
// right answer — it is just a different one.
check(mid.dist > slow.dist && mid.dist > fast.dist,
  'a middle pace beats both extremes, so the dial is a real decision',
  `slow ${Math.round(slow.dist)} · mid ${Math.round(mid.dist)} · fast ${Math.round(fast.dist)}`);

// ── 3. across many seeds it is winnable, and losable ───────────────────────
const outcomes = { arrive: 0, dead: 0 };
const reached = [];
for (let seed = 1; seed <= 120; seed += 1) {
  const r = play(seed * 7919, greedy, adaptive);
  reached.push(r.dist);
  if (r.ending === 'arrive') outcomes.arrive += 1; else outcomes.dead += 1;
}

// Driving the dial has to beat ignoring it, or half the v2 brief is decoration.
let fixedWins = 0;
for (let seed = 1; seed <= 120; seed += 1) {
  if (play(seed * 7919, greedy, 6).ending === 'arrive') fixedWins += 1;
}
check(outcomes.arrive > fixedWins,
  'using the speed dial beats holding one pace the whole way',
  `adaptive ${outcomes.arrive} vs fixed ${fixedWins}`);
check(outcomes.arrive > 0, 'a good player CAN arrive', `${outcomes.arrive}/120 wins`);
check(outcomes.dead > 0, 'a good player can still die — it is not a walk', `${outcomes.dead}/120 losses`);
const winRate = outcomes.arrive / 120;
check(winRate >= 0.15 && winRate <= 0.7,
  'the win rate sits in a band where arriving means something',
  `${Math.round(winRate * 100)}% — want 15-70%`);
const avg = Math.round(reached.reduce((a, b) => a + b, 0) / reached.length);
check(avg > 120, 'the average run gets meaningfully down the road', `avg ${avg} mi`);

// The window is forty seconds now, and the bot above answers in under one.
// Somebody who actually READS the prompt spends eight, at a crawl, with the
// canteen draining per second — so the game has to still be winnable for them
// or the generous timer has quietly made it unwinnable.
let slowWins = 0; const slowReached = [];
for (let seed = 1; seed <= 120; seed += 1) {
  const r = play(seed * 7919, greedy, adaptive, DELIBERATE);
  slowReached.push(r.dist);
  if (r.ending === 'arrive') slowWins += 1;
}
const slowRate = slowWins / 120;
check(slowRate >= 0.1 && slowRate <= 0.7,
  'a player who READS every prompt can still arrive — the long window has not broken the economy',
  `${Math.round(slowRate * 100)}% at ${DELIBERATE}s/decision vs ${Math.round(winRate * 100)}% at ${THINK}s`);
check(slowWins <= outcomes.arrive,
  'taking longer over a decision costs something, so the clock is not decoration',
  `deliberate ${slowWins} vs decisive ${outcomes.arrive}`);

// Careless play should do clearly worse than considered play. If it does not,
// the choices are decoration.
let carelessWins = 0;
for (let seed = 1; seed <= 120; seed += 1) {
  if (play(seed * 7919, first, adaptive).ending === 'arrive') carelessWins += 1;
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

// ── 7. the v2 additions ────────────────────────────────────────────────────
const obstacles = EVENTS.filter((e) => e.type === 'obstacle');
check(obstacles.length >= 3, 'there are obstacle events to draw', `${obstacles.length}`);
check(obstacles.every((e) => e.obstacleSprite), 'every obstacle names a sprite to draw');
check(obstacles.every((e) => e.choices.some((c) => c.cost?.distance)),
  'every obstacle offers a BRAKE that costs ground — the safe option must cost something');

// ── the decision window, and what running it out costs ─────────────────────
check(EVENT_SECONDS >= 30 && EVENT_SECONDS <= 60,
  'the decision window is long enough to READ the prompt before answering it',
  `${EVENT_SECONDS}s — want 30-60`);
check(WARN_AT > 0 && WARN_AT < 1, 'the warning starts partway through, not at the buzzer', `${WARN_AT * 100}%`);

// The reversal. This used to assert the opposite — that timing out braked for
// you — which was right at five seconds and wrong at forty: a generous window
// plus a safe default means never choosing is a viable strategy.
check(EVENTS.every((e) => {
  const vals = e.choices.map((c) => choiceValue(c));
  return vals.every((v) => v >= vals[defaultChoice(e)] - 1e-9);
}), 'the timer takes the option worth LEAST to the run — the worst one on the board');
check(obstacles.every((e) => defaultChoice(e) !== e.choices.findIndex((c) => c.cost?.distance)),
  '…so it never hands you the cautious option for free',
  obstacles.filter((e) => defaultChoice(e) === e.choices.findIndex((c) => c.cost?.distance)).map((e) => e.id).join(',') || 'all ok');

// Every event has to have a worst answer worth avoiding, or the penalty for
// running out of time is nothing on that event and the clock is a bluff.
check(EVENTS.every((e) => Math.max(...e.choices.map((c) => choiceValue(c))) > choiceValue(e.choices[defaultChoice(e)])),
  'on every event there is something better than the default, so the clock always matters',
  EVENTS.filter((e) => Math.max(...e.choices.map((c) => choiceValue(c))) <= choiceValue(e.choices[defaultChoice(e)])).map((e) => e.id).join(',') || 'all ok');

// And the price of a thing depends on how much of it you have left.
const dry = newRun(3); dry.res.water = 1;
const pump = EVENTS.find((e) => e.id === 'dry-well').choices[0];
check(choiceValue(pump, dry) > choiceValue(pump, newRun(3)),
  'the default is state-aware: water is worth more when the canteen is nearly empty',
  `${Math.round(choiceValue(pump, dry))} thirsty vs ${Math.round(choiceValue(pump, newRun(3)))} full`);

// Losing ground has to actually lose ground.
const dRun = newRun(9);
setThrottle(dRun, 5);
while (dRun.phase !== 'event') travel(dRun, DT);
const before = dRun.dist;
const brakeIdx = dRun.event.choices.findIndex((c) => c.cost?.distance);
if (brakeIdx >= 0) {
  choose(dRun, brakeIdx);
  check(dRun.dist < before, 'a distance cost moves you BACKWARDS down the road',
    `${Math.round(before)} -> ${Math.round(dRun.dist)}`);
} else {
  check(true, 'a distance cost moves you backwards (no braking option in this seed)');
}

// The RESULT card must clear itself too. Waiting for a press there parks an
// inattentive player on a results screen forever, in a game that is supposed
// not to stop.
const oRun = newRun(13);
setThrottle(oRun, 5);
while (oRun.phase !== 'event') travel(oRun, DT);
choose(oRun, 0);
let oSpins = 0;
while (oRun.phase === 'outcome' && oSpins < 1000) { travel(oRun, DT); oSpins += 1; }
check(oRun.phase !== 'outcome', 'the result card clears itself after a beat', `${oSpins} frames`);

// The timer must resolve on its own, or "real time" is a claim rather than a rule.
// The guard is derived from the window rather than hard-coded, so lengthening
// the window cannot turn this into a false failure.
const LIMIT = Math.ceil(EVENT_SECONDS / DT) + 100;
const tRun = newRun(11);
setThrottle(tRun, 5);
while (tRun.phase !== 'event') travel(tRun, DT);
const thirstBefore = tRun.res.water;
let spins = 0;
while (tRun.phase === 'event' && spins < LIMIT) { travel(tRun, DT); spins += 1; }
check(tRun.phase !== 'event', 'an ignored encounter resolves itself when the clock runs out', `${spins} frames`);
check(spins * DT > 30, '…but not before the player has had time to read it', `${(spins * DT).toFixed(1)}s`);
check(!!tRun.outcome?.text, '…and it leaves an outcome card to read', tRun.outcome?.text || 'none');
// Dithering is not free even before the worst option lands: the vehicle is
// held to a crawl for the whole window and the canteen drains per second.
check(tRun.res.water < thirstBefore - 1,
  'sitting on the decision costs real supplies, not just the clock',
  `water ${thirstBefore.toFixed(1)} -> ${tRun.res.water.toFixed(1)}`);

check(MAX_SPEED === 10, 'speed range matches the brief');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
