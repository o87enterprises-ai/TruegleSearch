import { useCallback, useState } from 'react';
import api from '../services/api';
import { getPlayable } from '../utils/videoEmbed';

// A channel's ACTUAL feed — newest upload first — rather than whatever a web
// index happened to have crawled.
//
// Searching for a channel gives a name; YouTube's free per-channel RSS speaks
// channel ids. `/api/creators/resolve` bridges the two, and the existing feed
// endpoint does the rest. Both are keyless and cached server-side.
const cache = new Map(); // handle -> sources[]

const toSource = (v, name) => {
  const base = getPlayable(v.url);
  return base ? {
    ...base,
    title: v.title || name,
    pageUrl: v.url,
    poster: v.thumbnail,
    channel: name,
    published: v.published || null,
  } : null;
};

export function useChannelFeed() {
  const [state, setState] = useState({ handle: null, videos: null, loading: false, error: '' });

  const open = useCallback(async (handle, name) => {
    const key = String(handle || '').replace(/^@+/, '').toLowerCase();
    if (!key) return;

    if (cache.has(key)) {
      setState({ handle: key, videos: cache.get(key), loading: false, error: '' });
      return;
    }
    setState({ handle: key, videos: null, loading: true, error: '' });
    try {
      const r = await api.get(`/creators/resolve?handle=${encodeURIComponent(key)}`);
      const channelId = r.data?.channelId;
      if (!channelId) throw new Error('no channel');
      const f = await api.get(`/creators/${channelId}/videos`);
      // The feed arrives newest-first; keep that order — it IS the channel.
      const videos = (f.data?.videos || []).map((v) => toSource(v, name || `@${key}`)).filter(Boolean);
      if (!videos.length) throw new Error('empty feed');
      cache.set(key, videos);
      setState({ handle: key, videos, loading: false, error: '' });
    } catch {
      setState({
        handle: key,
        videos: null,
        loading: false,
        error: "Couldn't open that channel's feed.",
      });
    }
  }, []);

  const clear = useCallback(() => setState({ handle: null, videos: null, loading: false, error: '' }), []);

  return { ...state, open, clear };
}

export default useChannelFeed;
