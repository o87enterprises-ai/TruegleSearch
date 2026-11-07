import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Rss, ArrowUpRight, Shuffle } from 'lucide-react';
import { FeedList } from '../../pages/FeedPage';
import { useSocialFeed } from '../../hooks/useSocialFeed';
import { PROVIDERS, platformsFor, isConnectable, BROWSE_ONLY } from '../../config/socialProviders';
import { MODE_COLORS } from '../../config/modeTheme';
import { categoryById } from '../../config/feedCategories';

// TABS (owner, 2026-11-06): Top · Creators · News · Markets.
//
// TOP is the social networks ONLY — no headlines, repos or link pools — so the
// round-robin's first N cards are each network's #1 hot/top post (the backend
// reads each platform's popular listing / top-posts seed for an empty query).
// The other three reuse the Browse categories' sources so they can't drift.
const TOP_NETWORKS = ['instagram', 'facebook', 'tiktok', 'x', 'reddit', 'bluesky',
  'mastodon', 'lemmy', 'truthsocial', 'rumble', 'pinterest'];
// Display names for the Top tab's server pills.
const NETWORK_LABELS = {
  instagram: 'Instagram', facebook: 'FB', tiktok: 'TikTok', x: 'X', reddit: 'Reddit',
  bluesky: 'Bluesky', mastodon: 'Mastodon', lemmy: 'Lemmy', truthsocial: 'Truth',
  rumble: 'Rumble', pinterest: 'Pinterest',
};

// The heading's platform name when ONE server pill is picked (owner,
// 2026-11-07): "Trending Posts on Facebook", not "…on FB". Falls back to the
// pill's own label.
const HEADING_NAMES = { facebook: 'Facebook', truthsocial: 'Truth Social' };
const headingFor = (tab, server) => {
  if (tab !== 'top') return TABS.find((t) => t.id === tab).label;
  if (server === 'all') return 'Trending posts across all platforms';
  return `Trending Posts on ${HEADING_NAMES[server] || NETWORK_LABELS[server] || server}`;
};

// BLANK NEVER MEANS BROKEN (owner, 2026-11-06). A blank query on the big
// networks often comes back empty, which reads as "this doesn't work". When the
// unseeded pull finishes empty, the frame re-asks with a top-posts word and
// sorts what comes back newest first. Shuffle picks another word.
const FALLBACK_SEEDS = ['viral', 'trending', 'breaking', 'funny', 'video', 'news', 'music', 'sports'];
const byNewest = (a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0);

const TABS = [
  { id: 'top', label: 'Top', platforms: TOP_NETWORKS },
  { id: 'creators', label: 'Creators', platforms: categoryById('creators').platforms },
  { id: 'news', label: 'News', platforms: categoryById('news').platforms },
  { id: 'markets', label: 'Markets', platforms: categoryById('markets').platforms },
];

// THE FEED, IN A FRAME, ON LANDING (owner, 2026-11-05).
//
// The /feed home timeline, shrunk to a fixed-height box under the feature
// tiles that scrolls INSIDE itself instead of taking the page. Same list, same
// cards, same play-in-player, same endless paging — it IS FeedPage's FeedList,
// not a look-alike, so the two can never drift.
//
// TOP POSTS FIRST: `interleave` round-robins the per-platform pages
// (utils/roundRobin.js), so the first N cards are each platform's #1 post, one
// at a time; scrolling then walks every platform's #2, #3, …
//
// rememberSeen is OFF on purpose: the never-repeat ledger would hide today's
// top posts here simply because the visitor saw them on /feed, and this frame's
// whole job is to show what's on top right now.
//
// Not an <iframe> of /feed: that would boot a second copy of the whole app (and
// a second player) inside the first. A scroll container gives the same "page in
// a frame" feel with one app and one player.
export default function LandingFeedFrame() {
  const [tab, setTab] = useState('top');
  const [server, setServer] = useState('all');
  // -1 = the plain blank-query pull; 0+ = index into FALLBACK_SEEDS.
  const [seedIdx, setSeedIdx] = useState(-1);
  const platforms = useMemo(() => {
    const available = new Set(platformsFor(PROVIDERS.filter((p) => isConnectable(p.id)).map((p) => p.id)));
    const wanted = TABS.find((t) => t.id === tab).platforms;
    // BROWSE_ONLY shelves are allowed here only when their tab asks for them.
    const list = wanted.filter((p) => available.has(p) && (tab !== 'top' || !BROWSE_ONLY.has(p)));
    return tab === 'top' && server !== 'all' ? list.filter((p) => p === server) : list;
  }, [tab, server]);
  const topNetworks = useMemo(() => TABS[0].platforms.filter((p) => NETWORK_LABELS[p]), []);
  const query = seedIdx >= 0 ? FALLBACK_SEEDS[seedIdx % FALLBACK_SEEDS.length] : '';
  const raw = useSocialFeed({ query, platforms, enabled: platforms.length > 0, interleave: true, rememberSeen: false });

  // New tab or server → start over from the plain blank pull.
  useEffect(() => { setSeedIdx(-1); }, [tab, server]);
  // The blank pull finished with nothing → auto-pull top posts instead. Walks
  // the seed list once, so a truly dead source ends rather than looping.
  const empty = !raw.loading && !raw.items.length && (raw.done || raw.error);
  useEffect(() => {
    if (empty && tab === 'top' && platforms.length && seedIdx < FALLBACK_SEEDS.length - 1) {
      setSeedIdx((i) => i + 1);
    }
  }, [empty]); // eslint-disable-line react-hooks/exhaustive-deps

  const usingFallback = seedIdx >= 0;
  const feed = useMemo(
    () => (usingFallback ? { ...raw, items: [...raw.items].sort(byNewest) } : raw),
    [raw, usingFallback],
  );
  const shuffle = () => setSeedIdx((i) => {
    let n; do { n = Math.floor(Math.random() * FALLBACK_SEEDS.length); } while (n === i && FALLBACK_SEEDS.length > 1);
    return n;
  });
  const accent = MODE_COLORS.yellow;

  return (
    <section aria-label="Trending posts" data-landing-feed="" className="mt-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 data-landing-feed-title="" className="flex items-center gap-2 text-sm font-semibold" style={{ color: accent }}>
          <Rss size={16} /> {headingFor(tab, server)}
        </h2>
        <Link to="/feed" className="text-xs text-white/50 hover:text-white flex items-center gap-1">
          Open full feed <ArrowUpRight size={12} />
        </Link>
      </div>
      <div role="tablist" aria-label="Feed category" className="flex gap-1 mb-2 px-1 overflow-x-auto">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-landing-feed-tab={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${active ? 'text-black' : 'text-white/60 hover:text-white border-white/10'}`}
              style={active ? { background: accent, borderColor: accent } : undefined}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tab === 'top' && (
        <div aria-label="Server" className="flex gap-1 mb-2 px-1 overflow-x-auto items-center">
          {['all', ...topNetworks].map((id) => {
            const active = id === server;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                data-landing-feed-server={id}
                onClick={() => setServer(id)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] whitespace-nowrap border transition-colors ${active ? 'text-white border-white/50 bg-white/10' : 'text-white/50 hover:text-white border-white/10'}`}
              >
                {id === 'all' ? 'All' : NETWORK_LABELS[id]}
              </button>
            );
          })}
          <button
            type="button"
            data-landing-feed-shuffle=""
            onClick={shuffle}
            title="Pull a fresh set of top posts, newest first"
            className="ml-auto px-2.5 py-0.5 rounded-full text-[11px] whitespace-nowrap border border-white/10 text-white/60 hover:text-white flex items-center gap-1"
          >
            <Shuffle size={11} /> Shuffle
          </button>
        </div>
      )}
      {usingFallback && (
        <p data-landing-feed-fallback="" className="text-[11px] text-white/40 mb-1 px-1">
          Showing top “{query}” posts, newest first.
        </p>
      )}
      <div
        role="tabpanel"
        key={`${tab}:${server}`}
        data-landing-feed-frame=""
        className="h-[70vh] max-h-[640px] overflow-y-auto overscroll-contain rounded-2xl border bg-black/30 backdrop-blur-sm p-3"
        style={{ borderColor: `${accent}40` }}
      >
        <FeedList feed={feed} />
      </div>
    </section>
  );
}
