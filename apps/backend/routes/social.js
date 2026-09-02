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

// MORE THAN ONE DOOR TO REDDIT.
//
// `www.reddit.com` is the documented one and the one that works from a laptop.
// It is also the one most likely to answer a request from a datacenter with a
// 403 or a 429 — which is what this runs on in production, so a single-host
// fetch means the feed and the Tube Reddit search both fail for a reason that
// has nothing to do with the query. These are the same public JSON on hosts
// Reddit operates itself; if one refuses, the next is asked.
const REDDIT_HOSTS = [
  'https://www.reddit.com',
  'https://old.reddit.com',
  // No `www`: a different edge again, and the JSON is identical.
  'https://reddit.com',
];

/** The upstream's own words, short enough to put in a JSON field. */
function upstreamReason(err) {
  if (err?.response) {
    const status = err.response.status;
    // CONFIRMED IN PRODUCTION 2026-08-18, not a hypothesis: every host in
    // REDDIT_HOSTS returns 403 from the deployment. Reddit blocks datacenter
    // IP ranges for keyless reads, so no amount of host-walking or header
    // tuning gets past it — the fix is an authenticated request, i.e. the free
    // Reddit OAuth app the Feed page already names as the one that works.
    if (status === 403) {
      return 'HTTP 403 — Reddit blocks keyless reads from datacenter IPs like ours. '
        + 'Connecting a Reddit account (free OAuth) is what lifts this.';
    }
    if (status === 429) return 'HTTP 429 — rate limited by Reddit';
    return `HTTP ${status}`;
  }
  if (err?.code === 'ECONNABORTED') return `timed out after ${FEED_TIMEOUT}ms`;
  return err?.code || err?.message || 'unknown error';
}

// ── news, and why it earns a slot ───────────────────────────────────────────
//
// The feed had exactly two sources that can actually run without credentials,
// and one of them — GitHub's unauthenticated search — allows TEN requests a
// minute for the whole server, shared across every visitor. So a feed with a
// handful of readers rate-limits itself, both panels empty, and the page looks
// like it needs a login it does not need. More free sources is the fix, not a
// better error message.
//
// Google News RSS is the best of them: no key, no quota published or observed,
// and it is already parsed by services/NewsSources.js for the news panel, so
// this adds a source without adding a dependency or a failure mode nobody has
// debugged before.
//
// PAGINATION BY TOPIC. RSS has no cursor, so "page two" would normally mean
// re-fetching page one forever. Google publishes a section feed per topic
// though, so the cursor is an INDEX INTO THESE: each page is a different
// section, and the list runs out honestly when the sections do. It also means
// the feed covers sports, entertainment, science and health — four of the
// categories the spec asks for — from one keyless source.
const NEWS_TOPICS = ['WORLD', 'BUSINESS', 'TECHNOLOGY', 'SCIENCE', 'HEALTH', 'SPORTS', 'ENTERTAINMENT'];

function normaliseNews(items, topic) {
  return items.map((n) => ({
    // RSS carries no id. The URL is the identity — it is what dedupe,
    // `platform:id` keys and the client's seen-ledger all hang off, and two
    // outlets running the same wire story have different URLs, which is
    // correct: they are different posts.
    id: n.url,
    platform: 'News',
    title: n.title,
    url: n.url,
    permalink: n.url,
    snippet: null,
    // The OUTLET, which is the useful "who" for a headline. splitSource() in
    // NewsSources.js has already pulled it off the end of the RSS title.
    author: n.source || null,
    subreddit: null,
    date: n.at ? new Date(n.at).toISOString() : null,
    // Google News publishes neither, and inventing a 0 would render as a real
    // score of zero rather than "this source does not have one".
    score: null,
    comments: null,
    thumbnail: null,
    flair: topic ? topic.toLowerCase() : null,
  }));
}

async function fetchNews(query, limit, cursor) {
  const { parseRss } = require('../services/NewsSources');
  const page = Number.isInteger(cursor) ? cursor : 0;

  // A SEARCH IS ONE PAGE. Google News search has no sections to walk and no
  // cursor, so it answers once and reports itself exhausted rather than
  // handing back the same headlines forever.
  if (query) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const res = await axios.get(url, { timeout: FEED_TIMEOUT, headers: { 'User-Agent': UA } });
    return { items: normaliseNews(parseRss(res.data, limit), null), next: null };
  }

  if (page >= NEWS_TOPICS.length) return { items: [], next: null };
  const topic = NEWS_TOPICS[page];
  const url = `https://news.google.com/rss/headlines/section/topic/${topic}?hl=en-US&gl=US&ceid=US:en`;
  const res = await axios.get(url, { timeout: FEED_TIMEOUT, headers: { 'User-Agent': UA } });
  return {
    items: normaliseNews(parseRss(res.data, limit), topic),
    next: page + 1 < NEWS_TOPICS.length ? page + 1 : null,
  };
}

// ── the open fediverse: Mastodon, Bluesky, Lemmy ────────────────────────────
//
// These three are the answer to "which social platforms can we actually read".
// Not most of them: X wants $200/mo, Instagram's Basic Display shut down,
// Facebook will not grant user_posts to non-partners, TikTok returns only the
// caller's own videos, and Truth Social — a Mastodon fork, so it LOOKS like it
// should work — gates its public timeline behind auth and forbids automated
// access in its terms. None of that is a budget problem; the endpoints do not
// exist for us.
//
// These three do exist, keyless and by design: they are federated networks
// whose public timelines are public infrastructure. No account, no key, no
// quota to buy, and reading them is the documented purpose of the endpoint
// rather than a gap somebody forgot to close.
//
// UNVERIFIED FROM THE SANDBOX. The agent proxy blocks every outbound host, so
// these response shapes could not be checked where they were written — the
// same reason the Reddit live exchange was left unimplemented rather than
// guessed at. scripts/verify-feed-sources.mjs hits all three for real and
// asserts every field these adapters read. Run it before trusting them.

function stripHtml(html) {
  // Mastodon serves post bodies as HTML. The feed renders text, and passing
  // provider HTML through would be an injection surface for anything the
  // client later renders unescaped — so it is flattened here, at the edge,
  // rather than trusted downstream.
  return String(html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MASTODON_HOST = process.env.MASTODON_INSTANCE || 'https://mastodon.social';

async function fetchMastodon(query, limit, cursor) {
  // Search needs an account on Mastodon; the public timeline does not. So a
  // query returns nothing rather than pretending, and the round-robin simply
  // gives its slot to a source that can answer.
  if (query) return { items: [], next: null };
  const params = new URLSearchParams({ limit: String(Math.min(limit, 40)) });
  if (cursor) params.set('max_id', cursor);
  const res = await axios.get(`${MASTODON_HOST}/api/v1/timelines/public?${params}`, {
    timeout: FEED_TIMEOUT, headers: { 'User-Agent': UA },
  });
  const rows = Array.isArray(res.data) ? res.data : [];
  return {
    items: rows.filter((t) => t && t.id).map((t) => ({
      id: String(t.id),
      platform: 'Mastodon',
      title: stripHtml(t.content).slice(0, 200) || '(no text)',
      url: t.url || t.uri,
      permalink: t.url || t.uri,
      snippet: stripHtml(t.content).slice(0, 400) || null,
      author: t.account?.acct ? `@${t.account.acct}` : null,
      subreddit: null,
      date: t.created_at || null,
      score: typeof t.favourites_count === 'number' ? t.favourites_count : null,
      comments: typeof t.replies_count === 'number' ? t.replies_count : null,
      thumbnail: t.media_attachments?.[0]?.preview_url || null,
      flair: null,
    })),
    // Mastodon pages by "older than this id", so the cursor is the last id seen.
    next: rows.length ? String(rows[rows.length - 1].id) : null,
  };
}

// Bluesky's public read API needs no auth at all for public data — a separate
// host from the authenticated one, precisely so anonymous reads are a supported
// use rather than a loophole. "What's Hot" is the network's own discovery feed.
const BSKY_PUBLIC = 'https://public.api.bsky.app/xrpc';
const BSKY_HOT = 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot';

async function fetchBluesky(query, limit, cursor) {
  const isSearch = Boolean(query);
  const params = new URLSearchParams(
    isSearch
      ? { q: query, limit: String(Math.min(limit, 50)) }
      : { feed: BSKY_HOT, limit: String(Math.min(limit, 50)) },
  );
  if (cursor) params.set('cursor', cursor);
  const path = isSearch ? 'app.bsky.feed.searchPosts' : 'app.bsky.feed.getFeed';
  const res = await axios.get(`${BSKY_PUBLIC}/${path}?${params}`, {
    timeout: FEED_TIMEOUT, headers: { 'User-Agent': UA },
  });
  // searchPosts returns `posts`; getFeed returns `feed` wrapping each post.
  const rows = isSearch
    ? (res.data?.posts || [])
    : (res.data?.feed || []).map((f) => f.post).filter(Boolean);
  return {
    items: rows.filter((p) => p && p.uri).map((p) => {
      // An at:// uri is not a link anybody can open. The web URL is built from
      // the author's handle plus the record key at the end of the uri.
      const rkey = String(p.uri).split('/').pop();
      const handle = p.author?.handle;
      const web = handle && rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : null;
      return {
        id: String(p.uri),
        platform: 'Bluesky',
        title: (p.record?.text || '').slice(0, 200) || '(no text)',
        url: web,
        permalink: web,
        snippet: (p.record?.text || '').slice(0, 400) || null,
        author: handle ? `@${handle}` : null,
        subreddit: null,
        date: p.record?.createdAt || p.indexedAt || null,
        score: typeof p.likeCount === 'number' ? p.likeCount : null,
        comments: typeof p.replyCount === 'number' ? p.replyCount : null,
        thumbnail: p.embed?.images?.[0]?.thumb || p.embed?.external?.thumb || null,
        flair: null,
      };
    }).filter((r) => r.url),
    next: res.data?.cursor || null,
  };
}

// Lemmy is the fediverse's Reddit: link aggregation, communities, scores — the
// same shape the feed already renders for Reddit, from a network that has not
// closed its API.
const LEMMY_HOST = process.env.LEMMY_INSTANCE || 'https://lemmy.world';

async function fetchLemmy(query, limit, cursor) {
  const page = Number.isInteger(cursor) ? cursor : 1;
  const params = new URLSearchParams(
    query
      ? { q: query, limit: String(limit), page: String(page), type_: 'All', listing_type: 'All' }
      : { limit: String(limit), page: String(page), sort: 'Hot', type_: 'All' },
  );
  const path = query ? 'search' : 'post/list';
  const res = await axios.get(`${LEMMY_HOST}/api/v3/${path}?${params}`, {
    timeout: FEED_TIMEOUT, headers: { 'User-Agent': UA },
  });
  const rows = (query ? res.data?.posts : res.data?.posts) || [];
  return {
    items: rows.filter((v) => v?.post?.id).map((v) => ({
      id: String(v.post.id),
      platform: 'Lemmy',
      title: v.post.name,
      // A Lemmy post either links out or is a self post; ap_id is always the
      // post itself, so it is the honest permalink either way.
      url: v.post.url || v.post.ap_id,
      permalink: v.post.ap_id,
      snippet: v.post.body ? String(v.post.body).slice(0, 400) : null,
      author: v.creator?.name ? `@${v.creator.name}` : null,
      // Lemmy communities read exactly like subreddits, and the card already
      // has a slot that renders one.
      subreddit: v.community?.name ? `c/${v.community.name}` : null,
      date: v.post.published || null,
      score: typeof v.counts?.score === 'number' ? v.counts.score : null,
      comments: typeof v.counts?.comments === 'number' ? v.counts.comments : null,
      thumbnail: v.post.thumbnail_url || null,
      flair: null,
    })),
    // Page-numbered, and a short page is the last one.
    next: rows.length === limit ? page + 1 : null,
  };
}

// ── the community pool, and why it is the floor under the whole feed ────────
//
// Every other source in this file is somebody else's server, and all of them
// can refuse us at once — Reddit already does from the deployment. This one is
// our own table (community_media, migration 018), submitted by people using the
// site, so it answers whenever Postgres does. It is what stops "every upstream
// is having a bad day" from rendering as an empty page.
//
// It is also the only lawful route to the platforms with no free read API at
// all: somebody drops a link, it renders through the platform's own embed, and
// the creator keeps their view. Nothing is copied or re-hosted.
function normaliseCommunity(rows) {
  return rows.map((r) => ({
    id: String(r.id),
    platform: 'Community',
    title: r.title || r.pageUrl,
    url: r.pageUrl,
    permalink: r.pageUrl,
    snippet: null,
    // The PLATFORM it came from, which is the honest "who" here — a submitted
    // link has a submitter, but naming them would turn an anonymous
    // contribution into an attributed one.
    author: r.platform || null,
    subreddit: null,
    date: null,
    score: null,
    comments: null,
    thumbnail: r.poster || null,
    flair: r.kind || null,
  }));
}

async function fetchCommunity(query, limit, cursor) {
  const MediaService = require('../services/MediaService');
  const offset = Number.isInteger(cursor) ? cursor : 0;
  const rows = query
    ? await MediaService.search({ q: query, limit })
    : await MediaService.list({ limit, offset, sort: 'new' });
  return {
    items: normaliseCommunity(rows || []),
    // A short page is the last page. Search has no offset paging at all, so it
    // reports itself exhausted rather than repeating.
    next: !query && (rows || []).length === limit ? offset + limit : null,
  };
}

async function fetchReddit(query, limit, after) {
  const params = query
    ? new URLSearchParams({ q: query, sort: 'hot', limit, type: 'link', t: 'week' })
    : new URLSearchParams({ limit });
  if (after) params.set('after', after);
  // /hot.json is the keyless popular listing — the honest stand-in for a home
  // feed until a token can ask for the real one.
  const path = query ? 'search.json' : 'hot.json';

  const tried = [];
  for (const host of REDDIT_HOSTS) {
    try {
      const res = await axios.get(`${host}/${path}?${params}`, {
        timeout: FEED_TIMEOUT,
        // Reddit 429s a default user agent almost immediately. This header is
        // the only reason any of this works unauthenticated.
        headers: { 'User-Agent': UA },
      });
      return {
        items: normaliseReddit(res.data?.data?.children?.map((c) => c.data) || [], query),
        next: res.data?.data?.after || null,
      };
    } catch (err) {
      tried.push(`${new URL(host).host}: ${upstreamReason(err)}`);
    }
  }
  // Carries WHICH host said WHAT. "Reddit unavailable" on its own cannot tell
  // a blocked deployment IP from an outage from a bad query, and that
  // difference is the whole diagnosis.
  const err = new Error(`Reddit unreachable — ${tried.join(' · ')}`);
  err.attempts = tried;
  throw err;
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
 * platforms defaults to every source below when omitted or ['all']:
 * reddit, hackernews, github, news (Google News RSS, keyless) and community
 * (our own submitted-media pool, which answers whenever Postgres does).
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
    const [redditResult, hnResult, ghResult, newsResult, communityResult,
           mastodonResult, blueskyResult, lemmyResult] = await Promise.allSettled([
      want('reddit') ? fetchReddit(q, limit, cur.reddit) : Promise.resolve(NONE),
      want('hackernews') ? fetchHackerNews(q, limit, cur.hackernews) : Promise.resolve(NONE),
      want('github') ? fetchGitHub(q, limit, cur.github) : Promise.resolve(NONE),
      want('news') ? fetchNews(q, limit, cur.news) : Promise.resolve(NONE),
      want('community') ? fetchCommunity(q, limit, cur.community) : Promise.resolve(NONE),
      want('mastodon') ? fetchMastodon(q, limit, cur.mastodon) : Promise.resolve(NONE),
      want('bluesky') ? fetchBluesky(q, limit, cur.bluesky) : Promise.resolve(NONE),
      want('lemmy') ? fetchLemmy(q, limit, cur.lemmy) : Promise.resolve(NONE),
    ]);

    const settle = (r) => (r.status === 'fulfilled' ? r.value : NONE);
    const reddit = settle(redditResult).items;
    const hackernews = settle(hnResult).items;
    const github = settle(ghResult).items;
    const news = settle(newsResult).items;
    const community = settle(communityResult).items;
    const mastodon = settle(mastodonResult).items;
    const bluesky = settle(blueskyResult).items;
    const lemmy = settle(lemmyResult).items;

    if (redditResult.status === 'rejected') logger.warn('Reddit feed failed:', redditResult.reason?.message);
    if (hnResult.status === 'rejected') logger.warn('HN feed failed:', hnResult.reason?.message);
    if (ghResult.status === 'rejected') logger.warn('GitHub feed failed:', ghResult.reason?.message);
    if (newsResult.status === 'rejected') logger.warn('News feed failed:', newsResult.reason?.message);
    if (communityResult.status === 'rejected') logger.warn('Community feed failed:', communityResult.reason?.message);
    if (mastodonResult.status === 'rejected') logger.warn('Mastodon feed failed:', mastodonResult.reason?.message);
    if (blueskyResult.status === 'rejected') logger.warn('Bluesky feed failed:', blueskyResult.reason?.message);
    if (lemmyResult.status === 'rejected') logger.warn('Lemmy feed failed:', lemmyResult.reason?.message);

    // Merged chronological feed across all platforms
    const all_results = [...reddit, ...hackernews, ...github, ...news, ...community,
      ...mastodon, ...bluesky, ...lemmy].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    });

    return res.json({
      query: q,
      results: all_results,
      platforms: { reddit, hackernews, github, news, community, mastodon, bluesky, lemmy },
      // What to send back to continue. A platform that has run out reports
      // null, which is how the client knows to stop asking rather than
      // spinning on an endpoint that will keep returning the same page.
      nextCursor: {
        reddit: settle(redditResult).next,
        hackernews: settle(hnResult).next,
        github: settle(ghResult).next,
        news: settle(newsResult).next,
        community: settle(communityResult).next,
        mastodon: settle(mastodonResult).next,
        bluesky: settle(blueskyResult).next,
        lemmy: settle(lemmyResult).next,
      },
      // WHY, not just THAT.
      //
      // This used to say 'unavailable' for every kind of failure, and the
      // client threw the field away entirely — so a platform being blocked, a
      // platform timing out and a platform genuinely having no posts all
      // looked identical from the outside: an empty feed and no explanation.
      // That is what "the feed won't load" was, and it is unfixable from a
      // screenshot when the only symptom is nothing.
      errors: {
        reddit: redditResult.status === 'rejected' ? (redditResult.reason?.message || 'unavailable') : null,
        hackernews: hnResult.status === 'rejected' ? (hnResult.reason?.message || 'unavailable') : null,
        github: ghResult.status === 'rejected' ? (ghResult.reason?.message || 'unavailable') : null,
        news: newsResult.status === 'rejected' ? (newsResult.reason?.message || 'unavailable') : null,
        community: communityResult.status === 'rejected' ? (communityResult.reason?.message || 'unavailable') : null,
        mastodon: mastodonResult.status === 'rejected' ? (mastodonResult.reason?.message || 'unavailable') : null,
        bluesky: blueskyResult.status === 'rejected' ? (blueskyResult.reason?.message || 'unavailable') : null,
        lemmy: lemmyResult.status === 'rejected' ? (lemmyResult.reason?.message || 'unavailable') : null,
      },
    });
  } catch (error) {
    logger.error('Social feed error:', error);
    return res.status(500).json({ error: 'Social feed unavailable', details: 'Service error' });
  }
});

module.exports = router;