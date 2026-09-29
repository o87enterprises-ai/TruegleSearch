import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Compass, ShieldCheck, EyeOff, ChevronDown } from 'lucide-react';
import NewsFeed from './NewsFeed';
import CollapsibleCard from './CollapsibleCard';

// Same three-lens phrase ThreeCards uses for Chat, kept in step by being
// spelled out identically rather than shared as an import across two files
// that otherwise have nothing to do with each other.
const MODE_LIST = 'Mainstream, Green, Rabbit Hole, Privacy/OSINT';

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
    path: '/red?q=federal+reserve+money+printing+explained',
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
    path: '/red?fold=1&q=immigration+policy+effects',
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
    path: '/green?q=how+to+repair+a+bike+chain',
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
  {
    // FEED, restored to the yellow slot 2026-09-02 (see modeTheme.js) — it had
    // briefly been Creators-only. Creators isn't lost: it's one of Feed's own
    // Browse categories now, alongside Soc/Tube/Live/Music/Entertainment.
    id: 'feed',
    label: 'Feed',
    tagline: 'Every account you follow · One scroll',
    description: 'Reddit, Mastodon, Bluesky, news, and the creators Truegle partners with — interleaved into one timeline, never the same post twice. No account required for the public sources; connect the ones that need it.',
    color: 'from-yellow-500 to-amber-400',
    glow: 'shadow-yellow-500/20',
    border: 'border-yellow-500/30 hover:border-yellow-400/60',
    dot: 'bg-yellow-400',
    textAccent: 'text-yellow-300',
    exampleQuery: 'everything you follow, in one place',
    path: '/feed',
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
    >
      <CollapsibleCard
        className={`${mode.border} hover:shadow-xl ${mode.glow}`}
        header={(
          <>
            <span className={`w-2 h-2 rounded-full ${mode.dot} flex-shrink-0`} />
            <h3 className={`text-lg font-bold bg-gradient-to-r ${mode.color} bg-clip-text text-transparent`}>
              {mode.label}
            </h3>
          </>
        )}
      >
        <span className="text-xs text-white/40 font-semibold uppercase tracking-widest">{mode.tagline}</span>
        <p className="text-sm text-white/60 leading-relaxed">{mode.description}</p>
        <div className={`rounded-lg bg-black/40 border border-white/5 px-3 py-2 text-xs ${mode.textAccent} font-mono truncate`}>
          &rsaquo; {mode.exampleQuery}
        </div>
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

// ── Exported section ─────────────────────────────────────────────────────────

export default function ModesAndTrending() {
  // Collapsed by default, and the SAME card as True Tube and Chat Modes above
  // it (CollapsibleCard, max-w-2xl): it used to be its own hand-rolled shell
  // at max-w-6xl, which on a wide screen sat twice the width of its
  // neighbours and broke the column (owner, 2026-09-28).
  return (
    <section className="pt-4 pb-0 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Search Modes + "Pick your lens", combined into one card. Each mode
            below is still its own collapsible inside the one outer card. */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto px-4"
        >
          <CollapsibleCard
            data-search-modes-card=""
            className="border-emerald-500/25 hover:border-emerald-400/50"
            header={(
              <>
                <span className="shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                  <Compass size={16} className="text-white" />
                </span>
                <h2 className="min-w-0 truncate text-base sm:text-lg font-bold bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                  Search Modes
                </h2>
              </>
            )}
          >
          <div className="space-y-3 mb-2 mt-3">
            <p className="text-sm text-white/60 leading-relaxed">
              {`The same color-coded lenses — ${MODE_LIST} — applied to classic web results instead of chat. Cycle the pill above the search bar to switch between them. Green is the zero-AI one: nothing is generated, so no model runs on your query at all.`}
            </p>
            <p className="text-sm text-white/60 leading-relaxed">
              Two stops on that pill are whole surfaces rather than lenses: True Tube, where video and audio from across the web play in one pop-out player, and the Feed, where the social accounts you already read arrive in a single scroll.
            </p>
            <p className="text-sm text-white/60 leading-relaxed">
              And inside the Rabbit Hole there is Wonderland — isolate what you found by one perspective at a time: political, faith, societal, or economic.
            </p>
          </div>
          {/* Two safety features that live INSIDE search results, mentioned
              honestly: the link checker reads a URL's own shape and never
              sends it anywhere, and the proxy is opt-in per link, not a VPN. */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5 text-xs text-white/50">
            <div className="flex items-start gap-1.5">
              <ShieldCheck size={13} className="mt-0.5 shrink-0 text-emerald-400/80" />
              <span>Every result carries a link-health check — read locally, in your browser, from the address itself. Never a reputation lookup that means sending your links to a third party.</span>
            </div>
            <div className="flex items-start gap-1.5">
              <EyeOff size={13} className="mt-0.5 shrink-0 text-emerald-400/80" />
              <span>"View anonymously" opens some results through Truegle's own in-app proxy, so the destination sees Truegle, not you.</span>
            </div>
          </div>

          <p className="text-sm text-white/50 mb-3">Same query, completely different results — depending on what you need to see. Plus the two surfaces that aren't lenses at all: the player and the feed.</p>

          {/* Three across, not four: the list is six cards now (Tube and the
              Feed joined the lenses), and four columns leaves a ragged pair on
              the second row. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            {MODES.map((mode, i) => (
              <ModeCard key={mode.id} mode={mode} index={i} />
            ))}
          </div>
          </CollapsibleCard>
        </motion.div>

        {/* Was a rotating list of search QUERIES; now what has actually
            happened — local + global headlines, video coverage and a live
            markets summary. See NewsFeed.jsx. */}
        <NewsFeed />
      </div>
    </section>
  );
}
