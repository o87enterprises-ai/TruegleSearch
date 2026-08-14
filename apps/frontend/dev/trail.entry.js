// Boot for the dev harness.
//
// It imports the SHIPPED game — not a copy of it — so there is only ever one
// version of the rules, the drawing and the content to keep straight. A
// second implementation for "quick iteration" drifts from the real one within
// a day, and then every bug has to be diagnosed twice.
import { mount } from '../src/games/trail/index.js';
import { startMinigame } from '../src/games/trail/state.js';

// Dev-only: jump straight into a mini-game instead of driving until one turns
// up. This file is the harness, not the game — nothing here is bundled into
// the 404 page, which is why the shortcut lives at this end rather than as a
// debug flag inside the game.
window.__trailStart = (id) => startMinigame(document.getElementById('c').__trailRun, id);

mount(document.getElementById('c'), {
  onExit: () => {
    document.getElementById('note').textContent = 'esc pressed — reload to restart';
  },
});
