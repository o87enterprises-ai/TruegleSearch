import { PlayCircle } from 'lucide-react';
import { getPlayable } from '../../utils/videoEmbed';

// Videos, in their own row — the way Google shows them on "All".
//
// The All tab used to merge every video into the web list: a search for
// "eugene oregon patent lawyers" came back as 20 web pages and 113 videos,
// most of them PeerTube uploads about people called Eugène. Videos are not
// hidden (the Videos tab still has all of them); on All they get one compact,
// sideways-scrolling row so the web results lead.
export default function VideoRow({ videos, onPlay, accent }) {
  if (!videos?.length) return null;
  return (
    <section aria-label="Videos" className="my-5">
      <h3 className="text-sm font-semibold text-white/80 mb-2">Videos</h3>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:thin]">
        {videos.map((v) => {
          const playable = getPlayable(v.url);
          const host = (() => { try { return new URL(v.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
          const open = () => {
            if (playable && onPlay) onPlay({ ...playable, title: v.title || v.url, pageUrl: v.url, poster: v.image });
            else window.open(v.url, '_blank', 'noopener,noreferrer');
          };
          return (
            <button
              key={v.url}
              type="button"
              onClick={open}
              title={v.title}
              className={`snap-start shrink-0 w-44 text-left rounded-xl overflow-hidden border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] transition-colors ${accent?.border || ''}`}
            >
              <div className="relative aspect-video bg-black/40">
                {v.image && <img src={v.image} alt="" loading="lazy" className="w-full h-full object-cover" />}
                <PlayCircle size={28} className="absolute inset-0 m-auto text-white/85 drop-shadow" aria-hidden="true" />
              </div>
              <div className="p-2">
                <p className="text-xs text-white/85 leading-snug line-clamp-2">{v.title}</p>
                <p className="text-[10px] text-white/40 mt-1 truncate">{host}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
