import { motion } from 'framer-motion';

// The small line under the logo — "an ocean-inspired periodic text that fades
// in and out like tides". Framer's own opacity tween, eased slow in both
// directions (rather than linear) is what reads as a tide's approach and
// retreat rather than a blink; a small vertical drift echoes a swell without
// being distracting enough to fight the logo above it for attention.
export default function LandingTagline({ text = 'Surf Engine' }) {
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0], y: [4, 0, 0, -4] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.75, 1] }}
      className="mt-1 text-[13px] tracking-[0.35em] uppercase text-cyan-200/70 font-medium select-none"
    >
      {text}
    </motion.p>
  );
}
