import { useEffect, useState } from 'react';

// "Is this a phone-width screen?" — one definition, so the player's default
// home and anything else that depends on it can never disagree.
//
// 640px is Tailwind's `sm` breakpoint, which the rest of the UI already treats
// as the line between one column and two.
const NARROW = 640;

export function useNarrowViewport(breakpoint = NARROW) {
  const [narrow, setNarrow] = useState(
    () => (typeof window === 'undefined' ? false : window.innerWidth < breakpoint),
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [breakpoint]);
  return narrow;
}

export default useNarrowViewport;
