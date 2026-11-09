import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Rss, ArrowUpRight } from 'lucide-react';
import { FeedList } from '../../pages/FeedPage';
import { PROVIDERS, platformsFor, isConnectable } from '../../config/socialProviders';
import { MODE_COLORS } from '../../config/modeTheme';
import { useFeedTabs, TABS, NETWORK_LABELS } from '../../hooks/useFeedTabs';
import FeedPills from '../feed/FeedPills';
import TruegleLogo from '../ui/TruegleLogo';
import LangModeToggle from '../ui/LangModeToggle';

// The pill flow (tabs, server pills, fallback, sort) lives in hooks/useFeedTabs
// so /feed Home runs the same code. See there for the owner's notes.

// The heading's platform name when ONE server pill is picked (owner,
// 2026-11-07): "Trending Posts on Facebook", not "…on FB".
// WHILE THE TOP POSTS LOAD (owner, 2026-11-09): the pull fans out across the big
// networks and can take ten-plus seconds, which reads as "broken" and sends
// people away. So the wait says what it is doing, under the logo. Top tab only
// — the other tabs answer fast. The logo's click would navigate home; here it
// is just a picture.
const TopLoadingNote = () => (
  <div data-feed-loading-note="" role="status" className="flex flex-col items-center gap-3 py-8 text-center">
    <TruegleLogo size="medium" animated onClick={() => {}} />
    <p className="text-sm text-white/70 max-w-xs leading-snug">
      Surfing top posts may take +10 seconds to load... Thank you for your patience.
    </p>
  </div>
);

const HEADING_NAMES = { facebook: 'Facebook', truthsocial: 'Truth Social' };
const headingFor = (tab, server) => {
  if (tab !== 'top') return TABS.find((t) => t.id === tab).label;
  if (server === 'all') return 'Trending posts across all platforms';
  return `Trending Posts on ${HEADING_NAMES[server] || NETWORK_LABELS[server] || server}`;
};

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
//
// `embedded`: rendered inside the landing's Feed CARD (LandingModules), which
// owns the width and spacing — and only mounts this while the card is open, so
// nothing is fetched while it is retracted.
export default function LandingFeedFrame({ embedded = false }) {
  const available = useMemo(() => platformsFor(PROVIDERS.filter((p) => isConnectable(p.id)).map((p) => p.id)), []);
  const t = useFeedTabs({ available });
  const { tab, server, feed } = t;
  const accent = MODE_COLORS.yellow;

  return (
    <section aria-label="Trending posts" data-landing-feed="" className={embedded ? '' : 'mt-8 max-w-4xl mx-auto'}>
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 data-landing-feed-title="" className="flex items-center gap-2 text-sm font-semibold" style={{ color: accent }}>
          <Rss size={16} /> {headingFor(tab, server)}
        </h2>
        <Link to="/feed" className="text-xs text-white/50 hover:text-white flex items-center gap-1">
          Open full feed <ArrowUpRight size={12} />
        </Link>
      </div>
      <FeedPills t={t} />
      {/* Local (this device's language) / Global. */}
      <LangModeToggle className="mb-2 px-1" />
      {/* SCROLL CHAINING (owner, 2026-11-09): inside the frame the wheel / finger
          scrolls the frame; once it reaches its top or bottom the PAGE carries on.
          `overscroll-y-auto` is the browser default made explicit — this was
          `overscroll-contain`, which trapped the scroll in the frame at its ends. */}
      <div
        role="tabpanel"
        key={`${tab}:${server}`}
        data-landing-feed-frame=""
        className="h-[70vh] max-h-[640px] overflow-y-auto overscroll-y-auto rounded-2xl border bg-black/30 backdrop-blur-sm p-3"
        style={{ borderColor: `${accent}40` }}
      >
        <FeedList feed={feed} loadingNote={tab === 'top' ? <TopLoadingNote /> : null} />
      </div>
    </section>
  );
}
