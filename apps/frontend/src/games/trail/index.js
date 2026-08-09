import { createScreen, text, wrap, W, H, PAL, UI } from './engine';
import { scene, party, icon, hazard } from './draw';
import {
  newRun, travel, choose, resume, readStats, writeStats,
  biomeAt, biomeStart, BIOMES, ENDINGS, ITEMS, RESOURCES, TOTAL, MAX_HP,
} from './state';

// The loop, the screens and the input. Everything that needs a browser lives
// here; the rules live in state.js and the pixels in draw.js.
//
// Exported as a single mount() so the React side can lazy-load this whole
// module and know nothing about any of it.

const SPEED = 26; // world units per second while travelling

export function mount(canvas, { onExit } = {}) {
  const s = createScreen(canvas);
  let run = newRun();
  let stats = readStats();
  let raf = 0;
  let last = performance.now();
  let t = 0;
  let titleScreen = true;
  let hover = 0;          // highlighted choice, for keyboard play
  let choiceBoxes = [];   // hit rects in world coords, rebuilt each frame

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => s.resize()) : null;
  ro?.observe(canvas.parentElement || canvas);
  s.resize();

  // ── input ───────────────────────────────────────────────────────────────
  // Keyboard AND touch, both complete, because this will be opened on a phone
  // far more often than on a desktop.
  const act = (i) => {
    if (titleScreen) { titleScreen = false; return; }
    if (run.phase === 'event') { choose(run, i); hover = 0; }
    else if (run.phase === 'outcome') resume(run);
    else if (run.phase === 'over') { writeStats(run); stats = readStats(); run = newRun(); titleScreen = false; }
  };

  const onKey = (e) => {
    if (e.key === 'Escape') { onExit?.(); return; }
    const n = run.phase === 'event' ? run.event.choices.length : 1;
    if (e.key === 'ArrowUp' || e.key === 'w') { hover = (hover - 1 + n) % n; e.preventDefault(); }
    else if (e.key === 'ArrowDown' || e.key === 's') { hover = (hover + 1) % n; e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === ' ') { act(hover); e.preventDefault(); }
    else if (/^[1-4]$/.test(e.key)) act(Number(e.key) - 1);
  };

  const pointAt = (ev) => {
    const r = canvas.getBoundingClientRect();
    const p = ev.touches?.[0] || ev.changedTouches?.[0] || ev;
    const dpr = canvas.width / r.width;
    const sc = s.scale;
    const ox = (canvas.width - W * sc) / 2;
    const oy = (canvas.height - H * sc) / 2;
    return {
      x: ((p.clientX - r.left) * dpr - ox) / sc,
      y: ((p.clientY - r.top) * dpr - oy) / sc,
    };
  };

  const onTap = (ev) => {
    ev.preventDefault();
    const { x, y } = pointAt(ev);
    if (titleScreen || run.phase === 'outcome' || run.phase === 'over') { act(0); return; }
    if (run.phase === 'event') {
      const hit = choiceBoxes.findIndex((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
      if (hit >= 0) act(hit);
    }
  };

  const onMove = (ev) => {
    if (run.phase !== 'event') return;
    const { x, y } = pointAt(ev);
    const hit = choiceBoxes.findIndex((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (hit >= 0) hover = hit;
  };

  window.addEventListener('keydown', onKey);
  canvas.addEventListener('click', onTap);
  canvas.addEventListener('touchstart', onTap, { passive: false });
  canvas.addEventListener('mousemove', onMove);

  // ── frame ───────────────────────────────────────────────────────────────
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); // clamped: a backgrounded
    last = now;                                     // tab must not teleport you
    t = now;

    if (!titleScreen && run.phase === 'travel') {
      const steps = Math.max(1, Math.round(SPEED * dt));
      travel(run, steps);
    }

    const bi = biomeAt(run.dist);
    const b = BIOMES[bi];
    scene(s, b, run.dist - biomeStart(bi));
    party(s, t, { hurt: run.hp < MAX_HP * 0.35, dead: run.phase === 'over' && run.ending !== 'arrive' });
    hud(s);

    const view = s.present();
    if (titleScreen) drawTitle(view);
    else if (run.phase === 'event') drawEvent(view);
    else if (run.phase === 'outcome') drawOutcome(view);
    else if (run.phase === 'over') drawOver(view);
    else drawTravel(view, b);

    raf = requestAnimationFrame(frame);
  };

  // ── the pixel HUD (icons + bars live in the world layer) ────────────────
  function hud() {
    s.rect(0, 0, W, 22, 0);
    s.rect(0, 22, W, 1, 5);
    let x = 4;
    for (const k of RESOURCES) {
      icon(s, k, x, 3);
      const full = Math.max(0, Math.min(1, run.res[k] / 20));
      s.rect(x, 13, 30, 4, 1);
      s.rect(x, 13, Math.round(30 * full), 4, ITEMS[k].colour);
      x += 38;
    }
    icon(s, 'heart', x + 6, 3);
    s.rect(x + 6, 13, 30, 4, 1);
    s.rect(x + 6, 13, Math.round(30 * (run.hp / MAX_HP)), 4, 8);

    // Progress along the whole road, biomes marked.
    const bar = W - 12;
    s.rect(6, H - 7, bar, 3, 1);
    s.rect(6, H - 7, Math.round(bar * (run.dist / TOTAL)), 3, 11);
    let acc = 0;
    for (const bm of BIOMES.slice(0, -1)) {
      acc += bm.distance;
      s.rect(6 + Math.round(bar * (acc / TOTAL)), H - 9, 1, 7, 6);
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
    panel(view, 40, 100);
    text(view, 'TRAIL', W / 2, 50, { size: 20, align: 'center', col: PAL[10] });
    text(view, '500 miles. One life. No saves.', W / 2, 76, { size: 7, align: 'center', col: PAL[6] });
    if (stats.runs > 0) {
      text(view, `Best: ${stats.best} mi  ·  Runs: ${stats.runs}`, W / 2, 90, { size: 6, align: 'center', col: PAL[13] });
    }
    text(view, blink() ? 'PRESS ANY KEY OR TAP' : '', W / 2, 112, { size: 7, align: 'center', col: UI });
    text(view, 'Esc to leave', W / 2, 128, { size: 6, align: 'center', col: PAL[5] });
  }

  function drawTravel(view, b) {
    text(view, b.label.toUpperCase(), 6, 26, { size: 6, col: PAL[6] });
    text(view, `${Math.round(run.dist)} / ${TOTAL} mi`, W - 6, 26, { size: 6, col: PAL[6], align: 'right' });
    if (run.dying && run.res[run.dying] <= 0) {
      text(view, `OUT OF ${run.dying.toUpperCase()}`, W / 2, 40, { size: 8, align: 'center', col: blink() ? PAL[8] : PAL[9] });
    }
  }

  function drawEvent(view) {
    const lines = wrap(view, run.event.text, W - 24, 7);
    const boxH = 30 + lines.length * 10 + run.event.choices.length * 13;
    const top = H - boxH - 12;
    panel(view, top, boxH);
    hazardBadge(view, top);

    lines.forEach((l, i) => text(view, l, 12, top + 8 + i * 10, { size: 7, col: PAL[7] }));

    choiceBoxes = [];
    const cTop = top + 14 + lines.length * 10;
    run.event.choices.forEach((c, i) => {
      const y = cTop + i * 13;
      choiceBoxes.push({ x: 8, y: y - 2, w: W - 16, h: 12 });
      const on = i === hover;
      if (on) {
        const { ctx, scale, ox, oy } = view;
        ctx.fillStyle = 'rgba(255,236,39,0.16)';
        ctx.fillRect(ox + 8 * scale, oy + (y - 2) * scale, (W - 16) * scale, 12 * scale);
      }
      text(view, `${on ? '>' : ' '} ${i + 1}. ${c.label}`, 12, y, { size: 7, col: on ? PAL[10] : PAL[6] });
    });
  }

  function hazardBadge(view, top) {
    // The badge is a world-layer sprite, but the panel is drawn on top of the
    // world — so it is re-drawn here into the visible context as a block of
    // colour rather than reaching back into the buffer.
    const { ctx, scale, ox, oy } = view;
    const kind = BIOMES[biomeAt(run.dist)].hazards[0];
    const size = 8 * scale;
    ctx.save();
    ctx.translate(ox + (W - 18) * scale, oy + (top + 4) * scale);
    ctx.scale(scale, scale);
    const tmp = { rect: (x, y, w, h, col) => { ctx.fillStyle = PAL[col]; ctx.fillRect(x, y, w, h); } };
    hazard(tmp, kind, 0, 0);
    ctx.restore();
    void size;
  }

  function drawOutcome(view) {
    const o = run.outcome;
    const lines = wrap(view, o.text, W - 24, 7);
    const deltas = Object.entries(o.deltas).filter(([, v]) => v);
    const boxH = 34 + lines.length * 10 + (deltas.length ? 12 : 0);
    const top = H - boxH - 12;
    panel(view, top, boxH);

    text(view, o.failed ? 'THAT WENT BADLY' : 'ALRIGHT', 12, top + 6, {
      size: 7, col: o.failed ? PAL[8] : PAL[11],
    });
    lines.forEach((l, i) => text(view, l, 12, top + 18 + i * 10, { size: 7, col: PAL[7] }));

    if (deltas.length) {
      const y = top + 20 + lines.length * 10;
      let x = 12;
      for (const [k, v] of deltas) {
        const label = k === 'hp' ? 'health' : (ITEMS[k]?.label.toLowerCase() || k);
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

  return function unmount() {
    cancelAnimationFrame(raf);
    ro?.disconnect();
    window.removeEventListener('keydown', onKey);
    canvas.removeEventListener('click', onTap);
    canvas.removeEventListener('touchstart', onTap);
    canvas.removeEventListener('mousemove', onMove);
    // A run abandoned by closing the tab still counted — it happened.
    if (!titleScreen && run.dist > 0 && run.phase !== 'over') writeStats(run);
  };
}

export default mount;
