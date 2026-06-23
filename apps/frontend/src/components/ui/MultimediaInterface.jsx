import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ExternalLink,
  Download,
  Share2,
  Heart,
  Play,
  Pause,
  MessageCircle,
  Repeat2,
  ThumbsUp,
} from 'lucide-react';
import SocialEmbed from './SocialEmbed';

// Platforms with a stable, no-login, no-API-key embed widget. Facebook and
// Instagram gate their oEmbed behind app-review tokens, so they stay as
// link-out cards instead of silently failing to render.
const EMBEDDABLE_PLATFORMS = new Set(['Twitter / X', 'Reddit', 'TikTok']);

export default function MultimediaInterface({ category, onClose, searchQuery }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socialPlatformFilter, setSocialPlatformFilter] = useState('All');

  useEffect(() => {
    if (category && searchQuery) {
      setLoading(true);
      setSocialPlatformFilter('All');
      let categoryFilter = '';
      if (category === 'pics') categoryFilter = 'images';
      else if (category === 'vids') categoryFilter = 'videos';
      else if (category === 'audio') categoryFilter = 'audio';
      else if (category === 'soc') categoryFilter = 'social';

      if (categoryFilter) {
        fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: searchQuery,
            filters: { category: categoryFilter, bias: 'all', dateRange: 'any', perPage: 20 }
          })
        })
          .then(response => response.json())
          .then(result => {
            let mappedData = [];
            if (result.results && result.results.length > 0) {
              if (category === 'pics') {
                mappedData = result.results.map(img => ({
                  id: img.id || img.url,
                  url: img.image || img.url,
                  title: img.title,
                }));
              } else if (category === 'vids') {
                mappedData = result.results.map(vid => {
                  const videoId = vid.url?.includes('youtube.com')
                    ? new URLSearchParams(new URL(vid.url).search).get('v')
                    : null;
                  return {
                    id: videoId || vid.url,
                    videoId,
                    url: vid.url,
                    thumbnail: videoId
                      ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
                      : vid.image,
                    title: vid.title,
                    snippet: vid.snippet,
                    channel: vid.channel || vid.sourceName || 'YouTube',
                    date: vid.date,
                    duration: vid.duration || null,
                    views: vid.views ?? null,
                    bias: vid.bias || null,
                    biasLabel: vid.biasLabel || null,
                  };
                });
              } else if (category === 'audio') {
                mappedData = result.results.map(audio => ({
                  id: audio.id || audio.url,
                  title: audio.title,
                  duration: 'N/A',
                  source: audio.sourceName,
                }));
              } else if (category === 'soc') {
                mappedData = result.results.map(post => ({
                  id: post.id || post.url,
                  url: post.url,
                  platform: post.domain?.includes('reddit') ? 'Reddit'
                    : (post.domain?.includes('twitter') || post.domain?.includes('x.com')) ? 'Twitter / X'
                    : post.domain?.includes('tiktok') ? 'TikTok'
                    : (post.domain?.includes('youtube') || post.domain?.includes('youtu.be')) ? 'YouTube'
                    : post.domain?.includes('instagram') ? 'Instagram'
                    : post.domain?.includes('facebook') ? 'Facebook'
                    : post.sourceName || 'Social',
                  author: post.domain || 'Unknown',
                  text: post.snippet || post.title,
                  title: post.title,
                  timestamp: post.date ? new Date(post.date).toLocaleDateString() : '',
                }));
              }
            }
            setData(mappedData);
          })
          .catch(() => {
            setData([]);
          })
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }
  }, [category, searchQuery]);

  // Empty fallbacks — no fake data shown when APIs return nothing
  const mockImages = [];
  const mockVideos = [];
  const mockAudio = [];
  const mockSocialPosts = [];

  // Simple components for display
  const ImageGrid = ({ images, onSelect }) => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {images.map((img) => (
        <div key={img.id} className="aspect-square bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition-transform" onClick={() => onSelect(img)}>
          <img src={img.url} alt={img.title} className="w-full h-full object-cover" />
          <div className="p-2 bg-black/50">
            <p className="text-white text-sm truncate">{img.title}</p>
          </div>
        </div>
      ))}
    </div>
  );

  const formatViews = (n) => {
    if (n == null) return null;
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B views`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M views`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K views`;
    return `${n} views`;
  };

  const VideoGrid = ({ videos, onSelect }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {videos.map((vid) => (
        <div key={vid.id} className="bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:scale-105 transition-transform" onClick={() => onSelect(vid)}>
          <div className="relative">
            <img src={vid.thumbnail} alt={vid.title} className="w-full aspect-video object-cover" />
            {vid.duration && (
              <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-white text-xs font-medium">
                {vid.duration}
              </span>
            )}
          </div>
          <div className="p-3">
            <h3 className="text-white font-semibold truncate">{vid.title}</h3>
            <p className="text-gray-400 text-sm truncate">{vid.channel}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
              {formatViews(vid.views) && <span>{formatViews(vid.views)}</span>}
              {vid.date && <span>{new Date(vid.date).toLocaleDateString()}</span>}
              {vid.bias && (
                <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  {vid.biasLabel || vid.bias}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const AudioGrid = ({ audio }) => (
    <div className="space-y-3">
      {audio.map((item) => (
        <div key={item.id} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold">{item.title}</h3>
            <p className="text-gray-400 text-sm">{item.duration}</p>
          </div>
          <button className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg">
            <Play size={16} />
          </button>
        </div>
      ))}
    </div>
  );

  const platformColors = {
    'Reddit': 'border-orange-500/50 text-orange-400',
    'Twitter / X': 'border-blue-500/50 text-blue-400',
    'TikTok': 'border-pink-500/50 text-pink-400',
    'YouTube': 'border-red-500/50 text-red-400',
    'Instagram': 'border-purple-500/50 text-purple-400',
    'Facebook': 'border-blue-600/50 text-blue-300',
    'Social': 'border-cyan-500/50 text-cyan-400',
  };

  const SocialGrid = ({ posts }) => {
    const platforms = ['All', ...Array.from(new Set(posts.map((p) => p.platform)))];
    const filteredPosts = socialPlatformFilter === 'All'
      ? posts
      : posts.filter((p) => p.platform === socialPlatformFilter);

    return (
      <div>
        {/* Platform tabs — quick-switch between social apps without leaving the page */}
        {posts.length > 0 && (
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
            {platforms.map((platform) => (
              <button
                key={platform}
                onClick={() => setSocialPlatformFilter(platform)}
                className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all whitespace-nowrap ${
                  socialPlatformFilter === platform
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                }`}
              >
                {platform}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-3">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-12 text-white/50">No social results found for this query.</div>
          ) : filteredPosts.map((post) => (
            <div
              key={post.id}
              className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${platformColors[post.platform] || platformColors['Social']}`}>
                  {post.platform}
                </span>
                <span className="text-white/40 text-xs">{post.author}</span>
                {post.timestamp && <span className="text-white/30 text-xs ml-auto">{post.timestamp}</span>}
                <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/70">
                  <ExternalLink size={12} />
                </a>
              </div>

              {EMBEDDABLE_PLATFORMS.has(post.platform) ? (
                <SocialEmbed url={post.url} platform={post.platform} title={post.title} />
              ) : (
                <a href={post.url} target="_blank" rel="noopener noreferrer" className="block group">
                  <p className="text-white/90 font-semibold text-sm mb-1 group-hover:text-white transition-colors line-clamp-2">
                    {post.title}
                  </p>
                  {post.text && post.text !== post.title && (
                    <p className="text-white/60 text-xs line-clamp-2">{post.text}</p>
                  )}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render based on category
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full"></div>
          <span className="ml-3 text-white/70">Loading {category} content...</span>
        </div>
      );
    }

    switch (category) {
      case 'pics':
        return (
          <ImageGrid images={data.length > 0 ? data : mockImages} onSelect={setSelectedItem} />
        );
      case 'vids':
        return data.length > 0
          ? <VideoGrid videos={data} onSelect={setSelectedItem} />
          : <div className="text-center py-12 text-white/50">No video results found. Try a different search term.</div>;
      case 'audio':
        return <AudioGrid audio={data.length > 0 ? data : mockAudio} />;
      case 'soc':
        return (
          <SocialGrid
            posts={data.length > 0 ? data : mockSocialPosts}
            onSelect={setSelectedItem}
          />
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="w-full overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">
            {category === 'pics' && '📸 Images'}
            {category === 'vids' && '🎬 Videos'}
            {category === 'audio' && '🎵 Audio'}
            {category === 'soc' && '💬 Social Media'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Ad Banner 1 - Top */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 backdrop-blur-xl border-2 border-yellow-400"
          style={{
            backgroundColor: '#FFEB3B',
            boxShadow: '0 4px 15px rgba(255, 235, 59, 0.3)',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-700 mb-1 font-bold">
                Sponsored
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {category === 'soc'
                  ? 'Social Media Management Tools'
                  : 'Premium Stock Photos'}
              </div>
              <div className="text-xs text-gray-800">
                {category === 'soc'
                  ? 'Schedule and analyze your posts'
                  : 'Unlimited downloads for your projects'}
              </div>
            </div>
            <button className="px-6 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-semibold whitespace-nowrap hover:from-orange-400 hover:to-red-400 transition-all shadow-lg">
              Try Free
            </button>
          </div>
        </motion.div>

        {/* Content */}
        {renderContent()}

        {/* Ad Banner 2 - Bottom */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 rounded-2xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 backdrop-blur-xl border-2 border-yellow-400"
          style={{
            backgroundColor: '#FFEB3B',
            boxShadow: '0 4px 15px rgba(255, 235, 59, 0.3)',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-700 mb-1 font-bold">
                Sponsored
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {category === 'soc'
                  ? 'Grow Your Following'
                  : 'Video Editing Software'}
              </div>
              <div className="text-xs text-gray-800">
                {category === 'soc'
                  ? 'Smart engagement tools'
                  : 'Professional tools for creators'}
              </div>
            </div>
            <button className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-semibold whitespace-nowrap hover:from-blue-400 hover:to-indigo-400 transition-all shadow-lg">
              Get Started
            </button>
          </div>
        </motion.div>
      </div>

      {/* Lightbox for selected item */}
      <AnimatePresence>
        {selectedItem && (
          <Lightbox
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            category={category}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Image Masonry Grid Component
function ImageMasonryGrid({ images, onSelect }) {
  return (
    <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
      {images.map((image, index) => (
        <motion.div
          key={image.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          className="break-inside-avoid group relative cursor-pointer"
          onClick={() => onSelect(image)}
        >
          <div className="relative overflow-hidden rounded-2xl border-2 border-purple-500/50 hover:border-purple-400 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.5)]">
            <img
              src={image.url}
              alt={image.title}
              className="w-full h-auto transform group-hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-white text-sm font-semibold">
                  {image.title}
                </p>
                <p className="text-white/70 text-xs">{image.source}</p>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Social Media Masonry Grid Component
function SocialMasonryGrid({ posts, onSelect }) {
  const platformColors = {
    Twitter: 'from-blue-500/20 to-cyan-500/20 border-blue-500/50',
    Reddit: 'from-orange-500/20 to-red-500/20 border-orange-500/50',
    Facebook: 'from-blue-600/20 to-indigo-500/20 border-blue-600/50',
  };

  const platformIcons = {
    Twitter: '𝕏',
    Reddit: '🔴',
    Facebook: 'f',
  };

  return (
    <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
      {posts.map((post, index) => (
        <motion.div
          key={post.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          className="break-inside-avoid group relative cursor-pointer"
          onClick={() => onSelect(post)}
        >
          <div
            className={`relative overflow-hidden rounded-2xl border-2 bg-gradient-to-br ${platformColors[post.platform]} hover:border-purple-400 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.5)]`}
          >
            {/* Platform Badge */}
            <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm">
              <span className="text-xs text-white font-semibold">
                {platformIcons[post.platform]} {post.platform}
              </span>
            </div>

            {/* Post Image */}
            <img
              src={post.thumbnail}
              alt={post.text}
              className="w-full h-auto transform group-hover:scale-110 transition-transform duration-500"
            />

            {/* Post Content Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-white/90 text-xs mb-2 font-medium">
                  {post.author}
                </p>
                <p className="text-white text-sm line-clamp-3 mb-3">
                  {post.text}
                </p>

                {/* Engagement Stats */}
                <div className="flex items-center gap-4 text-white/70 text-xs">
                  <div className="flex items-center gap-1">
                    <Heart size={12} />
                    <span>{post.likes.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle size={12} />
                    <span>{post.comments}</span>
                  </div>
                  <span className="ml-auto">{post.timestamp}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Video Dome Gallery Component
function VideoDomeGallery({ videos, onSelect }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {videos.map((video, index) => (
        <motion.div
          key={video.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="group relative cursor-pointer"
          onClick={() => onSelect(video)}
        >
          <div className="relative overflow-hidden rounded-2xl border-2 border-purple-500/50 hover:border-purple-400 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.5)]">
            <img
              src={video.thumbnail}
              alt={video.title}
              className="w-full h-48 object-cover transform group-hover:scale-110 transition-transform duration-500"
            />

            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/60 transition-all">
              <div className="w-16 h-16 rounded-full bg-purple-500 flex items-center justify-center transform group-hover:scale-110 transition-transform shadow-lg shadow-purple-500/50">
                <Play size={24} className="text-white ml-1" fill="white" />
              </div>
            </div>

            {/* Duration Badge */}
            <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-white text-xs font-semibold">
              {video.duration}
            </div>

            {/* Title on Hover */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-white text-sm font-semibold line-clamp-2">
                {video.title}
              </p>
              <p className="text-white/70 text-xs">{video.source}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Audio List Component
function AudioList({ audio }) {
  const [playing, setPlaying] = useState(null);

  return (
    <div className="space-y-3">
      {audio.map((track, index) => (
        <motion.div
          key={track.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className="p-4 rounded-2xl bg-gradient-to-br from-[#1a1a2e]/95 to-[#16213e]/95 backdrop-blur-2xl border-2 border-purple-500/50 hover:border-purple-400 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] group"
        >
          <div className="flex items-center gap-4">
            {/* Play Button */}
            <button
              onClick={() => setPlaying(playing === track.id ? null : track.id)}
              className="w-12 h-12 rounded-full bg-purple-500 hover:bg-purple-400 flex items-center justify-center transition-all shadow-lg shadow-purple-500/50"
            >
              {playing === track.id ? (
                <Pause size={20} className="text-white" fill="white" />
              ) : (
                <Play size={20} className="text-white ml-1" fill="white" />
              )}
            </button>

            {/* Track Info */}
            <div className="flex-1">
              <h3 className="text-white font-semibold">{track.title}</h3>
              <p className="text-white/60 text-sm">{track.source}</p>
            </div>

            {/* Duration */}
            <div className="text-white/60 text-sm font-mono">
              {track.duration}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all">
                <Heart size={16} />
              </button>
              <button className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all">
                <Share2 size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Lightbox Component
function Lightbox({ item, onClose, category }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        className="relative max-w-5xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {category === 'soc' ? (
          // Social Post Lightbox
          <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] rounded-2xl border-2 border-purple-500 shadow-2xl shadow-purple-500/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
                <div>
                  <h3 className="text-white font-semibold">{item.author}</h3>
                  <p className="text-white/60 text-sm">
                    {item.platform} • {item.timestamp}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-3 rounded-xl bg-red-500 hover:bg-red-400 text-white transition-all shadow-lg"
              >
                <X size={20} />
              </button>
            </div>

            <img
              src={item.thumbnail}
              alt={item.text}
              className="w-full rounded-xl mb-4"
            />

            <p className="text-white text-lg mb-4">{item.text}</p>

            <div className="flex items-center gap-6 text-white/70">
              <button className="flex items-center gap-2 hover:text-pink-400 transition-colors">
                <Heart size={20} />
                <span>{item.likes.toLocaleString()}</span>
              </button>
              <button className="flex items-center gap-2 hover:text-cyan-400 transition-colors">
                <MessageCircle size={20} />
                <span>{item.comments}</span>
              </button>
              <button className="flex items-center gap-2 hover:text-green-400 transition-colors">
                <Repeat2 size={20} />
                <span>Share</span>
              </button>
            </div>
          </div>
        ) : category === 'vids' && item.videoId ? (
          // YouTube Video Embed
          <div className="bg-black rounded-2xl border-2 border-purple-500 shadow-2xl shadow-purple-500/50 overflow-hidden">
            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${item.videoId}?autoplay=1&rel=0&modestbranding=1`}
                title={item.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="p-4 bg-gradient-to-br from-[#1a1a2e] to-[#16213e]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h2 className="text-white font-bold text-lg mb-1 line-clamp-2">{item.title}</h2>
                  <p className="text-white/50 text-sm">{item.channel}</p>
                  {item.snippet && <p className="text-white/60 text-xs mt-2 line-clamp-3">{item.snippet}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-all"
                    title="Open on YouTube"
                  >
                    <ExternalLink size={16} />
                  </a>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : category === 'vids' && !item.videoId ? (
          // Non-YouTube video fallback
          <div className="bg-[#1a1a2e] rounded-2xl border-2 border-purple-500 shadow-2xl p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h2 className="text-white font-bold text-xl">{item.title}</h2>
              <button onClick={onClose} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                <X size={18} />
              </button>
            </div>
            {item.thumbnail && (
              <img src={item.thumbnail} alt={item.title} className="w-full rounded-xl mb-4 object-cover max-h-64" />
            )}
            <p className="text-white/60 text-sm mb-4">{item.snippet}</p>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-all"
            >
              <ExternalLink size={16} /> Watch Video
            </a>
          </div>
        ) : (
          // Image Lightbox
          <>
            <img
              src={item.url || item.thumbnail}
              alt={item.title}
              className="w-full h-auto rounded-2xl border-2 border-purple-500 shadow-2xl shadow-purple-500/50"
            />
            <div className="absolute top-4 right-4 flex gap-2">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-xl bg-purple-500 hover:bg-purple-400 text-white transition-all shadow-lg"
              >
                <ExternalLink size={20} />
              </a>
              <button
                onClick={onClose}
                className="p-3 rounded-xl bg-red-500 hover:bg-red-400 text-white transition-all shadow-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent rounded-b-2xl">
              <h2 className="text-white text-xl font-bold">{item.title}</h2>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
