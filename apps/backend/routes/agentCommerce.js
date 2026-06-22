/**
 * Agent Commerce Network routes (scaffold).
 *
 * Two auth worlds meet here: human JWT auth (`authenticate`, from the
 * existing login system) governs identity/merchant management — registering
 * as an agent, issuing keys, and listing your own products. Agent API key
 * auth (`agentKeyAuth`) governs the buyer-agent-facing endpoints those keys
 * are for — search, streaming updates, and checkout.
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { agentKeyAuth, agentKeyIdentifyOnly } = require('../middleware/agentQuota');
const AgentCommerceService = require('../services/AgentCommerceService');

/**
 * POST /api/agent/register
 * Opt an existing human user into the agent commerce network. Idempotent —
 * returns the existing identity if one already exists for this user.
 */
router.post('/register', authenticate, async (req, res) => {
  try {
    const { displayName } = req.body;
    const identity = await AgentCommerceService.registerAgent(req.user.userId, displayName);
    res.json({ success: true, data: identity });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to register agent identity' });
  }
});

/**
 * POST /api/agent/keys
 * Issue the first API key for the calling user's agent identity (registers
 * one if it doesn't exist yet). The raw key is returned ONCE here — only its
 * hash is stored, so losing it means issuing a new one.
 * Body: { tier?: 'free' | 'pro' }
 */
router.post('/keys', authenticate, async (req, res) => {
  try {
    const identity = await AgentCommerceService.registerAgent(req.user.userId);
    const { rawKey, record } = await AgentCommerceService.issueApiKey(identity.did, req.body.tier || 'free');
    res.json({ success: true, data: { apiKey: rawKey, ...record } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Failed to issue API key' });
  }
});

/**
 * POST /api/agent/products/ingest
 * Merchant (an existing agent identity owned by req.user) lists products.
 * Body: { products: [{ title, description, priceAmount, priceCurrency,
 *                       category, stockProof, attributes }, ...] }
 */
router.post('/products/ingest', authenticate, async (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, message: 'products array is required' });
    }

    const identity = await AgentCommerceService.registerAgent(req.user.userId);
    const inserted = await AgentCommerceService.ingestProducts(products, identity.did);
    res.json({ success: true, data: inserted });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to ingest products' });
  }
});

/**
 * GET /api/agent/products?page=1&limit=20
 * Browse the catalog. Requires a valid agent API key + quota.
 */
router.get('/products', agentKeyAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const products = await AgentCommerceService.listProducts({ page, limit });
    res.json({ success: true, data: products, quotaRemaining: req.agentKey.quota_remaining });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to list products' });
  }
});

/**
 * POST /api/agent/embeddings/search
 * Body: { query: string, topK?: number }
 * Semantic search over the product catalog. Requires a valid agent API key + quota.
 */
router.post('/embeddings/search', agentKeyAuth, async (req, res) => {
  try {
    const { query: queryText, topK } = req.body;
    if (!queryText || typeof queryText !== 'string') {
      return res.status(400).json({ success: false, message: 'query string is required' });
    }

    const results = await AgentCommerceService.searchProducts(queryText, topK || 10);
    res.json({ success: true, data: results, quotaRemaining: req.agentKey.quota_remaining });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to search products' });
  }
});

/**
 * GET /api/agent/products/stream
 * Server-Sent Events feed of catalog changes since the client's last seen
 * timestamp (?since=ISO8601). Requires a valid agent API key + quota.
 *
 * NOT compatible with serverless (Vercel) deployment — SSE needs a long-lived
 * connection held open by setInterval, which a serverless function instance
 * cannot guarantee across polls. This works under a long-running Node process
 * (e.g. local dev, a VM, or a container) only. See HANDOFF.md.
 */
router.get('/products/stream', agentKeyAuth, (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  let since = req.query.since || new Date().toISOString();

  const tick = async () => {
    try {
      const updates = await AgentCommerceService.getRecentlyUpdated(since, 50);
      if (updates.length > 0) {
        since = updates[updates.length - 1].updated_at;
        res.write(`data: ${JSON.stringify(updates)}\n\n`);
      }
    } catch (error) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'stream error' })}\n\n`);
    }
  };

  const interval = setInterval(tick, 2000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

/**
 * GET /api/agent/sitemap/products.json
 * Public lightweight index of product ids + last-updated timestamps, so
 * agents/crawlers can discover what to fetch without spending quota.
 */
router.get('/sitemap/products.json', async (req, res) => {
  try {
    const sitemap = await AgentCommerceService.getProductIdSitemap();
    res.json({ success: true, data: sitemap });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to build product sitemap' });
  }
});

/**
 * POST /api/agent/transact
 * Body: { cart: [{ productId, quantity }, ...] }
 * Records a transaction intent. Requires a valid agent API key + quota.
 * Does not move money — see AgentCommerceService.createTransaction.
 */
router.post('/transact', agentKeyAuth, async (req, res) => {
  try {
    const { cart } = req.body;
    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({ success: false, message: 'cart array is required' });
    }

    const transaction = await AgentCommerceService.createTransaction(req.agentKey.agent_did, cart);
    res.json({ success: true, data: transaction, quotaRemaining: req.agentKey.quota_remaining });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create transaction' });
  }
});

/**
 * POST /api/agent/purchase-key
 * Body: { tier: 'free' | 'pro' }
 * Upgrade path for an agent that just hit its 402 quota wall. Uses
 * agentKeyIdentifyOnly (not agentKeyAuth) precisely so an exhausted key can
 * still reach this endpoint.
 * TODO: not wired to real payment yet — issues the new tier's key for free.
 */
router.post('/purchase-key', agentKeyIdentifyOnly, async (req, res) => {
  try {
    const { tier } = req.body;
    const { rawKey, record } = await AgentCommerceService.upgradeKey(req.agentKey.agent_did, tier || 'pro');
    res.json({ success: true, data: { apiKey: rawKey, ...record } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || 'Failed to issue upgraded key' });
  }
});

module.exports = router;
