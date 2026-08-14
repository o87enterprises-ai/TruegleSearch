// THE POST — a trading stall, a purse of scrap, and a trader who is losing
// patience with you.
//
// Three lessons, all mechanical rather than written on the wall:
//
//   BARGAINING — the first price is never the price. Haggling works. It also
//     costs patience, and one time in four the trader takes offence and the
//     price goes UP, so there is a point past which pushing is just losing.
//   TRUST NO ONE — a third of the stock is not what the label says. Inspecting
//     reveals it, and inspecting costs patience too, so you cannot check
//     everything: you have to decide what is worth checking.
//   BE RESOURCEFUL — you can sell what the road has not asked you for. Selling
//     is at a bad rate, because it always is.
//
// PROTECTION is on the shelf here and nowhere else. It is the only thing that
// survives being caught on a raid, and the connection is meant to be learned
// the expensive way at least once.

export const meta = {
  id: 'trade',
  title: 'THE POST',
  seconds: 75,
  hint: 'UP/DOWN A ROW  ·  LEFT/RIGHT AN ACTION  ·  ENTER OR TAP  ·  E TO LEAVE',
  axis: 'step',
  lesson: 'The first price is never the price. Look before you pay.',
};

// Scrap per unit.
//
// Protection was 9, which after markup is 11-15 scrap against a starting purse
// of 6 — so across 120 simulated runs the raid was entered 28 times, and the
// whole intended progression (sweep for scrap, buy protection, raid for real
// supplies) was gated behind a price nobody could reach. It should be a
// DECISION, not a wall.
const BASE = { fuel: 2.6, water: 2.4, food: 1.1, meds: 3.4, protection: 6 };
const SELLABLE = ['food', 'water', 'fuel', 'meds'];
const SELL_RATE = 0.5;          // you always sell low
const HAGGLE_OFF = 0.18;
const HAGGLE_BACKFIRE = 0.25;
export const ACTIONS = ['INSPECT', 'HAGGLE', 'BUY'];

export function create(run, rand, res = {}) {
  const kinds = ['fuel', 'water', 'food', 'meds'];
  const offers = [];
  // One protection, always. The lesson cannot be learned from a shelf that
  // sometimes has nothing on it.
  offers.push(mkOffer('protection', 1, rand, false));
  for (let i = 0; i < 3; i += 1) {
    const kind = kinds[Math.floor(rand() * kinds.length)];
    const n = kind === 'meds' ? 1 + Math.floor(rand() * 2) : 2 + Math.floor(rand() * 4);
    offers.push(mkOffer(kind, n, rand, rand() < 0.34));
  }
  return {
    id: 'trade',
    // Kept on the state so haggling rolls off the RUN's seed. An early draft
    // reached for Math.random here, which quietly broke the one guarantee the
    // whole game is built on: that a seed replays exactly.
    rand,
    offers,
    purse: res.scrap || 0,
    stock: { ...res },
    patience: 5,
    sel: 0,
    act: 2,
    left: meta.seconds,
    done: false,
    how: null,             // 'left' | 'time' | 'thrown-out'
    bought: [],            // { kind, n, scam } for the receipt
    sold: {},
    flash: 0,
    flashText: '',
  };
}

function mkOffer(kind, n, rand, scam) {
  const fair = BASE[kind] * n;
  return {
    kind,
    n,
    // Marked up 25-70%, which is what makes haggling worth doing at all.
    price: Math.max(1, Math.round(fair * (1.25 + rand() * 0.45))),
    scam,
    inspected: false,
    haggles: 0,
    gone: false,
  };
}

export const ROWS = (mg) => mg.offers.length + 2;   // offers, then SELL, then LEAVE

export function step(mg, dt, input) {
  if (mg.done) return mg;
  mg.left -= dt;
  mg.flash = Math.max(0, mg.flash - dt);

  const rows = ROWS(mg);
  // Same defaulting as the sweep: only the axis that moved has to be present.
  if (input.dy) mg.sel = clamp(mg.sel + (input.dy || 0), 0, rows - 1);
  if (input.dx) mg.act = clamp(mg.act + (input.dx || 0), 0, ACTIONS.length - 1);
  if (typeof input.row === 'number') mg.sel = clamp(input.row, 0, rows - 1);
  if (typeof input.col === 'number') mg.act = clamp(input.col, 0, ACTIONS.length - 1);

  // Touch: one tap lands on a row AND a button, so the finger does in one
  // gesture what the keyboard needs three keys for.
  if (input.tap) {
    for (let i = 0; i < rows; i += 1) {
      if (!hitRow(input.tap, i)) continue;
      mg.sel = i;
      const c = COL_X.findIndex((x) => input.tap.x >= x && input.tap.x <= x + COL_W);
      if (mg.offers[i] && c >= 0) mg.act = c;
      commit(mg);
      break;
    }
  }

  if (input.act && !mg.done) commit(mg);
  if (input.leave) { mg.done = true; mg.how = 'left'; }
  else if (mg.patience <= 0) { mg.done = true; mg.how = 'thrown-out'; }
  else if (mg.left <= 0) { mg.done = true; mg.how = 'time'; }
  return mg;
}

const hitRow = (pt, i) => {
  const r = rowRect(i);
  return pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h;
};

function say(mg, s) { mg.flash = 1.8; mg.flashText = s; }

function commit(mg) {
  if (mg.sel === ROWS(mg) - 1) { mg.done = true; mg.how = 'left'; return; }
  if (mg.sel === mg.offers.length) { sell(mg); return; }

  const o = mg.offers[mg.sel];
  if (o.gone) { say(mg, 'ALREADY YOURS'); return; }

  if (ACTIONS[mg.act] === 'INSPECT') {
    if (o.inspected) { say(mg, 'YOU LOOKED ALREADY'); return; }
    o.inspected = true;
    mg.patience -= 1;
    say(mg, o.scam ? 'WATERED DOWN — HALF OF IT IS NOT WHAT IT SAYS' : 'IT IS WHAT HE SAYS IT IS');
    return;
  }

  if (ACTIONS[mg.act] === 'HAGGLE') {
    if (o.haggles >= 2) { say(mg, 'HE IS DONE MOVING ON THAT'); return; }
    o.haggles += 1;
    mg.patience -= 1;
    // A quarter of the time pushing costs you. Knowing when to stop is the
    // lesson; a haggle that always worked would just be a button.
    if (mg.rand() < HAGGLE_BACKFIRE) {
      o.price = Math.ceil(o.price * 1.12);
      mg.patience -= 1;
      say(mg, 'HE TAKES OFFENCE. THE PRICE GOES UP.');
    } else {
      o.price = Math.max(1, Math.round(o.price * (1 - HAGGLE_OFF)));
      say(mg, 'HE COMES DOWN A LITTLE');
    }
    return;
  }

  // BUY
  if (mg.purse < o.price) { say(mg, 'NOT ENOUGH SCRAP'); return; }
  mg.purse -= o.price;
  o.gone = true;
  // A scam delivers roughly a third, and you only find out now if you did not
  // look. The number is not hidden after the fact — being cheated has to be
  // legible or it reads as a bug.
  const got = o.scam ? Math.max(1, Math.round(o.n * 0.34)) : o.n;
  mg.bought.push({ kind: o.kind, n: got, scam: o.scam, paid: o.price, cheated: o.scam && !o.inspected });
  say(mg, o.scam && !o.inspected ? `SHORT MEASURE — ${got} OF ${o.n}` : `+${got} ${o.kind}`);
}

function sell(mg) {
  // Sell whatever you are longest on, three at a time. Deciding WHAT is
  // surplus is the player's job on the road; here it is just the exchange.
  const kind = SELLABLE
    .filter((k) => (mg.stock[k] || 0) - (mg.sold[k] || 0) >= 4)
    .sort((a, b) => (mg.stock[b] - (mg.sold[b] || 0)) - (mg.stock[a] - (mg.sold[a] || 0)))[0];
  if (!kind) { say(mg, 'NOTHING YOU CAN SPARE'); return; }
  const n = 3;
  const paid = Math.max(1, Math.round(BASE[kind] * n * SELL_RATE));
  mg.sold[kind] = (mg.sold[kind] || 0) + n;
  mg.purse += paid;
  say(mg, `SOLD ${n} ${kind} FOR ${paid} SCRAP`);
}

export function finish(mg) {
  const deltas = {};
  const bump = (k, v) => { deltas[k] = (deltas[k] || 0) + v; };
  for (const b of mg.bought) bump(b.kind, b.n);
  for (const [k, v] of Object.entries(mg.sold)) bump(k, -v);
  // Net scrap: what is in the purse now versus what walked in.
  const spent = mg.purse - (mg.stock.scrap || 0);
  if (spent) bump('scrap', spent);
  for (const k of Object.keys(deltas)) if (!deltas[k]) delete deltas[k];

  const cheated = mg.bought.filter((b) => b.cheated).length;
  if (mg.how === 'thrown-out') {
    return {
      deltas,
      failed: true,
      text: 'He has had enough of you and puts the shutter down. Whatever was left on that shelf stays there.',
      lesson: meta.lesson,
    };
  }
  return {
    deltas,
    failed: cheated > 0,
    text: mg.bought.length
      ? (cheated
        ? 'Half a mile down the road you find out what you actually bought.'
        : 'Fair enough dealing, by the standards of the road.')
      : 'You look at everything and buy nothing. He has seen that before.',
    lesson: meta.lesson,
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── drawing ────────────────────────────────────────────────────────────────
export const ROW_H = 17;
export const ROW_Y0 = 40;
export const rowRect = (i) => ({ x: 10, y: ROW_Y0 + i * ROW_H, w: 300, h: ROW_H - 3 });
export const COL_X = [186, 224, 266];
export const COL_W = 36;

export function draw(s, mg) {
  s.clear(1);
  // A tarp, a counter and a lamp. Enough to say "stall" at this size.
  //
  // The stripes used to fill the whole band in PAL[14] hot pink, with the purse
  // and the patience pips sitting on top of it — legible in a palette swatch
  // and not on a screen. The colour is a two-pixel valance now and the text has
  // a dark bar to sit on.
  s.rect(0, 24, 320, 3, 2);
  for (let x = 0; x < 320; x += 24) s.rect(x, 24, 12, 3, 14);
  s.rect(0, 27, 320, 10, 0);
  s.rect(0, 37, 320, 122, 1);

  const rows = ROWS(mg);
  for (let i = 0; i < rows; i += 1) {
    const r = rowRect(i);
    const on = i === mg.sel;
    s.rect(r.x, r.y, r.w, r.h, on ? 5 : 0);
    if (on) s.rect(r.x, r.y, 2, r.h, 10);
    const offer = mg.offers[i];
    if (offer) {
      if (offer.gone) s.rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 1);
      // Action buttons, so the same targets work for a finger and a key.
      ACTIONS.forEach((_, c) => {
        const active = on && c === mg.act;
        s.rect(COL_X[c], r.y + 2, COL_W, r.h - 4, active ? 10 : 5);
        s.rect(COL_X[c], r.y + 2, COL_W, 1, active ? 7 : 6);
      });
      if (offer.inspected) s.rect(r.x + 3, r.y + 3, 3, 3, offer.scam ? 8 : 11);
    }
  }

  // Patience. It is the real clock in here.
  for (let i = 0; i < 5; i += 1) {
    s.rect(258 + i * 10, 29, 8, 6, i < mg.patience ? 11 : 5);
  }
}

export function overlay(view, mg, t, text, PAL) {
  text(view, 'PATIENCE', 252, 29, { size: 6, align: 'right', col: PAL[6] });
  text(view, `SCRAP ${mg.purse}`, 10, 29, { size: 7, col: PAL[10] });
  text(view, `${Math.ceil(mg.left)}s`, 180, 29, { size: 6, align: 'right', col: mg.left < 15 ? PAL[8] : PAL[13] });

  const rows = ROWS(mg);
  for (let i = 0; i < rows; i += 1) {
    const r = rowRect(i);
    const on = i === mg.sel;
    const o = mg.offers[i];
    if (o) {
      const label = `${o.n} ${o.kind}`;
      const seen = o.inspected;
      text(view, o.gone ? `${label} — sold to you` : label, 16, r.y + 3, {
        size: 7, col: o.gone ? PAL[5] : (on ? PAL[7] : PAL[6]),
      });
      if (!o.gone) {
        text(view, `${o.price}`, 178, r.y + 3, { size: 7, align: 'right', col: PAL[10] });
        // What inspecting bought you: a word, permanently, on the row.
        if (seen) {
          text(view, o.scam ? 'SHORT' : 'GOOD', 16 + label.length * 4 + 8, r.y + 4, {
            size: 6, col: o.scam ? PAL[8] : PAL[11],
          });
        }
        ACTIONS.forEach((a, c) => {
          text(view, a, COL_X[c] + COL_W / 2, r.y + 4, {
            size: 6, align: 'center', col: on && c === mg.act ? PAL[0] : PAL[13],
          });
        });
      }
    } else if (i === mg.offers.length) {
      text(view, 'SELL 3 OF WHATEVER YOU HAVE MOST OF', 16, r.y + 3, { size: 7, col: on ? PAL[7] : PAL[6] });
    } else {
      text(view, 'BACK TO THE ROAD', 16, r.y + 3, { size: 7, col: on ? PAL[7] : PAL[6] });
    }
  }

  if (mg.flash > 0) {
    const bad = /SHORT|OFFENCE|NOT ENOUGH|NOTHING|ALREADY|DONE MOVING|WATERED/.test(mg.flashText);
    text(view, mg.flashText, 160, 149, { size: 7, align: 'center', col: bad ? PAL[8] : PAL[11] });
  } else if (Math.floor(t / 2600) % 2) {
    text(view, meta.lesson, 160, 149, { size: 6, align: 'center', col: PAL[13] });
  }
}
