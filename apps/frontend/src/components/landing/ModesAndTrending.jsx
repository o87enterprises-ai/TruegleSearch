import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import NewsFeed from './NewsFeed';

// ── Mode showcase ────────────────────────────────────────────────────────────

const MODES = [
  {
    id: 'blue',
    label: 'Blue Mode',
    tagline: 'Mainstream · Traditional',
    description: 'The lens used by most major platforms and legacy media. Results weighted toward widely-accepted, establishment-endorsed sources — the digital equivalent of the evening news.',
    color: 'from-blue-600 to-cyan-500',
    glow: 'shadow-blue-500/30',
    border: 'border-blue-500/30 hover:border-blue-400/60',
    dot: 'bg-blue-400',
    textAccent: 'text-cyan-400',
    exampleQuery: 'climate change latest research',
    path: '/search?mode=blue&q=climate+change+latest+research',
  },
  {
    id: 'red',
    label: 'Red Mode',
    tagline: 'Rabbit Hole · Free Thinker',
    description: 'Independent voices, contrarian takes, and sources that challenge the official narrative. For curious, open-minded people who question consensus and think for themselves.',
    color: 'from-red-600 to-rose-400',
    glow: 'shadow-red-500/30',
    border: 'border-red-500/30 hover:border-red-400/60',
    dot: 'bg-red-400',
    textAccent: 'text-red-400',
    exampleQuery: 'federal reserve money printing explained',
    path: '/search?mode=red&q=federal+reserve+money+printing+explained',
  },
  {
    // Perspectives is no longer a mode — it is the re-ask fold inside the
    // Rabbit Hole. The card stays because the capability is worth advertising;
    // it just points at where the capability actually lives now.
    id: 'purple',
    label: 'Re-ask It',
    tagline: 'Multi-viewpoint · Skeptical',
    description: 'Inside the Rabbit Hole: re-read the results you already have from a conservative, skeptical, faith, or economic angle — instantly, without searching again. Search again only if that angle isn\'t in them.',
    color: 'from-purple-600 to-violet-400',
    glow: 'shadow-purple-500/30',
    border: 'border-purple-500/30 hover:border-purple-400/60',
    dot: 'bg-purple-400',
    textAccent: 'text-purple-400',
    exampleQuery: 'immigration policy effects',
    path: '/search?mode=red&fold=1&q=immigration+policy+effects',
  },
  {
    id: 'ocean',
    label: 'Ocean Mode',
    tagline: 'Privacy · Security · OSINT',
    description: 'Built for developers, security researchers, and privacy-conscious users. Suspicious of surveillance, fluent in threat models — dig into domains, public records, and open-source intelligence.',
    color: 'from-cyan-600 to-teal-400',
    glow: 'shadow-cyan-500/30',
    border: 'border-cyan-500/30 hover:border-cyan-400/60',
    dot: 'bg-cyan-400',
    textAccent: 'text-cyan-400',
    exampleQuery: 'OSINT: domain registrant lookup',
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
      onClick={() => navigate(mode.path)}
      className={`cursor-pointer group rounded-2xl border bg-white/[0.03] backdrop-blur-sm p-5 flex flex-col gap-3 transition-all duration-300 ${mode.border} hover:bg-white/[0.06] hover:shadow-xl ${mode.glow}`}
    >
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${mode.dot} flex-shrink-0`} />
        <span className="text-xs text-white/40 font-semibold uppercase tracking-widest">{mode.tagline}</span>
      </div>

      <div>
        <h3 className={`text-lg font-bold mb-1 bg-gradient-to-r ${mode.color} bg-clip-text text-transparent`}>
          {mode.label}
        </h3>
        <p className="text-sm text-white/60 leading-relaxed">{mode.description}</p>
      </div>

      <div className={`rounded-lg bg-black/40 border border-white/5 px-3 py-2 text-xs ${mode.textAccent} font-mono truncate`}>
        &rsaquo; {mode.exampleQuery}
      </div>

      <div className={`flex items-center gap-1 text-xs ${mode.textAccent} opacity-0 group-hover:opacity-100 transition-opacity mt-auto`}>
        Try it <ArrowRight size={12} />
      </div>
    </motion.div>
  );
}

// ── Exported section ─────────────────────────────────────────────────────────

export default function ModesAndTrending() {
  return (
    <section className="py-16 px-4 border-t border-white/5">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold text-white mb-1">Pick your lens</h2>
          <p className="text-sm text-white/50">Same query, completely different results — depending on what you need to see.</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MODES.map((mode, i) => (
            <ModeCard key={mode.id} mode={mode} index={i} />
          ))}
        </div>

        {/* Was a rotating list of search QUERIES; now what has actually
            happened — local + global headlines, video coverage and a live
            markets summary. See NewsFeed.jsx. */}
        <NewsFeed />
      </div>
    </section>
  );
}
