import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, MapPin, Play, ExternalLink } from 'lucide-react';

// The landing page's News and Markets — the bodies of their two tiles (see
// LandingModules: one open at a time, opened by a hand).
//
// THE REPORTS ARE YOUTUBE'S, AS THUMBNAILS THAT PLAY IN TRUEGLE (owner,
// 2026-09-29). Tapping one opens it in the Feed's own timeline — the News or
// Markets category, with that clip playing and the shelf lined up behind it —
// rather than starting a second, separate player on the landing page. They come
// from GET /api/news/videos, which asks
// our own index for YouTube coverage of today's news / today's markets — a
// search, deliberately not a list of chosen channels (see
// backend/services/NewsVideos.js). That is what the cards say underneath.
//
// NOTHING IS ASKED FOR WHILE A TILE IS CLOSED. LandingModules only mounts the
// open tile's body, so every fetch and every polling interval below lives in a
// body component: opening starts it, closing (or opening another tile, which
// closes this one) tears it down. That is the whole "minimise silences it"
// contract, with no separate minimise control to get confused by.
//
// WHERE "LOCAL" COMES FROM: the backend reads the country off the edge/CDN
// header the request already carries. No geolocation prompt, no IP-lookup
// service, nothing stored. The region picker overrides it, kept in this
// browser only.
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const COUNTRY_KEY = 'truegle_news_country';
const MARKETS_REFRESH_MS = 60 * 1000;

const REGIONS = [
  { id: '', label: 'Auto' },
  { id: 'US', label: 'United States' }, { id: 'GB', label: 'United Kingdom' },
  { id: 'CA', label: 'Canada' }, { id: 'AU', label: 'Australia' },
  { id: 'IN', label: 'India' }, { id: 'DE', label: 'Germany' },
  { id: 'FR', label: 'France' }, { id: 'ES', label: 'Spain' },
  { id: 'BR', label: 'Brazil' }, { id: 'NL', label: 'Netherlands' },
  { id: 'JP', label: 'Japan' }, { id: 'ZA', label: 'South Africa' },
];

const ago = (ts) => {
  if (!ts) return '';
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 90) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

const clock = (secs) => {
  if (!secs) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
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

/** One GET, on mount and whenever `url` changes; `null` url means don't ask. */
function useJson(url) {
  const [state, setState] = useState({ data: null, status: url ? 'loading' : 'idle' });
  useEffect(() => {
    if (!url) { setState({ data: null, status: 'idle' }); return undefined; }
    const controller = new AbortController();
    setState((s) => ({ data: s.data, status: 'loading' }));
    fetch(url, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((data) => setState({ data, status: 'ok' }))
      .catch((e) => { if (e.name !== 'AbortError') setState({ data: null, status: 'error' }); });
    return () => controller.abort();
  }, [url]);
  return state;
}

/**
 * A row of YouTube thumbnails. Tapping one opens it in the Feed timeline with
 * the rest of the shelf lined up behind it — auto-advance is the player's own
 * feed-follow, the same as on the Feed page.
 */
function VideoRail({ videos, status, emptyText, label, category }) {
  const navigate = useNavigate();

  // Into the Feed timeline: the category shelf (same clips, same source) with
  // this one already playing. FeedPage plays it even if the shelf has since
  // moved on, so a stale card still works.
  const play = (v) => navigate(`/feed?category=${category}&play=${encodeURIComponent(v.url)}`);

  if (status === 'loading' && !videos?.length) {
    return (
      <div className="flex gap-3 overflow-hidden" aria-busy="true" data-news-loading="">
        {[0, 1, 2].map((i) => (
          <div key={i} className="shrink-0 w-[168px]">
            <div className="aspect-video rounded-lg bg-white/5 animate-pulse" />
            <div className="mt-2 h-3 w-3/4 rounded bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }
  if (!videos?.length) {
    return <p className="text-[11px] text-white/35" data-news-empty="">{emptyText}</p>;
  }

  return (
    <div
      role="list"
      aria-label={label}
      className="flex gap-3 overflow-x-auto snap-x snap-mandatory overscroll-x-contain pb-1 -mx-1 px-1"
      style={{ scrollbarWidth: 'none' }}
    >
      {videos.map((v) => (
        <button
          key={v.id}
          type="button"
          role="listitem"
          data-news-video={v.id}
          onClick={() => play(v)}
          className="group snap-start shrink-0 w-[168px] text-left"
        >
          <div className="relative aspect-video rounded-lg overflow-hidden bg-white/5 border border-white/10 group-hover:border-white/30 transition-colors">
            <img src={v.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm border border-white/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play size={14} className="text-white fill-white ml-0.5" />
              </span>
            </span>
            {v.duration ? (
              <span className="absolute bottom-1 right-1 px-1 rounded bg-black/75 text-[10px] text-white/90 tabular-nums">{clock(v.duration)}</span>
            ) : null}
          </div>
          <p className="mt-1.5 text-[12px] leading-snug text-white/85 line-clamp-2">{v.title}</p>
          <p className="text-[10px] text-white/35 truncate">
            {[v.channel, v.at ? ago(v.at) : ''].filter(Boolean).join(' · ')}
          </p>
        </button>
      ))}
    </div>
  );
}

const SOURCE_NOTE = 'Videos are today’s YouTube coverage found by Truegle’s search — not a chosen list of outlets, and not an endorsement.';

/** Text headlines: only when the video row has nothing to show. */
function HeadlineFallback({ country, tab }) {
  const navigate = useNavigate();
  const { data } = useJson(`${BACKEND}/api/news/feed${country ? `?country=${country}` : ''}`);
  const rows = (tab === 'world' ? data?.print?.world : data?.print?.local) || [];
  if (!rows.length) return null;
  return (
    <ul className="mt-3 border-t border-white/5 pt-2" data-news-headlines="">
      {rows.slice(0, 4).map((h) => (
        <li key={h.url || h.title} className="group flex items-start gap-2 py-1">
          <a href={h.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 text-[12px] leading-snug text-white/70 hover:text-white truncate">
            {h.title}
          </a>
          <button
            type="button"
            onClick={() => navigate(`/search?q=${encodeURIComponent(h.title)}`)}
            title="Search this on Truegle"
            aria-label="Search this on Truegle"
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-white/30 hover:text-white hover:bg-white/10"
          >
            <ExternalLink size={12} />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function NewsBody() {
  const [country, setCountry] = useState(() => { try { return localStorage.getItem(COUNTRY_KEY) || ''; } catch { return ''; } });
  const [tab, setTab] = useState('local');
  const url = `${BACKEND}/api/news/videos?kind=news&scope=${tab}${country ? `&country=${country}` : ''}`;
  const { data, status } = useJson(url);
  const shown = data?.country || country || '';

  const chooseRegion = (id) => {
    setCountry(id);
    try { if (id) localStorage.setItem(COUNTRY_KEY, id); else localStorage.removeItem(COUNTRY_KEY); } catch { /* private mode */ }
  };

  return (
    <div data-news-body="news">
      <div className="flex items-center gap-1 flex-wrap mb-3">
        {['local', 'world'].map((t) => (
          <button
            key={t}
            type="button"
            data-news-tab={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider transition-colors ${
              tab === t ? 'bg-white/12 text-white/90' : 'text-white/35 hover:text-white/70'
            }`}
          >
            {t === 'local' ? <MapPin size={10} /> : <Globe size={10} />}
            {t === 'local' ? (shown || 'Local') : 'World'}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-1 text-[11px] text-white/40">
          <span className="sr-only">News region</span>
          <select
            value={country}
            onChange={(e) => chooseRegion(e.target.value)}
            aria-label="News region"
            className="bg-transparent border border-white/10 rounded-md px-1.5 py-0.5 text-[11px] text-white/60 outline-none hover:border-white/25 focus:border-white/30 [&>option]:bg-[#0d0d14]"
          >
            {REGIONS.map((r) => (
              <option key={r.id || 'auto'} value={r.id}>{r.id ? r.label : `Auto${shown ? ` (${shown})` : ''}`}</option>
            ))}
          </select>
        </label>
      </div>
      <VideoRail
        videos={data?.videos}
        status={status}
        label="News videos"
        category="news"
        emptyText={status === 'error' ? 'News videos are unavailable right now.' : 'No fresh news videos found right now.'}
      />
      {status !== 'loading' && !data?.videos?.length ? <HeadlineFallback country={country} tab={tab} /> : null}
      <p className="mt-3 text-[10px] text-white/30 leading-snug">{SOURCE_NOTE}</p>
    </div>
  );
}

function Sparkline({ points = [], up, width = 88, height = 28 }) {
  const path = useMemo(() => {
    const vals = points.filter((v) => typeof v === 'number' && Number.isFinite(v));
    if (vals.length < 2) return '';
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || 1; // a dead-flat series would divide by zero
    const stepX = width / (vals.length - 1);
    return vals
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`)
      .join(' ');
  }, [points, width, height]);

  if (!path) return <div style={{ width, height }} aria-hidden />;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="overflow-visible">
      <path d={path} fill="none" stroke={up ? '#34d399' : '#f87171'} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function MarketRow({ q }) {
  const up = (q.changePct ?? 0) >= 0;
  return (
    <div className="flex items-center gap-2 py-1.5">
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

export function MarketsBody() {
  const [markets, setMarkets] = useState(null);
  const [failed, setFailed] = useState(false);
  const [all, setAll] = useState(false);
  const alive = useRef(true);

  // Ticks immediately on open and every minute after, and stops the moment the
  // card retracts (this component unmounts). Prices from a minute ago on a card
  // that was just opened would be the opposite of "live".
  useEffect(() => {
    alive.current = true;
    const tick = async () => {
      try {
        const r = await fetch(`${BACKEND}/api/news/markets`);
        if (!r.ok) throw new Error(String(r.status));
        const j = await r.json();
        if (alive.current) { setMarkets(j); setFailed(false); }
      } catch {
        if (alive.current) setFailed(true); // leave the last numbers on screen
      }
    };
    tick();
    const id = setInterval(tick, MARKETS_REFRESH_MS);
    return () => { alive.current = false; clearInterval(id); };
  }, []);

  const rows = useMemo(() => [
    ...(markets?.stocks || []), ...(markets?.crypto || []), ...(markets?.commodities || []),
  ], [markets]);
  // The News card's region applies here too: it decides the language (English
  // for the US) and which market the videos are about. Auto = the server's
  // guess from the edge, same as News.
  const [region] = useState(() => { try { return localStorage.getItem(COUNTRY_KEY) || ''; } catch { return ''; } });
  const { data, status } = useJson(`${BACKEND}/api/news/videos?kind=markets${region ? `&country=${region}` : ''}`);

  return (
    <div data-news-body="markets">
      {rows.length === 0 ? (
        <p className="text-[11px] text-white/30">{failed ? 'Market data is unavailable right now.' : 'Loading markets…'}</p>
      ) : (
        <>
          <div className="divide-y divide-white/5">
            {rows.slice(0, all ? rows.length : 4).map((q) => <MarketRow key={q.id} q={q} />)}
          </div>
          <div className="flex items-center gap-2 mt-1">
            {rows.length > 4 && (
              <button
                type="button"
                data-markets-more=""
                onClick={() => setAll((v) => !v)}
                className="text-[11px] text-white/45 hover:text-white/80 underline-offset-2 hover:underline"
              >
                {all ? 'Show fewer' : `Show all ${rows.length}`}
              </button>
            )}
            {markets?.at ? <span className="ml-auto text-[10px] text-white/25">updated {ago(markets.at)}</span> : null}
          </div>
        </>
      )}

      <p className="mt-4 mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/45">Analysis</p>
      <VideoRail
        videos={data?.videos}
        status={status}
        label="Market analysis videos"
        category="markets"
        emptyText={status === 'error' ? 'Analysis videos are unavailable right now.' : 'No fresh analysis videos found right now.'}
      />
      <p className="mt-3 text-[10px] text-white/30 leading-snug">{SOURCE_NOTE} Not financial advice.</p>
    </div>
  );
}
