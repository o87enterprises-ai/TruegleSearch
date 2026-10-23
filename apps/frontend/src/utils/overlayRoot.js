// WHERE AN OVERLAY MUST MOUNT TO BE SEEN.
//
// A portal into <body> is invisible in full screen. The native Fullscreen API
// paints ONLY the fullscreen element's subtree (the player root), so a sheet
// attached to <body> is drawn behind it — the "add to list" sheet landed in the
// page UNDER the full-screen picture and could not be reached (owner,
// 2026-10-23). The iPhone has no element full screen: the player is a fixed box
// (`[data-pseudo-fullscreen]`, z-index 2147483000) that sits over everything,
// including a body-level sheet.
//
// So: inside the fullscreen element when there is one, inside the iPhone box
// when that is up, and <body> otherwise. Read when the overlay OPENS — a sheet
// is short-lived, and it renders where the viewer is looking at that moment.
export function overlayRoot() {
  if (typeof document === 'undefined') return null;
  return document.fullscreenElement
    || document.webkitFullscreenElement
    || document.querySelector('[data-pseudo-fullscreen]')
    || document.body;
}

/** True when the overlay will mount inside a full-screen surface. */
export const inFullscreenSurface = () => {
  const root = overlayRoot();
  return !!root && root !== document.body;
};
