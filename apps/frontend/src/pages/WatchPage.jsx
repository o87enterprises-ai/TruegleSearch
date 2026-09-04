import { useEffect, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Play, Search, ListPlus, AlertTriangle } from 'lucide-react';
import LandingBackground from '../components/LandingBackground';
import TruegleLogo from '../components/ui/TruegleLogo';
import { usePlayer } from '../context/PlayerContext';
import { parsePlayerParams } from '../utils/playerLink';

// /w — the receiving end of a shared Truegle player link.
//
// Opening one drops the recipient straight into Truegle's own player instead
// of the source site: the media plays inside a sandboxed embed that cannot
// navigate the tab, YouTube is served from youtube-nocookie, and nothing about
// the visit is tracked. That is the whole promise of the link — a Truegle link
// is safe to open, because of where it opens.
//
// Anything in `?u=` that our player can't host is never followed. It's printed
// as inert text and left for the recipient to decide on.
export default function WatchPage() {
  const { search } = useLocation();
  const { play, enqueueMany, current } = usePlayer();
  const { sources, rejected } = useMemo(() => parsePlayerParams(search), [search]);
  const started = useRef('');

  // Auto-open into the player. Runs once per distinct link so navigating back
  // here doesn't restart what's already playing.
  useEffect(() => {
    if (!sources.length || started.current === search) return;
    started.current = search;
    play(sources[0], 'tube');
    if (sources.length > 1) enqueueMany(sources.slice(1), 'tube');
  }, [search, sources, play, enqueueMany]);

  useEffect(() => {
    const first = sources[0]?.title;
    document.title = first ? `${first} · Truegle Player` : 'Truegle Player';
  }, [sources]);

  const replay = () => {
    if (!sources.length) return;
    play(sources[0], 'tube');
    if (sources.length > 1) enqueueMany(sources.slice(1), 'tube');
  };

  return (
    <div className="min-h-screen relative bg-black">
      <LandingBackground />
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 15%, #22d3ee26, transparent 60%)' }} />

      <div className="relative z-10 min-h-screen flex flex-col items-center px-4 pt-10 pb-32">
        <Link to="/" className="mb-4"><TruegleLogo size="medium" animated /></Link>

        {sources.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-xl"
          >
            <div className="flex items-center justify-center gap-2 mb-2 text-cyan-300">
              <ShieldCheck size={18} />
              <span className="text-sm font-semibold">Opening in the Truegle player</span>
            </div>
            <p className="text-center text-xs text-white/45 mb-6">
              Playing inside Truegle&apos;s sandboxed player — the embed can&apos;t redirect your tab,
              YouTube is loaded from its no-cookie host, and Truegle doesn&apos;t track the visit.
            </p>

            <div className="rounded-2xl border border-white/12 bg-white/[0.03] overflow-hidden">
              {sources.map((s, i) => (
                <div key={`${s.pageUrl}-${i}`} className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0">
                  <span className={`text-[10px] w-5 shrink-0 ${i === 0 ? 'text-cyan-300' : 'text-white/30'}`}>
                    {i === 0 ? '▶' : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white/85 truncate">{s.title}</div>
                    <div className="text-[11px] text-white/35 truncate">{s.pageUrl}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
              <button
                type="button"
                onClick={replay}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-100 text-sm hover:bg-cyan-500/30 transition-colors"
              >
                {current ? <ListPlus size={16} /> : <Play size={16} />}
                {current ? 'Reopen in player' : 'Play now'}
              </button>
              <Link
                to="/search"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/15 text-white/70 text-sm hover:text-white hover:border-white/35 transition-colors"
              >
                <Search size={16} /> Search Truegle
              </Link>
            </div>

            <p className="text-center text-[11px] text-white/30 mt-5">
              The player stays with you — keep browsing Truegle and it keeps playing.
            </p>
          </motion.div>
        ) : (
          <div className="w-full max-w-md text-center mt-8">
            <p className="text-white/70 text-sm mb-2">There&apos;s nothing playable in this link.</p>
            <p className="text-white/40 text-xs mb-5">
              Truegle&apos;s player hosts YouTube, Vimeo, SoundCloud and direct audio/video files.
            </p>
            <Link to="/search" className="text-sm text-cyan-300 hover:text-cyan-200">Search Truegle instead →</Link>
          </div>
        )}

        {/* Rejected inputs are shown as text and nothing else — Truegle will not
            open a link it can't vouch for. */}
        {rejected.length > 0 && (
          <div className="w-full max-w-xl mt-6 rounded-xl border border-amber-400/25 bg-amber-400/5 px-4 py-3">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-medium mb-1.5">
              <AlertTriangle size={14} /> Not opened
            </div>
            <p className="text-[11px] text-white/45 mb-2">
              This link also carried {rejected.length === 1 ? 'an address' : 'addresses'} the Truegle player can&apos;t host.
              We haven&apos;t opened {rejected.length === 1 ? 'it' : 'them'} — copy anything you trust yourself.
            </p>
            {rejected.map((r, i) => (
              <code key={i} className="block text-[10px] text-white/35 break-all mb-0.5">{r}</code>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
