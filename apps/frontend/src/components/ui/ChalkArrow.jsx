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
const LAYOUTS = {
  'top-right': { wrap: '-top-14 right-0 items-end text-right', path: 'M4 44C22 34 34 18 44 4', head: 'M44 4l-11 1M44 4l-2 11' },
  'top-left': { wrap: '-top-14 left-0 items-start text-left', path: 'M44 44C26 34 14 18 4 4', head: 'M4 4l11 1M4 4l2 11' },
  'bottom-right': { wrap: '-bottom-14 right-0 items-end text-right', path: 'M4 4C22 14 34 30 44 44', head: 'M44 44l-2-11M44 44l-11-1' },
  'bottom-left': { wrap: '-bottom-14 left-0 items-start text-left', path: 'M44 4C26 14 14 30 4 44', head: 'M4 44l2-11M4 44l11-1' },
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
