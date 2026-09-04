import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * Fetch all of a creator's channel videos with pagination support.
 *
 * Returns { videos, hasMore, loadMore, loading, error }
 */
export function useAllChannelVideos(channelId, enabled = true) {
  const [videos, setVideos] = useState([]);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  // Fetch one page
  const fetchPage = useCallback(async (pageToken) => {
    if (!enabled || !channelId) return;
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (pageToken) params.pageToken = pageToken;
      const res = await axios.get(`${BACKEND}/api/creators/${channelId}/videos/all`, { params });
      const newVideos = res.data.videos || [];
      setVideos((prev) => pageToken ? [...prev, ...newVideos] : newVideos);
      setNextPageToken(res.data.nextPageToken || null);
      setHasMore(!!res.data.nextPageToken);
    } catch (err) {
      setError(err.message || 'Failed to fetch videos');
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [channelId, enabled]);

  // Load more
  const loadMore = useCallback(() => {
    if (nextPageToken && !loading) {
      fetchPage(nextPageToken);
    }
  }, [nextPageToken, loading, fetchPage]);

  // Initial load
  useEffect(() => {
    if (enabled && channelId) {
      setVideos([]);
      setNextPageToken(null);
      setHasMore(true);
      fetchPage(null);
    }
  }, [channelId, enabled, fetchPage]);

  return { videos, hasMore, loadMore, loading, error };
}

export default useAllChannelVideos;
