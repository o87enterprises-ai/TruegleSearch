import { createScreen, text, wrap, W, H, PAL, UI } from './engine';
import { scene, drawVehicle, drawObstacle, drawParticle, icon } from './draw';
import {
  newRun, travel, choose, resume, readStats, writeStats, setThrottle, defaultChoice,
  biomeAt, biomeStart, fuelMultiplier,
  BIOMES, ENDINGS, ITEMS, RESOURCES, TOTAL, MAX_HP, MAX_SPEED, EVENT_SECONDS,
} from './state';

// The loop, the screens and the input. Everything that needs a browser lives
// here; the rules live in state.js and the pixels in draw.js.

// On-canvas throttle pads, in world coordinates. Drawn rather than made of
// DOM, so they scale with the game and cannot drift out of alignment with it.
const GAS = { x: W - 44, y: 116, w: 38, h: 26 };
const BRAKE = { x: W - 44, y: 146, w: 38, h: 26 };
const inPad = (p, x, y) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;

export function mount(canvas, { onExit } = {}) {
  // ONE INSTANCE PER CANVAS, enforced here rather than trusted to the caller.
  //
  // React 18's StrictMode double-invokes effects in development, and this
  // module is loaded by a dynamic import — so the cleanup can run while the
  // import is still in flight, and a second mount can land on a canvas that
  // already has one. That is not a hypothetical: it happened, and the symptom
  // was baffling. Both instances drew every frame and both received every
  // tap, so the newer one dismissed its title while the older one drew its
  // title back on top, and the game looked frozen on the menu while quietly
  // playing itself underneath.
  //
  // Guarding the canvas makes that impossible no matter how the caller
  // behaves, which is the right place for the guarantee.
  canvas.__trailUnmount?.();

  const s = createScreen(canvas);
  let run = newRun();
  let stats = readStats();
  let raf = 0;
  let last = performance.now();
  let t = 0;
  let titleScreen = true;
  let hover = 0;
  let choiceBoxes = [];
  let held = null;          // 'gas' | 'brake' while a pad is pressed
  const dust = [];

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => s.resize()) : null;
  ro?.observe(canvas.parentElement || canvas);
  s.resize();

  // ── input ───────────────────────────────────────────────────────────────
  const commit = (i) => {
    if (titleScreen) { titleScreen = false; setThrottle(run, 4); return; }
    if (run.phase === 'event') { choose(run, i); hover = 0; }
    else if (run.phase === 'outcome') resume(run);
    else if (run.phase === 'over') { writeStats(run); stats = readStats(); run = newRun(); dust.length = 0; }
  };

  const keys = new Set();
  const onKey = (e) => {
    if (e.key === 'Escape') { onExit?.(); return; }
    const k = e.key.toLowerCase();
    keys.add(k);
    // W/S are the throttle; the arrows move between choices. Overloading the
    // arrows onto both would mean picking an option nudges the accelerator.
    if (k === 'arrowup') { hover = Math.max(0, hover - 1); e.preventDefault(); }
    else if (k === 'arrowdown') { hover += 1; e.preventDefault(); }
    else if (k === 'enter' || k === ' ') { commit(hover); e.preventDefault(); }
    else if (/^[1-4]$/.test(k)) commit(Number(k) - 1);
  };
  const onKeyUp = (e) => keys.delete(e.key.toLowerCase());

  const pointAt = (ev) => {
    const r = canvas.getBoundingClientRect();
    const p = ev.touches?.[0] || ev.changedTouches?.[0] || ev;
    const dpr = canvas.width / r.width;
    const sc = s.scale;
    return {
      x: ((p.clientX - r.left) * dpr - (canvas.width - W * sc) / 2) / sc,
      y: ((p.clientY - r.top) * dpr - (canvas.height - H * sc) / 2) / sc,
    };
  };

  const onDown = (ev) => {
    ev.preventDefault();
    const { x, y } = pointAt(ev);
    if (titleScreen) { commit(0); return; }
    if (run.phase === 'outcome' || run.phase === 'over') { commit(0); return; }
    if (run.phase === 'event') {
      const hit = choiceBoxes.findIndex((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
      if (hit >= 0) { commit(hit); return; }
    }
    if (inPad(GAS, x, y)) held = 'gas';
    else if (inPad(BRAKE, x, y)) held = 'brake';
  };
  const onUp = () => { held = null; };
  const onMove = (ev) => {
    if (run.phase !== 'event') return;
    const { x, y } = pointAt(ev);
    const hit = choiceBoxes.findIndex((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (hit >= 0) hover = hit;
  };

  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mouseup', onUp);
  canvas.addEventListener('mouseleave', onUp);
  canvas.addEventListener('touchstart', onDown, { passive: false });
  canvas.addEventListener('touchend', onUp);
  canvas.addEventListener('touchcancel', onUp);
  canvas.addEventListener('mousemove', onMove);

  // ── throttle ────────────────────────────────────────────────────────────
  // Held input nudges a TARGET; state.js interpolates the real speed toward
  // it. Setting speed directly from a keypress would make the vehicle
  // teleport between paces, and the whole point of the dial is the weight.
  function throttle(dt) {
    const up = keys.has('w') || held === 'gas';
    const down = keys.has('s') || held === 'brake';
    if (up) setThrottle(run, run.targetSpeed + 9 * dt);
    else if (down) setThrottle(run, run.targetSpeed - 12 * dt);
  }

  function spawnDust(dt) {
    // More speed, more dust. Capped so a long run cannot grow an array
    // forever on a phone.
    const want = Math.round(run.speed * 1.6);
    if (dust.length < 90 && Math.random() < want * dt * 3) {
      dust.push({ x: W / 2 + (Math.random() * 26 - 13), y: 150, life: 1, vx: (Math.random() - 0.5) * 26, vy: -6 - Math.random() * 10 });
    }
    for (let i = dust.length - 1; i >= 0; i -= 1) {
      const p = dust[i];
      p.life -= dt * 1.5;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) dust.splice(i, 1);
    }
  }

  // ── frame ───────────────────────────────────────────────────────────────
  const frame = (now) => {
    // Clamped: a backgrounded tab must not teleport you down the road, and a
    // dt of several seconds would skip straight past a fuel-out.
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t = now;

    if (!titleScreen && run.phase !== 'over') {
      throttle(dt);
      travel(run, dt);
      spawnDust(dt);
    }

    const bi = biomeAt(run.dist);
    const b = BIOMES[bi];
    scene(s, b, run.dist - biomeStart(bi));

    // The obstacle, closing. Rendered before the vehicle so the vehicle can
    // pass in front of it, which is the only cue that says "this is on the
    // road with you" rather than "this is a picture in a box".
    if (run.phase === 'event' && run.event?.obstacleSprite) {
      const near = Math.max(0, Math.min(1, 1 - (run.obstacleAt - run.dist) / 14));
      drawObstacle(s, run.event.obstacleSprite, near);
    }

    drawVehicle(s, t, {
      speed: run.speed,
      hurt: run.hp < MAX_HP * 0.35,
      dead: run.phase === 'over' && run.ending !== 'arrive',
    });
    for (const p of dust) drawParticle(s, p);
    hud();
    if (!titleScreen && run.phase !== 'over') pads();

    const view = s.present();
    if (titleScreen) drawTitle(view);
    else if (run.phase === 'event') drawEvent(view);
    else if (run.phase === 'outcome') drawOutcome(view);
    else if (run.phase === 'over') drawOver(view);
    else drawTravel(view, b);

    raf = requestAnimationFrame(frame);
  };

  // ── the pixel layer of the HUD ──────────────────────────────────────────
  function hud() {
    s.rect(0, 0, W, 22, 0);
    s.rect(0, 22, W, 1, 5);
    let x = 4;
    for (const k of RESOURCES) {
      icon(s, k, x, 3);
      s.rect(x, 13, 30, 4, 1);
      s.rect(x, 13, Math.round(30 * Math.max(0, Math.min(1, run.res[k] / 20))), 4, ITEMS[k].colour);
      x += 38;
    }
    icon(s, 'heart', x + 6, 3);
    s.rect(x + 6, 13, 30, 4, 1);
    s.rect(x + 6, 13, Math.round(30 * (run.hp / MAX_HP)), 4, 8);

    // Progress, and the speed gauge directly above it. Both live at the
    // bottom so everything about the journey is in one place instead of
    // making the eye cross the screen to assemble it.
    const bar = W - 12;
    s.rect(6, H - 7, bar, 3, 1);
    s.rect(6, H - 7, Math.round(bar * (run.dist / TOTAL)), 3, 11);
    let acc = 0;
    for (const bm of BIOMES.slice(0, -1)) {
      acc += bm.distance;
      s.rect(6 + Math.round(bar * (acc / TOTAL)), H - 9, 1, 7, 6);
    }

    const gw = 60;
    s.rect(6, H - 16, gw, 5, 1);
    const lit = Math.round(gw * (run.speed / MAX_SPEED));
    // Green through amber to red: the colour IS the fuel warning, so the
    // penalty for flooring it is visible without reading a multiplier.
    const col = run.speed > 7.5 ? 8 : run.speed > 4.5 ? 9 : 11;
    s.rect(6, H - 16, lit, 5, col);
    for (let i = 1; i < 5; i += 1) s.rect(6 + Math.round(gw * i / 5), H - 16, 1, 5, 0);
  }

  function pads() {
    for (const [pad, on] of [[GAS, held === 'gas' || keys.has('w')], [BRAKE, held === 'brake' || keys.has('s')]]) {
      s.rect(pad.x, pad.y, pad.w, pad.h, on ? 5 : 1);
      s.rect(pad.x, pad.y, pad.w, 1, 6);
      s.rect(pad.x, pad.y + pad.h - 1, pad.w, 1, 0);
    }
    // Chevrons rather than words: at this size a glyph reads and a label does not.
    const gx = GAS.x + GAS.w / 2; const gy = GAS.y + GAS.h / 2;
    for (let i = 0; i < 4; i += 1) s.rect(gx - 4 + i, gy - 3 + Math.abs(i - 1.5), Math.max(1, 8 - i * 2) - 4, 2, 11);
    s.rect(gx - 5, gy - 4, 10, 2, 11);
    s.rect(gx - 3, gy - 6, 6, 2, 11);
    const bx = BRAKE.x + BRAKE.w / 2; const by = BRAKE.y + BRAKE.h / 2;
    s.rect(bx - 5, by + 2, 10, 2, 8);
    s.rect(bx - 3, by + 4, 6, 2, 8);
  }

  // ── text layers ─────────────────────────────────────────────────────────
  function panel(view, top, height) {
    const { ctx, scale, ox, oy } = view;
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.fillRect(ox, oy + top * scale, W * scale, height * scale);
    ctx.fillStyle = PAL[5];
    ctx.fillRect(ox, oy + top * scale, W * scale, scale);
  }

  function drawTitle(view) {
    panel(view, 40, 104);
    text(view, 'TRAIL', W / 2, 48, { size: 20, align: 'center', col: PAL[10] });
    text(view, '500 miles. One life. No saves.', W / 2, 74, { size: 7, align: 'center', col: PAL[6] });
    text(view, 'W / S or the pads to drive', W / 2, 88, { size: 6, align: 'center', col: PAL[13] });
    if (stats.runs > 0) {
      text(view, `Best ${stats.best} mi  ·  Runs ${stats.runs}`, W / 2, 100, { size: 6, align: 'center', col: PAL[13] });
    }
    text(view, blink() ? 'PRESS ANY KEY OR TAP' : '', W / 2, 118, { size: 7, align: 'center', col: UI });
    text(view, 'Esc to leave', W / 2, 132, { size: 6, align: 'center', col: PAL[5] });
  }

  function drawTravel(view, b) {
    text(view, b.label.toUpperCase(), 6, 26, { size: 6, col: PAL[6] });
    text(view, `${Math.round(run.dist)} / ${TOTAL} mi`, W - 6, 26, { size: 6, col: PAL[6], align: 'right' });
    // The pace penalty, stated. A multiplier the player cannot see is a
    // mechanic they cannot play around.
    text(view, `${run.speed.toFixed(0)} · fuel ×${fuelMultiplier(run.speed).toFixed(1)}`, 6, H - 24, {
      size: 6, col: run.speed > 7.5 ? PAL[8] : PAL[13],
    });
    if (run.dying && run.res[run.dying] <= 0) {
      text(view, `OUT OF ${run.dying.toUpperCase()}`, W / 2, 40, { size: 8, align: 'center', col: blink() ? PAL[8] : PAL[9] });
    }
  }

  function drawEvent(view) {
    const lines = wrap(view, run.event.text, W - 24, 7);
    const n = run.event.choices.length;
    hover = Math.min(hover, n - 1);
    const boxH = 26 + lines.length * 10 + n * 13;
    const top = H - boxH - 10;
    panel(view, top, boxH);

    // The countdown is the whole reason this is real time. Drawn as a bar
    // because a number would be one more thing to read under time pressure.
    const { ctx, scale, ox, oy } = view;
    const frac = Math.max(0, run.eventLeft / EVENT_SECONDS);
    ctx.fillStyle = frac < 0.35 ? PAL[8] : PAL[10];
    ctx.fillRect(ox, oy + top * scale, W * scale * frac, 2 * scale);

    lines.forEach((l, i) => text(view, l, 12, top + 6 + i * 10, { size: 7, col: PAL[7] }));

    choiceBoxes = [];
    const cTop = top + 12 + lines.length * 10;
    run.event.choices.forEach((c, i) => {
      const y = cTop + i * 13;
      choiceBoxes.push({ x: 8, y: y - 2, w: W - 16, h: 12 });
      const on = i === hover;
      if (on) {
        ctx.fillStyle = 'rgba(255,236,39,0.16)';
        ctx.fillRect(ox + 8 * scale, oy + (y - 2) * scale, (W - 16) * scale, 12 * scale);
      }
      // The price is on the button. Choosing under a five-second clock is not
      // the moment to make someone remember what "swerve" costs.
      const bits = [];
      if (c.cost?.fuel) bits.push(`-${c.cost.fuel} fuel`);
      if (c.cost?.water) bits.push(`-${c.cost.water} water`);
      if (c.cost?.distance) bits.push(`-${c.cost.distance} mi`);
      if (c.risk) bits.push(`${Math.round(c.risk * 100)}% risk`);
      text(view, `${on ? '>' : ' '} ${i + 1}. ${c.label}`, 12, y, { size: 7, col: on ? PAL[10] : PAL[6] });
      if (bits.length) text(view, bits.join('  '), W - 12, y + 1, { size: 6, align: 'right', col: PAL[13] });
    });
  }

  function drawOutcome(view) {
    const o = run.outcome;
    const lines = wrap(view, o.text, W - 24, 7);
    const deltas = Object.entries(o.deltas).filter(([, v]) => v);
    const boxH = 34 + lines.length * 10 + (deltas.length ? 12 : 0);
    const top = H - boxH - 10;
    panel(view, top, boxH);

    text(view, o.failed ? 'THAT WENT BADLY' : 'ALRIGHT', 12, top + 6, {
      size: 7, col: o.failed ? PAL[8] : PAL[11],
    });
    lines.forEach((l, i) => text(view, l, 12, top + 18 + i * 10, { size: 7, col: PAL[7] }));

    if (deltas.length) {
      const y = top + 20 + lines.length * 10;
      let x = 12;
      for (const [k, v] of deltas) {
        const label = k === 'hp' ? 'health' : k === 'distance' ? 'miles' : (ITEMS[k]?.label.toLowerCase() || k);
        const str = `${v > 0 ? '+' : ''}${Math.round(v * 10) / 10} ${label}`;
        text(view, str, x, y, { size: 6, col: v > 0 ? PAL[11] : PAL[8] });
        x += str.length * 4 + 10;
      }
    }
    text(view, blink() ? 'TAP OR PRESS ENTER' : '', W - 8, H - 20, { size: 6, align: 'right', col: PAL[13] });
  }

  function drawOver(view) {
    const e = ENDINGS[run.ending] || ENDINGS.hp;
    panel(view, 34, 112);
    const win = run.ending === 'arrive';
    text(view, e.title, W / 2, 44, { size: 14, align: 'center', col: win ? PAL[11] : PAL[8] });
    e.lines.forEach((l, i) => text(view, l, W / 2, 70 + i * 11, { size: 7, align: 'center', col: PAL[6] }));
    text(view, `${Math.round(run.dist)} of ${TOTAL} miles`, W / 2, 112, { size: 7, align: 'center', col: PAL[10] });
    text(view, `Best ${Math.max(stats.best, Math.round(run.dist))} mi  ·  Run ${stats.runs + 1}`, W / 2, 124, {
      size: 6, align: 'center', col: PAL[13],
    });
    text(view, blink() ? 'TAP TO GO AGAIN' : '', W / 2, 138, { size: 7, align: 'center', col: UI });
  }

  const blink = () => Math.floor(t / 500) % 2 === 0;

  raf = requestAnimationFrame(frame);

  function unmount() {
    if (canvas.__trailUnmount === unmount) delete canvas.__trailUnmount;
    cancelAnimationFrame(raf);
    ro?.disconnect();
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('mousedown', onDown);
    canvas.removeEventListener('mouseup', onUp);
    canvas.removeEventListener('mouseleave', onUp);
    canvas.removeEventListener('touchstart', onDown);
    canvas.removeEventListener('touchend', onUp);
    canvas.removeEventListener('touchcancel', onUp);
    canvas.removeEventListener('mousemove', onMove);
    if (!titleScreen && run.dist > 0 && run.phase !== 'over') writeStats(run);
  }

  canvas.__trailUnmount = unmount;
  return unmount;
}

export { defaultChoice };
export default mount;
