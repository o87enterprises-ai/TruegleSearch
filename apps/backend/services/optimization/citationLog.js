/**
 * Citation log — records each auto-published page (audit trail + GEO Pulse +
 * dedup source). No user data, only the public page the engine created.
 * Degrades to a no-op when the DB/table is unavailable.
 */

const log = require('./log');

let query = null;
try {
  ({ query } = require('../../db/connection'));
} catch {
  /* no DB */
}

async function record(post, { source = 'backlog', demand = 0, provider = null } = {}) {
  if (!query) return;
  try {
    await query(
      `INSERT INTO citation_log (slug, title, topic, source, demand, provider)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [post.slug, post.title, post._meta?.cluster || null, source, demand, provider]
    );
  } catch (e) {
    log.warn(`citationLog: ${e.message}`);
  }
}

async function recent(limit = 20) {
  if (!query) return [];
  try {
    const { rows } = await query(
      'SELECT slug, title, source, demand, provider, created_at FROM citation_log ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return rows;
  } catch {
    return [];
  }
}

async function total() {
  if (!query) return 0;
  try {
    const { rows } = await query('SELECT COUNT(*)::int AS n FROM citation_log');
    return rows[0]?.n || 0;
  } catch {
    return 0;
  }
}

module.exports = { record, recent, total };
