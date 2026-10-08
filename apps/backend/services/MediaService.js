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
const { expandShortLink } = require('./ShortLinkService');
const { discoverEmbed } = require('./EmbedDiscovery');

// Discovered embeds, briefly remembered: the same pasted page should not be
// read again for every person who pastes it. Small and in-process.
const DISCOVERED = new Map();
const DISCOVERED_TTL_MS = 60 * 60 * 1000;
const DISCOVERED_MAX = 500;
const { query } = require('../db/connection');
const logger = require('../utils/logger');
// A stranger supplies no text, so the title has to come from the platform.
const OembedService = require('./OembedService');

class MediaError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'MediaError';
    this.code = code; // INVALID | UNSUPPORTED | NOT_FOUND | UNAUTHENTICATED
  }
}

// ── NO ONE CAN HIDE A VIDEO FROM EVERYONE ─────────────────────────────────────
// Owner audit, 2026-10-08: "make sure that results aren't being blocked or
// censored." media_signals used to hide a video from EVERY visitor after five
// anonymous 👎 or two "broken" reports — nothing stops one person sending five
// requests, and the old silence watchdog filed "broken" by itself on slow
// phones. The one video it had hidden was Luis Fonsi's "Despacito", public and
// embeddable. So:
//   · votes NEVER hide anything for everyone (they shape recommendations only)
//   · "broken" hides a YouTube/Vimeo video only once the platform itself says
//     it is gone — removed, private, or embedding switched off
//   · other platforms, which cannot be checked, need BROKEN_UNVERIFIED reports
const BROKEN_UNVERIFIED = 5;
const VERIFY_ENDPOINTS = {
  youtube: (id) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`,
  vimeo: (id) => `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${id}`)}`,
};
const verified = new Map(); // key → { at, gone }
const VERIFY_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Is this media really unplayable here? true = gone, false = plays,
 * null = this platform cannot be checked (or the check itself failed).
 */
async function isReallyGone(mediaKey, fetchImpl = fetch) {
  const [platform, id] = String(mediaKey).split(':');
  const endpoint = VERIFY_ENDPOINTS[platform];
  if (!endpoint || !id) return null;
  const hit = verified.get(mediaKey);
  if (hit && Date.now() - hit.at < VERIFY_TTL_MS) return hit.gone;
  try {
    const r = await fetchImpl(endpoint(id), { signal: AbortSignal.timeout(5000) });
    // 200 = public and embeddable. 401/403 = embedding off or private, 400/404 =
    // removed or never existed: unplayable in Truegle either way. Anything else
    // (429, 5xx) proves nothing.
    const gone = r.status === 200 ? false : [400, 401, 403, 404].includes(r.status) ? true : null;
    if (gone !== null) verified.set(mediaKey, { at: Date.now(), gone });
    return gone;
  } catch {
    return null;
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
        // The controllable embed player (play/pause/sound over postMessage),
        // not the /embed/v2 card, which had no control channel.
        src: `https://www.tiktok.com/player/v1/${id}?autoplay=1&rel=0&native_context_menu=0`,
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

/** What a submitter with no account may post: hosted platforms only.
 *  Excludes 'audio' and 'video', which classifyMedia also accepts — those are
 *  direct file URLs, i.e. arbitrary media on someone's own server with no
 *  platform moderating it. See migration 023. */
const ANON_KINDS = new Set(['youtube', 'vimeo', 'tiktok', 'soundcloud', 'reddit']);

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
  // Only present where the query asked for it (the feed). Undefined elsewhere
  // rather than 0, so a card can tell "nobody has played this" apart from
  // "this endpoint does not report plays".
  ...(row.plays === undefined || row.plays === null ? {} : { plays: Number(row.plays) }),
  community: true,
  // From the COLUMN, not from who asked — so every caller sees the same
  // answer and the card can badge an unclaimed post honestly. Undefined where
  // the query did not select it, rather than a misleading false.
  ...(row.submitted_by === undefined ? {} : { anonymous: row.submitted_by === null }),
});

const MediaService = {
  classifyMedia,
  toSource,

  /**
   * Add a link so everyone can play it.
   *
   * ANONYMOUS IS ALLOWED, AND CONSTRAINED. Migration 018 required a signed-in
   * submitter and wrote down why: an open write to a store every visitor can
   * play is a spam door. 023 relaxes that for a frictionless paste-a-link
   * flow, and moves the protection rather than dropping it — see that
   * migration for the full reasoning. Enforced here:
   *
   *   · a stranger may only post PLATFORM links, never the direct
   *     .mp4/.mp3 case (see ANON_KINDS);
   *   · a stranger supplies no text at all — the title comes from the
   *     platform's own oEmbed, so a submission carries no payload of its own.
   *
   * Idempotent per canonical URL either way: submitting the same link twice
   * returns the existing row and fills in a title if it was missing.
   */
  async submit({ url, title, userId = null }) {
    let raw = clean(url, MAX_URL);
    if (!raw) throw new MediaError('INVALID', 'No link was provided.');
    // A share link (vm.tiktok.com/…) carries no video id — follow it to the
    // video first. Only the canonical link is kept; see ShortLinkService.
    raw = (await expandShortLink(raw)) || raw;

    const { kind, platform, canonical, src, vertical } = classifyMedia(raw);
    const anonymous = !userId;

    // THE ONE THING A STRANGER MAY NOT DO. classifyMedia accepts any https URL
    // ending in a media extension, which for an attributable submitter is a
    // feature — they can add a file they host. From a stranger it is arbitrary
    // media on someone else's server, with no platform moderating it and
    // nobody to hold responsible, promoted into a feed everyone sees.
    if (anonymous && !ANON_KINDS.has(kind)) {
      throw new MediaError(
        'SIGN_IN_REQUIRED',
        'Direct file links can only be added from an account. '
        + 'A link from YouTube, Vimeo, TikTok, SoundCloud or Reddit can be posted without one.',
      );
    }

    // A stranger's text never reaches the row. The platform's own title is a
    // fact about the media; a submitted title is an unmoderated message in a
    // feed, which is the actual spam surface — the link itself only points at
    // something a platform is already moderating.
    let storedTitle = anonymous ? null : clean(title, MAX_TITLE);
    if (anonymous) {
      // Best effort: a missing title is a cosmetic loss (the card falls back to
      // the platform name), and a slow oEmbed provider must not fail a
      // submission that is otherwise perfectly good.
      try {
        const meta = await OembedService.lookup(raw);
        if (meta?.title) storedTitle = clean(meta.title, MAX_TITLE);
      } catch { /* no title for this one */ }
    }

    const thumbnail = deriveThumbnail(kind, canonical);

    const { rows } = await query(
      `INSERT INTO community_media (url, canonical, kind, platform, title, thumbnail, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (canonical) DO UPDATE
         SET title = COALESCE(community_media.title, EXCLUDED.title)
       RETURNING id, url, kind, platform, title, thumbnail, created_at, submitted_by`,
      [raw, canonical, kind, platform, storedTitle, thumbnail, userId],
    );
    logger.info('Media submitted', { kind, canonical, anonymous });
    // `anonymous` travels with the row so the card can badge it honestly —
    // derived from the column, not from who happened to ask, so a row fetched
    // by anyone reports the same thing.
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
      `SELECT id, url, kind, platform, title, thumbnail, created_at, submitted_by
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
  async list({ limit = 24, offset = 0, sort = 'new' } = {}) {
    const capped = Math.min(Math.max(parseInt(limit, 10) || 24, 1), 100);
    // Paging matters here in a way it does not for search: this is a POOL, and
    // a pool you can only see the first page of is a teaser. The feed scrolls.
    const from = Math.min(Math.max(parseInt(offset, 10) || 0, 0), 5000);
    // Two orderings, both defensible, and an allow-list rather than string
    // interpolation — `sort` arrives from a query string.
    const ORDER = {
      new: 'created_at DESC, id DESC',
      played: 'plays DESC, created_at DESC',
    };
    const order = ORDER[String(sort)] || ORDER.new;
    const { rows } = await query(
      `SELECT id, url, kind, platform, title, thumbnail, created_at, plays, submitted_by
         FROM community_media
        WHERE hidden = FALSE
        ORDER BY ${order}
        LIMIT $1 OFFSET $2`,
      [capped, from],
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
  async signal({ key, from = 0, to = 0, play = false, broken = false, kind, title, pageUrl, poster, channel } = {}) {
    const mediaKey = clean(key, 200);
    if (!mediaKey || !/^[\w.:@/-]+$/.test(mediaKey)) return { ok: false };

    const dir = (v) => (v === 1 || v === -1 ? v : 0);
    const a = dir(from);
    const b = dir(to);
    // A transition moves at most one counter each way: up→down is -1 up, +1 down.
    const dUp = (b === 1 ? 1 : 0) - (a === 1 ? 1 : 0);
    const dDown = (b === -1 ? 1 : 0) - (a === -1 ? 1 : 0);
    const dPlay = play ? 1 : 0;
    const dBroken = broken ? 1 : 0;
    if (!dUp && !dDown && !dPlay && !dBroken) return { ok: true };

    try {
      const { rows } = await query(
        `INSERT INTO media_signals (media_key, kind, title, page_url, poster, channel, ups, downs, plays, broken)
         VALUES ($1, $2, $3, $4, $5, $6, GREATEST($7, 0), GREATEST($8, 0), GREATEST($9, 0), GREATEST($10, 0))
         ON CONFLICT (media_key) DO UPDATE SET
           ups      = GREATEST(media_signals.ups   + $7, 0),
           downs    = GREATEST(media_signals.downs + $8, 0),
           plays    = GREATEST(media_signals.plays + $9, 0),
           broken   = GREATEST(media_signals.broken + $10, 0),
           title    = COALESCE(media_signals.title, EXCLUDED.title),
           page_url = COALESCE(media_signals.page_url, EXCLUDED.page_url),
           poster   = COALESCE(media_signals.poster, EXCLUDED.poster),
           channel  = COALESCE(media_signals.channel, EXCLUDED.channel),
           -- Only "broken" can hide, never votes (see NO ONE CAN HIDE A VIDEO
           -- FROM EVERYONE). Reaching the count is a CANDIDATE: a checkable
           -- platform is asked below before anything stays hidden.
           hidden   = (GREATEST(media_signals.broken + $10, 0)
                        >= $11 + GREATEST(media_signals.ups + $7, 0)),
           updated_at = NOW()
         RETURNING ups, downs, broken, hidden`,
        [
          mediaKey, clean(kind, 32), clean(title, MAX_TITLE), clean(pageUrl, MAX_URL),
          clean(poster, MAX_URL), clean(channel, 120), dUp, dDown, dPlay, dBroken,
          // A checkable platform is verified anyway, so two reports may ask; an
          // uncheckable one needs more people.
          VERIFY_ENDPOINTS[mediaKey.split(':')[0]] ? 2 : BROKEN_UNVERIFIED,
        ],
      );
      const row = rows[0] || {};
      if (row.hidden && (await isReallyGone(mediaKey)) === false) {
        await this.unhide(mediaKey);
        return { ok: true, ...row, hidden: false };
      }
      return { ok: true, ...row };
    } catch (err) {
      logger.warn('Media signal failed', { error: err && err.message });
      return { ok: false };
    }
  },

  /**
   * Everything currently considered dead — the blocklist the player filters
   * search results through before showing them.
   *
   * Deliberately a LIST OF KEYS and nothing else: it is fetched by every
   * visitor, cached, and compared against locally, so it must stay small and
   * carry no metadata worth leaking. Reports below the threshold are not
   * included — one person's region lock is not everyone's.
   */
  async brokenKeys({ limit = 500 } = {}) {
    const capped = Math.min(Math.max(parseInt(limit, 10) || 500, 1), 2000);
    try {
      const { rows } = await query(
        `SELECT media_key FROM media_signals
          WHERE broken > 0 AND hidden = TRUE
          ORDER BY broken DESC
          LIMIT $1`,
        [capped],
      );
      // Anything hidden under the old rules is re-checked before it is served
      // as dead, and restored if the platform says it plays (a few per call,
      // cached, so this list stays fast).
      const keys = [];
      let checks = 0;
      for (const { media_key: key } of rows) {
        if (checks < 10 && VERIFY_ENDPOINTS[key.split(':')[0]]) {
          checks += 1;
          if ((await isReallyGone(key)) === false) { await this.unhide(key); continue; }
        }
        keys.push(key);
      }
      return keys;
    } catch (err) {
      logger.warn('Broken list failed', { error: err && err.message });
      return [];
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
  /**
   * @param offset how far down the ranking to start. THIS IS WHAT LETS THE
   * PLAYER STOP LOOPING: ordered by score with no offset, this returns the
   * same head rows on every single call, and `exclude` only carries 60 keys —
   * so once a browser is 60 videos deep, the pool has nothing new to say. The
   * player's exploration path (utils/explore.js) asks for a random depth
   * instead, which reaches real, human-voted content that the score ordering
   * would never surface.
   */
  /**
   * How popular each of these is, by Truegle's OWN numbers.
   *
   * The Tube results page needed a "Popular" sort and there was no honest
   * signal for one: the search index returns no view counts, and YouTube's own
   * would cost 1 quota unit per video against a 10k/day allowance shared by
   * the whole site. What we do have is this table — anonymous 👍/👎 and play
   * counts, no user id attached to any of it — so Popular means "popular on
   * Truegle", and the UI says exactly that rather than implying it is the
   * platform's count.
   *
   * Same score formula as trending(), minus the recency bonus: this ranks
   * within a result set the user already chose, so leaning on freshness here
   * would quietly make Popular a second Newest.
   *
   * Unknown keys are simply absent from the map. A caller must treat missing
   * as "no signal", NOT as zero — most rows will be missing, and sorting them
   * below a video with a single thumb would be a strong claim built on one
   * press.
   *
   * @param {string[]} keys media keys, as produced by utils/videoEmbed mediaKey()
   * @returns {Promise<Object<string, number>>}
   */
  async scores(keys = []) {
    const wanted = (Array.isArray(keys) ? keys : [])
      .map((k) => clean(k, 200)).filter(Boolean).slice(0, 100);
    if (wanted.length === 0) return {};
    try {
      const { rows } = await query(
        `SELECT media_key,
                ( (ups + 1.0) / (ups + downs + 2.0)
                  - 1.0 / SQRT(ups + downs + 2.0)
                  + LEAST(plays, 50) / 500.0
                ) AS score
           FROM media_signals
          WHERE hidden = FALSE
            AND (ups > 0 OR plays > 0)
            AND media_key = ANY($1)`,
        [wanted],
      );
      return Object.fromEntries(rows.map((r) => [r.media_key, Number(r.score)]));
    } catch (err) {
      // A popularity sort that cannot reach the database falls back to the
      // order it already had. Never an error the user has to read.
      logger.warn('Media scores failed', { error: err && err.message });
      return {};
    }
  },

  async trending({ limit = 20, exclude = [], offset = 0 } = {}) {
    const capped = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const from = Math.min(Math.max(parseInt(offset, 10) || 0, 0), 500);
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
          LIMIT $1 OFFSET $3`,
        [capped, skip.length ? skip : null, from],
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
    let url = clean(rawUrl, MAX_URL);
    if (!url) throw new MediaError('INVALID', 'No link was provided.');
    // Share links (vm.tiktok.com/…) → the video they point at, tracking dropped.
    url = (await expandShortLink(url)) || url;
    // A known platform first. Anything else: read the page for the embed it
    // offers (services/EmbedDiscovery.js, through utils/safeFetch, which only
    // ever reaches the public internet).
    let known;
    try {
      known = classifyMedia(url);
    } catch (err) {
      if (!(err instanceof MediaError) || err.code !== 'UNSUPPORTED') throw err;
      return this.discover(url);
    }
    const { kind, platform, canonical, src, vertical } = known;

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

  /** The embed a page on any other site offers — or UNSUPPORTED if none. */
  async discover(url) {
    const hit = DISCOVERED.get(url);
    if (hit && Date.now() - hit.at < DISCOVERED_TTL_MS) {
      if (!hit.media) throw new MediaError('UNSUPPORTED', 'No playable video or audio was found on that page.');
      return hit.media;
    }
    const classify = (target) => {
      try {
        const k = classifyMedia(target);
        return { kind: k.kind, platform: k.platform, canonical: k.canonical, src: k.src, ...(k.vertical ? { vertical: true } : {}) };
      } catch { return null; }
    };
    let found = null;
    try {
      found = await discoverEmbed(url, { classify });
    } catch (err) {
      logger.warn('embed discovery failed', { error: err && err.message });
    }
    const media = found ? {
      kind: found.kind,
      platform: found.platform || null,
      canonical: found.canonical || null,
      src: found.src,
      pageUrl: url,
      title: found.title || null,
      channel: found.platform || null,
      poster: found.poster || null,
      via: found.via || null,
      ...(found.vertical ? { vertical: true } : {}),
    } : null;
    if (DISCOVERED.size >= DISCOVERED_MAX) DISCOVERED.delete(DISCOVERED.keys().next().value);
    DISCOVERED.set(url, { at: Date.now(), media });
    if (!media) throw new MediaError('UNSUPPORTED', 'No playable video or audio was found on that page.');
    return media;
  },

  /** Put a wrongly hidden video back, and forget the reports against it. */
  async unhide(mediaKey) {
    try {
      await query('UPDATE media_signals SET hidden = FALSE, broken = 0, updated_at = NOW() WHERE media_key = $1', [mediaKey]);
    } catch (err) {
      logger.warn('Unhide failed', { error: err && err.message });
    }
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

module.exports = { MediaService, MediaError, isReallyGone, __verified: verified };
