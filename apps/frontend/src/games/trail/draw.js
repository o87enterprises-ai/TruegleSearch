import { W, H, rng } from './engine';

// Everything you can see, drawn from rectangles.
//
// No PNGs at all — the owner's call, and it removes three problems in one go:
// nothing to fit inside an asset budget, no way for the palette to drift
// between one sitting and the next, and no licensing question on a public
// site. The cost is that a shape is a function rather than a picture, which
// is a fair trade at 320×180 where a sprite is thirty rectangles anyway.

const GROUND_Y = 132;

/**
 * Parallax, generated from a seed rather than stored.
 *
 * `offset` is in world pixels and grows with distance travelled. Each layer
 * divides it, which is the whole parallax trick: far things slide slower.
 * The seed is per-layer-per-biome so the two layers never accidentally
 * produce the same silhouette.
 */
export function parallax(s, biome, offset) {
  const far = Math.floor(offset / 6);
  const near = Math.floor(offset / 2);

  if (biome.id === 'mountains') {
    ridge(s, biome.far, far, 64, 46, 900);
    ridge(s, biome.near, near, 96, 30, 1600);
  } else if (biome.id === 'desert') {
    dunes(s, biome.far, far, 104, 14, 700);
    cacti(s, biome.near, near, 1300);
  } else {
    skyline(s, biome.far, far, 74, 34, 500);
    poles(s, biome.near, near, 1100);
  }
}

// Overlapping triangles. Drawn as vertical slices because the whole renderer
// is fillRect and adding a path API for three shapes is not worth it.
function ridge(s, col, offset, baseY, height, seed) {
  const r = rng(seed);
  const peaks = [];
  for (let i = 0; i < 14; i += 1) peaks.push({ x: i * 46 + r() * 30, h: height * (0.5 + r() * 0.6), w: 40 + r() * 40 });
  for (const p of peaks) {
    const px = mod(p.x - offset, 14 * 46) - 60;
    for (let x = 0; x < p.w; x += 1) {
      const t = 1 - Math.abs((x - p.w / 2) / (p.w / 2));
      if (t <= 0) continue;
      const h = Math.round(p.h * t);
      s.rect(px + x, baseY - h, 1, h + 40, col);
    }
  }
}

function dunes(s, col, offset, baseY, amp, seed) {
  const r = rng(seed);
  const phase = r() * 10;
  for (let x = 0; x < W; x += 1) {
    const wx = x + offset;
    const y = baseY + Math.sin(wx / 41 + phase) * amp + Math.sin(wx / 13) * (amp / 3);
    s.rect(x, y, 1, H - y, col);
  }
}

function cacti(s, col, offset, seed) {
  const r = rng(seed);
  const span = 1200;
  for (let i = 0; i < 18; i += 1) {
    const at = r() * span;
    const h = 10 + Math.round(r() * 14);
    const x = mod(at - offset, span);
    if (x > W + 8) continue;
    s.rect(x, GROUND_Y - h, 3, h, col);
    if (r() > 0.4) { s.rect(x - 3, GROUND_Y - h + 4, 3, 2, col); s.rect(x - 3, GROUND_Y - h + 4, 2, 6, col); }
  }
}

function skyline(s, col, offset, baseY, height, seed) {
  const r = rng(seed);
  const span = 900;
  for (let i = 0; i < 26; i += 1) {
    const at = r() * span;
    const w = 12 + Math.round(r() * 22);
    const h = 8 + Math.round(r() * height);
    const x = mod(at - offset, span);
    if (x > W + 30) continue;
    s.rect(x, baseY - h, w, h + 40, col);
    // A few lit windows. Nobody is home; the grid just has not finished dying.
    if (r() > 0.75) s.rect(x + 2, baseY - h + 3, 2, 2, 10);
  }
}

function poles(s, col, offset, seed) {
  const r = rng(seed);
  const span = 1100;
  for (let i = 0; i < 22; i += 1) {
    const at = r() * span;
    const x = mod(at - offset, span);
    if (x > W + 6) continue;
    const h = 26 + Math.round(r() * 10);
    s.rect(x, GROUND_Y - h, 2, h, col);
    s.rect(x - 5, GROUND_Y - h, 12, 2, col);
  }
}

const mod = (n, m) => ((n % m) + m) % m;

/** Sky, ground, and the road running out to the horizon. */
export function scene(s, biome, offset) {
  s.clear(biome.sky);
  // A band of lighter sky at the horizon. Cheap, and it stops the top half
  // reading as a flat rectangle.
  s.rect(0, 88, W, 20, biome.sky === 12 ? 6 : 15);
  parallax(s, biome, offset);
  s.rect(0, GROUND_Y, W, H - GROUND_Y, biome.ground);
  // Road: a trapezoid, faked with rows.
  for (let y = 0; y < H - GROUND_Y; y += 1) {
    const t = y / (H - GROUND_Y);
    const half = 8 + t * 120;
    s.rect(W / 2 - half, GROUND_Y + y, half * 2, 1, 0);
  }
  // Centre line, scrolling toward the viewer.
  for (let y = 2; y < H - GROUND_Y; y += 6) {
    const t = y / (H - GROUND_Y);
    const dash = mod(offset * (0.4 + t), 12);
    if (dash > 6) continue;
    s.rect(W / 2 - Math.max(1, t * 3), GROUND_Y + y, Math.max(1, t * 6), Math.max(1, t * 3), 10);
  }
}

/**
 * The vehicle, from behind, held in the centre of the road.
 *
 * Horizontally FIXED with a sway rather than free movement: the road narrows
 * to a point at the horizon, so a vehicle that could drive sideways would
 * either leave the tarmac or need lane logic the game does not have. The sway
 * and the bounce scale with speed, which is what sells pace when the scenery
 * is the only other thing moving.
 */
export function drawVehicle(s, t, { speed = 0, hurt = false, dead = false } = {}) {
  const pace = Math.min(1, speed / 10);
  const sway = dead ? 0 : Math.sin(t / (260 - pace * 150)) * (0.6 + pace * 2.2);
  const bounce = dead ? 6 : Math.sin(t / (110 - pace * 55)) * (0.5 + pace * 1.6);
  const x = W / 2 - 16 + Math.round(sway);
  const y = 128 + Math.round(bounce);
  const body = dead ? 5 : (hurt ? 8 : 4);

  s.rect(x + 4, y + 22, 24, 3, 0);              // shadow
  s.rect(x + 2, y + 6, 28, 16, body);           // body
  s.rect(x + 2, y + 6, 28, 2, dead ? 5 : 15);   // top highlight
  s.rect(x + 5, y + 2, 22, 6, 13);              // canopy / tarp
  s.rect(x + 7, y + 9, 18, 7, 1);               // rear window
  s.rect(x + 9, y + 10, 6, 2, 6);               // a glint on the glass
  s.rect(x + 1, y + 18, 6, 6, 0);               // wheels
  s.rect(x + 25, y + 18, 6, 6, 0);
  s.rect(x + 2, y + 19, 4, 4, 5);
  s.rect(x + 26, y + 19, 4, 4, 5);
  if (!dead) {
    // Tail lights brighten under braking — the one piece of feedback that
    // reads instantly without a number attached to it.
    const lamp = speed < 1.5 ? 8 : 2;
    s.rect(x + 3, y + 11, 3, 3, lamp);
    s.rect(x + 26, y + 11, 3, 3, lamp);
  }
  // Junk lashed to the roof. Different every run, the same all run.
  const r = rng(97);
  for (let i = 0; i < 5; i += 1) {
    const w = 3 + Math.round(r() * 5);
    s.rect(x + 5 + i * 5, y - Math.round(r() * 3), w, 3, [9, 11, 6, 15, 4][i]);
  }
  return { x: x + 16, y: y + 24 };
}

/**
 * A thing in the road, drawn at a scale that grows as it closes.
 * @param near 0 at the horizon, 1 when it is on top of you.
 */
export function drawObstacle(s, type, near) {
  const k = 0.25 + near * near * 1.6;            // squared: things rush at the end
  const y = 118 + near * 34;
  const cx = W / 2;
  const w = Math.max(2, Math.round(18 * k));
  const h = Math.max(2, Math.round(12 * k));

  if (type === 'crater') {
    s.rect(cx - w, y, w * 2, Math.max(1, Math.round(h * 0.7)), 0);
    s.rect(cx - w + 1, y + 1, w * 2 - 2, Math.max(1, Math.round(h * 0.4)), 1);
    s.rect(cx - w, y - 1, w * 2, 1, 5);
  } else if (type === 'wreck') {
    s.rect(cx - w, y - h, w * 2, h, 5);
    s.rect(cx - w, y - h, w * 2, Math.max(1, Math.round(h * 0.3)), 2);
    s.rect(cx - Math.round(w * 0.6), y, Math.round(w * 0.5), Math.max(2, Math.round(h * 0.4)), 0);
    s.rect(cx + Math.round(w * 0.2), y, Math.round(w * 0.5), Math.max(2, Math.round(h * 0.4)), 0);
  } else if (type === 'storm') {
    for (let i = 0; i < 5; i += 1) {
      const o = (i - 2) * w * 0.45;
      s.rect(cx + o - w * 0.4, y - h - i % 2 * 3, w * 0.8, h, i % 2 ? 4 : 15);
    }
    s.rect(cx - w * 1.4, y - h - 4, w * 2.8, Math.max(2, h * 0.4), 15);
  } else { // rock
    s.rect(cx - w * 0.8, y - h, w * 1.6, h, 5);
    s.rect(cx - w * 0.5, y - h - Math.round(h * 0.4), w, Math.round(h * 0.5) + 1, 5);
    s.rect(cx - w * 0.6, y - h, w * 0.5, Math.max(1, Math.round(h * 0.4)), 6);
  }
}

/** One speck of dust. The caller owns the pool; this just paints. */
export function drawParticle(s, p) {
  const col = p.life > 0.6 ? 6 : (p.life > 0.3 ? 5 : 1);
  const sz = p.life > 0.5 ? 2 : 1;
  s.rect(p.x, p.y, sz, sz, col);
}

/** Little 8×8 glyphs for the resource row. Drawn, not typed. */
export function icon(s, kind, x, y) {
  switch (kind) {
    case 'fuel':
      s.rect(x + 1, y + 1, 5, 6, 9); s.rect(x + 6, y + 3, 2, 4, 9); s.rect(x + 2, y, 3, 1, 5); break;
    case 'water':
      s.rect(x + 3, y, 2, 2, 12); s.rect(x + 2, y + 2, 4, 2, 12); s.rect(x + 1, y + 4, 6, 3, 12); break;
    case 'food':
      s.rect(x + 2, y + 1, 4, 6, 11); s.rect(x + 1, y + 3, 6, 3, 11); s.rect(x + 3, y, 1, 2, 3); break;
    case 'meds':
      s.rect(x + 3, y + 1, 2, 6, 8); s.rect(x + 1, y + 3, 6, 2, 8); break;
    case 'scrap':
      // A bolt and a washer: the universal currency of things pulled off other
      // things.
      s.rect(x + 1, y + 1, 4, 2, 6); s.rect(x + 4, y + 2, 3, 4, 6); s.rect(x + 1, y + 4, 3, 3, 13); break;
    case 'protection':
      // Deliberately not a gun. It reads at 8 pixels and it is the idea that
      // matters — something between you and the next person.
      s.rect(x + 2, y, 4, 1, 7); s.rect(x + 1, y + 1, 6, 3, 7); s.rect(x + 2, y + 4, 4, 2, 7); s.rect(x + 3, y + 6, 2, 1, 7); break;
    case 'heart':
      s.rect(x + 1, y + 1, 2, 2, 8); s.rect(x + 5, y + 1, 2, 2, 8);
      s.rect(x + 1, y + 2, 6, 2, 8); s.rect(x + 2, y + 4, 4, 1, 8); s.rect(x + 3, y + 5, 2, 1, 8); break;
    default: break;
  }
}

/** Hazard badge shown when an event fires. */
export function hazard(s, kind, x, y) {
  if (kind === 'raiders') {
    s.rect(x + 2, y, 4, 4, 8); s.rect(x, y + 4, 8, 5, 2); s.rect(x + 2, y + 5, 1, 1, 0); s.rect(x + 5, y + 5, 1, 1, 0);
  } else if (kind === 'storm') {
    s.rect(x, y + 1, 8, 3, 6); s.rect(x + 1, y, 5, 2, 7); s.rect(x + 4, y + 4, 2, 3, 10); s.rect(x + 3, y + 6, 2, 3, 10);
  } else {
    s.rect(x + 1, y + 2, 6, 5, 9); s.rect(x + 3, y, 2, 3, 5); s.rect(x, y + 7, 8, 1, 5);
  }
}
