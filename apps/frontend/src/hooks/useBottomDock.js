import { useEffect, useState } from 'react';

/**
 * Who owns the bottom strip of the screen.
 *
 * THE PROBLEM: page furniture pins itself to the bottom and never gives that
 * height back. The freemium meter did it on every page (since deleted), and the
 * early-access feedback bar still does: full width,
 * z-[60], and on a phone its copy wraps to four lines. Anything that docks
 * there afterwards — the footer-docked player, the map with its own control
 * bars — has to sit ON TOP of that, so the component the visitor is actually
 * using is squeezed by a banner they have already read.
 *
 * THE RULE: a docked UI component outranks page furniture. While one is on
 * screen the furniture collapses and the height is released; when it closes
 * the furniture comes straight back.
 *
 * Ref-counted, because more than one thing can be docked at once (the player
 * pinned to the footer while the map is open). The bar comes back only when
 * the LAST claim is released — a plain boolean would have the first component
 * to unmount restore the bar underneath the second.
 *
 * Deliberately a module-level counter plus an event rather than a context:
 * PreProductionBanner is mounted above the provider tree in App.jsx, so there
 * is no shared provider for it and the player to sit inside. This mirrors the
 * BAR_EVENT mechanism already in PreProductionBanner.jsx.
 */

const EVENT = 'truegle:bottom-dock';
let claims = 0;

function publish() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(EVENT));
}

export function claimBottomDock() {
  claims += 1;
  if (claims === 1) publish();
}

export function releaseBottomDock() {
  // Never below zero: a double-release (StrictMode's mount/unmount/mount, or a
  // component unmounting after its effect already cleaned up) would otherwise
  // leave the counter negative and the bar permanently hidden.
  if (claims === 0) return;
  claims -= 1;
  if (claims === 0) publish();
}

export function isBottomDockClaimed() {
  return claims > 0;
}

/**
 * Claim the bottom strip while `active` is true. Releases on unmount.
 * @param {boolean} active
 */
export function useBottomDockClaim(active) {
  useEffect(() => {
    if (!active) return undefined;
    claimBottomDock();
    return releaseBottomDock;
  }, [active]);
}

/** True while anything holds the bottom strip. */
export function useBottomDockClaimed() {
  const [claimed, setClaimed] = useState(() => isBottomDockClaimed());
  useEffect(() => {
    const sync = () => setClaimed(isBottomDockClaimed());
    sync();   // a claim made before this subscribed would otherwise be missed
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  return claimed;
}
