import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import CollapsibleCard, { CollapsibleCardGroup } from './CollapsibleCard';

// ── Search: the lenses ─────────────────────────────────────────────────────
//
// Five lenses, one line each. Tube and Feed used to be listed here too, but
// they have tiles of their own now; the long paragraphs about each lens, the
// example query lines and the link-check / anonymous-view notes are gone — a
// visitor glancing at a landing page wants the jist, and "Try it" runs a real
// search for anyone who wants more. Colours are the pills' (blue, red, purple
// for Wonderland, green, ocean).
const MODES = [
  {
    id: 'blue', label: 'Blue',
    description: 'Mainstream sources first. The evening news, searchable.',
    color: 'from-blue-600 to-cyan-500', dot: 'bg-blue-400', textAccent: 'text-cyan-400',
    border: 'border-blue-500/30 hover:border-blue-400/60',
    path: '/search?mode=blue&q=climate+change+latest+research',
  },
  {
    id: 'red', label: 'Red',
    description: 'Independent voices that question the official story.',
    color: 'from-red-600 to-rose-400', dot: 'bg-red-400', textAccent: 'text-red-400',
    border: 'border-red-500/30 hover:border-red-400/60',
    path: '/red?q=federal+reserve+money+printing+explained',
  },
  {
    // Wonderland is the fold inside the Rabbit Hole; it keeps its own row
    // because it is the most distinctive thing Truegle does.
    id: 'wonderland', label: 'Wonderland',
    description: 'Isolate results by politics, faith, society, or economics.',
    color: 'from-purple-600 to-violet-400', dot: 'bg-purple-400', textAccent: 'text-purple-400',
    border: 'border-purple-500/30 hover:border-purple-400/60',
    path: '/red?fold=1&q=immigration+policy+effects',
  },
  {
    // Green fires no model at all (AI_FREE_MODES in UniversalSearch), so the
    // claim is literal. No numbers: the saving has not been measured.
    id: 'green', label: 'Green',
    description: 'Zero AI. Nothing generated. Just results.',
    color: 'from-green-600 to-emerald-400', dot: 'bg-green-400', textAccent: 'text-green-300',
    border: 'border-green-500/30 hover:border-green-400/60',
    path: '/green?q=how+to+repair+a+bike+chain',
  },
  {
    id: 'ocean', label: 'Ocean',
    description: 'OSINT toolkit: domains, records, digital footprints.',
    color: 'from-cyan-600 to-teal-400', dot: 'bg-cyan-400', textAccent: 'text-cyan-400',
    border: 'border-cyan-500/30 hover:border-cyan-400/60',
    path: '/search?mode=ocean&q=domain+registrant+lookup',
  },
];

function ModeCard({ mode, index }) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08 }}
    >
      <CollapsibleCard
        data-mode-card={mode.id}
        className={mode.border}
        header={(
          <>
            <span className={`w-2 h-2 rounded-full ${mode.dot} flex-shrink-0`} />
            <h3 className={`text-base font-bold bg-gradient-to-r ${mode.color} bg-clip-text text-transparent`}>
              {mode.label}
            </h3>
          </>
        )}
      >
        <p className="text-sm text-white/70 leading-snug">{mode.description}</p>
        <button
          type="button"
          onClick={() => navigate(mode.path)}
          className={`self-start flex items-center gap-1 text-xs font-semibold ${mode.textAccent}`}
        >
          Try it <ArrowRight size={12} />
        </button>
      </CollapsibleCard>
    </motion.div>
  );
}

// ── Body ─────────────────────────────────────────────────────────────────────

export default function SearchBody() {
  return (
    // THEIR OWN GROUP. Each lens is itself one of these accordions, and a shared
    // group lets only one be open at a time — so opening a lens used to close
    // the Search card it lives in. A group of their own keeps "one at a time"
    // true among the lenses and leaves what is around them alone.
    <CollapsibleCardGroup>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start" data-search-body="">
        {MODES.map((mode, i) => (
          <ModeCard key={mode.id} mode={mode} index={i} />
        ))}
      </div>
    </CollapsibleCardGroup>
  );
}
