import { useEffect, useRef } from 'react';

/**
 * THE ONE TILE THAT DESCENDS ON ITS OWN. Phones only (< 768px). `ref` is the
 * tile; `open` is called ONCE, the first time the visitor scrolls DOWN while at
 * least 60% of the tile is on screen.
 *
 * Why watch the scroll and not just "entering the viewport": on a phone this
 * tile already sits at the bottom of the first screen at load, so waiting for
 * it to enter would never fire — the visitor asked for it to descend as they
 * scroll down the page. Both the scroll and the tile's visibility are watched,
 * and either can be the last piece.
 *
 * "Once" lives in a ref so re-renders cannot reset it: closing the tile by hand
 * while it is still on screen must not make it descend again.
 */
export default function useAutoOpenOnScroll(ref, open) {
  const fired = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    if (typeof window.matchMedia !== 'function' || !window.matchMedia('(max-width: 767px)').matches) return undefined;
    let visible = false;
    let lastY = window.scrollY;
    const maybeOpen = () => {
      if (fired.current || !visible || window.scrollY < 40) return;
      fired.current = true;
      openRef.current();
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.intersectionRatio >= 0.6;
      maybeOpen();
    }, { threshold: [0, 0.6, 1] });
    io.observe(el);
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastY) maybeOpen();   // only scrolling DOWN descends it
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { io.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, [ref]);
}
