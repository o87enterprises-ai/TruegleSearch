import { motion } from 'framer-motion';
import { PlayCircle, ListMusic, PictureInPicture2, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Introduces the Truegle player, directly under the landing search bar.
//
// It sits in the hero, so it stays one compact row on a phone — the point is a
// glance and a tap, not a pitch. Brand accents only (purple -> green), matching
// the rest of the landing surface.
const POINTS = [
  { icon: ListMusic, label: 'Queue anything' },
  { icon: PictureInPicture2, label: 'Keeps playing as you search' },
  { icon: ShieldCheck, label: 'Sandboxed — no hijacked tabs' },
];

export default function PlayerFeatureCard({ onOpen }) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.4 }}
      className="w-full max-w-2xl mx-auto px-4 mb-4"
    >
      <button
        type="button"
        onClick={() => (onOpen ? onOpen() : navigate('/tube'))}
        aria-label="Open True Tube"
        className="group w-full text-left rounded-2xl border border-white/15 bg-white/[0.07] backdrop-blur-lg
                   px-4 py-3 shadow-lg shadow-black/20 transition-colors hover:bg-white/[0.11] hover:border-purple-400/40"
      >
        <div className="flex items-center gap-3">
          <span className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-green-500
                           flex items-center justify-center shadow-md shadow-purple-500/20">
            <PlayCircle size={20} className="text-white" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-white font-semibold text-sm">True Tube</span>
              <span className="text-[10px] uppercase tracking-wide text-green-400/90 font-bold">New</span>
            </div>
            <p className="text-white/60 text-xs leading-snug mt-0.5">
              One player for video, reels and audio. Pop it out and it follows you across
              Truegle while you keep searching.
            </p>
          </div>

          <span className="hidden sm:inline shrink-0 text-xs font-semibold text-purple-300 group-hover:text-purple-200">
            Try it →
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 pl-[52px]">
          {POINTS.map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-[11px] text-white/45">
              <Icon size={12} className="text-white/40" />
              {label}
            </span>
          ))}
        </div>
      </button>
    </motion.div>
  );
}
