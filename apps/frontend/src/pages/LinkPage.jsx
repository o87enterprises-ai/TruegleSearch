import { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, ExternalLink, Search, AlertTriangle, Globe } from 'lucide-react';
import LandingBackground from '../components/LandingBackground';
import TruegleLogo from '../components/ui/TruegleLogo';
import { getPlayable } from '../utils/videoEmbed';
import { titleFromUrl } from '../utils/playerLink';

// /l — the non-media half of Truegle share links.
//
// /w handles anything the player can host. This handles everything else, so a
// shared Truegle link ALWAYS lands on Truegle first: the recipient sees the
// destination inside our viewer, with the real address shown plainly, and
// chooses whether to leave.
//
// SECURITY — the same rule as /w, and it matters more here because the target
// is an arbitrary page rather than a known embed:
//   • We NEVER navigate to `u` ourselves. No redirect, no meta-refresh, no
//     window.location. The user clicks, or nothing happens. That is what stops
//     this becoming an open redirect that launders a hostile URL behind the
//     truegle.info domain.
//   • There is deliberately NO inline preview of the destination. Framing an
//     arbitrary site would need `https:` in the site CSP's frame-src, and that
//     allowlist is exactly what was tightened after the 2026-08-01 ad hijack.
//     A branded interstitial that shows the address is worth more than a
//     preview bought by re-opening that hole.
//   • Only http(s) is accepted. javascript:, data: and friends are rejected
//     outright and rendered as inert text.

function parseTarget(search) {
  const params = new URLSearchParams(search || '');
  const raw = params.get('u') || '';
  const title = (params.get('t') || '').trim().slice(0, 200);
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return { rejected: raw.slice(0, 200) };
    return { url: u.href, host: u.hostname.replace(/^www\./, ''), title: title || titleFromUrl(u.href) };
  } catch {
    return { rejected: raw.slice(0, 200) };
  }
}

export default function LinkPage() {
  const { search } = useLocation();
  const target = useMemo(() => parseTarget(search), [search]);
  useEffect(() => {
    document.title = target.url ? `${target.title} · Shared on Truegle` : 'Shared on Truegle';
  }, [target]);

  // A playable link shared here belongs in the player instead.
  const playable = target.url ? getPlayable(target.url) : null;

  if (!target.url) {
    return (
      <div className="min-h-screen relative bg-black">
        <LandingBackground />
        <div className="relative z-10 min-h-screen flex flex-col items-center px-4 pt-10">
          <Link to="/" className="mb-4"><TruegleLogo size="medium" animated /></Link>
          <div className="max-w-md text-center mt-6">
            <div className="flex items-center justify-center gap-2 text-amber-300 text-sm mb-2">
              <AlertTriangle size={16} /> Nothing to open
            </div>
            <p className="text-white/45 text-xs mb-4">
              This link didn&apos;t carry a web address Truegle can show.
              {target.rejected && ' We haven’t opened what it did carry.'}
            </p>
            {target.rejected && (
              <code className="block text-[10px] text-white/30 break-all mb-4">{target.rejected}</code>
            )}
            <Link to="/search" className="text-sm text-cyan-300 hover:text-cyan-200">Search Truegle →</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-black">
      <LandingBackground />
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 15%, #22d3ee26, transparent 60%)' }} />

      <div className="relative z-10 min-h-screen flex flex-col items-center px-4 pt-10 pb-32">
        <Link to="/" className="mb-4"><TruegleLogo size="medium" animated /></Link>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl">
          <div className="flex items-center justify-center gap-2 mb-2 text-cyan-300">
            <ShieldCheck size={18} />
            <span className="text-sm font-semibold">Shared with you on Truegle</span>
          </div>
          <p className="text-center text-xs text-white/45 mb-6">
            You&apos;re on Truegle. Here&apos;s exactly where this link goes — nothing
            loads from that site until you choose to open it, and Truegle doesn&apos;t
            track the visit.
          </p>

          <div className="rounded-2xl border border-white/12 bg-white/[0.03] overflow-hidden">
            <div className="px-4 py-3">
              <div className="text-sm text-white/90 break-words">{target.title}</div>
              <div className="flex items-center gap-1.5 mt-1 text-[11px] text-white/40">
                <Globe size={11} className="shrink-0" />
                <span className="break-all">{target.url}</span>
              </div>
            </div>

          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            {playable ? (
              <Link
                to={`/w?u=${encodeURIComponent(target.url)}&t=${encodeURIComponent(target.title)}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-100 text-sm hover:bg-cyan-500/30 transition-colors"
              >
                <ShieldCheck size={16} /> Play in the Truegle player
              </Link>
            ) : null}
            {/* The ONLY navigation to the target, and it takes a deliberate
                click. noreferrer so the destination learns nothing about the
                Truegle page it came from. */}
            <a
              href={target.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/15 text-white/70 text-sm hover:text-white hover:border-white/35 transition-colors"
            >
              <ExternalLink size={16} /> Open {target.host}
            </a>
            <Link
              to={`/search?q=${encodeURIComponent(target.title)}`}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/15 text-white/70 text-sm hover:text-white hover:border-white/35 transition-colors"
            >
              <Search size={16} /> Search Truegle
            </Link>
          </div>

          <p className="text-center text-[11px] text-white/30 mt-5">
            Truegle never redirects you automatically — every Truegle link lands here first.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
