/**
 * ReelsService — the community-submitted half of Truegle's reels feed.
 *
 * WHY THIS EXISTS: TikTok, Instagram Reels and Facebook Reels expose no free
 * search API. Discovering them programmatically needs Meta/TikTok app review
 * and an audited developer app, which Truegle does not have. YouTube Shorts
 * can be discovered through the existing search stack; the other three cannot.
 * So the feed is fed from two sides — discovered Shorts, plus reels people
 * submit here.
 *
 * We store a URL and a bit of metadata. Truegle never copies, re-hosts or
 * re-encodes the video: it plays from the original platform's own embed, so
 * the creator keeps their views. That is also why there is no "upload".
 */
const { query } = require('../db/connection');
const logger = require('../utils/logger');

class ReelError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'ReelError';
    this.code = code; // INVALID | UNSUPPORTED | DUPLICATE | NOT_FOUND
  }
}

const MAX_TITLE = 200;
const MAX_URL = 2048;

/**
 * Recognize a genuine short-form URL and return its platform + canonical form.
 * Host matching is exact-or-true-subdomain: a bare endsWith() would also match
 * attacker hosts like `evilyoutube.com`, and this URL ends up in an iframe.
 * Mirrors apps/frontend/src/utils/shortForm.js — keep the two in step.
 */
function classifyReel(rawUrl) {
  let u;
  try {
    u = new URL(String(rawUrl).trim());
  } catch {
    throw new ReelError('INVALID', 'That does not look like a link.');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new ReelError('INVALID', 'Only http(s) links can be added.');
  }

  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  const path = u.pathname;
  const isHost = (base) => host === base || host.endsWith(`.${base}`);

  if (isHost('youtube.com') && path.startsWith('/shorts/')) {
    const id = path.split('/')[2];
    if (id) return { platform: 'YouTube Shorts', canonical: `youtube.com/shorts/${id.toLowerCase()}` };
  }
  if (isHost('tiktok.com')) {
    const id = /\/video\/(\d+)/.exec(path)?.[1];
    if (id) return { platform: 'TikTok', canonical: `tiktok.com/video/${id}` };
  }
  if (isHost('instagram.com') && (path.startsWith('/reel/') || path.startsWith('/reels/'))) {
    const id = path.split('/')[2];
    if (id) return { platform: 'Instagram Reels', canonical: `instagram.com/reel/${id.toLowerCase()}` };
  }
  if (isHost('facebook.com') && (path.startsWith('/reel/') || path.includes('/reels/'))) {
    const id = /\/reels?\/(\w+)/.exec(path)?.[1];
    if (id) return { platform: 'Facebook Reels', canonical: `facebook.com/reel/${id.toLowerCase()}` };
  }

  throw new ReelError(
    'UNSUPPORTED',
    'That is not a reel link. Paste a YouTube Short, TikTok, Instagram Reel or Facebook Reel.',
  );
}

// Thumbnail we can derive with no API key. Only YouTube exposes one publicly;
// the others need oEmbed behind app review, so their cards use the platform
// badge instead of a preview image.
function deriveThumbnail(platform, canonical) {
  if (platform !== 'YouTube Shorts') return null;
  const id = canonical.split('/').pop();
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : null);

const ReelsService = {
  classifyReel,

  /**
   * Add a reel to the community feed. Idempotent per canonical URL: submitting
   * the same reel twice returns the existing row rather than duplicating it.
   */
  async submit({ url, title, userId = null }) {
    const raw = clean(url, MAX_URL);
    if (!raw) throw new ReelError('INVALID', 'No link was provided.');

    const { platform, canonical } = classifyReel(raw);
    const thumbnail = deriveThumbnail(platform, canonical);

    const { rows } = await query(
      `INSERT INTO community_reels (url, canonical, platform, title, thumbnail, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (canonical) DO UPDATE
         SET title = COALESCE(community_reels.title, EXCLUDED.title)
       RETURNING id, url, platform, title, thumbnail, created_at`,
      [raw, canonical, platform, clean(title, MAX_TITLE), thumbnail, userId],
    );
    logger.info('Reel submitted', { platform, canonical });
    return rows[0];
  },

  /** Newest visible reels, optionally filtered to one platform. */
  async list({ platform = null, limit = 40 } = {}) {
    const capped = Math.min(Math.max(parseInt(limit, 10) || 40, 1), 100);
    const { rows } = platform
      ? await query(
        `SELECT id, url, platform, title, thumbnail, created_at
           FROM community_reels
          WHERE hidden = FALSE AND platform = $1
          ORDER BY created_at DESC LIMIT $2`,
        [platform, capped],
      )
      : await query(
        `SELECT id, url, platform, title, thumbnail, created_at
           FROM community_reels
          WHERE hidden = FALSE
          ORDER BY created_at DESC LIMIT $1`,
        [capped],
      );
    return rows;
  },

  /**
   * Report a reel. Soft moderation: enough reports hides it from the feed
   * without deleting the row, so an over-eager report is reversible.
   */
  async report(id, threshold = 3) {
    const { rows } = await query(
      `UPDATE community_reels
          SET reports = reports + 1,
              hidden  = (reports + 1) >= $2
        WHERE id = $1
      RETURNING id, hidden`,
      [id, threshold],
    );
    if (!rows[0]) throw new ReelError('NOT_FOUND', 'That reel no longer exists.');
    return rows[0];
  },
};

module.exports = { ReelsService, ReelError };
