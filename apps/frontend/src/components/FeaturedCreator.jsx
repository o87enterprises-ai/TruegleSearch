import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';
import { CREATORS, getFeaturedCreator } from '../content/creators';
import { fallbackVideos } from '../content/creatorVideosFallback';

/*
 * Landing "Featured Creator" slot. Surfaces the current featured creator (see
 * content/creators.js) with their latest upload thumbnail pulled live from the
 * free YouTube RSS proxy. Vibrant/animated to match the brand — links to the
 * creator's on-site page. Weekly rotation-by-traffic comes with ?ref tracking.
 */
export default function FeaturedCreator() {
  // Default to the static featured pick; override with the 7-day traffic leader
  // once the rotation endpoint answers (falls back silently if it can't).
  const [creator, setCreator] = useState(getFeaturedCreator());
  const [video, setVideo] = useState(null);

  useEffect(() => {
    let live = true;
    api.get('/creators/featured')
      .then((r) => {
        const code = r.data?.refCode;
        const winner = code && CREATORS.find((c) => c.refCode === code);
        if (live && winner) setCreator(winner);
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!creator) return;
    let live = true;
    api.get(`/creators/${creator.channelId}/videos`)
      .then((r) => {
        if (!live) return;
        const v = (r.data?.videos || [])[0] || fallbackVideos(creator.channelId)[0] || null;
        setVideo(v);
      })
      .catch(() => { if (live) setVideo(fallbackVideos(creator.channelId)[0] || null); });
    return () => { live = false; };
  }, [creator]);

  if (!creator) return null;

  return (
    <div className="py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <div className="text-xs uppercase tracking-[0.2em] text-orange-400/80 mb-2">Featured Creator</div>
          <h2 className="text-headline-large">
            <span className="gradient-orange-purple">Watch on Truegle</span>
          </h2>
          <p className="text-white/60 text-sm mt-2 max-w-xl mx-auto">
            Independent voices, streamed right here — creators keep every view. A fresh pick each week.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <Link
            to={`/creator/${creator.slug}`}
            className="group block rounded-3xl overflow-hidden border border-white/15 bg-gradient-to-br from-orange-500/10 via-purple-500/10 to-cyan-500/10 backdrop-blur-lg shadow-2xl hover:border-orange-400/40 transition-colors"
          >
            <div className="grid md:grid-cols-2">
              <div className="relative aspect-video overflow-hidden">
                {video?.thumbnail ? (
                  <img
                    src={video.thumbnail}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full min-h-[200px] bg-gradient-to-br from-orange-500/30 via-purple-600/30 to-cyan-500/30" />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center font-bold shrink-0">
                    {creator.name.charAt(0)}
                  </div>
                  <div className="font-bold text-lg">{creator.name}</div>
                </div>
                {video?.title && <div className="text-white/80 text-sm mb-5 line-clamp-2">{video.title}</div>}
                <span className="inline-flex items-center gap-2 self-start px-5 py-2.5 rounded-full bg-gradient-to-r from-orange-500 to-purple-600 text-white text-sm font-semibold group-hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/20">
                  Watch on Truegle →
                </span>
              </div>
            </div>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
