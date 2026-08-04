import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Play, ExternalLink, Search, Loader2, Share2, Film, AlertTriangle, Repeat, Repeat1, PlayCircle, PauseCircle, Plus } from 'lucide-react';
import LandingBackground from '../components/LandingBackground';
import TruegleLogo from '../components/ui/TruegleLogo';
import QueueButton from '../components/ui/QueueButton';
import { usePlayer } from '../context/PlayerContext';
import { getPlayable } from '../utils/videoEmbed';
import { buildPlayerLink } from '../utils/playerLink';
import { isShortForm, asReel, shortFormPlatform, parseDurationSeconds } from '../utils/shortForm';
import TruegleWatermark from '../components/ui/TruegleWatermark';
import ReelShareSheet from '../components/ui/ReelShareSheet';
import AddReelForm from '../components/ui/AddReelForm';

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
const AUTO_KEY = 'truegle_reels_autoscroll';
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
  const [refreshTick, setRefreshTick] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
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
        // "#shorts" is how uploaders mark short-form, so asking for it lifts
        // the share of genuine reels in what comes back. The strict filter
        // below is what guarantees purity — this just improves the yield.
        query: `${effectiveQuery} #shorts`,
        filters: { category: 'videos', bias: 'all', dateRange: 'any', perPage: 40 },
      }),
    })
      .then((r) => r.json())
      .catch(() => ({}))
      .then(async (d) => {
        if (!alive) return;
        // asReel promotes a tagged, short-enough YouTube watch URL to its
        // canonical /shorts/ form; isShortForm then admits only genuine
        // short-form surfaces. Ordinary brief videos never make the feed —
        // that was the bug where a 2-minute music video showed up as a reel.
        const discovered = (d.results || [])
          .map(asReel)
          .filter((r) => r && isShortForm(r))
          .map(toItem);

        // Community submissions carry the platforms search can't reach:
        // TikTok, Instagram and Facebook have no free discovery API, so the
        // only reels from those three are the ones people add.
        let submitted = [];
        try {
          const res = await fetch(`${BACKEND}/api/reels?limit=40`);
          const body = await res.json();
          submitted = (body.reels || [])
            .filter(isShortForm)
            .map((r) => toItem({ ...r, image: r.thumbnail, sourceName: r.platform }));
        } catch { /* feed still works on discovered reels alone */ }

        if (!alive) return;
        const seen = new Set();
        const merged = [...submitted, ...discovered].filter((it) => {
          if (seen.has(it.url)) return false;
          seen.add(it.url);
          return true;
        });
        setItems(merged);
        setActiveIndex(0);
        if (merged.length === 0) setError('No reels for that yet. Try another search — or add one with “Add a reel”.');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [effectiveQuery, refreshTick]);

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
    bumpInteraction();
  }, []);

  // ── auto-advance ────────────────────────────────────────────────────────
  // Sit still and the feed moves to the next clip on its own; touch anything
  // and the timer restarts so it never yanks the page out from under you.
  //
  // The dwell is the clip's own length where we know it (these are 15-90s
  // clips), because advancing at a fixed interval either cuts a clip short or
  // leaves you staring at a finished one. Embedded players don't report
  // "ended" without loading each platform's JS SDK, so this is a timer, not
  // an end-of-media event.
  //
  // Auto-scroll is the default behaviour of the feed, not an opt-in: sitting
  // still should keep playing. WCAG 2.2.2 wants moving content to be stoppable
  // rather than absent, which the always-visible Auto/Paused toggle satisfies —
  // and the choice is remembered, so pausing once pauses for good.
  const [autoAdvance, setAutoAdvance] = useState(() => {
    try {
      const saved = localStorage.getItem(AUTO_KEY);
      if (saved !== null) return saved === '1';
    } catch { /* private mode */ }
    return true;
  });
  const [repeat, setRepeat] = useState('all');   // 'all' = loop the feed, 'one' = loop this clip, 'off'
  const [replayKey, setReplayKey] = useState(0); // bumping this remounts the active embed
  const [interaction, setInteraction] = useState(0);
  const [progress, setProgress] = useState(0);
  const bumpInteraction = useCallback(() => setInteraction((n) => n + 1), []);

  const DEFAULT_DWELL = 30;
  const dwellSeconds = useMemo(() => {
    const secs = parseDurationSeconds(items[activeIndex]?.duration);
    return Math.min(Math.max(secs || DEFAULT_DWELL, 8), 90);
  }, [items, activeIndex]);

  const goTo = useCallback((index) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: index * el.clientHeight, behavior: 'smooth' });
    setActiveIndex(index);
  }, []);

  useEffect(() => {
    setProgress(0);
    if (!autoAdvance || items.length === 0) return undefined;

    const started = Date.now();
    const total = dwellSeconds * 1000;
    const tick = setInterval(() => {
      setProgress(Math.min((Date.now() - started) / total, 1));
    }, 250);

    const advance = setTimeout(() => {
      if (repeat === 'one') { setReplayKey((k) => k + 1); return; }
      const last = activeIndex >= items.length - 1;
      if (!last) goTo(activeIndex + 1);
      else if (repeat === 'all') goTo(0);
    }, total);

    return () => { clearInterval(tick); clearTimeout(advance); };
    // `interaction` is a dependency on purpose: any touch restarts the dwell.
  }, [activeIndex, autoAdvance, repeat, dwellSeconds, items.length, interaction, goTo]);

  useEffect(() => {
    try { localStorage.setItem(AUTO_KEY, autoAdvance ? '1' : '0'); } catch { /* private mode */ }
  }, [autoAdvance]);

  const cycleRepeat = () => setRepeat((r) => (r === 'all' ? 'one' : r === 'one' ? 'off' : 'all'));
  const RepeatIcon = repeat === 'one' ? Repeat1 : Repeat;

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

        {addOpen && (
          <AddReelForm
            onClose={() => setAddOpen(false)}
            onAdded={() => setRefreshTick((n) => n + 1)}
          />
        )}

        <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            title="Add a TikTok, Instagram, Facebook or YouTube reel to the feed"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
              addOpen ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-100'
                : 'bg-white/5 border-white/15 text-white/70 hover:text-white'
            }`}
          >
            <Plus size={13} /> Add a reel
          </button>
          <button
              type="button"
              onClick={() => { setAutoAdvance((v) => !v); bumpInteraction(); }}
              aria-pressed={autoAdvance}
              title={autoAdvance ? 'Auto-scroll is on — pause it' : 'Auto-scroll to the next clip on its own'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                autoAdvance
                  ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-100'
                  : 'bg-white/5 border-white/15 text-white/60 hover:text-white'
              }`}
            >
              {autoAdvance ? <PauseCircle size={13} /> : <PlayCircle size={13} />}
              {autoAdvance ? 'Auto' : 'Paused'}
            </button>
            <button
              type="button"
              onClick={cycleRepeat}
              title={`Repeat: ${repeat === 'all' ? 'the whole feed' : repeat === 'one' ? 'this clip' : 'off'}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
                repeat === 'off'
                  ? 'bg-white/5 border-white/15 text-white/45 hover:text-white'
                  : 'bg-cyan-500/20 border-cyan-400/40 text-cyan-100'
              }`}
            >
            <RepeatIcon size={13} />
            {repeat === 'all' ? 'Feed' : repeat === 'one' ? 'One' : 'Off'}
          </button>
        </div>

        {items.length > 0 && (
          <div className="flex items-center gap-3 mb-2">
            <button type="button" onClick={playAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/15 text-xs text-white/70 hover:text-white transition-colors">
              <Play size={13} /> Play in Truegle player
            </button>
            <span className="text-[11px] text-white/30">
              {items.length} clips · swipe up, or let it roll
            </span>
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
            onPointerDown={bumpInteraction}
            onKeyDown={bumpInteraction}
            className="w-full max-w-sm flex-1 min-h-0 overflow-y-auto snap-y snap-mandatory rounded-2xl border border-white/10"
          >
            {items.map((item, i) => (
              <ShortCard
                key={item.url}
                item={item}
                active={i === activeIndex}
                replayKey={replayKey}
                progress={i === activeIndex && autoAdvance ? progress : 0}
              />
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

function ShortCard({ item, active, replayKey = 0, progress = 0 }) {
  const [shareOpen, setShareOpen] = useState(false);
  const playerLink = item.source ? buildPlayerLink({ url: item.url, title: item.title }) : null;

  return (
    <div className="relative h-full w-full snap-start flex flex-col bg-black/40">
      <div className="relative flex-1 min-h-0 bg-black flex items-center justify-center overflow-hidden">
        {/* Dwell progress — so auto-scroll is visible and predictable rather
            than the page moving for no apparent reason. */}
        {active && progress > 0 && (
          <div className="absolute top-0 inset-x-0 h-0.5 z-20 bg-white/10">
            <div className="h-full bg-cyan-400/80 transition-[width] duration-200 ease-linear"
              style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}

        {active && item.playable ? (
          <iframe
            // replayKey remounts the embed when Repeat-one restarts the clip.
            key={`${item.url}-${replayKey}`}
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

        {/* Truegle mark over our viewer — never burned into the creator's
            video, which we neither hold nor have the right to re-encode. */}
        <TruegleWatermark />

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
            /* Title is distinct from the mini-player's own share button,
               which shares the whole queue — this one shares just this clip. */
            <button type="button" onClick={() => setShareOpen(true)}
              title="Share this clip — opens in Truegle's sandboxed player"
              className="flex items-center gap-1 px-2 h-9 rounded-lg border border-white/15 text-[11px] text-white/60 hover:text-white hover:bg-white/10 transition-colors">
              <Share2 size={14} /> Share
            </button>
          )}
          <a href={item.url} target="_blank" rel="noopener noreferrer" title="Open original"
            className="ml-auto flex items-center justify-center w-9 h-9 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors">
            <ExternalLink size={15} />
          </a>
        </div>
      </div>

      <ReelShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        link={playerLink}
        title={item.title}
        platform={item.platform}
      />
    </div>
  );
}
