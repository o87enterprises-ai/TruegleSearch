import { useEffect, useMemo, useState } from 'react';
import { useSocialFeed } from './useSocialFeed';
import { BROWSE_ONLY } from '../config/socialProviders';
import { categoryById } from '../config/feedCategories';

// THE LANDING FEED'S PILL FLOW, AS ONE HOOK (owner, 2026-11-08: "same pill
// filtering method as on landing … same sorting flow"). Extracted from
// LandingFeedFrame so the landing frame and /feed Home run the SAME code and
// cannot drift: tabs → server pills → blank-never-means-broken fallback →
// newest-first sort when the fallback is in use.
//
// TOP is the social networks ONLY — no headlines, repos or link pools — so the
// round-robin's first N cards are each network's #1 hot/top post. The other
// three reuse the Browse categories' sources.
export const TOP_NETWORKS = ['instagram', 'facebook', 'tiktok', 'x', 'reddit', 'bluesky',
  'mastodon', 'lemmy', 'truthsocial', 'rumble', 'pinterest'];
export const NETWORK_LABELS = {
  instagram: 'Instagram', facebook: 'FB', tiktok: 'TikTok', x: 'X', reddit: 'Reddit',
  bluesky: 'Bluesky', mastodon: 'Mastodon', lemmy: 'Lemmy', truthsocial: 'Truth',
  rumble: 'Rumble', pinterest: 'Pinterest',
};
// A blank query on the big networks often comes back empty, which reads as
// "this doesn't work". When the unseeded pull finishes empty, re-ask with a
// top-posts word and sort what comes back newest first. Shuffle picks another.
export const FALLBACK_SEEDS = ['viral', 'trending', 'breaking', 'funny', 'video', 'news', 'music', 'sports'];
const byNewest = (a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0);

export const TABS = [
  { id: 'top', label: 'Top', platforms: TOP_NETWORKS },
  { id: 'creators', label: 'Creators', platforms: categoryById('creators').platforms },
  { id: 'news', label: 'News', platforms: categoryById('news').platforms },
  { id: 'markets', label: 'Markets', platforms: categoryById('markets').platforms },
];
export const TOP_SERVER_IDS = TOP_NETWORKS.filter((p) => NETWORK_LABELS[p]);

/**
 * @param {{ available: string[], enabled?: boolean }} opts
 *   available — backend platform ids this visitor may use (landing: every
 *   connectable source; /feed: what Servers has switched on).
 *   rememberSeen — the never-repeat ledger. OFF on landing (it shows what is on
 *   top right now); ON on /feed, which has always never-repeated.
 */
export function useFeedTabs({ available, enabled = true, rememberSeen = false }) {
  const [tab, setTab] = useState('top');
  const [server, setServer] = useState('all');
  const [creator, setCreator] = useState('');
  const [kind, setKind] = useState('all'); // Creators tab: all | video | short
  // -1 = the plain blank-query pull; 0+ = index into FALLBACK_SEEDS.
  const [seedIdx, setSeedIdx] = useState(-1);

  const availKey = [...available].sort().join(',');
  const platforms = useMemo(() => {
    const ok = new Set(available);
    const wanted = TABS.find((t) => t.id === tab).platforms;
    // BROWSE_ONLY shelves are allowed only when their tab asks for them.
    const list = wanted.filter((p) => ok.has(p) && (tab !== 'top' || !BROWSE_ONLY.has(p)));
    return tab === 'top' && server !== 'all' ? list.filter((p) => p === server) : list;
  }, [tab, server, availKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = seedIdx >= 0 ? FALLBACK_SEEDS[seedIdx % FALLBACK_SEEDS.length] : '';
  const raw = useSocialFeed({
    query, platforms, creator: tab === 'creators' ? creator : '', kind: tab === 'creators' ? kind : 'all',
    enabled: enabled && platforms.length > 0, interleave: true, rememberSeen,
  });

  // New tab, server or creator → start over from the plain blank pull.
  useEffect(() => { setSeedIdx(-1); }, [tab, server, creator, kind]);
  useEffect(() => { if (tab !== 'creators') { setCreator(''); setKind('all'); } }, [tab]);

  // The blank pull finished with nothing → auto-pull top posts instead. Walks
  // the seed list once, so a truly dead source ends rather than looping.
  const empty = enabled && !raw.loading && !raw.items.length && (raw.done || raw.error);
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

  return { tab, setTab, server, setServer, creator, setCreator, kind, setKind, platforms, query, usingFallback, shuffle, feed };
}
