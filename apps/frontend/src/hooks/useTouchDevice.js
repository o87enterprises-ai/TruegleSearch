import { useEffect, useState } from 'react';

/* "Is this a thing you hold?" — one definition, so every feature that only
 * makes sense on a phone agrees about where it applies.
 *
 * WHY NOT VIEWPORT WIDTH, which is the usual shortcut and is wrong twice: a
 * laptop with a narrow window is still a laptop, and a tablet held in two
 * hands is still a touch device at 1024px. The question is what the INPUT is,
 * and the pointer media queries answer exactly that:
 *
 *   pointer: coarse  → the primary pointer is a fingertip
 *   hover: none      → it cannot hover, because a finger is either down or gone
 *
 * The first is the real test; the second catches devices that report a coarse
 * pointer while still being driven by something hoverable.
 *
 * THE CASE THIS EXISTS FOR: the player's lock. It is for a phone in a pocket —
 * it stops a leg from skipping the track. A desktop has no pocket and no stray
 * presses, so on desktop the lock is a button that takes the controls away and
 * then asks for a 700ms hold to give them back. That is not a feature there,
 * it is a trap, so the control is not offered at all.
 */
const QUERY = '(pointer: coarse) and (hover: none)';

export function useTouchDevice() {
  const [touch, setTouch] = useState(() => (
    typeof window === 'undefined' || !window.matchMedia
      ? false
      : window.matchMedia(QUERY).matches
  ));

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(QUERY);
    const sync = () => setTouch(mq.matches);
    sync();
    // A convertible laptop genuinely changes answer when it is folded into a
    // tablet, so this is watched rather than read once at mount.
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return touch;
}

export default useTouchDevice;
