// THE SWEEP — a supermarket, mostly picked over, and a noise meter.
//
// The lesson is knowing when to leave. Every shelf you force costs noise, the
// meter is always on screen, and the door is always open — so the game never
// tells you to stop, it just makes stopping a decision you have to make. Fill
// the meter and somebody comes, and they take half of what you were carrying,
// which is the cheapest way to teach "do not be greedy" that does not require
// killing the player for it.

export const meta = {
  id: 'scavenge',
  title: 'THE SWEEP',
  seconds: 45,
  hint: 'MOVE  ·  HOLD ENTER OR A SHELF  ·  E OR THE DOOR TO LEAVE',
  axis: 'step',
  lesson: 'Noise brings company. Take what you need and go.',
};

export const COLS = 6;
export const ROWS = 3;
const SEARCH_TIME = 0.9;        // seconds of holding to open one shelf
// Sized against the SHELF COUNT, not by feel. There are 18 units in here; at
// 0.075 a shelf the meter could not fill before the decay ate it, so emptying
// the whole place was free and "noise brings company" was a slogan printed
// over a mechanic that did not exist. Eleven shelves is the ceiling now, which
// is comfortably less than all of them — that gap IS the decision.
const NOISE_PER_SEARCH = 0.105;
const NOISE_DECAY = 0.014;      // per second: backing off and waiting works

// What is behind the doors. Weighted so that most of it is nothing, because a
// supermarket where every shelf pays is not a decision, it is a queue.
const TABLE = [
  { w: 27, kind: 'empty' },
  { w: 10, kind: 'supply', res: 'food', lo: 1, hi: 4 },
  { w: 9, kind: 'supply', res: 'water', lo: 1, hi: 3 },
  { w: 10, kind: 'supply', res: 'scrap', lo: 3, hi: 6 },
  { w: 9, kind: 'supply', res: 'fuel', lo: 1, hi: 3 },
  { w: 4, kind: 'supply', res: 'meds', lo: 1, hi: 1 },
  { w: 8, kind: 'glass' },
  { w: 5, kind: 'rats' },
  { w: 3, kind: 'cache' },       // the good one
];

function roll(rand) {
  const total = TABLE.reduce((a, e) => a + e.w, 0);
  let r = rand() * total;
  for (const e of TABLE) { r -= e.w; if (r <= 0) return e; }
  return TABLE[0];
}

export function create(run, rand) {
  const cells = [];
  for (let i = 0; i < COLS * ROWS; i += 1) {
    const e = roll(rand);
    cells.push({
      kind: e.kind,
      res: e.res,
      n: e.lo ? e.lo + Math.floor(rand() * (e.hi - e.lo + 1)) : 0,
      open: false,
    });
  }
  return {
    id: 'scavenge',
    cells,
    cur: 0,
    progress: 0,
    noise: 0,
    left: meta.seconds,
    haul: {},
    hurt: 0,
    opened: 0,
    done: false,
    how: null,          // 'left' | 'time' | 'caught'
    flash: 0,           // seconds of feedback on the last shelf
    flashText: '',
  };
}

const add = (bag, k, n) => { bag[k] = (bag[k] || 0) + n; };

const hit = (pt, r) => pt && pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;

export function step(mg, dt, input) {
  if (mg.done) return mg;
  mg.left -= dt;
  mg.flash = Math.max(0, mg.flash - dt);
  mg.noise = Math.max(0, mg.noise - NOISE_DECAY * dt);

  // Touch: tapping a shelf selects it and keeping the finger down forces it,
  // which is the same two-part gesture the keyboard does with move-then-hold.
  if (input.tap) {
    if (hit(input.tap, EXIT)) { mg.done = true; mg.how = 'left'; return mg; }
    const i = mg.cells.findIndex((_, k) => hit(input.tap, cellRect(k)));
    if (i >= 0 && i !== mg.cur) { mg.cur = i; mg.progress = 0; }
  }

  // Defaulted, because an input object is allowed to carry only the axis that
  // moved. Reading `undefined` straight into the arithmetic put NaN in the
  // cursor and every read after it came back undefined.
  const dx = input.dx || 0; const dy = input.dy || 0;
  if (dx || dy) {
    const x = clamp((mg.cur % COLS) + dx, 0, COLS - 1);
    const y = clamp(Math.floor(mg.cur / COLS) + dy, 0, ROWS - 1);
    const next = y * COLS + x;
    if (next !== mg.cur) { mg.cur = next; mg.progress = 0; }
  }

  const cell = mg.cells[mg.cur];
  const holding = input.hold || hit(input.at, cellRect(mg.cur));
  if (holding && !cell.open) {
    mg.progress += dt / SEARCH_TIME;
    // Noise accrues WHILE you force it, not when it pops open — so backing off
    // a shelf halfway still cost you something, which is the honest version.
    mg.noise += (NOISE_PER_SEARCH / SEARCH_TIME) * dt;
    if (mg.progress >= 1) open(mg, cell);
  } else if (mg.progress > 0 && !holding) {
    mg.progress = Math.max(0, mg.progress - dt * 1.5);
  }

  if (input.leave) { mg.done = true; mg.how = 'left'; }
  else if (mg.noise >= 1) { mg.done = true; mg.how = 'caught'; }
  else if (mg.left <= 0) { mg.done = true; mg.how = 'time'; }
  return mg;
}

function open(mg, cell) {
  cell.open = true;
  mg.progress = 0;
  mg.opened += 1;
  mg.flash = 1.4;
  switch (cell.kind) {
    case 'supply':
      add(mg.haul, cell.res, cell.n);
      mg.flashText = `+${cell.n} ${cell.res}`;
      break;
    case 'cache':
      add(mg.haul, 'scrap', 6); add(mg.haul, 'food', 2); add(mg.haul, 'meds', 1);
      mg.flashText = 'SOMEBODY\'S STASH';
      break;
    case 'glass':
      mg.hurt += 1;
      mg.flashText = 'GLASS — CUT';
      break;
    case 'rats':
      // They got here first, and they are still here.
      mg.hurt += 1;
      add(mg.haul, 'food', -Math.min(2, mg.haul.food || 0));
      mg.flashText = 'RATS';
      break;
    default:
      mg.flashText = 'NOTHING';
  }
}

export function finish(mg) {
  const deltas = {};
  for (const [k, v] of Object.entries(mg.haul)) if (v) deltas[k] = v;
  if (mg.hurt) deltas.hp = -mg.hurt;

  if (mg.how === 'caught') {
    // Half of everything, rounded against you. Not death — the point is the
    // lesson, and a lesson you die for is one you cannot use.
    for (const k of Object.keys(deltas)) {
      if (k === 'hp') continue;
      deltas[k] = deltas[k] > 0 ? Math.floor(deltas[k] / 2) : deltas[k];
    }
    deltas.hp = (deltas.hp || 0) - 1;
    return {
      deltas,
      failed: true,
      text: 'Somebody heard you three aisles back. They take half of it and let you go, which is generous.',
      lesson: meta.lesson,
    };
  }
  const took = Object.entries(deltas).filter(([k, v]) => k !== 'hp' && v > 0).length;
  return {
    deltas,
    failed: !took,
    text: took
      ? (mg.how === 'left'
        ? 'You load up and walk out while it is still quiet.'
        : 'You lose track of the time. The light changes and you go.')
      : 'Picked clean years ago. You leave with nothing but a cut hand.',
    lesson: meta.lesson,
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── drawing ────────────────────────────────────────────────────────────────
// Layout constants are exported so the input code can turn a tap into a cell
// without a second copy of the arithmetic drifting out of step with this one.
export const CELL = { w: 42, h: 28, gx: 6, gy: 6, x0: 19, y0: 28 };
export const cellRect = (i) => ({
  x: CELL.x0 + (i % COLS) * (CELL.w + CELL.gx),
  y: CELL.y0 + Math.floor(i / COLS) * (CELL.h + CELL.gy),
  w: CELL.w,
  h: CELL.h,
});
export const EXIT = { x: 268, y: 140, w: 44, h: 16 };

export function draw(s, mg, t) {
  s.clear(1);
  // Floor, and the strip lights that still work.
  s.rect(0, 24, 320, 140, 1);
  for (let x = 10; x < 320; x += 60) s.rect(x, 25, 34, 1, (Math.floor(t / 700) + x) % 3 ? 6 : 5);

  mg.cells.forEach((c, i) => {
    const r = cellRect(i);
    const on = i === mg.cur;
    s.rect(r.x, r.y, r.w, r.h, c.open ? 0 : 5);
    s.rect(r.x, r.y, r.w, 2, c.open ? 1 : 6);
    if (!c.open) {
      // Shelf slats, so a closed unit reads as a thing rather than a block.
      for (let y = 6; y < r.h - 4; y += 7) s.rect(r.x + 3, r.y + y, r.w - 6, 2, 13);
    } else {
      const col = c.kind === 'glass' || c.kind === 'rats' ? 8 : (c.kind === 'empty' ? 5 : 11);
      s.rect(r.x + r.w / 2 - 4, r.y + r.h / 2 - 3, 8, 6, col);
    }
    if (on) {
      const blink = Math.floor(t / 220) % 2;
      const col = blink ? 10 : 7;
      s.rect(r.x - 2, r.y - 2, r.w + 4, 1, col);
      s.rect(r.x - 2, r.y + r.h + 1, r.w + 4, 1, col);
      s.rect(r.x - 2, r.y - 2, 1, r.h + 4, col);
      s.rect(r.x + r.w + 1, r.y - 2, 1, r.h + 4, col);
      if (mg.progress > 0) {
        s.rect(r.x + 2, r.y + r.h - 5, r.w - 4, 3, 0);
        s.rect(r.x + 2, r.y + r.h - 5, Math.round((r.w - 4) * mg.progress), 3, 10);
      }
    }
  });

  // The door. Always open, always visible — that IS the mechanic.
  s.rect(EXIT.x, EXIT.y, EXIT.w, EXIT.h, 3);
  s.rect(EXIT.x, EXIT.y, EXIT.w, 1, 11);

  // Noise. Green to red, and it is the only thing on screen that moves on its
  // own, so the eye goes to it.
  const nw = 150;
  s.rect(10, 148, nw, 7, 0);
  const lit = Math.round(nw * Math.min(1, mg.noise));
  s.rect(10, 148, lit, 7, mg.noise > 0.75 ? 8 : mg.noise > 0.45 ? 9 : 11);
  for (let i = 1; i < 4; i += 1) s.rect(10 + Math.round((nw * i) / 4), 148, 1, 7, 1);
}

export function overlay(view, mg, t, text, PAL) {
  text(view, 'NOISE', 10, 140, { size: 6, col: PAL[6] });
  text(view, `${Math.ceil(mg.left)}s`, 250, 139, { size: 7, col: mg.left < 10 ? PAL[8] : PAL[6], align: 'right' });
  text(view, 'LEAVE', EXIT.x + EXIT.w / 2, EXIT.y + 5, { size: 6, align: 'center', col: PAL[7] });
  if (mg.noise > 0.7 && Math.floor(t / 200) % 2) {
    text(view, 'SOMEBODY IS COMING', 150, 140, { size: 7, align: 'center', col: PAL[8] });
  } else if (mg.flash > 0) {
    const bad = /GLASS|RATS|NOTHING/.test(mg.flashText);
    text(view, mg.flashText, 150, 140, { size: 7, align: 'center', col: bad ? PAL[8] : PAL[11] });
  }
}
