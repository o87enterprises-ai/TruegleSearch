import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { getCreator } from '../content/creators';
import { fallbackVideos } from '../content/creatorVideosFallback';
import { getVideoEmbed, getPlayable } from '../utils/videoEmbed';
import { recordRef } from '../utils/creatorRef';
import AdsterraBanner from '../components/ads/AdsterraBanner';
import QueueButton from '../components/ui/QueueButton';
import { usePlayer } from '../context/PlayerContext';

/*
 * Creator hub page — /creator/:slug.
 * Pulls the creator's latest uploads (free YouTube RSS via the backend proxy)
 * and plays them inline with the existing official embed. Payer ad slots wrap
 * the content; the creator keeps their own YouTube views/revenue.
 */
export default function CreatorPage() {
  const { slug } = useParams();
  const creator = getCreator(slug);
  const { play, setPoppedOut, current: playing } = usePlayer();

  const [videos, setVideos] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!creator) return;
    recordRef(creator.refCode); // visiting a creator's page attributes traffic to them
    let live = true;
    setLoading(true);
    setErr(false);
    api.get(`/creators/${creator.channelId}/videos`)
      .then((r) => {
        if (!live) return;
        const v = (r.data?.videos || []);
        const list = v.length ? v : fallbackVideos(creator.channelId); // snapshot when live is empty
        setVideos(list);
        setActive(list[0] || null);
        if (!list.length) setErr(true);
      })
      .catch(() => {
        if (!live) return;
        const fb = fallbackVideos(creator.channelId);
        setVideos(fb);
        setActive(fb[0] || null);
        if (!fb.length) setErr(true);
      })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [creator]);

  // A creator page is a place you come to WATCH, so the active video goes
  // straight into the Truegle player, popped out — the same player that keeps
  // going while you browse on. Two players on one page would mean two audio
  // streams, so the page's own embed steps aside below when this takes over.
  const handedOff = useRef(null);
  useEffect(() => {
    if (!active?.url) return;
    const source = getPlayable(active.url);
    if (!source || handedOff.current === active.url) return;
    handedOff.current = active.url;
    play({ ...source, title: active.title || creator?.name, pageUrl: active.url, poster: active.thumbnail });
    setPoppedOut(true);
  }, [active, creator, play, setPoppedOut]);

  if (!creator) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
        <p className="text-white/70 mb-4">Creator not found.</p>
        <Link to="/" className="text-sm text-orange-400 hover:text-orange-300">← Back to Truegle</Link>
      </div>
    );
  }

  const embed = active ? getVideoEmbed(active.url) : null;
  // Is the popped-out player already showing this very video? Then the page
  // must not mount a second copy of it.
  const activePlayable = active ? getPlayable(active.url) : null;
  const inPlayer = !!(activePlayable && playing && playing.src === activePlayable.src);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <Link to="/" className="text-sm text-white/50 hover:text-white/80">← Truegle</Link>

        <header className="mt-6 flex items-center gap-4">
          {creator.avatar ? (
            <img src={creator.avatar} alt={creator.name} className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-2xl font-bold">
              {creator.name.charAt(0)}
            </div>
          )}
          <div>
            <div className="text-xs uppercase tracking-widest text-orange-400/80">Featured Creator</div>
            <h1 className="text-2xl md:text-3xl font-bold">{creator.name}</h1>
            {creator.tagline && <p className="text-white/60 text-sm mt-1">{creator.tagline}</p>}
          </div>
        </header>

        {creator.socials?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {creator.socials.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white text-sm transition-colors"
              >
                {s.label} ↗
              </a>
            ))}
          </div>
        )}

        <div className="mt-8">
          {inPlayer ? (
            <div className="w-full rounded-2xl border border-white/10 bg-white/5 flex flex-col items-center justify-center gap-1 text-center px-4"
              style={{ aspectRatio: '16 / 9' }}>
              <span className="text-white/70 text-sm font-semibold">Playing in the Truegle player</span>
              <span className="text-white/40 text-xs">
                It keeps going while you browse — move or close it from the player itself.
              </span>
            </div>
          ) : embed ? (
            <div className="relative w-full rounded-2xl overflow-hidden border border-white/10" style={{ aspectRatio: '16 / 9' }}>
              <iframe
                src={embed}
                title={active.title}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            </div>
          ) : (
            <div className="w-full rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center" style={{ aspectRatio: '16 / 9' }}>
              <span className="text-white/40 text-sm">
                {loading ? 'Loading latest videos…' : err ? 'Videos are unavailable right now.' : 'No videos yet.'}
              </span>
            </div>
          )}
          {active && (
            <div className="mt-3 flex items-start justify-between gap-3">
              {active.title && <h2 className="font-semibold flex-1">{active.title}</h2>}
              {(getPlayable(active.url)) && (
                <QueueButton
                  source={{ ...getPlayable(active.url), title: active.title || creator.name, pageUrl: active.url, poster: active.thumbnail }}
                  className="shrink-0 bg-white/5 border border-white/10 text-white/70 hover:text-white px-3 py-1.5"
                  showLabel
                />
              )}
            </div>
          )}
        </div>

        <div className="my-6">
          <div className="text-[9px] uppercase tracking-widest text-orange-400/70 mb-1">Sponsored</div>
          <AdsterraBanner format="nativeBanner" className="rounded-xl overflow-hidden" />
        </div>

        {videos.length > 0 && (
          <>
            <h3 className="text-lg font-semibold mb-3">Recent uploads</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {videos.map((v) => (
                <button
                  key={v.videoId}
                  onClick={() => { setActive(v); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={`text-left rounded-xl overflow-hidden border transition-colors ${
                    active?.videoId === v.videoId ? 'border-orange-500/60' : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  {v.thumbnail && <img src={v.thumbnail} alt="" className="w-full aspect-video object-cover" loading="lazy" />}
                  <div className="p-2 text-xs text-white/70 line-clamp-2">{v.title}</div>
                </button>
              ))}
            </div>
          </>
        )}

        <p className="mt-10 text-[11px] text-white/30">
          Videos are streamed via YouTube's official player — views and ad revenue stay with the creator.
          Want your channel featured?{' '}
          <Link to="/advertise" className="underline hover:text-white/60">Get in touch</Link>.
        </p>
      </div>
    </div>
  );
}
