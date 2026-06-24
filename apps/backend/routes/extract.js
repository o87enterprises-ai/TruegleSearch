const express = require('express');
const axios = require('axios');
const router = express.Router();
const { YoutubeTranscript } = require('youtube-transcript');
const logger = require('../utils/logger');
const { rateLimitSearch } = require('../middleware/rateLimit');

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
    const segments = await YoutubeTranscript.fetchTranscript(ytId);
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
    logger.warn('Transcript extraction failed:', { error: err.message, ytId });
    return res.status(422).json({
      error: 'Could not extract transcript. The video may have captions disabled or be age-restricted.',
    });
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

module.exports = router;
