const express = require('express');
const router = express.Router();
const { inspect } = require('../services/LinkInspector');
const { rateLimitSearch } = require('../middleware/rateLimit');
const { createTtlCache } = require('../utils/ttlCache');

// A repeat check of the same link is free, and a pasted link is usually checked
// twice (once to look, once after the user changes their mind).
const cache = createTtlCache({ ttlMs: 10 * 60 * 1000, max: 300 });

/**
 * POST /api/link/inspect  { url }
 *
 * Reads a link on the visitor's behalf so the app can say, BEFORE opening it
 * in-app: where it really goes, whether it is a page or a download, and whether
 * the site allows being shown inside Truegle. See services/LinkInspector.js for
 * what that can and cannot prove.
 *
 * Deliberately NOT logged: the URL. The request line lands in the host's runtime
 * logs, and what somebody looked at is exactly what this product does not keep.
 */
router.post('/inspect', rateLimitSearch, async (req, res) => {
  const raw = req.body && req.body.url;
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 2048) {
    return res.status(400).json({ error: 'url is required (max 2048 characters)' });
  }
  let url = raw.trim();
  if (/\s/.test(url)) return res.status(400).json({ error: 'not a link' });
  // Only web links. Anything else (javascript:, data:, file:, ftp:) is refused
  // here rather than handed to the fetcher to refuse.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^https?:\/\//i.test(url)) {
    return res.json({ ok: false, reason: 'refused' });
  }
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  const hit = cache.get(url);
  if (hit) return res.json(hit);
  const result = await inspect(url);
  // An unreachable site may come back in a minute; only real answers are cached.
  if (result.ok) cache.set(url, result);
  return res.json(result);
});

module.exports = router;
