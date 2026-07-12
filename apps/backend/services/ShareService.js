/**
 * ShareService — persists link-shareable chat threads / OSINT investigations so
 * a recipient opens the LIVE thread (messages + cited media/links), not pasted
 * text. Public by design: anyone with the id can view. Backed by Postgres
 * (`shared_threads`), so no new infrastructure — works on the current stack.
 */
const crypto = require('crypto');
const { query } = require('../db/connection');
const logger = require('../utils/logger');

// url-safe, unambiguous alphabet (no 0/O/1/I/l) for hand-shareable ids.
const ID_ALPHABET = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const ID_LENGTH = 10;

// Hard cap on stored payload size — a shared thread is a conversation, not a
// data dump. Protects the DB from abuse and keeps reads fast. ~256 KB JSON.
const MAX_PAYLOAD_BYTES = 256 * 1024;
const MAX_MESSAGES = 200;

function generateId() {
  const bytes = crypto.randomBytes(ID_LENGTH);
  let out = '';
  for (let i = 0; i < ID_LENGTH; i++) out += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  return out;
}

class ShareError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'ShareError';
    this.code = code; // TOO_LARGE | INVALID | NOT_FOUND
  }
}

/**
 * Normalize + validate an incoming thread payload. Keeps only the fields a
 * read-only viewer needs, so we never persist tokens, timestamps, or unknown
 * client fields. Throws ShareError('INVALID' | 'TOO_LARGE').
 */
function sanitizePayload(raw) {
  if (!raw || typeof raw !== 'object') throw new ShareError('INVALID', 'payload must be an object');
  const messages = Array.isArray(raw.messages) ? raw.messages : null;
  if (!messages || messages.length === 0) throw new ShareError('INVALID', 'payload.messages is required');

  const clean = {
    // 'modes' (array) is the multi-select set; 'mode' kept for back-compat.
    modes: Array.isArray(raw.modes) ? raw.modes.map(String).slice(0, 5) : undefined,
    mode: typeof raw.mode === 'string' ? raw.mode : undefined,
    title: typeof raw.title === 'string' ? raw.title.slice(0, 200) : undefined,
    messages: messages.slice(0, MAX_MESSAGES).map((m) => ({
      role: m && m.role === 'user' ? 'user' : 'assistant',
      content: typeof (m && m.content) === 'string' ? m.content : '',
      // citations are plain result objects (links/pics/videos) — pass through
      // if present and object-shaped; the viewer renders them read-only.
      citations: m && m.citations && typeof m.citations === 'object' ? m.citations : null,
      // investigation graph (GraphiPy {nodes, edges}) — pass through so a
      // shared investigation carries its graph view too.
      graph: m && m.graph && typeof m.graph === 'object' ? m.graph : null,
    })),
  };

  const bytes = Buffer.byteLength(JSON.stringify(clean), 'utf8');
  if (bytes > MAX_PAYLOAD_BYTES) throw new ShareError('TOO_LARGE', `payload ${bytes} bytes exceeds ${MAX_PAYLOAD_BYTES}`);
  return clean;
}

/**
 * Persist a thread and return its short id. Retries on the (astronomically
 * unlikely) id collision.
 * @param {object} args
 * @param {'chat'|'investigation'} [args.kind]
 * @param {object} args.payload  { mode(s), messages:[{role,content,citations}] }
 * @param {number|null} [args.userId]
 * @returns {Promise<{id:string}>}
 */
async function createShare({ kind = 'chat', payload, userId = null }) {
  const safeKind = kind === 'investigation' ? 'investigation' : 'chat';
  const clean = sanitizePayload(payload);

  for (let attempt = 0; attempt < 4; attempt++) {
    const id = generateId();
    try {
      await query(
        `INSERT INTO shared_threads (id, kind, user_id, payload) VALUES ($1, $2, $3, $4)`,
        [id, safeKind, userId, JSON.stringify(clean)]
      );
      logger.info('Shared thread created:', { id, kind: safeKind, messages: clean.messages.length });
      return { id };
    } catch (err) {
      if (err.code === '23505' && attempt < 3) continue; // unique_violation → new id
      throw err;
    }
  }
  throw new ShareError('INVALID', 'could not allocate a share id');
}

/**
 * Load a shared thread by id (if not expired) and count the view.
 * @returns {Promise<{id, kind, payload, createdAt, views}>}
 * @throws ShareError('NOT_FOUND')
 */
async function getShare(id) {
  if (typeof id !== 'string' || !/^[0-9A-Za-z]{6,16}$/.test(id)) throw new ShareError('NOT_FOUND');
  const { rows } = await query(
    `UPDATE shared_threads SET views = views + 1
       WHERE id = $1 AND expires_at > NOW()
     RETURNING id, kind, payload, views, created_at`,
    [id]
  );
  if (rows.length === 0) throw new ShareError('NOT_FOUND');
  const r = rows[0];
  return { id: r.id, kind: r.kind, payload: r.payload, views: r.views, createdAt: r.created_at };
}

module.exports = {
  createShare,
  getShare,
  ShareError,
  _internals: { generateId, sanitizePayload, MAX_PAYLOAD_BYTES, MAX_MESSAGES },
};
