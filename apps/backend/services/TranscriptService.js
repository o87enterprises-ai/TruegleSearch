/**
 * TranscriptService — fetches YouTube captions.
 *
 * Strategy order (first to yield a transcript wins):
 *   1. INVIDIOUS/PIPED front-ends via YouTubeGateway — these fetch YouTube from
 *      THEIR own IPs and return captions as clean data (WebVTT), so YouTube
 *      can't rate-limit Truegle's datacenter IP. This is the same decentralized
 *      YouTube pathway SearXNG uses, and is the primary fix for the "YouTube is
 *      rate-limiting Truegle's server" error.
 *   2. DIRECT watch-page scrape — load the watch page, read `captionTracks`
 *      from `ytInitialPlayerResponse`, fetch+parse the timedtext XML. Kept as a
 *      last-resort fallback; can be routed through TRANSCRIPT_PROXY_URL.
 *
 * The instance pool, its rotation and its failure cooldowns now live in
 * YouTubeGateway, shared with the creator-feed routes. They used to be a
 * private list in this file, which meant a captcha on the creator page learned
 * nothing from a captcha on transcripts, and vice versa — two services
 * discovering the same dead instance independently, all day.
 *
 * Throws a `TranscriptError` with a stable `.code` so the route returns an
 * accurate, non-misleading message.
 */
const axios = require('axios');
const gateway = require('./YouTubeGateway');

class TranscriptError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'TranscriptError';
    this.code = code; // RATE_LIMITED | NO_CAPTIONS | AGE_RESTRICTED | UNAVAILABLE | FETCH_FAILED
  }
}

// Headers, timeout and the optional TRANSCRIPT_PROXY_URL agent — same builder
// the gateway uses for its own calls, so a proxy configured for one path is
// configured for all of them.
const requestOptions = gateway.requestOptions;

// YouTube blocks datacenter IPs with /sorry/ + reCAPTCHA. Detect so we report
// the truth ("rate limited") instead of "captions disabled".
const looksRateLimited = gateway.looksBlocked;

// Extract the JSON object assigned to ytInitialPlayerResponse via brace-matching
// (regex alone is unreliable for nested JSON).
function extractPlayerResponse(html) {
  const marker = 'ytInitialPlayerResponse';
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const braceStart = html.indexOf('{', idx);
  if (braceStart === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = braceStart; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(braceStart, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", '#160': ' ' };
function decodeEntities(str) {
  return str.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
    if (e[0] === '#') {
      const isHex = e[1] === 'x' || e[1] === 'X';
      const code = parseInt(isHex ? e.slice(2) : e.slice(1), isHex ? 16 : 10);
      return Number.isNaN(code) ? m : String.fromCodePoint(code);
    }
    return ENTITIES[e] ?? m;
  });
}

function parseTimedText(xml) {
  const segments = [];
  const re = /<text start="([\d.]+)"(?:\s+dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const text = decodeEntities(m[3].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    if (text) {
      segments.push({ text, offset: parseFloat(m[1]), duration: parseFloat(m[2] || '0') });
    }
  }
  return segments;
}

// hh:mm:ss.mmm (or mm:ss.mmm) → seconds
function vttTimeToSeconds(t) {
  const parts = t.split(':').map(Number);
  if (parts.some(Number.isNaN)) return NaN;
  let s = 0;
  for (const p of parts) s = s * 60 + p;
  return s;
}

/**
 * Parse WebVTT (what Invidious/Piped caption endpoints return) into the same
 * {text, offset, duration} segment shape as parseTimedText. Tolerates cue
 * settings on the timing line, cue identifiers, and inline tags.
 */
function parseVtt(vtt) {
  const segments = [];
  const timing = /(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{3}\s*-->\s*(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{3}/;
  const blocks = String(vtt).replace(/\r/g, '').split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split('\n');
    const tIdx = lines.findIndex((l) => timing.test(l));
    if (tIdx === -1) continue;
    const arrow = lines[tIdx].split('-->');
    const start = vttTimeToSeconds(arrow[0].trim().replace(',', '.'));
    const end = vttTimeToSeconds((arrow[1] || '').trim().split(/\s+/)[0].replace(',', '.'));
    if (Number.isNaN(start)) continue;
    const text = decodeEntities(lines.slice(tIdx + 1).join(' ').replace(/<[^>]+>/g, ''))
      .replace(/\s+/g, ' ')
      .trim();
    if (text) {
      segments.push({
        text,
        offset: start,
        duration: Number.isNaN(end) ? 0 : Math.max(0, end - start),
      });
    }
  }
  return segments;
}

// Choose the best caption track: exact requested lang, then any English, then
// the first available. Shared by the Invidious and watch-page paths.
function pickTrack(tracks, lang, codeKey) {
  return (
    (lang && tracks.find((t) => t[codeKey] === lang)) ||
    tracks.find((t) => t[codeKey] && String(t[codeKey]).startsWith('en')) ||
    tracks[0]
  );
}

/**
 * Strategy 1 — Invidious/Piped front-ends. Fetched from the instance's IP, not
 * ours, so YouTube's datacenter rate-limit never applies. Tries each configured
 * instance until one returns captions.
 * @returns {Promise<Array<{text:string, offset:number, duration:number}>>}
 */
async function fetchViaInvidious(videoId, opts = {}) {
  // The pool decides WHICH instance and remembers which ones are sick; this
  // function only has to know what a caption track looks like.
  const hit = await gateway.captionList(videoId);
  if (!hit) throw new TranscriptError('FETCH_FAILED', 'no invidious instance responded');

  const caps = hit.data.captions;
  // The instance answered, and its answer was "this video has none". That is a
  // fact about the video, not about the instance — asking a second front-end
  // the same question gets the same answer more slowly.
  if (!caps.length) throw new TranscriptError('NO_CAPTIONS');

  const track = pickTrack(caps, opts.lang, 'languageCode');
  const body = await gateway.captionBody(hit.base, track.url);
  if (body === null) throw new TranscriptError('FETCH_FAILED', 'caption fetch failed');

  // Invidious usually returns WebVTT; some instances proxy raw timedtext XML.
  const segments = /^\s*WEBVTT/.test(body) || body.includes('-->') ? parseVtt(body) : parseTimedText(body);
  if (!segments.length) throw new TranscriptError('NO_CAPTIONS');
  return segments;
}

/**
 * Strategy 2 — direct YouTube watch-page scrape (last resort).
 * @param {string} videoId  11-char YouTube ID
 * @param {object} [opts]
 * @param {string} [opts.lang]  Preferred caption language code (e.g. 'en')
 * @returns {Promise<Array<{text:string, offset:number, duration:number}>>}
 */
async function fetchViaWatchPage(videoId, opts = {}) {
  const lang = opts.lang;
  let watch;
  try {
    watch = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, requestOptions());
  } catch (err) {
    throw new TranscriptError('FETCH_FAILED', err.message);
  }

  const html = String(watch.data || '');
  if (looksRateLimited(watch.status, html)) {
    throw new TranscriptError('RATE_LIMITED');
  }
  if (watch.status >= 400) {
    throw new TranscriptError('FETCH_FAILED', `watch page HTTP ${watch.status}`);
  }

  const player = extractPlayerResponse(html);
  if (!player) {
    // No player JSON usually means a block/interstitial we didn't pattern-match.
    throw new TranscriptError('RATE_LIMITED');
  }

  const status = player.playabilityStatus && player.playabilityStatus.status;
  if (status === 'LOGIN_REQUIRED' || status === 'AGE_CHECK_REQUIRED') {
    throw new TranscriptError('AGE_RESTRICTED');
  }
  if (status === 'ERROR' || status === 'UNPLAYABLE') {
    throw new TranscriptError('UNAVAILABLE');
  }

  const tracks =
    player.captions &&
    player.captions.playerCaptionsTracklistRenderer &&
    player.captions.playerCaptionsTracklistRenderer.captionTracks;
  if (!tracks || !tracks.length) {
    throw new TranscriptError('NO_CAPTIONS');
  }

  const track = pickTrack(tracks, lang, 'languageCode');

  // Drop any &fmt= so we get the default XML timedtext format we parse below.
  const baseUrl = track.baseUrl.replace(/&fmt=[^&]*/g, '');

  let xmlResp;
  try {
    xmlResp = await axios.get(baseUrl, requestOptions());
  } catch (err) {
    throw new TranscriptError('FETCH_FAILED', err.message);
  }
  if (xmlResp.status >= 400) {
    throw new TranscriptError('FETCH_FAILED', `timedtext HTTP ${xmlResp.status}`);
  }

  const segments = parseTimedText(String(xmlResp.data || ''));
  if (!segments.length) {
    throw new TranscriptError('NO_CAPTIONS');
  }
  return segments;
}

// Which error codes are authoritative — the video genuinely can't be
// transcribed, so there's no point trying another strategy.
const TERMINAL_CODES = new Set(['AGE_RESTRICTED', 'UNAVAILABLE']);
// Preference when every strategy fails: NO_CAPTIONS (actionable) beats
// transient RATE_LIMITED/FETCH_FAILED.
const CODE_PRIORITY = { NO_CAPTIONS: 3, RATE_LIMITED: 2, FETCH_FAILED: 1 };

/**
 * Fetch a YouTube transcript, trying Invidious front-ends first (unblockable)
 * then the direct watch-page scrape. Returns {text, offset, duration} segments.
 *
 * @param {string} videoId  11-char YouTube ID
 * @param {object} [opts]
 * @param {string} [opts.lang]  Preferred caption language code (e.g. 'en')
 * @returns {Promise<Array<{text:string, offset:number, duration:number}>>}
 */
async function fetchTranscript(videoId, opts = {}) {
  const strategies = [fetchViaInvidious, fetchViaWatchPage];
  let best = null; // most informative error seen so far

  for (const strategy of strategies) {
    try {
      const segments = await strategy(videoId, opts);
      if (segments && segments.length) return segments;
    } catch (err) {
      const code = (err && err.code) || 'FETCH_FAILED';
      if (TERMINAL_CODES.has(code)) throw err; // no other strategy can help
      if (!best || (CODE_PRIORITY[code] || 0) > (CODE_PRIORITY[best.code] || 0)) best = err;
    }
  }
  throw best || new TranscriptError('FETCH_FAILED');
}

module.exports = {
  fetchTranscript,
  TranscriptError,
  // exported for unit testing
  _internals: { fetchViaInvidious, extractPlayerResponse, parseTimedText, parseVtt, decodeEntities, looksRateLimited, pickTrack, vttTimeToSeconds },
};
