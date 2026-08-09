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
export { BIOMES, EVENTS, ENDINGS, ITEMS };

// THE ECONOMY, and the mistake worth not repeating.
//
// The first tuning gave a clean run just enough to arrive. It simulated as
// 120 wins out of 120 — because every encounter was then pure upside, and a
// game where the choices only ever help is a game with no choices in it.
//
// So the road now costs MORE than you can carry: roughly 38 fuel and 21 water
// to cover 500 miles, against the 20 and 12 you leave with. You cannot drive
// this on what you start with. Scavenging is not a bonus, it is the game, and
// every scavenge is a risk you are made to take rather than one you may
// decline. Food is deliberately the one resource that nearly covers itself —
// something has to have slack or every choice collapses into the same choice.
//
// All of it lives in biomes.json. Retuning is a text edit, and the simulation
// in verify-trail re-checks the win rate.

export function newRun(seed = Date.now()) {
  return {
    seed,
    dist: 0,
    hp: MAX_HP,
    res: { ...START },
    biome: 0,
    phase: 'travel',       // travel | event | over
    event: null,
    outcome: null,
    ending: null,
    log: [],
    nextEventAt: 18 + (seed % 14),
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

/**
 * Advance one step of road.
 *
 * Returns the mutated run. The caller decides how often to call it, which is
 * what makes speed a presentation concern rather than a rules one — and means
 * a test can run 500 steps instantly.
 */
export function travel(run, steps = 1) {
  if (run.phase !== 'travel') return run;
  const b = BIOMES[biomeAt(run.dist)];
  run.biome = biomeAt(run.dist);

  for (let i = 0; i < steps; i += 1) {
    run.dist += 1;
    for (const k of Object.keys(b.drain)) {
      run.res[k] = Math.max(0, run.res[k] - b.drain[k]);
    }

    // Running out is not instant death — it is a bleed, so there is a window
    // in which an event can still save you. Instant death on an empty tank
    // would make the last 20 units of a good run unwinnable with no warning.
    let starving = false;
    for (const k of ['fuel', 'water', 'food']) {
      if (run.res[k] <= 0) { starving = true; run.dying = k; }
    }
    // 0.09/unit is ~110 miles of bleeding out from full. Long enough to be
    // rescued by an encounter, short enough that an empty tank is a crisis.
    if (starving) run.hp -= 0.09;
    else if (run.hp < MAX_HP) run.hp = Math.min(MAX_HP, run.hp + 0.004); // slow mend

    if (run.hp <= 0) {
      run.hp = 0;
      run.phase = 'over';
      run.ending = ENDINGS[run.dying || 'hp'] ? (run.dying || 'hp') : 'hp';
      return run;
    }
    if (run.dist >= TOTAL) {
      run.dist = TOTAL;
      run.phase = 'over';
      run.ending = 'arrive';
      return run;
    }
    if (run.dist >= run.nextEventAt) {
      run.phase = 'event';
      run.event = pickEvent(run);
      run.outcome = null;
      return run;
    }
  }
  return run;
}

// Weighted pick from the events that apply here, avoiding the last few so a
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

/** Apply a choice. Returns { text, deltas } for the UI to show. */
export function choose(run, index) {
  if (run.phase !== 'event' || !run.event) return run;
  const c = run.event.choices[index];
  if (!c) return run;

  const failed = typeof c.risk === 'number' && rand(run) < c.risk;
  const deltas = { ...(c.cost ? negate(c.cost) : {}) };
  const branch = failed ? c.fail : c.win;
  for (const [k, v] of Object.entries(branch || {})) {
    deltas[k] = (deltas[k] || 0) + v;
  }

  for (const [k, v] of Object.entries(deltas)) {
    if (k === 'hp') run.hp = clamp(run.hp + v, 0, MAX_HP);
    else if (k in run.res) run.res[k] = Math.max(0, run.res[k] + v);
  }

  run.log.push(run.event.id);
  run.outcome = {
    text: (failed ? c.failText : c.text) || c.text || '',
    deltas,
    failed,
  };
  run.phase = 'outcome';

  if (run.hp <= 0) { run.phase = 'over'; run.ending = 'hp'; }
  return run;
}

/** Leave the outcome screen and get back on the road. */
export function resume(run) {
  if (run.phase !== 'outcome') return run;
  run.phase = 'travel';
  run.event = null;
  // Next encounter 14–34 units out. Tight enough that the road never feels
  // empty, loose enough that it is not a metronome.
  run.nextEventAt = run.dist + 14 + Math.floor(rand(run) * 20);
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
