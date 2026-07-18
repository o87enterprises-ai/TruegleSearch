import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, ArrowRight } from 'lucide-react';

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
    id: 'purple',
    label: 'Perspectives Mode',
    tagline: 'Multi-viewpoint · Skeptical',
    description: 'A conservative or skeptical filter. Counter-narratives, accountability journalism, and perspectives that are underrepresented in mainstream search — for those who don\'t trust the mainstream.',
    color: 'from-purple-600 to-violet-400',
    glow: 'shadow-purple-500/30',
    border: 'border-purple-500/30 hover:border-purple-400/60',
    dot: 'bg-purple-400',
    textAccent: 'text-purple-400',
    exampleQuery: 'immigration policy effects',
    path: '/search?mode=purple&q=immigration+policy+effects',
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

// ── Trending searches ─────────────────────────────────────────────────────────

const TRENDING = [
  { query: 'AI regulation 2025', mode: 'blue' },
  { query: 'Gaza ceasefire updates', mode: 'red' },
  { query: 'Bitcoin ETF approval', mode: 'blue' },
  { query: 'US election interference claims', mode: 'purple' },
  { query: 'WHO pandemic treaty', mode: 'red' },
  { query: 'nuclear fusion breakthrough', mode: 'blue' },
  { query: 'TikTok ban Congress vote', mode: 'purple' },
  { query: 'inflation vs wages 2025', mode: 'blue' },
  { query: 'deep sea mining environment', mode: 'red' },
  { query: 'CRISPR gene editing ethics', mode: 'purple' },
  { query: 'domain IP lookup', mode: 'ocean' },
  { query: 'social media censorship evidence', mode: 'red' },
];

const MODE_PILL = {
  blue:   'bg-blue-500/20 text-blue-300 border-blue-500/30',
  red:    'bg-red-500/20 text-red-300 border-red-500/30',
  purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  ocean:  'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function TrendingFeed() {
  const navigate = useNavigate();
  // pool = whatever we're displaying; starts as static fallback
  const [pool, setPool] = useState(TRENDING);
  const [live, setLive] = useState(false);
  const [visible, setVisible] = useState(TRENDING.slice(0, 8));
  const [tick, setTick] = useState(0);

  // Fetch real trending data once on mount; keep static list as fallback
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/search/trending`)
      .then((r) => r.json())
      .then((data) => {
        if (data.trending && data.trending.length >= 4) {
          // Merge live results with static so we always have ≥ 8 pills even
          // on a fresh deploy with no query history yet.
          const liveQueries = new Set(data.trending.map((t) => t.query));
          const fallback = TRENDING.filter((t) => !liveQueries.has(t.query));
          setPool([...data.trending, ...fallback]);
          setLive(true);
        }
      })
      .catch(() => {}); // network error → stay on static
  }, []);

  // Cycle one item every 4 s to give the feed a "live" feel
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 4000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const shift = tick % pool.length;
    const rotated = [...pool.slice(shift), ...pool.slice(0, shift)];
    setVisible(rotated.slice(0, 8));
  }, [tick, pool]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="mt-16"
    >
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp size={16} className="text-orange-400" />
        <span className="text-sm font-semibold text-white/70 uppercase tracking-wider">Trending on Truegle</span>
        <span className="ml-1 w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
        {live && (
          <span className="ml-1 text-[10px] text-orange-400/60 font-medium tracking-wide">LIVE</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {visible.map((item) => (
          <motion.button
            key={item.query}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={() => navigate(`/search?mode=${item.mode}&q=${encodeURIComponent(item.query)}`)}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all hover:brightness-125 ${MODE_PILL[item.mode]}`}
          >
            {item.query}
          </motion.button>
        ))}
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

        <TrendingFeed />
      </div>
    </section>
  );
}
