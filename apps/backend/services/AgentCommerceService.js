/**
 * AgentCommerceService - AI Agent Commerce Network (scaffold)
 *
 * Lets AI agents (not just human browsers) discover and "buy" products listed
 * by Truegle merchants via a quota-gated API: register an agent identity tied
 * to an existing human user, issue an API key, search a semantically-indexed
 * product catalog, and record a transaction. See HANDOFF.md for what's real
 * vs. stubbed in this scaffold.
 */

const crypto = require('crypto');
const { query } = require('../db/connection');
const AgentEmbeddingService = require('./AgentEmbeddingService');

const TIERS = {
  free: { quotaLimit: 1000, windowMs: 24 * 60 * 60 * 1000 }, // 1,000 / day
  pro: { quotaLimit: 1000000, windowMs: 30 * 24 * 60 * 60 * 1000 }, // 1M / 30 days
};

const MAX_SEARCH_CANDIDATES = 500;
const API_KEY_PREFIX = 'tgak';

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

class AgentCommerceService {
  /**
   * Create (or return existing) agent identity for a human user.
   */
  static async registerAgent(userId, displayName) {
    const existing = await query('SELECT * FROM agent_identities WHERE user_id = $1', [userId]);
    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    const did = `did:truegle:${crypto.randomUUID()}`;
    const result = await query(
      `INSERT INTO agent_identities (did, user_id, display_name)
       VALUES ($1, $2, $3) RETURNING *`,
      [did, userId, displayName || null]
    );
    return result.rows[0];
  }

  /**
   * Issue a new API key for an agent identity. Returns the raw key ONCE —
   * only its hash is ever persisted, so it cannot be recovered later.
   */
  static async issueApiKey(agentDid, tier = 'free') {
    const tierConfig = TIERS[tier];
    if (!tierConfig) {
      throw new Error(`Unknown tier: ${tier}`);
    }

    const rawKey = `${API_KEY_PREFIX}_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, 12);
    const resetAt = new Date(Date.now() + tierConfig.windowMs);

    const result = await query(
      `INSERT INTO agent_api_keys
         (key_hash, key_prefix, agent_did, tier, quota_limit, quota_remaining, reset_at)
       VALUES ($1, $2, $3, $4, $5, $5, $6)
       RETURNING id, key_prefix, agent_did, tier, quota_limit, quota_remaining, reset_at, created_at`,
      [keyHash, keyPrefix, agentDid, tier, tierConfig.quotaLimit, resetAt]
    );

    return { rawKey, record: result.rows[0] };
  }

  /**
   * Look up an active key record by the raw key a caller presented. Resets
   * the quota window if it has lapsed (mirrors User.hasSearchQuota's
   * reset-on-read pattern) before returning.
   */
  static async findKeyByRawValue(rawKey) {
    if (!rawKey || !rawKey.startsWith(`${API_KEY_PREFIX}_`)) return null;

    const keyHash = hashKey(rawKey);
    const result = await query(
      `SELECT * FROM agent_api_keys WHERE key_hash = $1 AND revoked_at IS NULL`,
      [keyHash]
    );
    if (result.rows.length === 0) return null;

    let record = result.rows[0];
    if (new Date(record.reset_at) <= new Date()) {
      const tierConfig = TIERS[record.tier] || TIERS.free;
      const resetAt = new Date(Date.now() + tierConfig.windowMs);
      const updated = await query(
        `UPDATE agent_api_keys SET quota_remaining = $1, reset_at = $2 WHERE id = $3 RETURNING *`,
        [tierConfig.quotaLimit, resetAt, record.id]
      );
      record = updated.rows[0];
    }

    return record;
  }

  /**
   * Decrement remaining quota by 1. Caller must have already checked
   * quota_remaining > 0.
   */
  static async consumeQuota(keyRecord) {
    const result = await query(
      `UPDATE agent_api_keys SET quota_remaining = quota_remaining - 1
       WHERE id = $1 RETURNING quota_remaining`,
      [keyRecord.id]
    );
    return result.rows[0].quota_remaining;
  }

  /**
   * Shape of the 402 body returned when a key's quota is exhausted.
   */
  static quotaExceededResponse(keyRecord) {
    return {
      error: 'Quota exceeded',
      message: `This API key has used its ${keyRecord.quota_limit} request quota for the current ${keyRecord.tier} window.`,
      tier: keyRecord.tier,
      resetAt: keyRecord.reset_at,
      purchaseKeyEndpoint: '/api/agent/purchase-key',
      plans: Object.entries(TIERS).map(([name, cfg]) => ({
        tier: name,
        quotaLimit: cfg.quotaLimit,
        windowMs: cfg.windowMs,
      })),
    };
  }

  /**
   * Upgrade (or re-issue) a key at a higher tier for an agent identity.
   * TODO: no payment is actually collected here yet — this just issues a
   * 'pro' key outright. Wire to routes/payment.js's Stripe flow before this
   * goes live; until then this is a free upgrade, by design, for testing.
   */
  static async upgradeKey(agentDid, tier = 'pro') {
    return this.issueApiKey(agentDid, tier);
  }

  /**
   * Ingest a batch of products for a merchant (an agent identity). Computes
   * and stores an embedding for each so they're searchable immediately.
   */
  static async ingestProducts(rawList, merchantDid) {
    const inserted = [];
    for (const item of rawList) {
      const id = crypto.randomUUID();
      const embeddingText = `${item.title} ${item.description || ''}`.trim();
      const embedding = await AgentEmbeddingService.embed(embeddingText);

      const result = await query(
        `INSERT INTO agent_products
           (id, title, description, price_amount, price_currency, category,
            merchant_did, embedding, stock_proof, attributes, last_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
         RETURNING id, title, description, price_amount, price_currency, category, created_at`,
        [
          id,
          item.title,
          item.description || null,
          item.priceAmount,
          item.priceCurrency || 'USD',
          item.category || null,
          merchantDid,
          JSON.stringify(embedding),
          item.stockProof ? JSON.stringify(item.stockProof) : null,
          JSON.stringify(item.attributes || {}),
        ]
      );
      inserted.push(result.rows[0]);
    }
    return inserted;
  }

  static async listProducts({ page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const result = await query(
      `SELECT id, title, description, price_amount, price_currency, category, merchant_did, created_at
       FROM agent_products ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  }

  /**
   * Semantic search over the catalog: embed the query, pull up to
   * MAX_SEARCH_CANDIDATES most-recent products, rank by cosine similarity.
   * Fine at small/medium catalog sizes; revisit (pgvector + ANN index) if the
   * candidate cap starts truncating relevant results.
   */
  static async searchProducts(queryText, topK = 10) {
    const queryEmbedding = await AgentEmbeddingService.embed(queryText);

    const candidates = await query(
      `SELECT id, title, description, price_amount, price_currency, category, merchant_did, embedding
       FROM agent_products ORDER BY created_at DESC LIMIT $1`,
      [MAX_SEARCH_CANDIDATES]
    );

    const ranked = candidates.rows
      .map((row) => ({
        ...row,
        embedding: undefined,
        score: AgentEmbeddingService.cosineSimilarity(queryEmbedding, row.embedding || []),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return ranked;
  }

  static async getRecentlyUpdated(sinceISO, limit = 100) {
    const result = await query(
      `SELECT id, title, price_amount, price_currency, updated_at
       FROM agent_products WHERE updated_at > $1 ORDER BY updated_at ASC LIMIT $2`,
      [sinceISO, limit]
    );
    return result.rows;
  }

  static async getProductIdSitemap() {
    const result = await query(
      `SELECT id, updated_at FROM agent_products ORDER BY updated_at DESC`
    );
    return result.rows;
  }

  static async createTransaction(agentDid, cart) {
    const id = crypto.randomUUID();
    const result = await query(
      `INSERT INTO agent_transactions (id, agent_did, cart, status)
       VALUES ($1, $2, $3, 'created') RETURNING *`,
      [id, agentDid, JSON.stringify(cart)]
    );
    return result.rows[0];
  }

  static getTiers() {
    return TIERS;
  }
}

module.exports = AgentCommerceService;
