// Boot for the dev harness.
//
// It imports the SHIPPED game — not a copy of it — so there is only ever one
// version of the rules, the drawing and the content to keep straight. A
// second implementation for "quick iteration" drifts from the real one within
// a day, and then every bug has to be diagnosed twice.
import { mount } from '../src/games/trail/index.js';

mount(document.getElementById('c'), {
  onExit: () => {
    document.getElementById('note').textContent = 'esc pressed — reload to restart';
  },
});
