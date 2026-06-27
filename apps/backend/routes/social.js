const express = require('express');
const axios = require('axios');
const router = express.Router();
const config = require('../config/env');
const logger = require('../utils/logger');

// Social media search using Apify API
router.post('/search', async (req, res) => {
  try {
    const { query, platform = 'all', limit = 10 } = req.body;

    // Validate required parameters
    if (!query) {
      return res.status(400).json({
        error: 'Query parameter is required'
      });
    }

    // Check if Apify API key is configured
    if (!config.apify.apiKey) {
      return res.status(500).json({
        error: 'Apify API key is not configured'
      });
    }

    // Determine the Apify actor based on platform
    let actorId;
    switch (platform.toLowerCase()) {
      case 'twitter':
      case 'x':
        actorId = 'apify/twitter-scraper';
        break;
      case 'instagram':
        actorId = 'apify/instagram-scraper';
        break;
      case 'facebook':
        actorId = 'apify/facebook-scraper';
        break;
      case 'linkedin':
        actorId = 'apify/linkedin-scraper';
        break;
      case 'youtube':
        actorId = 'apify/youtube-scraper';
        break;
      case 'tiktok':
        actorId = 'apify/tiktok-scraper';
        break;
      default:
        // Use a generic social media scraper or aggregate multiple platforms
        actorId = 'apify/social-media-scraper'; // Placeholder - adjust based on actual Apify actors
    }

    // Prepare the input for the Apify actor
    const input = {
      search: query,
      maxItems: parseInt(limit),
      // Additional parameters can be added based on the specific actor
    };

    // Call the Apify API
    const response = await axios.post(
      `https://api.apify.com/v2/acts/${actorId}/runs`,
      input,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apify.apiKey}`
        },
        params: {
          token: config.apify.apiKey
        }
      }
    );

    // Return the job ID for the user to poll for results
    res.status(200).json({
      success: true,
      jobId: response.data.data.id,
      status: response.data.data.status,
      message: 'Social media search initiated successfully. Use the jobId to fetch results.'
    });

  } catch (error) {
    logger.error('Error in social media search:', error);
    
    res.status(500).json({
      error: 'Failed to initiate social media search',
      details: 'Service unavailable'
    });
  }
});

// Endpoint to get results from a previously initiated Apify job
router.get('/results/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        error: 'Job ID is required'
      });
    }

    // Check if Apify API key is configured
    if (!config.apify.apiKey) {
      return res.status(500).json({
        error: 'Apify API key is not configured'
      });
    }

    // Get the job status and results
    const jobResponse = await axios.get(
      `https://api.apify.com/v2/acts/runs/${jobId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.apify.apiKey}`
        },
        params: {
          token: config.apify.apiKey
        }
      }
    );

    const jobStatus = jobResponse.data.data.status;
    const results = {};

    if (jobStatus === 'SUCCEEDED') {
      // Get the dataset ID to fetch results
      const datasetId = jobResponse.data.data.defaultDatasetId;
      
      if (datasetId) {
        const datasetResponse = await axios.get(
          `https://api.apify.com/v2/datasets/${datasetId}/items`,
          {
            headers: {
              'Authorization': `Bearer ${config.apify.apiKey}`
            },
            params: {
              token: config.apify.apiKey
            }
          }
        );
        
        results.items = datasetResponse.data;
      }
    }

    res.status(200).json({
      success: true,
      jobId,
      status: jobStatus,
      results
    });

  } catch (error) {
    logger.error('Error fetching social media results:', error);
    
    res.status(500).json({
      error: 'Failed to fetch social media search results',
      details: 'Service unavailable'
    });
  }
});

// Alternative endpoint for direct social media search (if available)
router.post('/direct-search', async (req, res) => {
  try {
    const { query, platform = 'all', limit = 10 } = req.body;

    // Validate required parameters
    if (!query) {
      return res.status(400).json({
        error: 'Query parameter is required'
      });
    }

    // Check if Apify API key is configured
    if (!config.apify.apiKey) {
      return res.status(500).json({
        error: 'Apify API key is not configured'
      });
    }

    // For this implementation, we'll use the Twitter/X scraper as an example
    // In a real implementation, you'd want to dynamically select the appropriate actor
    const actorId = 'apify/twitter-scraper'; // Adjust as needed
    
    const input = {
      searches: [
        {
          phrase: query
        }
      ],
      maxItems: parseInt(limit),
      // Additional parameters can be added based on requirements
    };

    // Call the Apify API synchronously (with timeout)
    const response = await axios.post(
      `https://api.apify.com/v2/acts/${actorId}/runs?waitSecs=60`, // Wait up to 60 seconds
      input,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apify.apiKey}`
        },
        params: {
          token: config.apify.apiKey
        }
      }
    );

    // Extract results if available
    let results = [];
    if (response.data.data && response.data.data.defaultDatasetId) {
      const datasetId = response.data.data.defaultDatasetId;
      
      const datasetResponse = await axios.get(
        `https://api.apify.com/v2/datasets/${datasetId}/items`,
        {
          headers: {
            'Authorization': `Bearer ${config.apify.apiKey}`
          },
          params: {
            token: config.apify.apiKey
          }
        }
      );
      
      results = datasetResponse.data;
    }

    res.status(200).json({
      success: true,
      results,
      count: results.length
    });

  } catch (error) {
    logger.error('Error in direct social media search:', error);
    
    res.status(500).json({
      error: 'Failed to perform social media search',
      details: 'Service unavailable'
    });
  }
});

// ---------------------------------------------------------------------------
// Free RSS/JSON social feed — no API key required
// Fetches Reddit, Hacker News, and GitHub in parallel then normalises to a
// shared result shape.  Falls back to SearXNG social-media category when the
// self-hosted instance is reachable.
// ---------------------------------------------------------------------------

const FEED_TIMEOUT = 6000; // ms per upstream call

function normaliseReddit(posts, query) {
  return (posts || []).map((p) => {
    const d = p.data || p;
    return {
      id: d.id || d.name,
      platform: 'Reddit',
      title: d.title || '',
      url: d.url?.startsWith('http') ? d.url : `https://reddit.com${d.permalink}`,
      permalink: `https://reddit.com${d.permalink || ''}`,
      snippet: d.selftext ? d.selftext.slice(0, 200) : '',
      author: d.author || 'u/anonymous',
      subreddit: d.subreddit_name_prefixed || `r/${d.subreddit || 'all'}`,
      date: d.created_utc ? new Date(d.created_utc * 1000).toISOString() : null,
      score: d.score ?? null,
      comments: d.num_comments ?? null,
      thumbnail: (d.thumbnail && d.thumbnail.startsWith('http')) ? d.thumbnail : null,
      flair: d.link_flair_text || null,
    };
  });
}

function normaliseHN(hits) {
  return (hits || []).map((h) => ({
    id: String(h.objectID),
    platform: 'Hacker News',
    title: h.title || h.story_title || '',
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    permalink: `https://news.ycombinator.com/item?id=${h.objectID}`,
    snippet: h.story_text ? h.story_text.replace(/<[^>]+>/g, '').slice(0, 200) : '',
    author: h.author || '',
    subreddit: null,
    date: h.created_at || null,
    score: h.points ?? null,
    comments: h.num_comments ?? null,
    thumbnail: null,
    flair: null,
  }));
}

function normaliseGitHub(repos) {
  return (repos || []).map((r) => ({
    id: String(r.id),
    platform: 'GitHub',
    title: r.full_name || r.name || '',
    url: r.html_url || '',
    permalink: r.html_url || '',
    snippet: r.description || '',
    author: r.owner?.login || '',
    subreddit: null,
    date: r.updated_at || r.created_at || null,
    score: r.stargazers_count ?? null,
    comments: r.open_issues_count ?? null,
    thumbnail: r.owner?.avatar_url || null,
    flair: r.language || null,
  }));
}

async function fetchReddit(query, limit) {
  const params = new URLSearchParams({ q: query, sort: 'hot', limit, type: 'link', t: 'week' });
  const url = `https://www.reddit.com/search.json?${params}`;
  const res = await axios.get(url, {
    timeout: FEED_TIMEOUT,
    headers: { 'User-Agent': 'TruegleSearch/1.0 (social-feed)' },
  });
  return normaliseReddit(res.data?.data?.children?.map((c) => c.data) || [], query);
}

async function fetchHackerNews(query, limit) {
  const params = new URLSearchParams({ query, tags: 'story', hitsPerPage: limit });
  const url = `https://hn.algolia.com/api/v1/search?${params}`;
  const res = await axios.get(url, { timeout: FEED_TIMEOUT });
  return normaliseHN(res.data?.hits || []);
}

async function fetchGitHub(query, limit) {
  const params = new URLSearchParams({ q: query, sort: 'stars', order: 'desc', per_page: limit });
  const url = `https://api.github.com/search/repositories?${params}`;
  const res = await axios.get(url, {
    timeout: FEED_TIMEOUT,
    headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'TruegleSearch/1.0' },
  });
  return normaliseGitHub(res.data?.items || []);
}

/**
 * POST /api/social/feed
 * body: { query: string, platforms?: string[] }
 * platforms defaults to ['reddit','hackernews','github'] when omitted or ['all'].
 * Returns: { results: [...], platforms: { reddit: [...], hackernews: [...], github: [...] } }
 */
router.post('/feed', async (req, res) => {
  try {
    const { query, platforms: requestedPlatforms } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'query is required' });
    }

    const q = query.trim();
    const limit = 20;
    const all = !requestedPlatforms || requestedPlatforms.includes('all');
    const want = (p) => all || requestedPlatforms.includes(p);

    // Kick off all requested platform fetches in parallel; each is
    // independently fault-tolerant — a single failure doesn't kill the rest.
    const [redditResult, hnResult, ghResult] = await Promise.allSettled([
      want('reddit') ? fetchReddit(q, limit) : Promise.resolve([]),
      want('hackernews') ? fetchHackerNews(q, limit) : Promise.resolve([]),
      want('github') ? fetchGitHub(q, limit) : Promise.resolve([]),
    ]);

    const reddit = redditResult.status === 'fulfilled' ? redditResult.value : [];
    const hackernews = hnResult.status === 'fulfilled' ? hnResult.value : [];
    const github = ghResult.status === 'fulfilled' ? ghResult.value : [];

    if (redditResult.status === 'rejected') logger.warn('Reddit feed failed:', redditResult.reason?.message);
    if (hnResult.status === 'rejected') logger.warn('HN feed failed:', hnResult.reason?.message);
    if (ghResult.status === 'rejected') logger.warn('GitHub feed failed:', ghResult.reason?.message);

    // Merged chronological feed across all platforms
    const all_results = [...reddit, ...hackernews, ...github].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    });

    return res.json({
      query: q,
      results: all_results,
      platforms: { reddit, hackernews, github },
      errors: {
        reddit: redditResult.status === 'rejected' ? 'unavailable' : null,
        hackernews: hnResult.status === 'rejected' ? 'unavailable' : null,
        github: ghResult.status === 'rejected' ? 'unavailable' : null,
      },
    });
  } catch (error) {
    logger.error('Social feed error:', error);
    return res.status(500).json({ error: 'Social feed unavailable', details: 'Service error' });
  }
});

module.exports = router;