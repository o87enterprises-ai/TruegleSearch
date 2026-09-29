import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import { useSocialFeed } from '../../hooks/useSocialFeed';
import { CARD_ACCENT } from './cardTheme';

// Landing "Feed" — the live Creators category itself, as the body of the Feed
// tile (one open at a time, opened by a hand). The row inside is the same
// source Feed's own Browse shows under "Creators". Tapping a card is an
// instant nav straight into the full Feed
// page with the Creators category already open and that card already playing —
// no separate landing-page player, no second copy of playback state to keep in
// sync with Feed's own.
//
// "auto advance to next playable feed" is Feed's own queue-follow behaviour
// (useFeedCursor) — starting on a specific card there is what arms it, so
// nothing extra is needed here beyond landing on the right card.
//
// THE FETCH LIVES IN THE BODY. LandingModules only mounts the open tile's body,
// so nothing is requested while the tile is closed. The old version fetched
// on page load and hid itself if the list came back empty; a closed card can't
// know that, so an empty list now says so when opened.
function CreatorsRow() {
  const navigate = useNavigate();
  // Same platform the Creators Browse category maps to (config/feedCategories
  // .CATEGORIES 'creators' → ['creators']) — passed directly rather than
  // through platformsForCategory, which exists to respect a Servers on/off
  // list the landing page has no control for.
  const feed = useSocialFeed({ platforms: ['creators'], interleave: true, rememberSeen: false });
  const posts = feed.items.slice(0, 12);

  const open = (post) => {
    // The clicked post's own link carries it through — FeedPage matches it
    // against whatever the Creators category loads there and starts playing
    // it, rather than the landing page trying to hand over live playback
    // state across a full navigation.
    const play = post.permalink || post.url;
    navigate(`/feed?category=creators${play ? `&play=${encodeURIComponent(play)}` : ''}`);
  };

  return (
    <div data-featured-feeds-body="">
      {feed.loading && !posts.length && <p className="text-white/40 text-xs py-4">Loading creators…</p>}
      {!feed.loading && !posts.length && <p className="text-white/40 text-xs py-4">No creators to show right now.</p>}
      <div
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory overscroll-x-contain pb-1 -mx-1 px-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {posts.map((post) => (
          <button
            key={post._key}
            type="button"
            onClick={() => open(post)}
            className="group snap-start shrink-0 w-[200px] text-left rounded-xl overflow-hidden border border-white/15 bg-gradient-to-br from-orange-500/10 via-purple-500/10 to-cyan-500/10 hover:border-orange-400/40 transition-colors"
          >
            <div className="relative aspect-video overflow-hidden bg-white/5">
              {post.thumbnail ? (
                <img src={post.thumbnail} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-orange-500/30 via-purple-600/30 to-cyan-500/30" />
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-9 h-9 rounded-full bg-black/50 backdrop-blur flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform">
                  <Play size={14} className="text-white fill-white ml-0.5" />
                </div>
              </div>
            </div>
            <div className="p-2.5">
              <span className="block text-[11px] font-semibold text-white/80 truncate">{post.author || 'Truegle Creator'}</span>
              <p className="text-[12px] text-white/90 leading-snug line-clamp-2 mt-0.5">{post.title}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Feed, past its tile's pitch: the partner creators' latest, and the way in.
export default function FeedBody() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-3" data-feed-body="">
      <CreatorsRow />
      <button
        type="button"
        onClick={() => navigate('/feed')}
        className="self-start text-xs font-semibold"
        style={{ color: CARD_ACCENT.feed }}
      >
        Open Feed →
      </button>
    </div>
  );
}
