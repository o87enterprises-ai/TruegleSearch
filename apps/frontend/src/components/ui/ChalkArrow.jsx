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

const rotate = (x, y, angle) => ({
  x: x * Math.cos(angle) - y * Math.sin(angle),
  y: x * Math.sin(angle) + y * Math.cos(angle),
});

/**
 * A hand-sketched arrow + chalk-font label, geometrically fitted between two
 * points every time rather than picked from a fixed set of corner shapes —
 * so it can hug whatever space actually surrounds the target button instead
 * of reusing the same swoop everywhere.
 *
 * `from`/`to` are pixel offsets from the wrapped target's top-left corner
 * (positive y = down, negative y = above). `from` is where the label/tail
 * sits, `to` is where the tip should land — right at the target's edge, not
 * inside it. `bow` bends the curve away from the straight line (px,
 * perpendicular to travel — flip its sign to bend the other way).
 *
 * The arrowhead's barbs are computed from the path's actual end tangent, so
 * they always sit correctly no matter which direction `to` is from `from` —
 * there's no per-direction case to get backwards.
 */
export default function ChalkArrow({
  label = 'hover here',
  color = '#22D3EE',
  from = { x: 40, y: -70 },
  to = { x: 8, y: -8 },
  bow = 16,
  muted = false,
}) {
  const reducedMotion = usePrefersReducedMotion();

  const pad = 14;
  const labelSpace = 20; // gap reserved directly above the tail point, for the label
  const minX = Math.min(from.x, to.x) - pad;
  const maxX = Math.max(from.x, to.x) + pad;
  const minY = Math.min(from.y - labelSpace, to.y) - pad;
  const maxY = Math.max(from.y, to.y) + pad;
  const width = maxX - minX;
  const height = maxY - minY;

  // Points translated into this box's own local coordinate space — p0/p1
  // land exactly on `from`/`to`, nothing added, so the label (positioned
  // labelSpace above p0 below) sits a fixed gap above the curve regardless
  // of how big the overall box ends up.
  const p0 = { x: from.x - minX, y: from.y - minY };
  const p1 = { x: to.x - minX, y: to.y - minY };

  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  // Two control points, bowed by decreasing amounts so the curve eases into
  // the target rather than arriving at a sharp angle.
  const c1 = { x: p0.x + dx * 0.33 + nx * bow, y: p0.y + dy * 0.33 + ny * bow };
  const c2 = { x: p0.x + dx * 0.66 + nx * bow * 0.55, y: p0.y + dy * 0.66 + ny * bow * 0.55 };

  const path = `M${p0.x} ${p0.y}C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p1.x} ${p1.y}`;

  // Arrowhead barbs, rotated off the path's actual end tangent (c2 -> p1).
  const tdx = p1.x - c2.x;
  const tdy = p1.y - c2.y;
  const tlen = Math.hypot(tdx, tdy) || 1;
  const ux = -tdx / tlen;
  const uy = -tdy / tlen;
  const barb = 8;
  const spread = 0.5; // radians off the backward tangent, each side
  const b1 = rotate(ux, uy, spread);
  const b2 = rotate(ux, uy, -spread);
  const head = `M${p1.x} ${p1.y}l${b1.x * barb} ${b1.y * barb}M${p1.x} ${p1.y}l${b2.x * barb} ${b2.y * barb}`;

  // Label sits at the tail, growing away from the target so it never
  // overlaps the curve.
  const labelOnRight = dx <= 0;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-10"
      style={{ left: minX, top: minY, width, height, opacity: muted ? 0.45 : 1 }}
    >
      <span
        className="font-chalk text-[15px] leading-none whitespace-nowrap -rotate-3 absolute"
        style={{
          color,
          top: p0.y - labelSpace,
          left: labelOnRight ? p0.x : undefined,
          right: labelOnRight ? undefined : width - p0.x,
        }}
      >
        {label}
      </span>
      <motion.svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        fill="none"
        className="absolute inset-0"
        animate={reducedMotion ? undefined : { x: [0, dx * 0.06, 0], y: [0, dy * 0.06, 0] }}
        transition={reducedMotion ? undefined : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <path d={path} stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d={head} stroke={color} strokeWidth="2" strokeLinecap="round" />
      </motion.svg>
    </div>
  );
}
