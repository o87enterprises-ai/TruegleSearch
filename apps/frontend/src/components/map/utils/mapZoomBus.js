// One +/− for every view.
//
// The control rail owns the zoom buttons (owner, 2026-10-06: "all of the
// buttons in the UI consolidated into one place"). The street map can be zoomed
// directly, but the Globe and Azimuthal views own their own cameras — so the
// rail announces "zoom in / out" here and whichever view is mounted answers.

const EVENT = 'truegle:map-zoom';

/** Ask the current view to zoom. dir > 0 = in, dir < 0 = out. */
export function requestMapZoom(dir) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: dir }));
}

/** Answer zoom requests while mounted. Returns the unsubscribe. */
export function onMapZoomRequest(handler) {
  if (typeof window === 'undefined') return () => {};
  const fn = (e) => handler(e.detail);
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
