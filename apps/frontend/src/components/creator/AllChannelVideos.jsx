import { memo } from 'react';
import { Loader2 } from 'lucide-react';
import { useAllChannelVideos } from '../../hooks/useAllChannelVideos';
import { sourceColour } from '../../utils/playerQuery';

/**
 * Display all a creator's channel videos in a scrollable grid.
 * Handles pagination with a "Load more" button when videos exist.
 */
const AllChannelVideos = memo(({ channelId, onSelect, activeKey }) => {
  const { videos, hasMore, loadMore, loading, error } = useAllChannelVideos(channelId, !!channelId);

  if (!channelId) return null;

  if (error && videos.length === 0) {
    return (
      <div className="py-8 text-center text-red-400/80 text-sm">
        Failed to load videos
      </div>
    );
  }

  if (videos.length === 0 && !loading) {
    return (
      <div className="py-8 text-center text-white/40 text-sm">
        No videos found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Video grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {videos.map((v, i) => {
          const key = v.videoId || `${v.url}:${i}`;
          const isActive = activeKey && key === activeKey;
          const colour = sourceColour({ kind: 'youtube' });
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect?.(v)}
              className="group text-left rounded-lg overflow-hidden border bg-white/[0.03] hover:bg-white/[0.06] transition-colors focus:outline-none focus-visible:ring-2"
              style={{
                borderColor: isActive ? `${colour}aa` : `${colour}33`,
              }}
              data-video-cell={key}
            >
              <div className="relative aspect-video bg-black/60 overflow-hidden">
                {v.thumbnail && (
                  <img
                    src={v.thumbnail}
                    alt={v.title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="p-2">
                <p className="text-xs text-white/90 line-clamp-2">{v.title}</p>
                {v.published && (
                  <p className="text-[10px] text-white/40 mt-1">
                    {new Date(v.published).toLocaleDateString()}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Load more button */}
      {hasMore && (
        <div className="flex justify-center py-4">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-white/20 text-white/80 hover:text-white hover:border-white/40 disabled:opacity-50 text-sm font-medium transition-colors flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Loading…' : 'Load More'}
          </button>
        </div>
      )}

      {/* Loading state for first page */}
      {loading && videos.length === 0 && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-white/50" />
        </div>
      )}
    </div>
  );
});

AllChannelVideos.displayName = 'AllChannelVideos';
export default AllChannelVideos;
