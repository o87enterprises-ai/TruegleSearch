import { useState, useEffect, useRef, useCallback } from 'react';

// Show a control while there's activity near it; hide it when there isn't.
//
// Used for the popped-out player's search bar: the player sits over a page the
// user is still reading, so a permanently-visible input is clutter. It fades
// out when idle and comes back the moment the pointer moves near the player,
// which is what lets you browse and queue things up in the same place.
//
// "Near" is measured against the player's own rect rather than the whole
// window — a pointer moving on the far side of the screen isn't interest in
// the player, and waking on every mousemove would mean never hiding at all.
export function useIdleReveal(hostRef, { idleMs = 3000, proximity = 120 } = {}) {
  const [visible, setVisible] = useState(true);
  const timer = useRef(null);

  const wake = useCallback(() => {
    setVisible(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), idleMs);
  }, [idleMs]);

  useEffect(() => {
    wake();
    const onPointer = (e) => {
      const el = hostRef?.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const near =
        e.clientX >= r.left - proximity && e.clientX <= r.right + proximity
        && e.clientY >= r.top - proximity && e.clientY <= r.bottom + proximity;
      if (near) wake();
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    // A touch anywhere on the player itself always counts as interest.
    const el = hostRef?.current;
    el?.addEventListener('pointerdown', wake);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener('pointermove', onPointer);
      el?.removeEventListener('pointerdown', wake);
    };
  }, [hostRef, proximity, wake]);

  return { visible, wake };
}
