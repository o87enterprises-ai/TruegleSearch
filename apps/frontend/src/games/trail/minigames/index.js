import * as scavenge from './scavenge';
import * as raid from './raid';
import * as trade from './trade';

// The three mini-games, behind one shape.
//
// Difficulty in TRAIL used to be arithmetic: the road cost more than you could
// carry and you lost by subtraction. That is a tax, not a game. These are where
// the difficulty lives now — things you DO, that you can get better at — and
// the economy underneath was loosened to make room for them.
//
// Every one of them is split the same way, for the same reason state.js is
// split from draw.js: `create` and `step` never touch the DOM, so the balance
// simulation can play all three across a hundred and twenty seeds. A mini-game
// that can only be evaluated by a human with a keyboard cannot be balanced, and
// an unbalanceable game is one that ships broken.
//
//   meta     { id, title, seconds, hint, lesson }
//   create   (run, rand, res) -> state
//   step     (state, dt, input) -> state          // sets .done and .how
//   finish   (state, protection) -> { deltas, text, failed, lesson, fatal? }
//   draw     (screen, state, t)                   // world buffer
//   overlay  (view, state, t, text, PAL)          // text layer, device res
//
// `input` is one shape for all three, filled in by whichever of keys or touch
// happened: { dx, dy, act, hold, alt, leave, row, col }. `act` and `leave` are
// EDGES (true for exactly one step); `hold` and `alt` are levels.
export const MINIGAMES = { scavenge, raid, trade };

export const isMinigame = (id) => Object.prototype.hasOwnProperty.call(MINIGAMES, id);
