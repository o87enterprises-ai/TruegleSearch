// The smallest React that can run a hook outside a browser.
//
// Enough for one component with state, refs, callbacks and effects, driven by
// hand from a test. Real React would need a renderer and a DOM to tell us
// anything more, and what these tests are actually about is timing logic —
// which is this code, run exactly as written.
//
// `__setRender` hands the harness the re-render trigger; `__reset` starts a
// fresh mount. Hook order is positional, exactly as in React, so a test that
// calls hooks conditionally would break here for the same reason it would
// break there.
let slots = [];
let cursor = 0;
let render = () => {};

export function __reset() { slots = []; cursor = 0; }
export function __setRender(fn) { render = fn; }
export function __begin() { cursor = 0; }

export function useState(init) {
  const i = cursor++;
  if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init;
  return [slots[i], (v) => {
    slots[i] = typeof v === 'function' ? v(slots[i]) : v;
    render();
  }];
}

export function useRef(init) {
  const i = cursor++;
  if (!(i in slots)) slots[i] = { current: init };
  return slots[i];
}

// Identity is not memoised: a test that depended on a stable reference would be
// testing this stub rather than the hook.
export function useCallback(fn) { cursor += 1; return fn; }
export function useMemo(fn) { cursor += 1; return fn(); }

// Effects run IMMEDIATELY rather than after paint. There is no paint, and the
// alternative — collecting them for the harness to flush — buys nothing for
// hooks whose effects only register cleanup.
export function useEffect(fn) {
  cursor += 1;
  const cleanup = fn();
  return cleanup;
}

export default { useState, useRef, useCallback, useMemo, useEffect };
