const express = require('express');

const router = express.Router();
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { rateLimitSearch } = require('../middleware/rateLimit');
const { MediaService } = require('../services/MediaService');
const OembedService = require('../services/OembedService');

const ERRORS = {
  INVALID: 400,
  UNAUTHENTICATED: 401,
  UNSUPPORTED: 422,
  NOT_FOUND: 404,
};

function mapError(err, res) {
  const status = ERRORS[err && err.code];
  if (status) return res.status(status).json({ error: err.message, code: err.code });
  logger.error('Media route error:', { error: err && err.message });
  return res.status(500).json({ error: 'Something went wrong with that link.' });
}

/**
 * GET /api/media/search?q=…&limit=12
 * PUBLIC — this is the half that makes a submission worth making: once one
 * person adds a link, everyone can find it, by title or by the link itself.
 */
router.get('/search', async (req, res) => {
  try {
    const results = await MediaService.search({ q: req.query.q, limit: req.query.limit });
    return res.json({ success: true, results });
  } catch (err) {
    return mapError(err, res);
  }
});

/**
 * GET /api/media?limit=24&offset=0&sort=new|played
 *
 * THE ANONYMOUS FEED. Everything anyone has submitted, browsable by anybody,
 * with no account and nothing to type.
 *
 * Submitting requires a signed-in account (see POST below) because a write
 * every visitor can then play is an open door for spam. READING requires
 * nothing, and that asymmetry is the whole point: participation never depends
 * on being identifiable.
 *
 * This endpoint existed and no client called it, so a submitted link was
 * invisible until somebody guessed its title into the search box — the pool
 * was write-only in practice. `offset` is what makes it a feed rather than a
 * single page of samples.
 */
router.get('/', async (req, res) => {
  try {
    const results = await MediaService.list({
      limit: req.query.limit, offset: req.query.offset, sort: req.query.sort,
    });
    return res.json({ success: true, results });
  } catch (err) {
    return mapError(err, res);
  }
});

/**
 * POST /api/media  { url, title? }
 * SIGNED IN ONLY. A submission becomes playable for every visitor, so it is
 * attributable: `authenticate` (not optionalAuth) rejects anonymous writes,
 * and community_media.submitted_by is NOT NULL behind it.
 *
 * Nothing is uploaded — the link is classified and stored, and the media plays
 * from its original platform so the creator keeps their views.
 */
router.post('/', authenticate, rateLimitSearch, async (req, res) => {
  try {
    const { url, title } = req.body || {};
    const userId = req.user && req.user.userId;
    const media = await MediaService.submit({ url, title, userId });
    return res.json({ success: true, media });
  } catch (err) {
    return mapError(err, res);
  }
});

/**
 * POST /api/media/signal  { key, from, to, play?, kind?, title?, … }
 * PUBLIC AND ANONYMOUS BY DESIGN. A thumb is a counter bump against a video,
 * with no user, session or IP recorded — the visitor's own taste profile never
 * leaves their browser. Rate-limited so the counters cost something to game.
 * Always 200s: a lost vote must never interrupt playback.
 */
router.post('/signal', rateLimitSearch, async (req, res) => {
  const result = await MediaService.signal(req.body || {});
  return res.json({ success: true, ...result });
});

/**
 * GET /api/media/trending?limit=20&exclude=key1,key2&offset=0
 * The aggregate pool every visitor draws on before they have a taste of their
 * own. `exclude` drops what they have already seen this session; `offset`
 * reaches past the head, which is what the player's exploration path uses to
 * find organic clips the score ordering would otherwise never surface.
 */
router.get('/trending', async (req, res) => {
  const exclude = String(req.query.exclude || '').split(',').filter(Boolean);
  const results = await MediaService.trending({
    limit: req.query.limit, exclude, offset: req.query.offset,
  });
  return res.json({ success: true, results });
});

/**
 * POST /api/media/scores  { keys: [...] }
 * Truegle's own popularity for a batch of media keys, for the Tube results'
 * "Popular" sort. POST rather than GET because a page of results is well past
 * what belongs in a query string. Keys absent from the reply have no signal —
 * that is not the same as zero, and callers must not treat it as such.
 */
router.post('/scores', rateLimitSearch, async (req, res) => {
  const scores = await MediaService.scores((req.body || {}).keys);
  return res.json({ success: true, scores });
});

/**
 * GET /api/media/broken
 * The keys the player should not offer: things enough people (or the embed
 * itself) reported as unplayable. Keys only — no metadata, because every
 * visitor fetches this.
 */
/**
 * GET  /api/media/titles?u=…&u=…
 * POST /api/media/titles   { urls: [...] }
 *
 * PUBLIC. Titles for links that only carry an id — see OembedService for why
 * this is a server route rather than a fetch from the page (privacy first, and
 * the CSP second). Rate-limited because it makes outbound requests on the
 * caller's behalf; the allowlist in the service is what stops it being a way
 * to fetch anything else.
 *
 * Both verbs exist because a packed queue can carry 25 URLs, which is past
 * what belongs in a query string.
 */
async function titlesHandler(urls, res) {
  try {
    const found = await OembedService.lookupMany(urls);
    // Cache at the edge too. A title does not change, and a shared playlist is
    // opened by many people from one link.
    res.set('Cache-Control', 'public, max-age=21600');
    return res.json({ titles: found });
  } catch (err) {
    return mapError(err, res);
  }
}

router.get('/titles', rateLimitSearch, async (req, res) => {
  const raw = req.query.u;
  const urls = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  return titlesHandler(urls, res);
});

router.post('/titles', rateLimitSearch, async (req, res) => {
  const urls = Array.isArray(req.body?.urls) ? req.body.urls : [];
  return titlesHandler(urls, res);
});

router.get('/broken', async (req, res) => {
  const keys = await MediaService.brokenKeys({ limit: req.query.limit });
  return res.json({ success: true, keys });
});

/**
 * GET /api/media/resolve?url=…
 * A pasted link's real title, artist and artwork via the platform's own public
 * oEmbed. Keyless and free. The URL is classified BEFORE any fetch, so this
 * can only ever reach hosts the player already accepts — it is not a general
 * URL fetcher.
 */
router.get('/resolve', rateLimitSearch, async (req, res) => {
  try {
    const media = await MediaService.resolveLink(req.query.url);
    return res.json({ success: true, media });
  } catch (err) {
    return mapError(err, res);
  }
});

/** POST /api/media/:id/play — best-effort popularity signal for ordering. */
router.post('/:id/play', async (req, res) => {
  await MediaService.countPlay(req.params.id);
  return res.json({ success: true });
});

/** POST /api/media/:id/report — soft moderation, see MediaService.report. */
router.post('/:id/report', rateLimitSearch, async (req, res) => {
  try {
    const result = await MediaService.report(req.params.id);
    return res.json({ success: true, ...result });
  } catch (err) {
    return mapError(err, res);
  }
});

module.exports = router;
