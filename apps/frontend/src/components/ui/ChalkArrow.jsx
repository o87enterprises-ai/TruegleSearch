import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
};

// Which quadrant the arrow+label sit in, relative to the element they point
// at. The path/label are mirrored so the arrowhead always lands on the target.
// Each path runs FROM the end near the label TO the end near the target, so
// the arrowhead (drawn at the path's second point) always lands closest to
// whatever this is pointing at, not floating off toward the label.
const LAYOUTS = {
  // Block sits ABOVE the target -> must point DOWN.
  'top-right': { wrap: '-top-14 right-0 items-end text-right', path: 'M40 6C30 16 18 30 10 42', head: 'M10 42l11-2M10 42l2-11' },
  'top-left': { wrap: '-top-14 left-0 items-start text-left', path: 'M8 6C18 16 30 30 38 42', head: 'M38 42l-11-2M38 42l-2-11' },
  // Block sits BELOW the target -> must point UP.
  'bottom-right': { wrap: '-bottom-14 right-0 items-end text-right', path: 'M40 42C30 32 18 18 10 6', head: 'M10 6l11 2M10 6l2 11' },
  'bottom-left': { wrap: '-bottom-14 left-0 items-start text-left', path: 'M8 42C18 32 30 18 38 6', head: 'M38 6l-11 2M38 6l-2 11' },
};

/**
 * A hand-sketched arrow + chalk-font label pointing at whatever it's
 * absolutely-positioned inside (parent needs `relative`). Purely decorative
 * — the hover/tap target is the sibling element, not this component.
 */
export default function ChalkArrow({ label = 'hover here', color = '#22D3EE', layout = 'top-right', muted = false }) {
  const reducedMotion = usePrefersReducedMotion();
  const cfg = LAYOUTS[layout] || LAYOUTS['top-right'];

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute z-10 flex flex-col gap-0.5 w-14 ${cfg.wrap}`}
      style={{ opacity: muted ? 0.45 : 1 }}
    >
      <span
        className="font-chalk text-[15px] leading-none whitespace-nowrap -rotate-3"
        style={{ color }}
      >
        {label}
      </span>
      <motion.svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        animate={reducedMotion ? undefined : { y: [0, 4, 0] }}
        transition={reducedMotion ? undefined : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <path d={cfg.path} stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d={cfg.head} stroke={color} strokeWidth="2" strokeLinecap="round" />
      </motion.svg>
    </div>
  );
}
