import { createScreen, text, wrap, W, H, PAL, UI } from './engine';
import { scene, drawVehicle, drawObstacle, drawParticle, icon } from './draw';
import {
  newRun, travel, choose, resume, readStats, writeStats, setThrottle, defaultChoice,
  stepMinigame, biomeAt, biomeStart, fuelMultiplier,
  BIOMES, ENDINGS, ITEMS, RESOURCES, KIT, TOTAL, MAX_HP, MAX_SPEED,
  EVENT_SECONDS, WARN_AT, URGENT_AT,
} from './state';
import { MINIGAMES } from './minigames';
import { findVault } from '../../utils/vault';

// The loop, the screens and the input. Everything that needs a browser lives
// here; the rules live in state.js and the pixels in draw.js.

// On-canvas throttle pads, in world coordinates. Drawn rather than made of
// DOM, so they scale with the game and cannot drift out of alignment with it.
const GAS = { x: W - 44, y: 116, w: 38, h: 26 };
const BRAKE = { x: W - 44, y: 146, w: 38, h: 26 };
// Only ever drawn, and only ever live, on the arrival screen.
const VAULT = { x: 90, y: 130, w: 140, h: 16 };
const inPad = (p, x, y) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;

export function mount(canvas, { onExit, onFound } = {}) {
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
  // A read-only handle on the current run, hung off the canvas the same way
  // the unmount guard is. Debugging a canvas game otherwise means printf, and
  // the browser test needs to know which phase it is looking at without the
  // frame loop growing a callback that only exists for tests. Reassigned
  // whenever the run is; the object itself is mutated in place.
  const publish = () => { canvas.__trailRun = run; };
  publish();
  let stats = readStats();
  let raf = 0;
  let last = performance.now();
  let t = 0;
  let titleScreen = true;
  let hover = 0;
  let choiceBoxes = [];
  let held = null;          // 'gas' | 'brake' while a pad is pressed
  const dust = [];
  // Mini-game input. Edges are latched here and consumed by the next frame,
  // because a key press is an instant and a frame is a span: reading the key
  // set directly would fire "buy" once per frame for as long as a finger
  // rested on Enter.
  let ptr = null;           // { x, y } in world units while pressed
  let tap = null;           // ...and the same, for exactly one frame on press
  let mgAct = false;
  let mgLeave = false;
  let mgStepX = 0;
  let mgStepY = 0;
  // Where hud() PUT the first kit icon. It used to be the cursor the icon loop
  // walked, so by the time the text layer read it the numbers were two slots
  // to the right of the things they counted.
  let kitX = 0;

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => s.resize()) : null;
  ro?.observe(canvas.parentElement || canvas);
  s.resize();

  // ── input ───────────────────────────────────────────────────────────────
  // Arriving is how you find out the encyclopedia exists. The settlement at
  // the end of five hundred miles kept its library, which is the only prize
  // this game has to give that is worth anything off the screen.
  let found = false;
  const arrive = () => {
    if (found || run.ending !== 'arrive') return;
    found = true;
    findVault();
  };

  const commit = (i) => {
    if (titleScreen) { titleScreen = false; setThrottle(run, 4); return; }
    if (run.phase === 'event') { choose(run, i); hover = 0; }
    else if (run.phase === 'outcome') resume(run);
    else if (run.phase === 'over') {
      writeStats(run); stats = readStats(); run = newRun(); dust.length = 0; publish(); found = false;
    }
  };

  const keys = new Set();

  // What a key press MEANS, resolved once so keydown and keyup can never
  // disagree about it.
  //
  // `code` is checked before `key` because `key` is the character the layout
  // produced: on AZERTY the throttle key is physically where W is but reports
  // "z", and holding shift reports "W". `code` is the physical key, which is
  // what a driving control should be.
  const bind = (e) => {
    if (e.code === 'KeyW' || e.key?.toLowerCase() === 'w') return 'w';
    if (e.code === 'KeyS' || e.key?.toLowerCase() === 's') return 's';
    return e.key?.toLowerCase() || '';
  };

  // Keys the page needs more than the game does. Tab in particular: swallowing
  // it would trap a keyboard user inside a 404 page.
  const PASS_THROUGH = new Set(['tab', 'shift', 'control', 'alt', 'meta', 'escape', 'f5']);

  const onKey = (e) => {
    if (e.key === 'Escape') { onExit?.(); return; }
    const k = bind(e);
    keys.add(k);
    if (PASS_THROUGH.has(k)) return;
    // The title says PRESS ANY KEY, so any key has to work — it used to mean
    // "press one of four keys", which is a different sentence.
    if (titleScreen) { commit(0); e.preventDefault(); return; }

    // Inside a mini-game the same keys mean different things: W/S drive a
    // cursor rather than the throttle, and Enter commits rather than dismissing
    // a card. Branching here keeps that switch in ONE place instead of leaving
    // every downstream reader to work out which mode it is in.
    // On the arrival screen V opens what the settlement kept. Checked before
    // the generic "any key restarts" so the one key that matters is not eaten
    // by a new run.
    if (run.phase === 'over' && run.ending === 'arrive' && k === 'v') {
      onFound?.(); e.preventDefault(); return;
    }
    if (run.phase === 'minigame') {
      if (k === 'e') mgLeave = true;
      else if (k === 'enter' || k === ' ') mgAct = true;
      else if (k === 'arrowleft' || k === 'a') mgStepX = -1;
      else if (k === 'arrowright' || k === 'd') mgStepX = 1;
      else if (k === 'arrowup' || k === 'w') mgStepY = -1;
      else if (k === 'arrowdown' || k === 's') mgStepY = 1;
      else if (!/^[1-9]$/.test(k)) return;
      e.preventDefault();
      return;
    }
    // W/S are the throttle; the arrows move between choices. Overloading the
    // arrows onto both would mean picking an option nudges the accelerator.
    if (k === 'arrowup') hover = Math.max(0, hover - 1);
    else if (k === 'arrowdown') hover += 1;
    else if (k === 'enter' || k === ' ') commit(hover);
    else if (/^[1-4]$/.test(k)) commit(Number(k) - 1);
    else if (k !== 'w' && k !== 's') return;   // not ours — leave it alone
    // EVERY key the game claims must be swallowed, including the letters.
    //
    // W and S used to fall through, and in a browser with find-as-you-type on
    // that is not a small bug: every press opened the quick-find bar, ate the
    // key, and left the accelerator dead. The game looked broken and the fault
    // was one missing call. A key you act on is a key you have to consume.
    e.preventDefault();
  };
  const onKeyUp = (e) => keys.delete(bind(e));

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
    if (run.phase === 'minigame') { ptr = { x, y }; tap = { x, y }; return; }
    if (run.phase === 'over' && run.ending === 'arrive' && inPad(VAULT, x, y)) { onFound?.(); return; }
    if (run.phase === 'outcome' || run.phase === 'over') { commit(0); return; }
    if (run.phase === 'event') {
      const hit = choiceBoxes.findIndex((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
      if (hit >= 0) { commit(hit); return; }
    }
    if (inPad(GAS, x, y)) held = 'gas';
    else if (inPad(BRAKE, x, y)) held = 'brake';
  };
  const onUp = () => { held = null; ptr = null; };
  const onMove = (ev) => {
    if (run.phase === 'minigame') {
      if (ptr) { const p = pointAt(ev); ptr.x = p.x; ptr.y = p.y; }
      return;
    }
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
  canvas.addEventListener('touchmove', onMove, { passive: false });

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

  // ── mini-games ──────────────────────────────────────────────────────────
  // One input shape for all three. The games differ in how they read it —
  // `axis: 'step'` wants a cursor nudge per press, `axis: 'analog'` wants a
  // direction held — and declaring that in the game's own meta beats teaching
  // this function the difference between a supermarket and a stealth section.
  function mgInput(m) {
    const ax = (a, b) => (keys.has(a) ? -1 : 0) + (keys.has(b) ? 1 : 0);
    const analog = m.meta.axis === 'analog';
    const inp = {
      dx: analog ? ax('arrowleft', 'arrowright') + ax('a', 'd') : mgStepX,
      dy: analog ? ax('arrowup', 'arrowdown') + ax('w', 's') : mgStepY,
      hold: keys.has('enter') || keys.has(' '),
      alt: keys.has('shift'),
      act: mgAct,
      leave: mgLeave,
      at: ptr,
      tap,
    };
    mgStepX = 0; mgStepY = 0; mgAct = false; mgLeave = false; tap = null;
    return inp;
  }

  // ── frame ───────────────────────────────────────────────────────────────
  const frame = (now) => {
    // Clamped: a backgrounded tab must not teleport you down the road, and a
    // dt of several seconds would skip straight past a fuel-out.
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t = now;

    const mgMod = run.phase === 'minigame' ? MINIGAMES[run.mgId] : null;

    if (run.phase === 'over') arrive();
    if (!titleScreen && run.phase !== 'over') {
      // No throttle while parked — the same keys are the mini-game's now.
      if (!mgMod) throttle(dt);
      travel(run, dt);
      if (mgMod) stepMinigame(run, dt, mgInput(mgMod));
      else spawnDust(dt);
    }

    // A mini-game owns the whole picture; the road does not show through it.
    if (mgMod && run.phase === 'minigame') {
      mgMod.draw(s, run.mg, t);
      hud(true);
      const mgView = s.present();
      hudText(mgView);
      mgMod.overlay(mgView, run.mg, t, text, PAL);
      // Name it, then tell them how to play it — for six seconds, then get out
      // of the way. A mini-game nobody has seen before with no controls listed
      // is a puzzle about the keyboard rather than about the supermarket.
      const elapsed = mgMod.meta.seconds - run.mg.left;
      text(mgView, mgMod.meta.title, 160, 164, {
        size: 7, align: 'center', col: elapsed < 6 ? PAL[10] : PAL[5],
      });
      if (elapsed < 6) {
        text(mgView, mgMod.meta.hint, 160, 173, { size: 6, align: 'center', col: PAL[6] });
      }
      raf = requestAnimationFrame(frame);
      return;
    }

    const bi = biomeAt(run.dist);
    const b = BIOMES[bi];
    scene(s, b, run.dist - biomeStart(bi));

    // The obstacle, closing. Rendered before the vehicle so the vehicle can
    // pass in front of it, which is the only cue that says "this is on the
    // road with you" rather than "this is a picture in a box".
    //
    // It closes on the CLOCK rather than on distance, and it appears at the
    // horizon exactly when the countdown starts flashing. Two things then say
    // the same thing at the same time — the bar and the boulder — and the
    // moment it arrives is the moment the run decides for you.
    //
    // Measured in miles it could not do that: the vehicle is held to a crawl
    // during an encounter, so a fixed distance ahead was covered in a third of
    // the window and the obstacle then sat on the bumper for the rest of it.
    if (run.phase === 'event' && run.event?.obstacleSprite) {
      const frac = Math.max(0, run.eventLeft / EVENT_SECONDS);
      if (frac <= WARN_AT) drawObstacle(s, run.event.obstacleSprite, 1 - frac / WARN_AT);
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
    if (!titleScreen) hudText(view);
    if (titleScreen) drawTitle(view);
    else if (run.phase === 'event') drawEvent(view);
    else if (run.phase === 'outcome') drawOutcome(view);
    else if (run.phase === 'over') drawOver(view);
    else drawTravel(view, b);

    raf = requestAnimationFrame(frame);
  };

  // ── the pixel layer of the HUD ──────────────────────────────────────────
  function hud(parked = false) {
    s.rect(0, 0, W, 22, 0);
    s.rect(0, 22, W, 1, 5);
    let x = 4;
    for (const k of RESOURCES) {
      icon(s, k, x, 3);
      s.rect(x, 13, 26, 4, 1);
      s.rect(x, 13, Math.round(26 * Math.max(0, Math.min(1, run.res[k] / 20))), 4, ITEMS[k].colour);
      x += 34;
    }
    icon(s, 'heart', x, 3);
    s.rect(x, 13, 26, 4, 1);
    s.rect(x, 13, Math.round(26 * (run.hp / MAX_HP)), 4, 8);
    // Scrap and protection are COUNTS, not levels — there is no "full" to draw
    // a bar against, and a two-pixel bar for a number between nought and two
    // says less than the number does.
    kitX = x + 34;
    let kx = kitX;
    for (const k of KIT) { icon(s, k, kx, 3); kx += 30; }

    if (parked) return;
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

    // Parked in a mini-game the journey furniture is meaningless — a speed dial
    // reading zero and a progress bar that cannot move — and the strip it sits
    // in is the only clear place to put the mini-game's name and its controls.
    // So it is the mini-game's, and the games draw nothing below y=160.
    if (parked) return;
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

  /** The numbers that go with hud()'s pixels. Text lives at device resolution,
   *  so it cannot be drawn into the world buffer with everything else. */
  function hudText(view) {
    let x = kitX;
    for (const k of KIT) {
      text(view, `${Math.round(run.res[k])}`, x + 9, 4, {
        size: 7, col: run.res[k] > 0 ? PAL[ITEMS[k].colour] : PAL[5],
      });
      x += 30;
    }
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
    text(view, '500 miles. One life. No saves.', W / 2, 70, { size: 7, align: 'center', col: PAL[6] });
    // The road will not feed you. Saying so on the title screen is not a spoiler
    // — it is the strategy, and a player who works it out on run four has spent
    // three runs losing to a rule nobody mentioned.
    text(view, 'Sweep the shops. Haggle at the post. Raid, if you dare.', W / 2, 82, {
      size: 6, align: 'center', col: PAL[11],
    });
    text(view, 'W / S or the pads to drive', W / 2, 92, { size: 6, align: 'center', col: PAL[13] });
    // Stated up front, because a rule you only discover by losing to it is a
    // trick. The encounter clock is generous now; what it does at zero is not.
    text(view, 'Run the clock out and it chooses the worst for you', W / 2, 101, {
      size: 6, align: 'center', col: PAL[9],
    });
    if (stats.runs > 0) {
      text(view, `Best ${stats.best} mi  ·  Runs ${stats.runs}`, W / 2, 111, { size: 6, align: 'center', col: PAL[13] });
    }
    text(view, blink() ? 'PRESS ANY KEY OR TAP' : '', W / 2, 123, { size: 7, align: 'center', col: UI });
    text(view, 'Esc to leave', W / 2, 134, { size: 6, align: 'center', col: PAL[5] });
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

    // The countdown is the whole reason this is real time. A bar for the first
    // half — quiet, so reading is not done under a strobe — and then a warning
    // for the second, because forty seconds is long enough that a player who
    // has stopped watching the clock deserves to be told.
    const { ctx, scale, ox, oy } = view;
    const frac = Math.max(0, run.eventLeft / EVENT_SECONDS);
    const warn = frac < WARN_AT;
    const urgent = frac < URGENT_AT;
    // Faster as it gets worse. A flash at a constant rate reads as decoration
    // after the second one; a flash that accelerates reads as a countdown.
    const on = !warn || flash(urgent ? 160 : 400);
    ctx.fillStyle = warn ? (on ? PAL[8] : PAL[2]) : PAL[10];
    ctx.fillRect(ox, oy + top * scale, W * scale * frac, (warn ? 3 : 2) * scale);

    if (warn) {
      // Says what is about to happen, not just that time is short. The penalty
      // for running out is the WORST option on the board, and a player who has
      // not been told that will read it as the game misfiring.
      text(view, on ? `DECIDING FOR YOU IN ${Math.ceil(run.eventLeft)}` : '', W / 2, top - 12, {
        size: 7, align: 'center', col: urgent ? PAL[8] : PAL[9],
      });
    }

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
    const boxH = 34 + lines.length * 10 + (deltas.length ? 12 : 0) + (o.lesson ? 12 : 0);
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
    // The lesson, stated once, under the thing that just taught it. A mini-game
    // that punishes you without naming why is a puzzle; naming it is the whole
    // reason these exist.
    if (o.lesson) {
      text(view, o.lesson, 12, top + boxH - 22, { size: 6, col: PAL[9] });
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
    text(view, `Best ${Math.max(stats.best, Math.round(run.dist))} mi  ·  Run ${stats.runs + 1}`, W / 2, 122, {
      size: 6, align: 'center', col: PAL[13],
    });
    if (win) {
      // The prize. Drawn as a button because on a phone there is no V key, and
      // a reward you cannot reach is not a reward.
      const { ctx, scale, ox, oy } = view;
      ctx.fillStyle = PAL[3];
      ctx.fillRect(ox + VAULT.x * scale, oy + VAULT.y * scale, VAULT.w * scale, VAULT.h * scale);
      text(view, 'THEY KEPT THE LIBRARY', W / 2, VAULT.y + 5, { size: 7, align: 'center', col: PAL[7] });
      text(view, blink() ? 'PRESS V OR TAP IT' : '', W / 2, 152, { size: 6, align: 'center', col: PAL[11] });
    } else {
      text(view, blink() ? 'TAP TO GO AGAIN' : '', W / 2, 138, { size: 7, align: 'center', col: UI });
    }
  }

  const flash = (period) => Math.floor(t / period) % 2 === 0;
  const blink = () => flash(500);

  raf = requestAnimationFrame(frame);

  function unmount() {
    if (canvas.__trailUnmount === unmount) delete canvas.__trailUnmount;
    delete canvas.__trailRun;
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
    canvas.removeEventListener('touchmove', onMove);
    if (!titleScreen && run.dist > 0 && run.phase !== 'over') writeStats(run);
  }

  canvas.__trailUnmount = unmount;
  return unmount;
}

export { defaultChoice };
export default mount;
