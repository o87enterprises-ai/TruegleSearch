import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Rss, ArrowUpRight } from 'lucide-react';
import { FeedList } from '../../pages/FeedPage';
import { useSocialFeed } from '../../hooks/useSocialFeed';
import { PROVIDERS, platformsFor, isConnectable, BROWSE_ONLY } from '../../config/socialProviders';
import { MODE_COLORS } from '../../config/modeTheme';

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
  const platforms = useMemo(
    () => platformsFor(PROVIDERS.filter((p) => isConnectable(p.id)).map((p) => p.id))
      .filter((p) => !BROWSE_ONLY.has(p)),
    [],
  );
  const feed = useSocialFeed({ platforms, enabled: platforms.length > 0, interleave: true, rememberSeen: false });
  const accent = MODE_COLORS.yellow;

  return (
    <section aria-label="Top posts" data-landing-feed="" className="mt-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: accent }}>
          <Rss size={16} /> Top posts right now
        </h2>
        <Link to="/feed" className="text-xs text-white/50 hover:text-white flex items-center gap-1">
          Open full feed <ArrowUpRight size={12} />
        </Link>
      </div>
      <div
        data-landing-feed-frame=""
        className="h-[70vh] max-h-[640px] overflow-y-auto overscroll-contain rounded-2xl border bg-black/30 backdrop-blur-sm p-3"
        style={{ borderColor: `${accent}40` }}
      >
        <FeedList feed={feed} />
      </div>
    </section>
  );
}
