import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Play, ExternalLink, Search, Loader2, ShieldCheck, Check, Film, AlertTriangle } from 'lucide-react';
import LandingBackground from '../components/LandingBackground';
import TruegleLogo from '../components/ui/TruegleLogo';
import QueueButton from '../components/ui/QueueButton';
import { usePlayer } from '../context/PlayerContext';
import { getPlayable } from '../utils/videoEmbed';
import { buildPlayerLink } from '../utils/playerLink';
import { isShortForm, shortFormPlatform } from '../utils/shortForm';

// /shorts — an aggregated short-form feed (YouTube Shorts + TikTok), served
// from the same free SearXNG-backed search as everything else. No platform
// API keys, no per-platform accounts, no tracking.
//
// Honest scope, so nobody wonders why their favourite app is missing:
//   • YouTube Shorts and TikTok are playable inline — both expose a keyless
//     embed.
//   • Instagram and Facebook Reels are *found and listed* but link out: Meta
//     gates oEmbed behind app review, which Truegle doesn't have. They're
//     labelled as such rather than quietly dropped.
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// Seed topics for a cold open, so the feed has something in it before anyone
// types a query.
const SEED_TOPICS = ['trending shorts', 'viral clips', 'shorts today'];
const pickSeed = () => SEED_TOPICS[Math.floor(Math.random() * SEED_TOPICS.length)];

function toItem(result) {
  const playable = getPlayable(result.url);
  return {
    url: result.url,
    title: result.title || result.url,
    channel: result.channel || result.sourceName || result.domain || '',
    thumbnail: result.image || result.thumbnail || null,
    duration: result.duration || null,
    platform: shortFormPlatform(result.url) || 'Short video',
    playable,
    source: playable
      ? { ...playable, title: result.title || result.url, pageUrl: result.url, poster: result.image }
      : null,
  };
}

export default function ShortsFeed() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [input, setInput] = useState(query);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const { play, enqueueMany } = usePlayer();

  const effectiveQuery = useMemo(() => query || pickSeed(), [query]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    fetch(`${BACKEND}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: effectiveQuery,
        filters: { category: 'videos', bias: 'all', dateRange: 'any', perPage: 40 },
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const shorts = (d.results || []).filter(isShortForm).map(toItem);
        setItems(shorts);
        setActiveIndex(0);
        if (shorts.length === 0) setError('No short-form clips in those results. Try another search.');
      })
      .catch(() => { if (alive) setError('Search is unreachable right now.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [effectiveQuery]);

  const submit = (e) => {
    e.preventDefault();
    setSearchParams(input.trim() ? { q: input.trim() } : {});
  };

  // Only the card in view mounts its iframe — 40 autoplaying embeds would
  // melt a phone.
  const containerRef = useRef(null);
  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setActiveIndex(Math.round(el.scrollTop / el.clientHeight));
  }, []);

  // Queue the whole feed — the "uninterrupted content" case, one tap.
  const playAll = () => {
    const sources = items.map((i) => i.source).filter(Boolean);
    if (!sources.length) return;
    play(sources[0]);
    if (sources.length > 1) enqueueMany(sources.slice(1));
  };

  return (
    <div className="h-screen relative bg-black overflow-hidden">
      <LandingBackground />
      {/* h-screen + flex-1 on the feed: the card sizes itself to whatever
          space the app chrome leaves, instead of guessing at a fixed offset
          and ending up under the bottom banner. pb-28 clears that banner. */}
      <div className="relative z-10 h-full flex flex-col items-center px-4 pt-8 pb-28">
        <Link to="/" className="mb-3"><TruegleLogo size="small" animated /></Link>

        <div className="flex items-center gap-2 mb-3 text-white/80">
          <Film size={18} className="text-cyan-300" />
          <h1 className="text-lg font-semibold">Shorts &amp; Reels</h1>
        </div>

        <form onSubmit={submit} className="w-full max-w-md flex gap-2 mb-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search short-form video…"
            className="flex-1 min-w-0 bg-black/40 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/60"
          />
          <button type="submit"
            className="px-4 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-100 text-sm hover:bg-cyan-500/30 transition-colors">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          </button>
        </form>

        {items.length > 0 && (
          <div className="flex items-center gap-3 mb-3">
            <button type="button" onClick={playAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-xs text-white/70 hover:text-white transition-colors">
              <Play size={13} /> Play in Truegle player
            </button>
            <span className="text-[11px] text-white/30">{items.length} clips · swipe up for the next</span>
          </div>
        )}

        {error && !loading && (
          <p className="text-white/50 text-sm my-8">{error}</p>
        )}

        {/* Vertical snap feed. Sized to leave the app's own chrome alone
            instead of fighting the fixed banner for the viewport. */}
        {items.length > 0 && (
          <div
            ref={containerRef}
            onScroll={onScroll}
            className="w-full max-w-sm flex-1 min-h-0 overflow-y-auto snap-y snap-mandatory rounded-2xl border border-white/10"
          >
            {items.map((item, i) => (
              <ShortCard key={item.url} item={item} active={i === activeIndex} />
            ))}
          </div>
        )}

        {loading && items.length === 0 && (
          <div className="flex items-center gap-2 text-white/40 text-sm my-12">
            <Loader2 size={16} className="animate-spin" /> Gathering shorts…
          </div>
        )}
      </div>
    </div>
  );
}

function ShortCard({ item, active }) {
  const [copied, setCopied] = useState(false);
  const playerLink = item.source ? buildPlayerLink({ url: item.url, title: item.title }) : null;

  const copyLink = () => {
    if (!playerLink) return;
    navigator.clipboard.writeText(playerLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="h-full w-full snap-start flex flex-col bg-black/40">
      <div className="relative flex-1 min-h-0 bg-black flex items-center justify-center overflow-hidden">
        {active && item.playable ? (
          <iframe
            src={`${item.source.src}${item.source.src.includes('?') ? '&' : '?'}autoplay=1`}
            title={item.title}
            className="w-full h-full"
            // Same sandbox rule as the mini-player: no allow-top-navigation,
            // so an embed can never navigate the tab out from under the feed.
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : item.thumbnail ? (
          <img src={item.thumbnail} alt="" className="w-full h-full object-cover opacity-70" />
        ) : (
          <Film size={40} className="text-white/15" />
        )}

        {!item.playable && (
          <div className="absolute inset-x-0 bottom-0 bg-black/80 px-3 py-2">
            <div className="flex items-center gap-1.5 text-amber-300 text-[11px] mb-0.5">
              <AlertTriangle size={12} /> {item.platform} can&apos;t play inside Truegle
            </div>
            <p className="text-[10px] text-white/40 leading-tight">
              Meta gates Reels embedding behind app review. Opening it leaves Truegle.
            </p>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-white/10 shrink-0">
        <div className="text-xs text-white/85 line-clamp-2">{item.title}</div>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/35">
          <span className="truncate">{item.channel}</span>
          <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">{item.platform}</span>
          {item.duration && <span className="shrink-0">{item.duration}</span>}
        </div>

        <div className="flex items-center gap-1 mt-2">
          {item.source && <QueueButton source={item.source} className="text-cyan-300" showLabel />}
          {playerLink && (
            <button type="button" onClick={copyLink} title="Copy a safe Truegle player link"
              className={`flex items-center justify-center w-9 h-9 rounded-lg hover:bg-white/10 transition-colors ${copied ? 'text-green-400' : 'text-white/50'}`}>
              {copied ? <Check size={15} /> : <ShieldCheck size={15} />}
            </button>
          )}
          <a href={item.url} target="_blank" rel="noopener noreferrer" title="Open original"
            className="ml-auto flex items-center justify-center w-9 h-9 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <ExternalLink size={15} />
          </a>
        </div>
      </div>
    </div>
  );
}
