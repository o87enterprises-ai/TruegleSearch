// THE RAID — a settlement at night, three caches, and people who will kill you.
//
// This is the one with teeth: caught without protection ends the run. That is
// the owner's call and it is the right one, because a stealth game where being
// seen costs a resource is not a stealth game, it is a slot machine. Two things
// make it fair rather than cruel:
//
//   1. You are never volunteered into it. It is always a choice on an
//      encounter card, and running the clock out on that card never picks it.
//   2. PROTECTION buys you one mistake. You get it at the trading post, it is
//      spent the moment it saves you, and the run tells you so in as many
//      words. That is the lesson: carry it before you need it.
//
// The exit is behind you the whole time. Leaving with one cache is a win.

export const meta = {
  id: 'raid',
  title: 'THE RAID',
  seconds: 70,
  hint: 'MOVE  ·  SHIFT TO CROUCH  ·  HOLD ENTER AT A CACHE  ·  REACH THE GATE',
  axis: 'analog',
  lesson: 'Trust no one, and carry protection before you need it.',
};

const WALK = 52;               // world px per second
const CROUCH = 26;
const SIGHT = 58;              // how far a guard sees, standing
const CONE = 0.62;             // half-angle, radians
const SPOT_TIME = 0.5;         // seconds inside a cone before it is over
const LOOT_TIME = 1.0;
export const ARENA = { x: 6, y: 26, w: 308, h: 128 };
export const GATE = { x: 6, y: 92, w: 20, h: 34 };

// Crates block sight. Without them the arena is a timing puzzle; with them it
// is a route, which is the difference between waiting and playing.
const CRATES = [
  { x: 60, y: 40, w: 26, h: 16 },
  { x: 132, y: 34, w: 18, h: 26 },
  { x: 210, y: 44, w: 30, h: 14 },
  { x: 78, y: 96, w: 20, h: 22 },
  { x: 158, y: 104, w: 34, h: 14 },
  { x: 244, y: 92, w: 18, h: 28 },
  { x: 116, y: 68, w: 40, h: 10 },
];

export function create(run, rand) {
  const caches = [
    { x: 96, y: 44, taken: false, loot: { scrap: 4 + Math.floor(rand() * 5), fuel: 1 + Math.floor(rand() * 3) } },
    { x: 226, y: 118, taken: false, loot: { scrap: 3 + Math.floor(rand() * 4), meds: 1, water: 1 + Math.floor(rand() * 3) } },
    { x: 288, y: 40, taken: false, loot: { scrap: 6 + Math.floor(rand() * 6), food: 2 + Math.floor(rand() * 4) } },
  ];
  const guards = [
    { path: [[52, 66], [268, 66]], base: 30 },
    { path: [[280, 132], [110, 132], [110, 84]], base: 26 },
    { path: [[190, 34], [190, 120], [252, 120]], base: 22 },
  ].map((g) => ({
    ...g, at: 0, dir: 1, t: 0, speed: g.base, face: 0, sweep: rand() * 6,
    px: g.path[0][0], py: g.path[0][1],
  }));
  return {
    id: 'raid',
    x: GATE.x + GATE.w + 20,
    y: GATE.y + GATE.h / 2,
    // The gate only becomes an exit once you have actually gone in. You start
    // a stride from it, and without this a twitch on the first frame ends the
    // raid before it opens.
    away: false,
    crouch: false,
    caches,
    guards,
    haul: {},
    progress: 0,
    seen: 0,           // seconds inside a cone, decays when you break line
    lit: false,        // seen RIGHT NOW — drives the alarm colour
    left: meta.seconds,
    done: false,
    how: null,         // 'out' | 'dawn' | 'caught'
    flash: 0,
    flashText: '',
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const inRect = (px, py, r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

/** Does the segment a→b cross this rectangle? Slab method, no allocations. */
function blocked(ax, ay, bx, by, r) {
  const dx = bx - ax; const dy = by - ay;
  let t0 = 0; let t1 = 1;
  for (const [p, q] of [[-dx, ax - r.x], [dx, r.x + r.w - ax], [-dy, ay - r.y], [dy, r.y + r.h - ay]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else if (t < t0) return false; else if (t < t1) t1 = t;
  }
  return true;
}

// Walk the waypoints and bounce at the ends. px/py/face are written on EVERY
// call, including the frame a guard turns around — an early version returned
// early on the turn and left them undefined, which read as a guard blinking to
// the origin with a cone pointing east.
function advance(g, dt) {
  const [ax, ay] = g.path[g.at];
  let nextIdx = g.at + g.dir;
  if (nextIdx < 0 || nextIdx >= g.path.length) { g.dir *= -1; nextIdx = g.at + g.dir; }
  const [bx, by] = g.path[nextIdx];
  const len = Math.hypot(bx - ax, by - ay) || 1;
  g.t += (g.speed * dt) / len;
  const k = Math.min(1, g.t);
  g.px = ax + (bx - ax) * k;
  g.py = ay + (by - ay) * k;
  g.face = Math.atan2(by - ay, bx - ax);
  if (g.t >= 1) { g.t = 0; g.at = nextIdx; }
}

export function step(mg, dt, input) {
  if (mg.done) return mg;
  mg.left -= dt;
  mg.flash = Math.max(0, mg.flash - dt);
  mg.crouch = !!input.alt;

  // ONE FINGER DOES EVERYTHING on touch: the player walks toward it, and how
  // far away it is IS the throttle. Keep the finger close and you creep and
  // stay quiet; reach out and you stride. That beats bolting a crouch button
  // and a loot button onto a 320-pixel screen, and it means the quiet way to
  // play is also the comfortable way to hold the phone.
  let dx = input.dx || 0; let dy = input.dy || 0;
  let touchDist = Infinity;
  if (input.at) {
    touchDist = Math.hypot(input.at.x - mg.x, input.at.y - mg.y);
    if (touchDist > 3) { dx = input.at.x - mg.x; dy = input.at.y - mg.y; }
    else { dx = 0; dy = 0; }
    mg.crouch = touchDist < 26;
  }

  const speed = mg.crouch ? CROUCH : WALK;
  const len = Math.hypot(dx, dy) || 1;
  const nx = clamp(mg.x + (dx / len) * speed * dt, ARENA.x + 2, ARENA.x + ARENA.w - 2);
  const ny = clamp(mg.y + (dy / len) * speed * dt, ARENA.y + 2, ARENA.y + ARENA.h - 2);
  // Crates are cover, and cover you can walk through is scenery. Axis-wise so
  // sliding along a crate works instead of sticking to it.
  if (!CRATES.some((c) => inRect(nx, mg.y, c))) mg.x = nx;
  if (!CRATES.some((c) => inRect(mg.x, ny, c))) mg.y = ny;

  // Guards move faster once the light starts to come up — the clock is not a
  // countdown to nothing, it is a countdown to being easier to see.
  const panic = mg.left < 18 ? 1.45 : 1;
  for (const g of mg.guards) {
    g.speed = g.base * panic;
    advance(g, dt);
    g.sweep += dt * 0.9;
  }

  // Detection.
  mg.lit = false;
  const reach = SIGHT * (mg.crouch ? 0.62 : 1) * (mg.left < 18 ? 1.15 : 1);
  for (const g of mg.guards) {
    const gx = g.px; const gy = g.py;
    const d = Math.hypot(mg.x - gx, mg.y - gy);
    if (d > reach) continue;
    const look = g.face + Math.sin(g.sweep) * 0.5;
    let a = Math.atan2(mg.y - gy, mg.x - gx) - look;
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    if (Math.abs(a) > CONE) continue;
    if (CRATES.some((c) => blocked(gx, gy, mg.x, mg.y, c))) continue;
    mg.lit = true;
    break;
  }
  mg.seen = mg.lit ? mg.seen + dt : Math.max(0, mg.seen - dt * 0.8);
  if (mg.x > GATE.x + GATE.w + 34) mg.away = true;

  // Looting.
  const near = mg.caches.find((c) => !c.taken && Math.hypot(c.x - mg.x, c.y - mg.y) < 10);
  // Standing on it with the finger on top of you counts as working at it.
  const holding = input.hold || touchDist < 12;
  if (near && holding) {
    mg.progress += dt / LOOT_TIME;
    if (mg.progress >= 1) {
      near.taken = true;
      mg.progress = 0;
      for (const [k, v] of Object.entries(near.loot)) mg.haul[k] = (mg.haul[k] || 0) + v;
      mg.flash = 1.4;
      mg.flashText = Object.entries(near.loot).map(([k, v]) => `+${v} ${k}`).join('  ');
    }
  } else {
    mg.progress = Math.max(0, mg.progress - dt * 2);
  }

  if (mg.seen >= SPOT_TIME) { mg.done = true; mg.how = 'caught'; }
  else if ((mg.away && inRect(mg.x, mg.y, GATE)) || input.leave) { mg.done = true; mg.how = 'out'; }
  else if (mg.left <= 0) { mg.done = true; mg.how = 'dawn'; }
  return mg;
}

/**
 * @param protection how many pieces of protection the run is carrying. Passed
 *   in rather than read off the run, so the outcome stays a pure function of
 *   the mini-game plus one number — which is what makes it testable.
 */
export function finish(mg, protection = 0) {
  const deltas = {};
  for (const [k, v] of Object.entries(mg.haul)) if (v) deltas[k] = v;
  const took = mg.caches.filter((c) => c.taken).length;

  if (mg.how === 'caught') {
    if (protection > 0) {
      // Spent, and said out loud. A resource that saves you silently teaches
      // nothing — the player has to connect the purchase to the survival.
      for (const k of Object.keys(deltas)) deltas[k] = Math.floor(deltas[k] / 2);
      deltas.protection = -1;
      deltas.hp = (deltas.hp || 0) - 2;
      return {
        deltas,
        failed: true,
        text: 'A torch finds you at the fence. You get out because you came armed — and you are not armed any more.',
        lesson: meta.lesson,
      };
    }
    return { deltas: {}, failed: true, fatal: 'caught', text: 'They were waiting at the fence.', lesson: meta.lesson };
  }

  if (mg.how === 'dawn') deltas.hp = (deltas.hp || 0) - 1;
  return {
    deltas,
    failed: !took,
    text: took
      ? (mg.how === 'dawn'
        ? 'You go over the fence in the grey light with the dogs starting up behind you.'
        : `Out through the gate with ${took === 3 ? 'everything' : 'what you came for'}, and nobody the wiser.`)
      : 'You get out clean and empty-handed, which counts for something.',
    lesson: meta.lesson,
  };
}

// ── drawing ────────────────────────────────────────────────────────────────
export function draw(s, mg, t) {
  s.clear(0);
  s.rect(ARENA.x, ARENA.y, ARENA.w, ARENA.h, 1);
  // Ground scuff, fixed so it does not shimmer.
  for (let i = 0; i < 40; i += 1) {
    const x = ARENA.x + ((i * 97) % ARENA.w);
    const y = ARENA.y + ((i * 53) % ARENA.h);
    s.rect(x, y, 1, 1, 0);
  }

  s.rect(GATE.x, GATE.y, GATE.w, GATE.h, 3);
  s.rect(GATE.x, GATE.y, GATE.w, 1, 11);
  s.rect(GATE.x, GATE.y + GATE.h - 1, GATE.w, 1, 11);

  // Crate tops were PAL[9] orange, the same orange as a cache, so at a glance
  // the seven things you hide behind and the three things you came for were
  // the same colour. Orange means LOOT in here and nothing else.
  for (const c of CRATES) {
    s.rect(c.x, c.y, c.w, c.h, 4);
    s.rect(c.x, c.y, c.w, 2, 13);
    s.rect(c.x, c.y + c.h - 1, c.w, 1, 0);
  }

  for (const c of mg.caches) {
    if (c.taken) { s.rect(c.x - 3, c.y - 2, 6, 4, 5); continue; }
    const b = Math.floor(t / 400) % 2;
    s.rect(c.x - 4, c.y - 4, 8, 8, 9);
    s.rect(c.x - 3, c.y - 3, 6, 6, b ? 10 : 9);
  }

  // Vision cones, as fans of one-pixel rays. Cheap, and it makes the geometry
  // the player is reasoning about the geometry that is actually being tested.
  for (const g of mg.guards) {
    const gx = g.px; const gy = g.py;
    const look = g.face + Math.sin(g.sweep) * 0.5;
    for (let a = -CONE; a <= CONE; a += 0.075) {
      for (let r = 6; r < SIGHT; r += 3) {
        const px = gx + Math.cos(look + a) * r;
        const py = gy + Math.sin(look + a) * r;
        if (!inRect(px, py, ARENA)) break;
        if (CRATES.some((c) => inRect(px, py, c))) break;
        s.rect(px, py, 1, 1, r > SIGHT * 0.7 ? 1 : 2);
      }
    }
    s.rect(gx - 3, gy - 3, 6, 6, 8);
    s.rect(gx - 2, gy - 2, 4, 4, 14);
  }

  const p = mg.crouch ? 3 : 4;
  s.rect(mg.x - p / 2, mg.y - p / 2 - 1, p, p + 2, mg.lit ? 8 : 12);
  if (mg.progress > 0) {
    s.rect(mg.x - 9, mg.y - 10, 18, 3, 0);
    s.rect(mg.x - 9, mg.y - 10, Math.round(18 * mg.progress), 3, 10);
  }
}

export function overlay(view, mg, t, text, PAL) {
  // Inside the arena rather than under it: the strip below belongs to the
  // host's title and controls, and the compound floor is dark enough to read
  // small text off without a panel behind it.
  text(view, `${Math.ceil(mg.left)}s`, 308, 144, { size: 7, align: 'right', col: mg.left < 18 ? PAL[8] : PAL[6] });
  text(view, mg.crouch ? 'CROUCHED' : 'STANDING', 10, 144, { size: 6, col: mg.crouch ? PAL[11] : PAL[13] });
  text(view, `${mg.caches.filter((c) => c.taken).length}/3`, 160, 144, { size: 6, align: 'center', col: PAL[6] });
  if (mg.seen > 0.05) {
    // A bar rather than a word, because there is no time to read a word.
    const { ctx, scale, ox, oy } = view;
    ctx.fillStyle = PAL[8];
    ctx.fillRect(ox + 120 * scale, oy + 20 * scale, Math.round(80 * (mg.seen / SPOT_TIME)) * scale, 3 * scale);
    if (Math.floor(t / 120) % 2) text(view, 'SEEN', 160, 8, { size: 8, align: 'center', col: PAL[8] });
  }
  if (mg.flash > 0) text(view, mg.flashText, 160, 30, { size: 7, align: 'center', col: PAL[11] });
}
