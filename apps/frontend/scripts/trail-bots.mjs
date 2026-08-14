/* Bots that PLAY the mini-games, so the balance simulation still means
 * something now that the mini-games are where the difficulty lives.
 *
 * Without these, verify-trail.mjs would have to skip every encounter that
 * opens one — which is most of the interesting ones — and the win rate it
 * printed would describe a game nobody plays. These are deliberately
 * mediocre: they use the obvious strategy and none of the clever ones, so the
 * number they produce is a floor for a thinking human rather than a ceiling.
 *
 * They are also the only way to know a mini-game TERMINATES. All three can be
 * driven to a result here in a few milliseconds; discovering that one of them
 * can deadlock by playing it in a browser for a minute is not a plan.
 */
import { COLS } from '../src/games/trail/minigames/scavenge.js';
import { GATE } from '../src/games/trail/minigames/raid.js';

// Roughly what a whole journey asks for. Used only to decide what to buy —
// the bot is not allowed to see the future, just to count its own tins.
const NEED = { fuel: 26, water: 16, food: 12, meds: 3 };

/** Fresh, per run — the bots hold a little state (cooldowns, "I already tried
 *  selling") and sharing that between runs would leak one run into the next. */
export function makeBots() {
  let cursorCool = 0;
  let soldOnce = false;
  let acts = 0;
  let stuck = 0;
  let lastX = 0;
  let dodge = 0;

  return {
    reset() { soldOnce = false; acts = 0; stuck = 0; dodge = 0; },

    // ── THE SWEEP ────────────────────────────────────────────────────────
    // Force shelves until the meter is into the red, then walk. The cap is
    // about eleven of the eighteen units, so this is roughly eight — what
    // somebody watching the bar would take. Backing out at two thirds is
    // available and safer; grinding all eighteen gets you robbed.
    scavenge(mg, dt) {
      if (mg.noise > 0.78) return { leave: true };
      if (!mg.cells[mg.cur].open) return { hold: true };
      cursorCool -= dt;
      if (cursorCool > 0) return {};
      cursorCool = 0.14;                       // a thumb, not a scanner
      const next = mg.cells.findIndex((c) => !c.open);
      if (next < 0) return { leave: true };
      const cx = mg.cur % COLS; const cy = Math.floor(mg.cur / COLS);
      const nx = next % COLS; const ny = Math.floor(next / COLS);
      return nx !== cx ? { dx: Math.sign(nx - cx) } : { dy: Math.sign(ny - cy) };
    },

    // ── THE RAID ─────────────────────────────────────────────────────────
    // Crouch the whole way, take the nearest cache, break line if spotted,
    // and leave after two. It gets stuck on crates, which is the point: a bot
    // that pathfinds perfectly would report a difficulty no player will meet.
    raid(mg, dt) {
      if (mg.lit) {
        let g = mg.guards[0]; let best = Infinity;
        for (const q of mg.guards) {
          const d = Math.hypot(q.px - mg.x, q.py - mg.y);
          if (d < best) { best = d; g = q; }
        }
        return { dx: mg.x - g.px, dy: mg.y - g.py, alt: true };
      }
      const taken = mg.caches.filter((c) => c.taken).length;
      const home = taken >= 2 || mg.left < 24;
      const open = mg.caches.filter((c) => !c.taken);
      const goal = home || !open.length
        ? { x: GATE.x + GATE.w / 2, y: GATE.y + GATE.h / 2 }
        : open.reduce((a, c) => (Math.hypot(c.x - mg.x, c.y - mg.y) < Math.hypot(a.x - mg.x, a.y - mg.y) ? c : a));

      if (!home && Math.hypot(goal.x - mg.x, goal.y - mg.y) < 7) return { hold: true, alt: true };

      // Unstick. Pinned against a crate, slide along it for a beat.
      if (Math.abs(mg.x - lastX) < 0.05) stuck += dt; else stuck = 0;
      lastX = mg.x;
      if (stuck > 0.7) { dodge = 0.6; stuck = 0; }
      if (dodge > 0) { dodge -= dt; return { dx: 0, dy: mg.y > 90 ? -1 : 1, alt: true }; }

      return { dx: goal.x - mg.x, dy: goal.y - mg.y, alt: true };
    },

    // ── THE POST ─────────────────────────────────────────────────────────
    // Buy protection when it is affordable, inspect before buying anything
    // else, sell surplus once, then leave. Notably it does NOT haggle — the
    // margin haggling wins is exactly the headroom a real player has over this.
    trade(mg) {
      acts += 1;
      if (acts > 60) return { leave: true };
      const live = mg.offers.map((o, i) => ({ o, i })).filter(({ o }) => !o.gone);
      const afford = live.filter(({ o }) => o.price <= mg.purse);

      const prot = afford.find(({ o }) => o.kind === 'protection');
      if (prot && !mg.stock.protection && mg.patience > 1) return { row: prot.i, col: 2, act: true };

      // By NEED, not by price. Sorting on cost-per-unit means always buying
      // food, which is the one thing the road is not short of — the bot stood
      // at a stall selling fuel and walked out with groceries, then ran dry
      // forty miles from the end.
      const short = ['fuel', 'water', 'food', 'meds']
        .filter((k) => (mg.stock[k] || 0) < NEED[k]);
      const buy = afford
        .filter(({ o }) => o.kind !== 'protection')
        .sort((a, b) => short.indexOf(b.o.kind) - short.indexOf(a.o.kind)
          || a.o.price / a.o.n - b.o.price / b.o.n)
        .filter(({ o }) => short.includes(o.kind))[0];
      if (buy) {
        if (!buy.o.inspected && mg.patience > 2) return { row: buy.i, col: 0, act: true };
        return { row: buy.i, col: 2, act: true };
      }
      if (!soldOnce) { soldOnce = true; return { row: mg.offers.length, act: true }; }
      return { leave: true };
    },
  };
}
