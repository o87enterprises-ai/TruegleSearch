import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { useSocialFeed } from '../hooks/useSocialFeed';

// Landing "Featured Feeds" — was "Featured Creator" (one creator, one video,
// picked by weekly traffic). Now the live Creators category itself: a
// horizontally scrollable row of cards, same source Feed's own Browse shows
// under "Creators". Tapping one is an instant nav straight into the full
// Feed page with the Creators category already open and that card already
// playing — no separate landing-page player, no second copy of playback
// state to keep in sync with Feed's own.
//
// "auto advance to next playable feed" is Feed's own queue-follow behaviour
// (useFeedCursor) — starting on a specific card there is what arms it, so
// nothing extra is needed here beyond landing on the right card.
export default function FeaturedFeeds() {
  const navigate = useNavigate();
  // Same platform the Creators Browse category maps to (config/feedCategories
  // .CATEGORIES 'creators' → ['creators']) — passed directly rather than
  // through platformsForCategory, which exists to respect a Servers on/off
  // list the landing page has no control for.
  const feed = useSocialFeed({ platforms: ['creators'], interleave: true, rememberSeen: false });
  const posts = feed.items.slice(0, 12);

  if (!feed.loading && !posts.length) return null;

  const open = (post) => {
    // The clicked post's own link carries it through — FeedPage matches it
    // against whatever the Creators category loads there and starts playing
    // it, rather than the landing page trying to hand over live playback
    // state across a full navigation.
    const play = post.permalink || post.url;
    navigate(`/feed?category=creators${play ? `&play=${encodeURIComponent(play)}` : ''}`);
  };

  return (
    <div className="py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <div className="text-xs uppercase tracking-[0.2em] text-orange-400/80 mb-2">Featured Feeds</div>
          <h2 className="text-headline-large">
            <span className="gradient-orange-purple">Watch on Truegle</span>
          </h2>
          <p className="text-white/60 text-sm mt-2 max-w-xl mx-auto">
            Independent voices, streamed right here — creators keep every view. Tap one to open the full feed and keep watching.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {feed.loading && !posts.length && (
            <div className="w-full text-center py-10 text-white/40 text-sm">Loading creators…</div>
          )}
          {posts.map((post) => (
            <button
              key={post._key}
              type="button"
              onClick={() => open(post)}
              className="group snap-start shrink-0 w-[240px] sm:w-[280px] text-left rounded-2xl overflow-hidden border border-white/15 bg-gradient-to-br from-orange-500/10 via-purple-500/10 to-cyan-500/10 backdrop-blur-lg shadow-xl hover:border-orange-400/40 transition-colors"
            >
              <div className="relative aspect-video overflow-hidden bg-white/5">
                {post.thumbnail ? (
                  <img
                    src={post.thumbnail}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-orange-500/30 via-purple-600/30 to-cyan-500/30" />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform">
                    <Play size={18} className="text-white fill-white ml-0.5" />
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-[11px] font-bold shrink-0">
                    {(post.author || 'T').charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-white/80 truncate">{post.author || 'Truegle Creator'}</span>
                </div>
                <p className="text-sm text-white/90 leading-snug line-clamp-2">{post.title}</p>
              </div>
            </button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
