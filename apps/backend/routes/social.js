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

// ── PAGING ────────────────────────────────────────────────────────────────
//
// Every one of these three upstreams has always supported paging and none of
// it was ever used: Reddit hands back an `after` cursor on every response and
// it was fetched and thrown away, HN and GitHub both take a `page`. Without
// them a "feed" is one page of twenty and then nothing, which is a sample, not
// a feed.
//
// Each fetcher returns { items, next } — `next` is whatever that platform
// wants back to continue, or null at the end. The shapes differ on purpose
// (Reddit's is an opaque token, the other two are page numbers); the route
// carries them per-platform rather than pretending one cursor fits all.
//
// AN EMPTY QUERY IS THE HOME FEED, and it goes to different endpoints. This
// matters and it is worth being straight about: without OAuth there is no
// "your" feed on any of these — Reddit's personal front page needs a token we
// do not have yet. What an unauthenticated home feed can honestly be is
// "what's popular right now", so that is exactly what these ask for.

const UA = 'TruegleSearch/1.0 (social-feed)';

async function fetchReddit(query, limit, after) {
  const params = query
    ? new URLSearchParams({ q: query, sort: 'hot', limit, type: 'link', t: 'week' })
    : new URLSearchParams({ limit });
  if (after) params.set('after', after);
  // /hot.json is the keyless popular listing — the honest stand-in for a home
  // feed until a token can ask for the real one.
  const path = query ? 'search.json' : 'hot.json';
  const res = await axios.get(`https://www.reddit.com/${path}?${params}`, {
    timeout: FEED_TIMEOUT,
    // Reddit 429s a default user agent almost immediately. This header is the
    // only reason any of this works unauthenticated.
    headers: { 'User-Agent': UA },
  });
  return {
    items: normaliseReddit(res.data?.data?.children?.map((c) => c.data) || [], query),
    next: res.data?.data?.after || null,
  };
}

async function fetchHackerNews(query, limit, page = 0) {
  const params = new URLSearchParams({ tags: query ? 'story' : 'front_page', hitsPerPage: limit, page });
  if (query) params.set('query', query);
  const res = await axios.get(`https://hn.algolia.com/api/v1/search?${params}`, { timeout: FEED_TIMEOUT });
  const { hits = [], nbPages = 0, page: got = 0 } = res.data || {};
  return { items: normaliseHN(hits), next: got + 1 < nbPages ? got + 1 : null };
}

async function fetchGitHub(query, limit, page = 1) {
  // GitHub's search REQUIRES a q, so the home feed asks a question that means
  // "things people care about, recently touched" rather than sending nothing.
  const params = new URLSearchParams({
    q: query || 'stars:>1000',
    sort: query ? 'stars' : 'updated',
    order: 'desc',
    per_page: limit,
    page,
  });
  const res = await axios.get(`https://api.github.com/search/repositories?${params}`, {
    timeout: FEED_TIMEOUT,
    headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': UA },
  });
  const items = normaliseGitHub(res.data?.items || []);
  // Unauthenticated search caps out at 1000 results; asking past that 422s.
  const more = items.length === Number(limit) && page * limit < 1000;
  return { items, next: more ? page + 1 : null };
}

/**
 * POST /api/social/feed
 * body: { query?: string, platforms?: string[], cursor?: {…}, limit?: number }
 *
 * platforms defaults to ['reddit','hackernews','github'] when omitted or ['all'].
 * QUERY IS OPTIONAL: with one this searches, without one it returns the
 * popular listing — which is what an unauthenticated "home feed" honestly is.
 * `cursor` is the previous response's `nextCursor`, per platform.
 *
 * Returns: { query, results, platforms: {…}, nextCursor: {…}, errors: {…} }
 */
router.post('/feed', async (req, res) => {
  try {
    const { query, platforms: requestedPlatforms, cursor, limit: rawLimit } = req.body || {};
    // An empty query used to be a 400. It is the home feed now, so the only
    // bad input left is a non-string that is not absent.
    const q = typeof query === 'string' ? query.trim() : '';
    if (query !== undefined && typeof query !== 'string') {
      return res.status(400).json({ error: 'query must be a string' });
    }

    const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 20, 1), 50);
    const cur = cursor && typeof cursor === 'object' ? cursor : {};
    const all = !requestedPlatforms || requestedPlatforms.includes('all');
    const want = (p) => all || requestedPlatforms.includes(p);
    const NONE = { items: [], next: null };

    // Kick off all requested platform fetches in parallel; each is
    // independently fault-tolerant — a single failure doesn't kill the rest.
    const [redditResult, hnResult, ghResult] = await Promise.allSettled([
      want('reddit') ? fetchReddit(q, limit, cur.reddit) : Promise.resolve(NONE),
      want('hackernews') ? fetchHackerNews(q, limit, cur.hackernews) : Promise.resolve(NONE),
      want('github') ? fetchGitHub(q, limit, cur.github) : Promise.resolve(NONE),
    ]);

    const settle = (r) => (r.status === 'fulfilled' ? r.value : NONE);
    const reddit = settle(redditResult).items;
    const hackernews = settle(hnResult).items;
    const github = settle(ghResult).items;

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
      // What to send back to continue. A platform that has run out reports
      // null, which is how the client knows to stop asking rather than
      // spinning on an endpoint that will keep returning the same page.
      nextCursor: {
        reddit: settle(redditResult).next,
        hackernews: settle(hnResult).next,
        github: settle(ghResult).next,
      },
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