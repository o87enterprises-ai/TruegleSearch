import express from 'express';
import {
  cache,
  context,
  createServer,
  getServerPort,
  reddit,
} from '@devvit/web/server';

/*
 * Truegle Search, as a Reddit post.
 *
 * WHY THE SERVER EXISTS AT ALL. A Devvit web view cannot fetch an external
 * domain from the client — client-side fetch may only call the app's own
 * `/api/*` endpoints. External calls happen here, from the server, and only to
 * hostnames allow-listed in devvit.json. So this file is the whole seam
 * between a Reddit post and Truegle's search API, and it is deliberately the
 * only place that knows the API exists.
 *
 * WHAT IT DELIBERATELY DOES NOT DO:
 *   - It sends nothing about the redditor. No username, no user ID, no post ID,
 *     no IP forwarding, no cookies. Truegle's API is called with a query and
 *     nothing else, which is the same promise the website makes.
 *   - It sets no cookies and stores nothing. `redis` is off in devvit.json
 *     because there is nothing worth keeping between searches.
 *   - It never returns a link back to truegle.com. See client/index.html.
 */

// Allow-listed in devvit.json. Both lists have to agree or the fetch is
// blocked at runtime, so the test asserts they do.
//
// WHY THE NAMED HOST AND NOT THE RAW DEPLOYMENT URL. Devvit's fetch policy
// approves "APIs that provide data or specific services" with a publicly
// documented and publicly accessible API, and refuses personal servers. A bare
// *.vercel.app deployment hostname reads as the second no matter what it
// serves. api.truegle.info, documented at truegle.info/developers, is the
// first. Same backend either way — this is about what the request looks like
// to the person reviewing it, and the reviewer is right to care.
const TRUEGLE_API = 'https://api.truegle.info';

// Truegle's own timeout budget, minus a margin. Devvit kills a fetch at 30s and
// reports it as a context deadline, which reads like an app bug rather than a
// slow upstream — better to give up first and say so in words.
const UPSTREAM_TIMEOUT_MS = 20_000;

const app = express();
app.use(express.json());

const router = express.Router();

/**
 * Search.
 *
 * The response is trimmed to the five fields the post actually renders. That
 * is not premature tidiness: the upstream payload carries an instant answer,
 * per-provider metadata and a provenance watermark, and shipping all of it into
 * a web view would be handing a Reddit post more than it needs.
 */
router.post('/api/search', async (req, res) => {
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
  if (!query) {
    res.status(400).json({ status: 'error', message: 'Type something to search for.' });
    return;
  }
  // Long queries are a paste accident far more often than a real search, and
  // the upstream rejects them anyway.
  if (query.length > 300) {
    res.status(400).json({ status: 'error', message: 'That query is too long.' });
    return;
  }

  try {
    // CACHED, AND SHARED. The cache helper picks one reader to make the real
    // call and hands the answer to everyone else asking the same thing — which
    // is exactly right here and would be exactly wrong for anything personal.
    // A search post in a busy community can otherwise turn one popular query
    // into hundreds of identical upstream calls.
    const results = await cache(
      async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
        try {
          const upstream = await fetch(`${TRUEGLE_API}/api/search`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // SAY WHO WE ARE. Truegle blocks undeclared automation on this
              // endpoint, and the Devvit runtime's fetch sends no User-Agent —
              // which without this header reads as an anonymous scraper and
              // lands in a five-per-minute throttle shared by every reader of
              // every post. Declared clients get the documented API ceiling
              // instead. See https://truegle.info/developers.
              'X-Truegle-Client': 'truegle-reddit',
            },
            // `blue-pill` is Truegle's mainstream lens. The other lenses are
            // the site's thing, not this post's — one box, one behaviour.
            body: JSON.stringify({ query, mode: 'blue-pill', filters: {} }),
            signal: controller.signal,
          });
          if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
          const data = await upstream.json();
          return (Array.isArray(data.results) ? data.results : [])
            .slice(0, 20)
            .map((r) => ({
              title: String(r?.title || '').slice(0, 300),
              url: String(r?.url || ''),
              snippet: String(r?.snippet || '').slice(0, 500),
              source: String(r?.source || ''),
              date: r?.date || null,
            }))
            .filter((r) => r.url.startsWith('https://') || r.url.startsWith('http://'));
        } finally {
          clearTimeout(timer);
        }
      },
      // Keyed on the query alone, lowercased — the cache is shared across every
      // reader of every install, so it must not be keyed on anything that
      // identifies one of them.
      { key: `q:${query.toLowerCase()}`, ttl: 300 },
    );

    res.json({ status: 'ok', query, results });
  } catch (error) {
    // The reason goes to app logs, not to the post. An upstream error message
    // can carry internal detail and a Reddit post is a public surface.
    console.error('search failed:', error instanceof Error ? error.message : error);
    res.status(502).json({
      status: 'error',
      message: 'Search is not answering right now. Try again in a moment.',
    });
  }
});

/**
 * The moderator menu item that puts a search post in a community.
 */
router.post('/internal/menu/create-post', async (_req, res) => {
  try {
    const post = await reddit.submitCustomPost({
      subredditName: context.subredditName,
      title: 'Truegle — search the web without being tracked',
      splash: {
        appDisplayName: 'Truegle',
        heading: 'Search, right here',
        description: 'A private web search you can run without leaving the thread.',
        buttonLabel: 'Open search',
      },
    });
    res.json({ navigateTo: `https://reddit.com${post.permalink}` });
  } catch (error) {
    console.error('create-post failed:', error instanceof Error ? error.message : error);
    res.status(500).json({ showToast: 'Could not create the post.' });
  }
});

app.use(router);

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(getServerPort());
