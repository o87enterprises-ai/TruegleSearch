import { useEffect, useState } from 'react';

// How much of the screen the on-screen keyboard is covering, in px.
//
// A `position: fixed` element is laid out against the LAYOUT viewport, which
// Android Chrome does not shrink when the keyboard opens — so a bar pinned to
// the bottom of the page ends up underneath the keyboard, with the very input
// you are typing into hidden behind it. The visual viewport is the part you
// can actually see, and the difference between the two is the keyboard.
//
// Small changes are ignored: the URL bar collapsing on scroll also moves the
// visual viewport, and nothing should jump around for that.
const MIN_KEYBOARD = 120;

export function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return undefined;
    const sync = () => {
      const covered = window.innerHeight - (vv.height + vv.offsetTop);
      setInset(covered > MIN_KEYBOARD ? Math.round(covered) : 0);
    };
    sync();
    vv.addEventListener('resize', sync);
    vv.addEventListener('scroll', sync);
    return () => {
      vv.removeEventListener('resize', sync);
      vv.removeEventListener('scroll', sync);
    };
  }, []);

  return inset;
}

export default useKeyboardInset;
