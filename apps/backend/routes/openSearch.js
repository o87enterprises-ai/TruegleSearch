// Keyless open search (services/openSearch): feature -> its own providers. No keys, no SearXNG.
//   GET /api/open-search/health          provider status per feature (counts only, no secrets)
//   GET /api/open-search/:feature?q=&limit=   feature = video | audio | social
// Queries are never logged here (the provider-failure warning carries no query text).
const express = require('express');
const OpenSearch = require('../services/openSearch');

const router = express.Router();

router.get('/health', (req, res) => res.json({ features: OpenSearch.stats() }));

router.get('/:feature', async (req, res) => {
  const { feature } = req.params;
  if (!OpenSearch.FEATURES[feature]) return res.status(404).json({ error: 'unknown feature', features: Object.keys(OpenSearch.FEATURES) });
  const q = String(req.query.q || '').trim();
  if (!q || q.length > 200) return res.status(400).json({ error: 'q required (1-200 chars)' });
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 25);
  const safe = req.query.safeSearch !== 'off';
  // Dedicated endpoint, not on the main search path: slow-on-cold providers (Openverse ~6s) get more time.
  const { items, report, answered } = await OpenSearch.search(feature, q, { limit, safe, deadlineMs: 8000 });
  res.set('Cache-Control', 'private, max-age=300'); // visitor's own browser only: queries stay out of shared caches
  return res.json({ feature, count: items.length, answered, providers: report, results: items });
});

module.exports = router;
