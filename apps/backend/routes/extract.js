const express = require('express');
const axios = require('axios');
const router = express.Router();
const { fetchTranscript } = require('../services/TranscriptService');
const logger = require('../utils/logger');
const { rateLimitSearch } = require('../middleware/rateLimit');

// Map TranscriptService error codes → HTTP status + an honest, specific message.
// (The old code always said "captions disabled", which was wrong: the usual
// cause in production is YouTube rate-limiting our datacenter IP.)
const TRANSCRIPT_ERRORS = {
  RATE_LIMITED: {
    status: 429,
    error:
      "YouTube is temporarily rate-limiting Truegle's server. Please try again in a few minutes.",
  },
  NO_CAPTIONS: {
    status: 422,
    error: 'This video has no captions/subtitles available to extract.',
  },
  AGE_RESTRICTED: {
    status: 422,
    error: 'This video is age-restricted or requires sign-in, so its transcript cannot be fetched.',
  },
  UNAVAILABLE: {
    status: 404,
    error: 'This video is unavailable (private, removed, or region-blocked).',
  },
  FETCH_FAILED: {
    status: 502,
    error: 'Could not fetch this transcript from any source right now. Please try again.',
  },
};

function getYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/**
 * POST /api/extract/transcript
 * body: { url: string }
 * Returns plain-text transcript for a YouTube URL.
 */
router.post('/transcript', rateLimitSearch, async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'url is required' });
  }

  const ytId = getYouTubeId(url.trim());
  if (!ytId) {
    return res.status(400).json({
      error: 'Only YouTube URLs are supported for transcript extraction right now.',
    });
  }

  try {
    const segments = await fetchTranscript(ytId);
    const text = segments
      .map((s) => s.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return res.json({
      success: true,
      source: 'youtube',
      videoId: ytId,
      transcript: text,
      wordCount: text.split(/\s+/).length,
      segmentCount: segments.length,
    });
  } catch (err) {
    logger.warn('Transcript extraction failed:', { code: err.code, error: err.message, ytId });
    const mapped = TRANSCRIPT_ERRORS[err.code] || {
      status: 422,
      error: 'Could not extract transcript for this video.',
    };
    return res.status(mapped.status).json({ error: mapped.error, code: err.code });
  }
});

/**
 * POST /api/extract/images
 * body: { url: string }
 * Returns og:image, twitter:image, and up to 20 img src values from a page.
 */
router.post('/images', rateLimitSearch, async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'url is required' });
  }

  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized;

  try {
    const response = await axios.get(normalized, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Truegle-Extractor/1.0; +https://truegle.info)' },
      timeout: 12000,
      maxContentLength: 5 * 1024 * 1024,
      responseType: 'text',
    });

    const html = String(response.data);
    const images = [];
    const seen = new Set();

    const add = (src) => {
      if (!src || seen.has(src) || src.startsWith('data:')) return;
      seen.add(src);
      images.push(src);
    };

    // Meta tags first (highest quality)
    const metaRe = /<meta[^>]+>/gi;
    let mm;
    while ((mm = metaRe.exec(html)) !== null) {
      const tag = mm[0];
      if (/(?:og:image|twitter:image)/i.test(tag)) {
        const cv = tag.match(/content=["']([^"']+)["']/i);
        if (cv) add(cv[1]);
      }
    }

    // img src / srcset
    const imgRe = /<img[^>]+>/gi;
    while ((mm = imgRe.exec(html)) !== null) {
      const tag = mm[0];
      const src = tag.match(/\bsrc=["']([^"']+)["']/i);
      if (src && src[1].length > 4) add(src[1]);
    }

    const base = new URL(normalized);
    const resolved = images
      .map((s) => { try { return new URL(s, base).href; } catch { return null; } })
      .filter((s) => s && /^https?:\/\//i.test(s))
      .slice(0, 24);

    return res.json({ success: true, url: normalized, images: resolved });
  } catch (err) {
    logger.warn('Image extraction failed:', { error: err.message, url: normalized });
    return res.status(422).json({
      error: 'Could not fetch that URL. It may be blocked or require login.',
    });
  }
});

// Hosts we must never let a user-supplied URL point the server at — the SSRF
// guard for any endpoint that fetches an arbitrary URL. Loopback, link-local,
// the cloud metadata address, private ranges, and bare/.local names.
function isBlockedHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (!h.includes('.') && !h.includes(':')) return true; // bare hostname, no TLD
  if (h === '169.254.169.254' || h === 'metadata.google.internal') return true;
  // IPv4 literals in private / loopback / link-local ranges.
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
  return false;
}

/**
 * POST /api/extract/frameable
 * body: { url: string }
 * Server-side check of whether a page will let Truegle embed it in an iframe.
 *
 * WHY THIS EXISTS: X-Frame-Options / CSP frame-ancestors are enforced by the
 * BROWSER and leak nothing back to the framing page (that is the point of a
 * clickjacking header), so the client cannot tell an embeddable page from a
 * refusing one — it just shows the browser's own "can't open this page" error
 * inside the preview. The server, fetching the page itself, CAN read those
 * headers. Returns { frameable: true | false | null } — null means the probe
 * could not decide (timeout/blocked), and the caller should fall back to its
 * static list rather than a broken frame.
 */
router.post('/frameable', rateLimitSearch, async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'url is required' });
  }
  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized;

  let parsed;
  try { parsed = new URL(normalized); } catch { return res.status(400).json({ error: 'invalid url' }); }
  if (!/^https?:$/.test(parsed.protocol) || isBlockedHost(parsed.hostname)) {
    return res.status(400).json({ error: 'url not allowed' });
  }

  try {
    const r = await axios.get(normalized, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Truegle-Framecheck/1.0; +https://truegle.info)' },
      timeout: 8000,
      maxContentLength: 512 * 1024,
      maxRedirects: 3,
      responseType: 'text',
      validateStatus: () => true,
    });

    const xfo = String(r.headers['x-frame-options'] || '').toLowerCase();
    const csp = String(r.headers['content-security-policy'] || '').toLowerCase();
    let frameable = true;
    let reason = null;

    if (xfo.includes('deny') || xfo.includes('sameorigin')) {
      frameable = false;
      reason = `X-Frame-Options: ${xfo.trim()}`;
    }
    // CSP frame-ancestors is the modern control and OVERRIDES X-Frame-Options
    // where both are present. We can embed only if it explicitly allows any
    // origin (a bare `*`); 'none', 'self', or a specific allow-list all exclude
    // Truegle.
    const fa = csp.match(/frame-ancestors([^;]*)/);
    if (fa) {
      const val = fa[1].trim();
      frameable = /(^|\s)\*(\s|$)/.test(val) && !/'none'/.test(val);
      if (!frameable) reason = `CSP frame-ancestors: ${val}`;
      else reason = null;
    }

    return res.json({ success: true, url: normalized, frameable, reason });
  } catch (err) {
    // Timeout, DNS failure, connection refused — we genuinely can't tell. Say
    // so (null) rather than guessing, so the client keeps its static-list call.
    logger.warn('Frameable probe failed:', { error: err.message, url: normalized });
    return res.json({ success: true, url: normalized, frameable: null, reason: 'probe failed' });
  }
});

module.exports = router;
