/**
 * AgentEmbeddingService - text embeddings for the agent-commerce product catalog.
 *
 * Uses Gemini's text-embedding-004 when GEMINI_API_KEY is configured. With no
 * provider configured, falls back to a deterministic hashed-bag-of-words
 * pseudo-vector so product ingest/search never throws — it just degrades to
 * keyword-ish matching instead of real semantic similarity. The fallback is
 * NOT semantic; it only agrees with itself, not with a real embedding model.
 */

const crypto = require('crypto');
const axios = require('axios');
const config = require('../config/env');
const logger = require('../utils/logger');

const EMBEDDING_DIM = 256;

class AgentEmbeddingService {
  constructor() {
    this.apiKey = config.ai.gemini?.apiKey;
    this.baseURL = 'https://generativelanguage.googleapis.com/v1beta';
    this.model = 'text-embedding-004';
    this.available = !!this.apiKey;
  }

  /**
   * @param {string} text
   * @returns {Promise<number[]>} embedding vector
   */
  async embed(text) {
    const input = (text || '').trim();
    if (!input) return new Array(EMBEDDING_DIM).fill(0);

    if (this.available) {
      try {
        return await this._embedWithGemini(input);
      } catch (error) {
        logger.warn('AgentEmbeddingService: Gemini embed failed, using fallback', {
          error: error.message,
        });
      }
    }

    return this._fallbackEmbed(input);
  }

  async _embedWithGemini(text) {
    const response = await axios.post(
      `${this.baseURL}/models/${this.model}:embedContent?key=${this.apiKey}`,
      {
        model: `models/${this.model}`,
        content: { parts: [{ text }] },
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
    );

    const values = response.data?.embedding?.values;
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('Gemini embedContent returned no values');
    }
    return values;
  }

  /**
   * Deterministic, dependency-free pseudo-embedding: a hashed bag-of-words
   * count vector (feature hashing, no signed buckets — signed hashing
   * cancels real overlap whenever two distinct shared/unshared tokens land
   * in the same bucket with opposite signs, which is common at this small a
   * dimension). Good enough to keep search functional with no provider
   * configured; not a substitute for a real embedding model.
   */
  _fallbackEmbed(text) {
    const vector = new Array(EMBEDDING_DIM).fill(0);
    const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

    for (const token of tokens) {
      const hash = crypto.createHash('sha256').update(token).digest();
      const bucket = hash.readUInt32BE(0) % EMBEDDING_DIM;
      vector[bucket] += 1;
    }

    return vector;
  }

  /**
   * Normalized cosine similarity in [-1, 1]. Returns 0 if either vector has
   * zero magnitude (e.g. empty text) rather than dividing by zero.
   */
  cosineSimilarity(a, b) {
    const len = Math.min(a.length, b.length);
    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < len; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }

    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  isAvailable() {
    return this.available;
  }
}

module.exports = new AgentEmbeddingService();
