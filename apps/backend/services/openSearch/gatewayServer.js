/**
 * The HTTP face of the open-search pool, run INSIDE the Hugging Face Space
 * (services/search-gateway/). The Vercel backend calls it as a FALLBACK tier for
 * providers that failed or are cooling down, so those requests leave from a
 * different IP and failure domain (shared-IP throttling, e.g. iTunes 403, is
 * exactly what this routes around).
 *
 *   GET  /health                 unauthenticated; says only whether it is configured
 *   POST /search/:feature        Bearer SEARCH_GATEWAY_TOKEN
 *        body { q, limit?, safe?, providers?[], deadlineMs? }
 *
 * POST + JSON body on purpose: a search query must never sit in a URL, where
 * platform access logs and proxies keep it. The server logs no request content.
 * With no token set it answers 503 to everything but /health: it will not run as
 * an open public search proxy.
 */
const crypto = require('crypto');
const express = require('express');
const OpenSearch = require('./index');

const clamp = (n, lo, hi, dflt) => { const v = Number(n); return Number.isFinite(v) ? Math.min(Math.max(Math.round(v), lo), hi) : dflt; };

function createApp({ token = process.env.SEARCH_GATEWAY_TOKEN } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '4kb' }));

  app.get('/health', (req, res) => res.json({ ok: true, configured: !!token, features: Object.keys(OpenSearch.FEATURES) }));

  const auth = (req, res, next) => {
    if (!token) return res.status(503).json({ error: 'gateway not configured' });
    const got = Buffer.from(String(req.get('authorization') || ''));
    const want = Buffer.from(`Bearer ${token}`);
    if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return res.status(401).json({ error: 'unauthorised' });
    return next();
  };

  app.post('/search/:feature', auth, async (req, res) => {
    const { feature } = req.params;
    const spec = OpenSearch.FEATURES[feature];
    if (!spec) return res.status(404).json({ error: 'unknown feature', features: Object.keys(OpenSearch.FEATURES) });
    const body = req.body || {};
    const q = typeof body.q === 'string' ? body.q.trim() : '';
    if (!q || q.length > 200) return res.status(400).json({ error: 'q required (1-200 chars)' });
    const only = Array.isArray(body.providers) ? body.providers.filter((p) => spec.providers.includes(p)) : null;
    if (only && !only.length) return res.status(400).json({ error: 'no known providers requested', providers: spec.providers });
    const { items, report, answered } = await OpenSearch.search(feature, q, {
      limit: clamp(body.limit, 1, 25, 10),
      safe: body.safe !== false,
      only,
      deadlineMs: clamp(body.deadlineMs, 1000, 8000, 4500),
      allowGateway: false, // never call ourselves: the gateway is a leaf, not a hop
    });
    res.set('Cache-Control', 'no-store');
    return res.json({ feature, count: items.length, answered, providers: report, results: items });
  });

  return app;
}

module.exports = { createApp };
