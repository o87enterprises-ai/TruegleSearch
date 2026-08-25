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
    description: 'Independent voices, contrarian takes, and sources that challenge the official narrative. For curious, open-minded people who question consensus and think for themselves. Wonderland lives in here too — the fold that isolates a single perspective on what you found.',
    color: 'from-red-600 to-rose-400',
    glow: 'shadow-red-500/30',
    border: 'border-red-500/30 hover:border-red-400/60',
    dot: 'bg-red-400',
    textAccent: 'text-red-400',
    exampleQuery: 'federal reserve money printing explained',
    path: '/search?mode=red&q=federal+reserve+money+printing+explained',
  },
  {
    // WONDERLAND. Perspectives stopped being a mode of its own and became the
    // re-ask fold inside the Rabbit Hole; this card is the fold's own name and
    // description, kept separate because the capability is the most distinctive
    // thing Truegle does and burying it in the Red card would hide it.
    id: 'wonderland',
    label: 'Wonderland',
    tagline: 'Inside the Rabbit Hole · Isolate a perspective',
    description: 'Go further down: take the results you already have and isolate them by the lens you choose — political, faith, societal, or economic. One angle at a time, on the same query, without searching again.',
    color: 'from-purple-600 to-violet-400',
    glow: 'shadow-purple-500/30',
    border: 'border-purple-500/30 hover:border-purple-400/60',
    dot: 'bg-purple-400',
    textAccent: 'text-purple-400',
    exampleQuery: 'immigration policy effects',
    path: '/search?mode=red&fold=1&q=immigration+policy+effects',
  },
  {
    // GREEN. The pun is the point and the owner asked for it kept: green the
    // colour, green the footprint. This is the only mode that fires no model at
    // all (AI_FREE_MODES in UniversalSearch), so the claim is literal rather
    // than a slogan — no summary, no quick answer, no assistant, no inference.
    // Deliberately no numbers here: we have not measured the saving and will
    // not invent one.
    id: 'green',
    label: 'Green Mode',
    tagline: 'Zero AI · Environmentally conscious',
    description: 'Search with no AI at all. No summary, no answer card, no assistant — nothing is generated, so no model runs and nothing is spent on inference for your query. Just the results, and the lightest search we know how to serve.',
    color: 'from-green-600 to-emerald-400',
    glow: 'shadow-green-500/30',
    border: 'border-green-500/30 hover:border-green-400/60',
    dot: 'bg-green-400',
    textAccent: 'text-green-300',
    exampleQuery: 'how to repair a bike chain',
    path: '/search?mode=green&q=how+to+repair+a+bike+chain',
  },
  {
    id: 'tube',
    label: 'True Tube',
    tagline: 'Video · Audio · One player',
    description: 'Video and audio from across the web — YouTube, Vimeo, SoundCloud, Rumble, Odysee, Reddit — searched together and played inside Truegle. The player pops out and keeps going while you browse the rest of the site.',
    color: 'from-slate-300 to-slate-500',
    glow: 'shadow-slate-400/20',
    border: 'border-slate-400/30 hover:border-slate-300/60',
    dot: 'bg-slate-300',
    textAccent: 'text-slate-200',
    exampleQuery: 'live jazz sets full length',
    path: '/tube?q=live+jazz+sets+full+length',
  },
  // The Feed card is PARKED, not deleted — /feed and its OAuth handshake still
  // work if reached directly. The yellow slot shows Creators for now; restore
  // the old entry from git history to put Feed back on the landing page.
  {
    id: 'creators',
    label: 'Creators',
    tagline: 'Channels · Played here · They keep the view',
    description: 'The creators Truegle hosts, with their uploads played on the site through the provider\'s own embed — so the view and the revenue still count for them. No account, no cookies, no tracking, and no algorithm deciding who you get to see.',
    color: 'from-yellow-500 to-amber-400',
    glow: 'shadow-yellow-500/20',
    border: 'border-yellow-500/30 hover:border-yellow-400/60',
    dot: 'bg-yellow-400',
    textAccent: 'text-yellow-300',
    exampleQuery: 'the channels we host',
    path: '/creators',
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
          <p className="text-sm text-white/50">Same query, completely different results — depending on what you need to see. Plus the two surfaces that aren't lenses at all: the player and the feed.</p>
        </motion.div>

        {/* Three across, not four: the list is six cards now (Tube and the
            Feed joined the lenses), and four columns leaves a ragged pair on
            the second row. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
