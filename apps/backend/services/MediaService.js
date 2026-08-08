/**
 * MediaService — community-submitted playable links.
 *
 * WHY THIS EXISTS: Truegle's search finds what the web indexes, which is not
 * the same set as what Truegle's player can play. A track or clip somebody
 * already knows the link to is invisible to everyone else until someone says
 * "this plays". A submission does exactly that: one person adds a link, and it
 * becomes findable — by title or by the link itself — for everyone.
 *
 * NOTHING IS UPLOADED. We store a URL and a little metadata; the media plays
 * from its original platform's own embed, so the creator keeps their views.
 *
 * SECURITY: a submitted URL ends up inside an iframe for every visitor, so the
 * accept rule is the same one the player uses — classify it or reject it, and
 * store OUR canonical embed target rather than whatever was pasted. Host
 * matching is exact-or-true-subdomain: a bare endsWith('youtube.com') also
 * matches attacker hosts like `evilyoutube.com`. Mirrors
 * apps/frontend/src/utils/videoEmbed.js — keep the two in step.
 */
const { query } = require('../db/connection');
const logger = require('../utils/logger');

class MediaError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'MediaError';
    this.code = code; // INVALID | UNSUPPORTED | NOT_FOUND | UNAUTHENTICATED
  }
}

const MAX_TITLE = 200;
const MAX_URL = 2048;
const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|wav|flac)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

/**
 * Recognize a link the player can host.
 * @returns {{kind, platform, canonical, src, vertical}} or throws MediaError.
 */
function classifyMedia(rawUrl) {
  let u;
  try {
    u = new URL(String(rawUrl).trim());
  } catch {
    throw new MediaError('INVALID', 'That does not look like a link.');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new MediaError('INVALID', 'Only http(s) links can be added.');
  }

  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  const isHost = (base) => host === base || host.endsWith(`.${base}`);
  const path = u.pathname;

  if (host === 'youtu.be') {
    const id = path.slice(1).split('/')[0];
    if (id) {
      return {
        kind: 'youtube',
        platform: 'YouTube',
        canonical: `youtube.com/watch/${id.toLowerCase()}`,
        src: `https://www.youtube-nocookie.com/embed/${id}`,
        vertical: false,
      };
    }
  }
  if (isHost('youtube.com') || isHost('youtube-nocookie.com')) {
    if (path === '/watch') {
      const id = u.searchParams.get('v');
      if (id) {
        return {
          kind: 'youtube',
          platform: 'YouTube',
          canonical: `youtube.com/watch/${id.toLowerCase()}`,
          src: `https://www.youtube-nocookie.com/embed/${id}`,
          vertical: false,
        };
      }
    }
    if (path.startsWith('/shorts/') || path.startsWith('/embed/')) {
      const id = path.split('/')[2];
      if (id) {
        const short = path.startsWith('/shorts/');
        return {
          kind: 'youtube',
          platform: short ? 'YouTube Shorts' : 'YouTube',
          canonical: `youtube.com/watch/${id.toLowerCase()}`,
          src: `https://www.youtube-nocookie.com/embed/${id}`,
          vertical: short,
        };
      }
    }
  }
  if (isHost('vimeo.com')) {
    const id = path.split('/').filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) {
      return {
        kind: 'vimeo',
        platform: 'Vimeo',
        canonical: `vimeo.com/${id}`,
        src: `https://player.vimeo.com/video/${id}`,
        vertical: false,
      };
    }
  }
  if (isHost('tiktok.com')) {
    const id = /\/video\/(\d+)/.exec(path)?.[1];
    if (id) {
      return {
        kind: 'tiktok',
        platform: 'TikTok',
        canonical: `tiktok.com/video/${id}`,
        src: `https://www.tiktok.com/embed/v2/${id}`,
        vertical: true,
      };
    }
  }
  // Reddit → the official redditmedia embed. Only a full post permalink can
  // be embedded (the embed is addressed by subreddit + post id), and we
  // deliberately don't touch v.redd.it: those are DASH/HLS with the audio on a
  // separate track, which would mean shipping a player library.
  // Mirrors getPlayable() in apps/frontend/src/utils/videoEmbed.js.
  if (isHost('reddit.com')) {
    const m = /^\/r\/([A-Za-z0-9_]{2,30})\/comments\/([a-z0-9]{4,10})/i.exec(path);
    if (m) {
      return {
        kind: 'reddit',
        platform: 'Reddit',
        canonical: `reddit.com/comments/${m[2].toLowerCase()}`,
        src: `https://www.redditmedia.com/r/${m[1]}/comments/${m[2]}/`
          + '?ref_source=embed&ref=share&embed=true&theme=dark&showmedia=true&depth=1',
        vertical: false,
      };
    }
  }
  if (isHost('soundcloud.com')) {
    // Mirrors getPlayable(): a one-segment path is an ARTIST PROFILE and the
    // widget plays their catalogue from it, so it is accepted — except for
    // SoundCloud's own reserved pages, which have no audio behind them. The
    // two sides disagreeing is how a link plays in search but is refused on
    // submit.
    const seg = path.split('/').filter(Boolean);
    const RESERVED = new Set(['discover', 'stream', 'you', 'search', 'upload', 'pages', 'terms', 'settings', 'notifications', 'messages', 'charts', 'tags', 'people']);
    const slug = seg.slice(0, 2).join('/');
    if (seg.length && !RESERVED.has(seg[0].toLowerCase())) {
      const clean = `https://soundcloud.com/${slug}`;
      return {
        kind: 'soundcloud',
        platform: 'SoundCloud',
        canonical: `soundcloud.com/${slug.toLowerCase()}`,
        src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(clean)}`
          + '&auto_play=true&hide_related=true&show_comments=false&show_user=true&visual=false',
        vertical: false,
      };
    }
  }
  // A direct file plays natively. The stored src IS the submitted URL here,
  // so it is kept exactly as given (already https-checked above).
  const asString = u.toString();
  if (AUDIO_EXT.test(path)) {
    return { kind: 'audio', platform: 'Audio file', canonical: `${host}${path.toLowerCase()}`, src: asString, vertical: false };
  }
  if (VIDEO_EXT.test(path)) {
    return { kind: 'video', platform: 'Video file', canonical: `${host}${path.toLowerCase()}`, src: asString, vertical: false };
  }

  throw new MediaError(
    'UNSUPPORTED',
    "Truegle's player can't host that link. YouTube, Vimeo, TikTok, SoundCloud, "
    + 'Reddit posts and direct audio/video files all work.',
  );
}

// A thumbnail we can derive with no API key. Only YouTube publishes one
// openly; the rest need oEmbed behind app review, so their rows carry the
// platform name instead of a preview image.
function deriveThumbnail(kind, canonical) {
  if (kind !== 'youtube') return null;
  const id = canonical.split('/').pop();
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : null);

// A row as the player consumes it — same shape getPlayable() returns on the
// client, so a submitted link drops straight into the queue.
const toSource = (row) => ({
  id: row.id,
  kind: row.kind,
  src: row.src,
  title: row.title,
  pageUrl: row.url,
  poster: row.thumbnail,
  platform: row.platform,
  ...(row.vertical ? { vertical: true } : {}),
  community: true,
});

const MediaService = {
  classifyMedia,
  toSource,

  /**
   * Add a link so everyone can play it. Requires a userId — the route enforces
   * a signed-in account, and the column is NOT NULL, so an unattributed row
   * cannot exist. Idempotent per canonical URL: submitting the same link twice
   * returns the existing row and fills in a title if it was missing.
   */
  async submit({ url, title, userId }) {
    if (!userId) throw new MediaError('UNAUTHENTICATED', 'Sign in to add a link.');
    const raw = clean(url, MAX_URL);
    if (!raw) throw new MediaError('INVALID', 'No link was provided.');

    const { kind, platform, canonical, src, vertical } = classifyMedia(raw);
    const thumbnail = deriveThumbnail(kind, canonical);

    const { rows } = await query(
      `INSERT INTO community_media (url, canonical, kind, platform, title, thumbnail, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (canonical) DO UPDATE
         SET title = COALESCE(community_media.title, EXCLUDED.title)
       RETURNING id, url, kind, platform, title, thumbnail, created_at`,
      [raw, canonical, kind, platform, clean(title, MAX_TITLE), thumbnail, userId],
    );
    logger.info('Media submitted', { kind, canonical });
    return toSource({ ...rows[0], src, vertical });
  },

  /**
   * Find submitted media by title OR by the link itself — people paste a URL
   * they half-remember as often as they type a name. Results are re-classified
   * on the way out rather than trusting a stored embed src, so a row written
   * before a rule changed can never outlive the rule.
   */
  async search({ q, limit = 12 } = {}) {
    const term = clean(q, 200);
    if (!term || term.length < 2) return [];
    const capped = Math.min(Math.max(parseInt(limit, 10) || 12, 1), 50);
    const like = `%${term.toLowerCase()}%`;
    const { rows } = await query(
      `SELECT id, url, kind, platform, title, thumbnail, created_at
         FROM community_media
        WHERE hidden = FALSE
          AND (lower(COALESCE(title, '')) LIKE $1 OR lower(url) LIKE $1 OR canonical LIKE $1)
        ORDER BY plays DESC, created_at DESC
        LIMIT $2`,
      [like, capped],
    );
    return rows.map((row) => {
      try {
        const { src, vertical, kind } = classifyMedia(row.url);
        return toSource({ ...row, src, vertical, kind });
      } catch {
        return null; // no longer playable under the current rules — drop it
      }
    }).filter(Boolean);
  },

  /** Newest visible submissions. */
  async list({ limit = 24 } = {}) {
    const capped = Math.min(Math.max(parseInt(limit, 10) || 24, 1), 100);
    const { rows } = await query(
      `SELECT id, url, kind, platform, title, thumbnail, created_at
         FROM community_media
        WHERE hidden = FALSE
        ORDER BY created_at DESC
        LIMIT $1`,
      [capped],
    );
    return rows.map((row) => {
      try {
        const { src, vertical, kind } = classifyMedia(row.url);
        return toSource({ ...row, src, vertical, kind });
      } catch {
        return null;
      }
    }).filter(Boolean);
  },

  /**
   * Record an anonymous 👍/👎/play against a piece of media.
   *
   * `from`/`to` are the vote TRANSITION the client is applying (0 none, 1 up,
   * -1 down), not an increment — so twenty presses of the same thumb move the
   * counter once. Nothing identifying is accepted or stored; see the migration
   * for why that is a design constraint rather than an oversight.
   *
   * Never throws: a lost vote must not cost anybody their playback.
   */
  async signal({ key, from = 0, to = 0, play = false, kind, title, pageUrl, poster, channel } = {}) {
    const mediaKey = clean(key, 200);
    if (!mediaKey || !/^[\w.:@/-]+$/.test(mediaKey)) return { ok: false };

    const dir = (v) => (v === 1 || v === -1 ? v : 0);
    const a = dir(from);
    const b = dir(to);
    // A transition moves at most one counter each way: up→down is -1 up, +1 down.
    const dUp = (b === 1 ? 1 : 0) - (a === 1 ? 1 : 0);
    const dDown = (b === -1 ? 1 : 0) - (a === -1 ? 1 : 0);
    const dPlay = play ? 1 : 0;
    if (!dUp && !dDown && !dPlay) return { ok: true };

    try {
      const { rows } = await query(
        `INSERT INTO media_signals (media_key, kind, title, page_url, poster, channel, ups, downs, plays)
         VALUES ($1, $2, $3, $4, $5, $6, GREATEST($7, 0), GREATEST($8, 0), GREATEST($9, 0))
         ON CONFLICT (media_key) DO UPDATE SET
           ups      = GREATEST(media_signals.ups   + $7, 0),
           downs    = GREATEST(media_signals.downs + $8, 0),
           plays    = GREATEST(media_signals.plays + $9, 0),
           title    = COALESCE(media_signals.title, EXCLUDED.title),
           page_url = COALESCE(media_signals.page_url, EXCLUDED.page_url),
           poster   = COALESCE(media_signals.poster, EXCLUDED.poster),
           channel  = COALESCE(media_signals.channel, EXCLUDED.channel),
           hidden   = (GREATEST(media_signals.downs + $8, 0)
                        >= 5 + 3 * GREATEST(media_signals.ups + $7, 0)),
           updated_at = NOW()
         RETURNING ups, downs`,
        [
          mediaKey, clean(kind, 32), clean(title, MAX_TITLE), clean(pageUrl, MAX_URL),
          clean(poster, MAX_URL), clean(channel, 120), dUp, dDown, dPlay,
        ],
      );
      return { ok: true, ...rows[0] };
    } catch (err) {
      logger.warn('Media signal failed', { error: err && err.message });
      return { ok: false };
    }
  },

  /**
   * What the platform as a whole is enjoying — the cold-start pool for a
   * visitor with no taste profile of their own, and extra candidates for one
   * who has.
   *
   * Ranked by a lower-confidence-bound rather than raw ups: a single 👍 on a
   * brand-new row should not outrank forty ups and two downs. Recency nudges
   * it so the pool doesn't calcify around whatever was popular in month one.
   */
  async trending({ limit = 20, exclude = [] } = {}) {
    const capped = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const skip = (Array.isArray(exclude) ? exclude : [])
      .map((k) => clean(k, 200)).filter(Boolean).slice(0, 60);
    try {
      const { rows } = await query(
        `SELECT media_key, kind, title, page_url, poster, channel, ups, downs, plays,
                ( (ups + 1.0) / (ups + downs + 2.0)
                  - 1.0 / SQRT(ups + downs + 2.0)
                  + LEAST(plays, 50) / 500.0
                  + CASE WHEN updated_at > NOW() - INTERVAL '14 days' THEN 0.08 ELSE 0 END
                ) AS score
           FROM media_signals
          WHERE hidden = FALSE
            AND (ups > 0 OR plays > 0)
            AND ($2::text[] IS NULL OR NOT (media_key = ANY($2)))
          ORDER BY score DESC, updated_at DESC
          LIMIT $1`,
        [capped, skip.length ? skip : null],
      );
      return rows.map((r) => ({
        mediaKey: r.media_key,
        kind: r.kind,
        title: r.title,
        pageUrl: r.page_url,
        poster: r.poster,
        channel: r.channel,
        ups: r.ups,
        downs: r.downs,
        score: Number(r.score) || 0,
      }));
    } catch (err) {
      logger.warn('Media trending failed', { error: err && err.message });
      return [];
    }
  },

  /**
   * Resolve a link's real title, artist and artwork through the platform's own
   * PUBLIC oEmbed endpoint — keyless, free, and documented.
   *
   * WHY THIS EXISTS: a general web index cannot find a small artist. Two live
   * traces showed `site:soundcloud.com <name>` returning literally zero, and
   * that is not a query-shaping bug — an artist with 33 followers, ranked
   * eleventh for their own name, is simply not in the crawl. No amount of
   * operator tuning reaches them, and SoundCloud has no open search API to ask
   * instead (app registrations have been closed for years).
   *
   * What DOES work is the link itself. oEmbed turns a pasted URL into a real
   * title, artist and thumbnail, so a submitted track looks like a track
   * instead of a bare URL — which is what makes community submission a usable
   * route to being findable rather than a chore.
   */
  async resolveLink(rawUrl) {
    const url = clean(rawUrl, MAX_URL);
    if (!url) throw new MediaError('INVALID', 'No link was provided.');
    // Classify first: this refuses anything we would not play anyway, so the
    // endpoint can never be used to make our server fetch arbitrary hosts.
    const { kind, platform, canonical, src, vertical } = classifyMedia(url);

    const ENDPOINTS = {
      soundcloud: 'https://soundcloud.com/oembed?format=json&url=',
      youtube: 'https://www.youtube.com/oembed?format=json&url=',
      vimeo: 'https://vimeo.com/api/oembed.json?url=',
      tiktok: 'https://www.tiktok.com/oembed?url=',
    };
    const endpoint = ENDPOINTS[kind];
    let meta = {};
    if (endpoint) {
      try {
        const r = await fetch(endpoint + encodeURIComponent(url), {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(6000),
        });
        if (r.ok) {
          const j = await r.json();
          meta = {
            title: clean(j.title, MAX_TITLE),
            author: clean(j.author_name, 120),
            // oEmbed thumbnails are often tiny; SoundCloud's -large can be
            // swapped for a bigger crop, which costs nothing to ask for.
            thumbnail: clean(
              typeof j.thumbnail_url === 'string'
                ? j.thumbnail_url.replace('-large.', '-t500x500.')
                : null,
              MAX_URL,
            ),
          };
        }
      } catch (err) {
        // Offline, rate-limited or a private track. The link still plays; it
        // just carries no nice title, which is a worse row, not a broken one.
        logger.warn('oEmbed resolve failed', { kind, error: err && err.message });
      }
    }

    return {
      kind,
      platform,
      canonical,
      src,
      pageUrl: url,
      title: meta.title || null,
      channel: meta.author || null,
      poster: meta.thumbnail || deriveThumbnail(kind, canonical),
      ...(vertical ? { vertical: true } : {}),
    };
  },

  /** Best-effort play counter; never fails a playback because of a write. */
  async countPlay(id) {
    try {
      await query('UPDATE community_media SET plays = plays + 1 WHERE id = $1', [id]);
    } catch (err) {
      logger.warn('Play count failed', { error: err && err.message });
    }
  },

  /**
   * Report a submission. Soft moderation: enough reports hides it from results
   * without deleting the row, so an over-eager report is reversible.
   */
  async report(id, threshold = 3) {
    const { rows } = await query(
      `UPDATE community_media
          SET reports = reports + 1,
              hidden  = (reports + 1) >= $2
        WHERE id = $1
      RETURNING id, hidden`,
      [id, threshold],
    );
    if (!rows[0]) throw new MediaError('NOT_FOUND', 'That link no longer exists.');
    return rows[0];
  },
};

module.exports = { MediaService, MediaError };
