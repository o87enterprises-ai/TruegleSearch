import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Play, RefreshCw, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import { CREATORS } from '../../content/creators';
import { fallbackVideos } from '../../content/creatorVideosFallback';
import { getPlayable } from '../../utils/videoEmbed';
import { usePlayer } from '../../context/PlayerContext';

// What the player shows when nothing is playing.
//
// "Search or paste a link to start watching" over an empty black rectangle
// reads as broken — a player that has never worked. The roster of Truegle
// creators is right there and every one of them has a latest upload, so the
// idle state is four of them instead: real videos, one per creator, ready to
// play. It also puts the creators in front of people, which is the point of
// having a roster.
//
// Picking one doesn't just play it — it queues the REST of that creator's
// uploads behind it, so Next (and auto-advance) walks that channel rather than
// wandering off into general search. Playing anything else takes over from
// there, which is what choosing something else means.
const PER_PAGE = 4;

// One fetch per channel per session. The idle state can be entered many times
// (stop, close, come back) and none of those should re-ask.
const cache = new Map();

async function latestFor(creator) {
  if (cache.has(creator.channelId)) return cache.get(creator.channelId);
  let videos = [];
  try {
    const r = await api.get(`/creators/${creator.channelId}/videos`);
    videos = r.data?.videos || [];
  } catch {
    videos = [];
  }
  if (!videos.length) videos = fallbackVideos(creator.channelId);
  cache.set(creator.channelId, videos);
  return videos;
}

const toSource = (video, creator) => {
  const base = getPlayable(video.url);
  return base ? {
    ...base,
    title: video.title || creator.name,
    pageUrl: video.url,
    poster: video.thumbnail,
    channel: creator.name,
  } : null;
};

export default function PlayerStarters({ compact = false }) {
  const { play, enqueueMany, clearQueue } = usePlayer();
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(null);

  const start = (page * PER_PAGE) % CREATORS.length;
  const slice = Array.from({ length: Math.min(PER_PAGE, CREATORS.length) },
    (_, i) => CREATORS[(start + i) % CREATORS.length]);
  const key = slice.map((c) => c.channelId).join(',');

  useEffect(() => {
    let live = true;
    setRows(null);
    Promise.all(slice.map(async (creator) => {
      const videos = await latestFor(creator);
      const playable = videos.map((v) => toSource(v, creator)).filter(Boolean);
      return playable.length ? { creator, latest: playable[0], rest: playable.slice(1) } : null;
    })).then((list) => { if (live) setRows(list.filter(Boolean)); });
    return () => { live = false; };
    // `key` is the identity of this page of creators; slice is derived from it.
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Play the latest, and line the channel up behind it.
  const startChannel = useCallback((row) => {
    clearQueue();
    play(row.latest, 'tube');
    if (row.rest.length) enqueueMany(row.rest, 'tube');
  }, [play, enqueueMany, clearQueue]);

  const cardH = compact ? 'h-16' : 'h-20';

  return (
    <div className="w-full bg-black/60 p-2">
      <div className="flex items-center gap-1.5 px-1 pb-1.5">
        <span className="text-[10px] uppercase tracking-wider text-white/40">
          Truegle creators — tap art to play, name to visit
        </span>
        <button
          type="button"
          onClick={() => setPage((n) => n + 1)}
          title="Show four more creators"
          aria-label="Show four more creators"
          className="ml-auto flex items-center gap-1 px-2 h-6 rounded-md text-[10px] uppercase tracking-wider text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <RefreshCw size={11} /> More
        </button>
      </div>

      {rows === null ? (
        <div className="grid grid-cols-2 gap-2" aria-live="polite">
          <span className="sr-only">Loading creators…</span>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${cardH} rounded-lg bg-white/[0.06] animate-pulse`} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="px-1 py-3 text-[11px] text-white/40">
          Search or paste a link to start watching.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {rows.map((row) => (
            <div
              key={row.creator.slug}
              className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] text-left hover:border-white/30 transition-colors"
            >
            <button
              type="button"
              onClick={() => startChannel(row)}
              title={`Play ${row.creator.name} — the rest of their uploads queue up behind it`}
              aria-label={`Play ${row.latest.title} from ${row.creator.name}`}
              className="block w-full text-left"
            >
              <div className={`relative w-full ${cardH} bg-black/40`}>
                {row.latest.poster && (
                  <img
                    src={row.latest.poster}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="w-7 h-7 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
                    <Play size={13} className="text-white ml-0.5" fill="currentColor" />
                  </span>
                </span>
              </div>
              <div className="px-1.5 py-1">
                <span className="block text-[10px] text-white/40 truncate">
                  {row.latest.title}
                </span>
              </div>
            </button>

            {/* The way IN to the creator's own page. It was missing entirely:
                creator pages existed but nothing on Tube linked to one, so the
                only route was typing the URL. A nested <a> inside the play
                button would be invalid, so the name sits beside it as its own
                target — press the art to play, press the name to visit. */}
            <Link
              to={`/creator/${row.creator.slug}`}
              title={`${row.creator.name} — open their page`}
              className="flex items-center gap-0.5 px-1.5 pb-1 -mt-0.5 text-[10px] font-semibold text-white/85 hover:text-white transition-colors"
            >
              <span className="truncate">{row.creator.name}</span>
              <ChevronRight size={11} className="shrink-0 text-white/35" />
            </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
