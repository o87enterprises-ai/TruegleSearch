/**
 * Cloudflare Worker edition of the search gateway (replaces the Hugging Face Space, which now needs a paid plan).
 * Same HTTP contract as apps/backend/services/openSearch/gatewayServer.js, so the Vercel backend's
 * gateway.js client works unchanged: set SEARCH_GATEWAY_URL to this Worker's URL and SEARCH_GATEWAY_TOKEN.
 *
 *   GET  /health                 unauthenticated; says only whether a token is configured
 *   POST /search/:feature        Bearer SEARCH_GATEWAY_TOKEN, body { q, limit?, safe?, providers?[], deadlineMs? }
 *
 * The pool + adapters are imported from the backend source (single source of truth). `axios` and the winston
 * logger are swapped for tiny stand-ins by wrangler.toml [alias]. No request content is ever logged.
 */
import OpenSearch from '../../apps/backend/services/openSearch/index.js';

const clamp = (n, lo, hi, dflt) => { const v = Number(n); return Number.isFinite(v) ? Math.min(Math.max(Math.round(v), lo), hi) : dflt; };
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

/** Constant-time string compare (no node:crypto needed). */
function safeEqual(a, b) {
  const x = new TextEncoder().encode(String(a)); const y = new TextEncoder().encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const token = env.SEARCH_GATEWAY_TOKEN;

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, configured: !!token, runtime: 'cloudflare-worker', features: Object.keys(OpenSearch.FEATURES) });
    }

    const m = url.pathname.match(/^\/search\/([a-z]+)$/);
    if (!m || request.method !== 'POST') return json({ error: 'not found' }, 404);

    if (!token) return json({ error: 'gateway not configured' }, 503);
    if (!safeEqual(request.headers.get('authorization') || '', `Bearer ${token}`)) return json({ error: 'unauthorised' }, 401);

    const feature = m[1];
    const spec = OpenSearch.FEATURES[feature];
    if (!spec) return json({ error: 'unknown feature', features: Object.keys(OpenSearch.FEATURES) }, 404);

    const raw = await request.text();
    if (raw.length > 4096) return json({ error: 'body too large' }, 413);
    let body;
    try { body = raw ? JSON.parse(raw) : {}; } catch { return json({ error: 'invalid json' }, 400); }

    const q = typeof body.q === 'string' ? body.q.trim() : '';
    if (!q || q.length > 200) return json({ error: 'q required (1-200 chars)' }, 400);
    const only = Array.isArray(body.providers) ? body.providers.filter((p) => spec.providers.includes(p)) : null;
    if (only && !only.length) return json({ error: 'no known providers requested', providers: spec.providers }, 400);

    // Pool reads OPEN_SEARCH_DISABLE from process.env; mirror the Worker var into it.
    if (typeof process !== 'undefined' && process.env) process.env.OPEN_SEARCH_DISABLE = env.OPEN_SEARCH_DISABLE || '';

    const { items, report, answered } = await OpenSearch.search(feature, q, {
      limit: clamp(body.limit, 1, 25, 10),
      safe: body.safe !== false,
      only,
      deadlineMs: clamp(body.deadlineMs, 1000, 8000, 4500),
      allowGateway: false, // a leaf, never a hop
    });
    return json({ feature, count: items.length, answered, providers: report, results: items });
  },
};
