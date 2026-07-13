/**
 * FeedbackService — records thumbs up/down votes on TrueGLE answers as training
 * signal. A downvote MUST carry a brief explanation (that's the whole point:
 * "this was wrong/biased/unhelpful because …" is what we can actually learn
 * from). Stored in Postgres (ai_feedback, migration 009).
 */
const { query } = require('../db/connection');
const logger = require('../utils/logger');

// Bound stored text so a pathological paste can't bloat the table.
const MAX_REASON = 2000;
const MAX_ANSWER = 8000;
const MAX_QUERY = 2000;

class FeedbackError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'FeedbackError';
    this.code = code; // INVALID | REASON_REQUIRED
  }
}

function clamp(v, max) {
  return typeof v === 'string' ? v.slice(0, max) : null;
}

/**
 * Record a feedback vote.
 * @param {object} args
 * @param {'up'|'down'} args.vote
 * @param {string} [args.reason]   required + non-empty when vote === 'down'
 * @param {string} [args.answer]   the rated answer text
 * @param {string} [args.query]    the question/context it answered
 * @param {string} [args.mode]
 * @param {string} [args.provider]
 * @param {number|null} [args.userId]
 * @returns {Promise<{id:number}>}
 */
async function record({ vote, reason, answer, query: q, mode, provider, userId = null }) {
  if (vote !== 'up' && vote !== 'down') throw new FeedbackError('INVALID', "vote must be 'up' or 'down'");
  const cleanReason = clamp(reason, MAX_REASON);
  if (vote === 'down' && (!cleanReason || cleanReason.trim().length === 0)) {
    throw new FeedbackError('REASON_REQUIRED', 'a brief explanation is required for a thumbs-down');
  }

  const { rows } = await query(
    `INSERT INTO ai_feedback (vote, reason, answer, query, mode, provider, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      vote,
      vote === 'down' ? cleanReason.trim() : (cleanReason ? cleanReason.trim() : null),
      clamp(answer, MAX_ANSWER),
      clamp(q, MAX_QUERY),
      clamp(mode, 64),
      clamp(provider, 64),
      userId,
    ]
  );
  logger.info('AI feedback recorded:', { id: rows[0].id, vote, mode, hasReason: !!cleanReason });
  return { id: rows[0].id };
}

module.exports = { record, FeedbackError, _internals: { MAX_REASON, MAX_ANSWER } };
