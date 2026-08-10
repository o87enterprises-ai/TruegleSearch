import BIOMES from './content/biomes.json';
import EVENTS from './content/events.json';
import ENDINGS from './content/endings.json';
import ITEMS from './content/items.json';

// The rules. No drawing in here, so the whole game is testable without a
// canvas — which is the only reason a game this small gets tested at all.

export const TOTAL = 500;
export const START = { fuel: 20, water: 12, food: 15, meds: 5 };
export const MAX_HP = 10;
export const RESOURCES = ['fuel', 'water', 'food', 'meds'];
export const MAX_SPEED = 10;
export const BASE_SPEED = 0.5;      // distance units per second, per point of speed
export const EVENT_SECONDS = 5;     // decide inside this or the vehicle brakes for you
export const CRAWL = 2;             // speed the vehicle is held to during an encounter
export const OUTCOME_SECONDS = 3.5; // how long the result card holds before clearing itself
export { BIOMES, EVENTS, ENDINGS, ITEMS };

// ── THE ECONOMY ────────────────────────────────────────────────────────────
//
// Two mistakes are recorded here because both are easy to make again.
//
// FIRST: the original tuning let a clean run reach the end. It simulated as
// 120 wins from 120, because every encounter was then pure upside — and a game
// whose choices only ever help has no choices in it. The road costs more than
// you can carry, so scavenging is the game rather than a bonus.
//
// SECOND, and this one is about the speed dial: if fuel, water and food all
// drained per MILE, then crawling would be free and the optimal play would be
// speed 1 for the whole run. A dial with one good end is not a dial. So the
// two costs are measured in different currencies:
//
//   FUEL  is spent per MILE, multiplied by 1 + speed/5. Going fast costs more
//         fuel to cover the same ground.
//   WATER and FOOD are spent per SECOND. Going slow costs more supplies to
//         cover the same ground.
//
// That is the real trade the original game made — pace against provisions —
// and it means neither end of the dial is safe. Flat out you run dry; crawling
// you go thirsty. Every number lives in biomes.json.
export function newRun(seed = Date.now()) {
  return {
    seed,
    dist: 0,
    hp: MAX_HP,
    res: { ...START },
    biome: 0,
    speed: 0,
    targetSpeed: 0,
    phase: 'travel',       // travel | event | outcome | over
    event: null,
    outcome: null,
    ending: null,
    log: [],
    eventLeft: 0,          // seconds remaining on the current encounter
    outcomeLeft: 0,        // …and on the result card, which clears itself
    obstacleAt: 0,         // distance at which the obstacle sits
    nextEventAt: 18 + (seed % 14),
    elapsed: 0,
  };
}

export const biomeAt = (dist) => {
  let acc = 0;
  for (let i = 0; i < BIOMES.length; i += 1) {
    acc += BIOMES[i].distance;
    if (dist < acc) return i;
  }
  return BIOMES.length - 1;
};

/** Where the current biome starts, so parallax can measure from it. */
export const biomeStart = (i) => BIOMES.slice(0, i).reduce((a, b) => a + b.distance, 0);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Fuel penalty for pace. Spelled out so the UI can show it. */
export const fuelMultiplier = (speed) => 1 + speed / 5;

/**
 * How far apart encounters fall, in miles. Faster driving means less warning:
 * you cover the gap sooner AND the gap itself shrinks.
 */
export const eventGap = (speed) => Math.max(10, 30 - speed);

export function setThrottle(run, target) {
  run.targetSpeed = clamp(target, 0, MAX_SPEED);
  return run;
}

/**
 * Advance the world by `dt` seconds.
 *
 * Time-based rather than step-based, because speed made distance-per-frame a
 * variable. A test can still run a whole journey instantly by calling it with
 * a large dt in a loop — the physics does not care how big the slices are, as
 * long as they are small enough that a fuel-out is noticed within one.
 */
export function travel(run, dt) {
  if (run.phase === 'over') return run;

  // The outcome card holds the world for a beat so the result can be read,
  // then clears itself. It used to wait for a press, which meant an
  // encounter you ignored left you parked on a results screen indefinitely —
  // a dead stop in the middle of a game whose whole premise is that it does
  // not stop. Tapping still skips it immediately.
  if (run.phase === 'outcome') {
    run.outcomeLeft -= dt;
    if (run.outcomeLeft <= 0) resume(run);
    return run;
  }
  const bi = biomeAt(run.dist);
  const b = BIOMES[bi];
  run.biome = bi;
  run.elapsed += dt;

  // During an encounter the vehicle is held to a crawl rather than frozen.
  // The brief asked for real time, and a hard pause is what makes a "choose
  // quickly" prompt feel like a lie.
  const wanted = run.phase === 'event' ? Math.min(run.targetSpeed, CRAWL) : run.targetSpeed;
  // Braking bites harder than the throttle. A vehicle that stops as slowly as
  // it starts cannot be used to avoid anything.
  const rate = wanted < run.speed ? 7 : 3.2;
  const delta = wanted - run.speed;
  run.speed += clamp(delta, -rate * dt, rate * dt);
  if (Math.abs(wanted - run.speed) < 0.02) run.speed = wanted;

  const moved = BASE_SPEED * run.speed * dt;
  run.dist += moved;

  // Per mile, penalised by pace.
  run.res.fuel = Math.max(0, run.res.fuel - b.drain.fuel * moved * fuelMultiplier(run.speed));
  // Per second, whether or not you are moving.
  run.res.water = Math.max(0, run.res.water - b.drain.water * dt);
  run.res.food = Math.max(0, run.res.food - b.drain.food * dt);

  // Running out is a bleed, not a guillotine: there has to be a window in
  // which an encounter can still save you. Instant death on an empty tank
  // makes the last stretch of a good run unwinnable with no warning.
  let out = null;
  for (const k of ['fuel', 'water', 'food']) if (run.res[k] <= 0) out = k;
  // 0.35/s is roughly half a minute from full — about eighty miles at a
  // middling pace. Long enough that an encounter can still rescue you,
  // short enough that an empty tank is a crisis rather than a footnote.
  if (out) { run.dying = out; run.hp -= 0.35 * dt; } else if (run.hp < MAX_HP) run.hp = Math.min(MAX_HP, run.hp + 0.06 * dt);

  // An empty tank also means you are not going anywhere.
  if (run.res.fuel <= 0) { run.targetSpeed = 0; run.speed = Math.max(0, run.speed - 6 * dt); }

  if (run.hp <= 0) {
    run.hp = 0;
    run.phase = 'over';
    run.ending = ENDINGS[run.dying] ? run.dying : 'hp';
    return run;
  }
  if (run.dist >= TOTAL) {
    run.dist = TOTAL;
    run.phase = 'over';
    run.ending = 'arrive';
    return run;
  }

  if (run.phase === 'event') {
    run.eventLeft -= dt;
    // Time ran out. The vehicle brakes for you — the safe option, and the one
    // that costs ground, which is the right default for indecision.
    if (run.eventLeft <= 0) return choose(run, defaultChoice(run.event));
    return run;
  }

  if (run.dist >= run.nextEventAt) {
    run.phase = 'event';
    run.event = pickEvent(run);
    run.eventLeft = EVENT_SECONDS;
    // The obstacle sits a little way ahead so it can be seen coming.
    run.obstacleAt = run.dist + 14;
    run.outcome = null;
  }
  return run;
}

/** The option taken when the timer runs out: braking, or failing that the safest. */
export function defaultChoice(event) {
  if (!event) return 0;
  const brake = event.choices.findIndex((c) => c.cost?.distance);
  if (brake >= 0) return brake;
  let safest = 0; let lowest = Infinity;
  event.choices.forEach((c, i) => { const r = c.risk || 0; if (r < lowest) { lowest = r; safest = i; } });
  return safest;
}

// Weighted pick from the events that apply here, skipping the last few so a
// short run does not show the same encounter twice.
function pickEvent(run) {
  const id = BIOMES[biomeAt(run.dist)].id;
  const recent = run.log.slice(-4);
  let pool = EVENTS.filter((e) => (e.biome === id || e.biome === '*') && !recent.includes(e.id));
  if (!pool.length) pool = EVENTS.filter((e) => e.biome === id || e.biome === '*');
  const total = pool.reduce((a, e) => a + (e.weight || 1), 0);
  let r = rand(run) * total;
  for (const e of pool) {
    r -= (e.weight || 1);
    if (r <= 0) return e;
  }
  return pool[pool.length - 1];
}

// Run-seeded RNG, advanced on the run itself so the same seed replays
// identically — which is what makes a bug in an event reproducible.
function rand(run) {
  run.seed = (run.seed * 1103515245 + 12345) & 0x7fffffff;
  return run.seed / 0x7fffffff;
}

/** Apply a choice. Sets run.outcome for the UI to show. */
export function choose(run, index) {
  if (run.phase !== 'event' || !run.event) return run;
  const c = run.event.choices[index];
  if (!c) return run;

  const failed = typeof c.risk === 'number' && rand(run) < c.risk;
  const deltas = { ...(c.cost ? negate(c.cost) : {}) };
  for (const [k, v] of Object.entries((failed ? c.fail : c.win) || {})) {
    deltas[k] = (deltas[k] || 0) + v;
  }

  for (const [k, v] of Object.entries(deltas)) {
    if (k === 'hp') run.hp = clamp(run.hp + v, 0, MAX_HP);
    // Ground lost. Braking hard for a boulder puts you behind, which is what
    // makes the safe option cost something rather than being free.
    else if (k === 'distance') run.dist = Math.max(0, run.dist + v);
    else if (k in run.res) run.res[k] = Math.max(0, run.res[k] + v);
  }

  run.log.push(run.event.id);
  run.outcome = { text: (failed ? c.failText : c.text) || c.text || '', deltas, failed };
  run.phase = 'outcome';
  run.eventLeft = 0;
  run.outcomeLeft = OUTCOME_SECONDS;

  if (run.hp <= 0) { run.phase = 'over'; run.ending = 'hp'; }
  return run;
}

/** Leave the outcome card and get back on the road. */
export function resume(run) {
  if (run.phase !== 'outcome') return run;
  run.phase = 'travel';
  run.event = null;
  run.obstacleAt = 0;
  // Measured from the speed you were carrying: press on and the next one
  // arrives sooner, which is the cost of hurrying that is not fuel.
  run.nextEventAt = run.dist + eventGap(run.speed) + Math.floor(rand(run) * 8);
  return run;
}

const negate = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, -v]));

// ── persistence ────────────────────────────────────────────────────────────
// Both flags the owner asked for, and nothing else. It stays in this browser:
// a hidden game on a 404 page is the last place that should be reporting
// anything about anybody.
const KEY = 'truegle_trail_v1';

export function readStats() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { best: Number(s.best) || 0, runs: Number(s.runs) || 0 };
  } catch { return { best: 0, runs: 0 }; }
}

export function writeStats(run) {
  try {
    const s = readStats();
    localStorage.setItem(KEY, JSON.stringify({
      best: Math.max(s.best, Math.round(run.dist)),
      runs: s.runs + 1,
    }));
  } catch { /* private mode — the run still counted, just not for next time */ }
}
