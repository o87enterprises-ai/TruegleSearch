// KEYBOARD CONTROLS FOR THE GAME BOY PLAYER (owner, 2026-11-11: "arrow controls /
// wasd for desktop users of the games category as well as a space bar (b) enter (a)
// controls as well so the desktop users can easily play the gameboy").
//
// The player was touch-only by design; this adds a keyboard, so a desktop visitor
// is not left with an on-screen d-pad they have to click.
//
//   Arrow keys or WASD   the d-pad
//   Space                B
//   Enter                A
//   E                    Start     } not in the request, but many games cannot be
//   Q                    Select    } started without Start. Change them HERE.
//
// Keys are matched on `event.code` (the physical key), not `event.key`, so WASD
// stays under the left hand on AZERTY/Dvorak layouts too.
//
// Pure on purpose — the DOM and the emulator are injected — so every rule below can
// be tested without a browser. See scripts/verify-gameboy-keys.mjs.

/** Every key, in the order the on-screen legend shows them. */
export const GAMEBOY_KEYS = [
  { button: 'up', codes: ['ArrowUp', 'KeyW'], label: '↑ / W', name: 'Up' },
  { button: 'down', codes: ['ArrowDown', 'KeyS'], label: '↓ / S', name: 'Down' },
  { button: 'left', codes: ['ArrowLeft', 'KeyA'], label: '← / A', name: 'Left' },
  { button: 'right', codes: ['ArrowRight', 'KeyD'], label: '→ / D', name: 'Right' },
  { button: 'b', codes: ['Space'], label: 'Space', name: 'B' },
  { button: 'a', codes: ['Enter', 'NumpadEnter'], label: 'Enter', name: 'A' },
  { button: 'start', codes: ['KeyE'], label: 'E', name: 'Start' },
  { button: 'select', codes: ['KeyQ'], label: 'Q', name: 'Select' },
];

const CODE_TO_BUTTON = Object.fromEntries(GAMEBOY_KEYS.flatMap(({ button, codes }) => codes.map((c) => [c, button])));
const BUTTON_TO_CODES = Object.fromEntries(GAMEBOY_KEYS.map(({ button, codes }) => [button, codes]));
// These three also ACTIVATE a focused button/link, so they are left alone when one has focus.
const ACTIVATING = new Set(['Enter', 'NumpadEnter', 'Space']);

/** Somewhere the person is typing: every key there belongs to the text. */
function isTypingTarget(t) {
  const tag = t?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!t?.isContentEditable;
}

/** Something Enter or Space would press: a button, a link, a role=button. */
function isPressable(t) {
  return !!t?.closest?.('button, a[href], summary, [role="button"]');
}

/**
 * @param {(button: string, pressed: boolean) => void} apply  called only when a
 *   button's state really changes (the emulator wants state, not key repeats)
 * @returns {{ keydown(e): boolean, keyup(e): boolean, releaseAll(): void }}
 *   keydown/keyup return true when the event was one of ours, so the caller can
 *   preventDefault() it (an arrow or Space would otherwise scroll the page behind).
 */
export function createGameboyKeys(apply) {
  const held = new Set();   // physical keys currently down, by event.code
  const isDown = (button) => BUTTON_TO_CODES[button].some((c) => held.has(c));

  function press(code) {
    const button = CODE_TO_BUTTON[code];
    const before = isDown(button);
    held.add(code);
    if (!before) apply(button, true);
  }

  function release(code) {
    const button = CODE_TO_BUTTON[code];
    held.delete(code);
    // Two keys can mean one button (ArrowLeft and A): it stays down until BOTH are up.
    if (!isDown(button)) apply(button, false);
  }

  return {
    keydown(e) {
      const code = e?.code;
      if (!CODE_TO_BUTTON[code]) return false;
      // Ctrl/Cmd/Alt + a key is a browser shortcut (Ctrl+S, Cmd+A, Alt+D), never a game press.
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      if (isTypingTarget(e.target)) return false;
      // Enter/Space on a focused button or link is how a keyboard user presses it.
      if (ACTIVATING.has(code) && isPressable(e.target)) return false;
      if (!held.has(code)) press(code);   // a held key repeats keydown: ignore the repeats
      return true;
    },
    keyup(e) {
      const code = e?.code;
      // A release is ALWAYS honoured for a key we saw go down — even with a modifier now
      // held or focus elsewhere — or the button would stay stuck down.
      if (!held.has(code)) return false;
      release(code);
      return true;
    },
    /** Window lost focus, tab hidden, player closed: nothing may stay held. */
    releaseAll() {
      const buttons = new Set([...held].map((c) => CODE_TO_BUTTON[c]));
      held.clear();
      buttons.forEach((b) => apply(b, false));
    },
  };
}
