import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Users, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import { CREATORS } from '../../content/creators';
import { MODE_COLORS } from '../../config/modeTheme';

// The creator's identity, on a page that is otherwise True Tube.
//
// A creator page IS the Tube page — same logo, same pill row, same bar, same
// player, same results underneath — with this block between the logo and the
// bar saying whose page it is. That is deliberate: the old creator page was a
// seventh copy of the layout and had already drifted away from everything else.
//
// Two parts:
//   1. The identity line — circled initial, "FEATURED CREATOR", the name, and
//      a TrueTube chip back to /tube. It used to say "YouTube ↗" and send
//      people off the site from the one page built to keep them on it.
//   2. The creator card — avatar, channel bio, subscriber count and the latest
//      upload with its thumbnail. Fetched from /creators/:id/about, which is
//      one quota unit and cached for six hours server-side.
const fmtSubs = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}K`;
  return String(v);
};

// One fetch per channel per session — the card is decoration and re-asking on
// every mount is pure waste.
const aboutCache = new Map();

export default function CreatorHeader({ creator, recentVideos = [], onPlayVideo }) {
  const [about, setAbout] = useState(() => aboutCache.get(creator.channelId) || null);

  useEffect(() => {
    if (aboutCache.has(creator.channelId)) { setAbout(aboutCache.get(creator.channelId)); return undefined; }
    let live = true;
    api.get(`/creators/${creator.channelId}/about`)
      .then((r) => {
        if (!live || !r.data?.channelId) return;
        aboutCache.set(creator.channelId, r.data);
        setAbout(r.data);
      })
      .catch(() => { /* the card falls back to the roster entry */ });
    return () => { live = false; };
  }, [creator.channelId]);

  const name = about?.name || creator.name;
  const avatar = about?.avatar || creator.avatar;
  const bio = about?.bio || creator.tagline || '';
  const subs = fmtSubs(about?.subscribers);
  const accent = MODE_COLORS.tube;

  return (
    <div className="max-w-4xl mx-auto mb-4">
      {/* ── identity line, directly under the TrueTube mark ── */}
      <div className="flex items-center gap-3">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="w-12 h-12 rounded-full object-cover shrink-0 border border-white/15"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <span className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-xl font-bold text-black"
            style={{ background: accent }}>
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <span className="block text-[10px] uppercase tracking-[0.2em] text-white/40">Featured Creator</span>
          <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{name}</h1>
        </div>
        {/* Was "YouTube ↗", which sent people off the site from the one page
            built to keep them on it. The video still plays from YouTube's own
            embed — the creator keeps the view either way. */}
        <Link
          to="/tube"
          className="shrink-0 flex items-center gap-1 px-3 h-8 rounded-full border text-[11px] font-semibold transition-colors"
          style={{ borderColor: `${accent}59`, color: accent }}
        >
          TrueTube <ChevronRight size={13} />
        </Link>
      </div>

      {/* ── creator card ── */}
      <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden">
        <div className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white/90 truncate">{name}</span>
            {about?.handle && <span className="text-[11px] text-white/35">{about.handle}</span>}
            {subs && (
              <span className="flex items-center gap-1 text-[11px] text-white/35">
                <Users size={11} /> {subs}
              </span>
            )}
          </div>
          {bio ? (
            <p className="mt-1 text-[12px] text-white/50 leading-snug line-clamp-3">{bio}</p>
          ) : (
            <p className="mt-1 text-[12px] text-white/25 leading-snug">
              {about ? 'This channel has no description yet.' : 'Loading the channel…'}
            </p>
          )}

          {/* Recent uploads, newest first — up to 4, right here in the
              viewport instead of buried in the results below. The point is
              choice: someone who's already seen the latest can jump straight
              to the next one back rather than re-watching or hunting for it.
              Eager-loaded (not lazy) since this is always above the fold the
              moment a creator is selected. */}
          {recentVideos.length > 0 && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {recentVideos.map((v, i) => (
                <button
                  key={v.url || v.thumbnail || i}
                  type="button"
                  onClick={() => onPlayVideo?.(v)}
                  title={v.title || ''}
                  aria-label={i === 0 ? `Play the latest upload, ${v.title || name}` : `Play ${v.title || 'this upload'}`}
                  className="group relative rounded-lg overflow-hidden border border-white/10 hover:border-white/30 transition-colors"
                >
                  {v.thumbnail ? (
                    <img src={v.thumbnail} alt="" loading="eager"
                      className="w-full aspect-video object-cover opacity-85 group-hover:opacity-100 transition-opacity"
                      onError={(e) => { e.target.style.visibility = 'hidden'; }} />
                  ) : (
                    <span className="block w-full aspect-video bg-white/[0.06]" />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-7 h-7 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
                      <Play size={13} className="text-white ml-0.5" fill="currentColor" />
                    </span>
                  </span>
                  {i === 0 && (
                    <span className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-gradient-to-t from-black/90 to-transparent">
                      <span className="block text-[9px] uppercase tracking-wider text-white/60">Latest</span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The Creator pill — clear/translucent, so it reads as a label for whose page
 * this is rather than another mode competing with Tube.
 *
 * It is NOT in the global pill cycle: every other search page would then be
 * able to cycle into "creator" with no creator selected, which has nowhere to
 * go. Here it cycles through the roster instead, which is the useful thing a
 * pill on a creator page can do.
 */
export function CreatorPill({ creator }) {
  const i = CREATORS.findIndex((c) => c.slug === creator.slug);
  const next = CREATORS[(i + 1) % CREATORS.length] || creator;
  return (
    <div className="flex justify-center">
      <Link
        to={`/creator/${next.slug}`}
        title={`Creator page — tap for ${next.name}`}
        aria-label={`Creator: ${creator.name}. Tap for ${next.name}`}
        className="flex items-center gap-2 px-4 h-9 rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-md text-white/70 hover:text-white hover:bg-white/[0.1] transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-white/50" />
        <span className="text-sm font-semibold">Creator</span>
        <span className="text-xs text-white/40 max-w-[9rem] truncate">{creator.name}</span>
      </Link>
    </div>
  );
}
