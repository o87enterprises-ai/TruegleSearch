import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Newspaper, Play, LineChart, Globe, MapPin, ChevronDown, ChevronUp,
  Maximize2, Minimize2, ExternalLink,
} from 'lucide-react';

// The landing page's news feed — local and global headlines, video coverage,
// and a live markets summary. Replaces the trending-searches pill row, which
// was a rotating list of queries rather than anything that had happened.
//
// WHERE "LOCAL" COMES FROM: the backend reads the country off the edge/CDN
// header the request already carries (see routes/news.js). No geolocation
// prompt on a first visit, no IP-lookup service, no third party, nothing
// stored. Anyone can override it with the region picker, and that choice is
// kept in this browser only.
//
// MINIMISING REALLY STOPS IT. A minimised category is not merely hidden — its
// polling interval is torn down, which is what "silence the notifications"
// has to mean for a panel that refreshes itself. Minimising the whole feed
// stops all three at once.
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const VIEW_KEY = 'truegle_news_view_v1';
const COUNTRY_KEY = 'truegle_news_country';

// How often each panel re-asks, while it is open. Markets is the only one that
// moves minute to minute; headlines that re-ordered themselves every 60s would
// just be motion for its own sake.
const REFRESH = { markets: 60 * 1000, feed: 5 * 60 * 1000 };

// Enough of a spread to be genuinely useful without becoming a country list.
// "Auto" is the default and the honest one — it is whatever the edge says.
const REGIONS = [
  { id: '', label: 'Auto' },
  { id: 'US', label: 'United States' }, { id: 'GB', label: 'United Kingdom' },
  { id: 'CA', label: 'Canada' }, { id: 'AU', label: 'Australia' },
  { id: 'IN', label: 'India' }, { id: 'DE', label: 'Germany' },
  { id: 'FR', label: 'France' }, { id: 'ES', label: 'Spain' },
  { id: 'BR', label: 'Brazil' }, { id: 'NL', label: 'Netherlands' },
  { id: 'JP', label: 'Japan' }, { id: 'ZA', label: 'South Africa' },
];

const CATEGORIES = ['print', 'video', 'markets'];

const DEFAULT_VIEW = {
  feed: { minimized: false, expanded: false },
  print: { minimized: false, expanded: false },
  video: { minimized: false, expanded: false },
  markets: { minimized: false, expanded: false },
};

function loadView() {
  try {
    const raw = JSON.parse(localStorage.getItem(VIEW_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return DEFAULT_VIEW;
    const pick = (k) => ({
      minimized: !!raw[k]?.minimized,
      expanded: !!raw[k]?.expanded,
    });
    return { feed: pick('feed'), print: pick('print'), video: pick('video'), markets: pick('markets') };
  } catch {
    return DEFAULT_VIEW;
  }
}

const ago = (ts) => {
  if (!ts) return '';
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 90) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

const money = (n, currency = 'USD') => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  const digits = Math.abs(n) >= 1000 ? 0 : Math.abs(n) >= 1 ? 2 : 4;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits,
    }).format(n);
  } catch {
    return n.toFixed(digits);
  }
};

/**
 * The "summarized live chart" — an inline SVG polyline, no charting library.
 *
 * A dependency for this would be several hundred KB on the landing page's
 * critical path to draw forty points into a 90×28 box. The points arrive
 * already downsampled by the backend.
 */
function Sparkline({ points = [], up, width = 88, height = 28 }) {
  const path = useMemo(() => {
    const vals = points.filter((v) => typeof v === 'number' && Number.isFinite(v));
    if (vals.length < 2) return '';
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    // A dead-flat series would divide by zero; draw it down the middle.
    const span = max - min || 1;
    const stepX = width / (vals.length - 1);
    return vals
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`)
      .join(' ');
  }, [points, width, height]);

  if (!path) return <div style={{ width, height }} aria-hidden />;
  const stroke = up ? '#34d399' : '#f87171';
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** The two controls every panel carries: expand for depth, minimise to silence. */
function PanelControls({ state, onToggleMin, onToggleExpand, label }) {
  return (
    <div className="ml-auto flex items-center gap-0.5 shrink-0">
      {!state.minimized && (
        <button
          type="button"
          onClick={onToggleExpand}
          aria-pressed={state.expanded}
          title={state.expanded ? `Collapse ${label}` : `Expand ${label} for more`}
          aria-label={state.expanded ? `Collapse ${label}` : `Expand ${label}`}
          className="flex items-center justify-center w-7 h-7 rounded-md text-white/35 hover:text-white hover:bg-white/10 transition-colors"
        >
          {state.expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      )}
      <button
        type="button"
        onClick={onToggleMin}
        aria-pressed={state.minimized}
        title={state.minimized ? `Show ${label}` : `Minimise ${label} — stops it refreshing`}
        aria-label={state.minimized ? `Show ${label}` : `Minimise ${label}`}
        className="flex items-center justify-center w-7 h-7 rounded-md text-white/35 hover:text-white hover:bg-white/10 transition-colors"
      >
        {state.minimized ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
    </div>
  );
}

function Panel({ id, icon: Icon, title, accent, state, setState, children, note }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <Icon size={13} style={{ color: accent }} className="shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/60">{title}</span>
        {note && !state.minimized && <span className="text-[10px] text-white/25 truncate">{note}</span>}
        {state.minimized && <span className="text-[10px] text-white/25">paused</span>}
        <PanelControls
          label={title}
          state={state}
          onToggleMin={() => setState(id, { minimized: !state.minimized })}
          onToggleExpand={() => setState(id, { expanded: !state.expanded })}
        />
      </div>
      {!state.minimized && children}
    </div>
  );
}

function HeadlineRow({ item, onSearch }) {
  return (
    <div className="group flex items-start gap-2 px-3 py-1.5 hover:bg-white/5">
      <div className="min-w-0 flex-1">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-[12px] leading-snug text-white/75 hover:text-white truncate"
        >
          {item.title}
        </a>
        <div className="flex items-center gap-1.5 text-[10px] text-white/30">
          {item.source && <span className="truncate max-w-[10rem]">{item.source}</span>}
          {item.at && <span className="tabular-nums">· {ago(item.at)}</span>}
        </div>
      </div>
      {/* The point of a search engine's news feed: read it here, or go and
          research it properly. */}
      <button
        type="button"
        onClick={() => onSearch(item.title)}
        title="Search this on Truegle"
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center w-7 h-7 rounded-md text-white/30 hover:text-white hover:bg-white/10 transition-all shrink-0"
      >
        <ExternalLink size={12} />
      </button>
    </div>
  );
}

function MarketRow({ q }) {
  const up = (q.changePct ?? 0) >= 0;
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-white/70 truncate">{q.label}</div>
        <div className="text-[10px] text-white/30 tabular-nums">{money(q.price, q.currency)}</div>
      </div>
      <Sparkline points={q.spark} up={up} />
      <div className={`w-14 text-right text-[11px] font-medium tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}>
        {up ? '+' : ''}{(q.changePct ?? 0).toFixed(2)}%
      </div>
    </div>
  );
}

export default function NewsFeed() {
  const navigate = useNavigate();
  const [view, setView] = useState(loadView);
  const [country, setCountry] = useState(() => localStorage.getItem(COUNTRY_KEY) || '');
  const [data, setData] = useState(null);
  const [markets, setMarkets] = useState(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState('local'); // print panel: local | world
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  const setPanel = useCallback((id, patch) => {
    setView((v) => {
      const next = { ...v, [id]: { ...v[id], ...patch } };
      try { localStorage.setItem(VIEW_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  }, []);

  const feedMin = view.feed.minimized;

  // ── the feed itself ───────────────────────────────────────────────────────
  const loadFeed = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/api/news/feed${country ? `?country=${country}` : ''}`);
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      if (!alive.current) return;
      setData(j);
      setMarkets(j.markets);
      setError(false);
    } catch {
      if (alive.current) setError(true);
    }
  }, [country]);

  useEffect(() => {
    if (feedMin) return undefined;         // minimised: don't even open with it
    loadFeed();
    const id = setInterval(loadFeed, REFRESH.feed);
    return () => clearInterval(id);
  }, [loadFeed, feedMin]);

  // Markets on its own faster cadence — and ONLY while both the feed and the
  // markets panel are open. This is the "silence it" contract: a minimised
  // panel makes no requests at all.
  const marketsMin = view.markets.minimized;
  useEffect(() => {
    if (feedMin || marketsMin) return undefined;
    const tick = async () => {
      try {
        const r = await fetch(`${BACKEND}/api/news/markets`);
        if (!r.ok) return;
        const j = await r.json();
        if (alive.current) setMarkets(j);
      } catch { /* leave the last numbers on screen */ }
    };
    // Tick IMMEDIATELY, not just on the interval. Bringing a minimised panel
    // back and being shown minute-old prices for another whole minute is the
    // opposite of what un-minimising a live chart is asking for — and on first
    // paint it fills the panel if /feed's markets leg was the one that failed.
    tick();
    const id = setInterval(tick, REFRESH.markets);
    return () => clearInterval(id);
  }, [feedMin, marketsMin]);

  const onSearch = useCallback((q) => navigate(`/search?q=${encodeURIComponent(q)}`), [navigate]);

  const chooseRegion = (id) => {
    setCountry(id);
    try {
      if (id) localStorage.setItem(COUNTRY_KEY, id);
      else localStorage.removeItem(COUNTRY_KEY);
    } catch { /* private mode */ }
  };

  const headlines = tab === 'world' ? (data?.print?.world || []) : (data?.print?.local || []);
  const printLimit = view.print.expanded ? 10 : 4;
  const videoLimit = view.video.expanded ? 8 : 3;
  const allMarkets = useMemo(() => ([
    ...(markets?.stocks || []),
    ...(markets?.crypto || []),
    ...(markets?.commodities || []),
  ]), [markets]);
  const marketLimit = view.markets.expanded ? allMarkets.length : 4;

  const shownCountry = data?.country || country || '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="mt-16"
    >
      {/* ── feed header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <Newspaper size={16} className="text-orange-400 shrink-0" />
        <span className="text-sm font-semibold text-white/70 uppercase tracking-wider">News</span>
        {!feedMin && !error && (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-[10px] text-orange-400/60 font-medium tracking-wide">LIVE</span>
          </>
        )}

        {/* Region. Coarse by design — a country, chosen or inferred, never a
            position. */}
        <label className="ml-2 flex items-center gap-1 text-[11px] text-white/40">
          <MapPin size={11} className="shrink-0" />
          <select
            value={country}
            onChange={(e) => chooseRegion(e.target.value)}
            aria-label="News region"
            className="bg-transparent border border-white/10 rounded-md px-1.5 py-0.5 text-[11px] text-white/60 outline-none hover:border-white/25 focus:border-white/30 [&>option]:bg-[#0d0d14]"
          >
            {REGIONS.map((r) => (
              <option key={r.id || 'auto'} value={r.id}>
                {r.id ? r.label : `Auto${shownCountry ? ` (${shownCountry})` : ''}`}
              </option>
            ))}
          </select>
        </label>

        <PanelControls
          label="the news feed"
          state={view.feed}
          onToggleMin={() => setPanel('feed', { minimized: !view.feed.minimized })}
          onToggleExpand={() => {
            // Expanding the feed expands every panel with it — the point of the
            // control at this level is "show me everything", and doing it three
            // more times by hand is not that.
            const expanded = !view.feed.expanded;
            setView((v) => {
              const next = { ...v, feed: { ...v.feed, expanded } };
              CATEGORIES.forEach((c) => { next[c] = { ...v[c], expanded }; });
              try { localStorage.setItem(VIEW_KEY, JSON.stringify(next)); } catch { /* private mode */ }
              return next;
            });
          }}
        />
      </div>

      {feedMin ? (
        <p className="text-[11px] text-white/25">News is minimised — nothing is being fetched.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* ── print ─────────────────────────────────────────────────── */}
          <Panel
            id="print" icon={Newspaper} title="Print" accent="#fb923c"
            state={view.print} setState={setPanel}
          >
            <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/5">
              {['local', 'world'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider transition-colors ${
                    tab === t ? 'bg-white/10 text-white/80' : 'text-white/30 hover:text-white/60'
                  }`}
                >
                  {t === 'local' ? <MapPin size={9} /> : <Globe size={9} />}
                  {t === 'local' ? (shownCountry || 'Local') : 'World'}
                </button>
              ))}
            </div>
            {headlines.length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-white/30">
                {error ? 'Headlines are unavailable right now.' : 'Loading headlines…'}
              </p>
            ) : (
              headlines.slice(0, printLimit).map((h) => (
                <HeadlineRow key={h.url || h.title} item={h} onSearch={onSearch} />
              ))
            )}
          </Panel>

          {/* ── video ─────────────────────────────────────────────────── */}
          <Panel
            id="video" icon={Play} title="Video" accent="#f43f5e"
            state={view.video} setState={setPanel}
            note="coverage of the top story"
          >
            {(data?.video || []).length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-white/30">
                {error ? 'Video coverage is unavailable right now.' : 'Looking for coverage…'}
              </p>
            ) : (
              data.video.slice(0, videoLimit).map((v) => (
                <a
                  key={v.url}
                  href={v.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 px-3 py-1.5 hover:bg-white/5 group"
                >
                  {v.thumbnail ? (
                    <img src={v.thumbnail} alt="" loading="lazy"
                      className="w-14 h-9 rounded object-cover bg-white/5 shrink-0" />
                  ) : (
                    <span className="flex items-center justify-center w-14 h-9 rounded bg-white/5 shrink-0">
                      <Play size={12} className="text-white/30" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] leading-snug text-white/75 group-hover:text-white truncate">{v.title}</span>
                    {v.source && <span className="block text-[10px] text-white/30 truncate">{v.source}</span>}
                  </span>
                </a>
              ))
            )}
          </Panel>

          {/* ── markets ───────────────────────────────────────────────── */}
          <Panel
            id="markets" icon={LineChart} title="Markets" accent="#34d399"
            state={view.markets} setState={setPanel}
            note={markets?.at ? `updated ${ago(markets.at)}` : ''}
          >
            {allMarkets.length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-white/30">
                {error ? 'Market data is unavailable right now.' : 'Loading markets…'}
              </p>
            ) : (
              <>
                {allMarkets.slice(0, marketLimit).map((q) => <MarketRow key={q.id} q={q} />)}
                {view.markets.expanded && (
                  <p className="px-3 py-1.5 text-[10px] text-white/25 border-t border-white/5">
                    Indices and commodities delayed; crypto is 7-day. Sparklines are indicative, not advice.
                  </p>
                )}
              </>
            )}
          </Panel>
        </div>
      )}
    </motion.div>
  );
}
