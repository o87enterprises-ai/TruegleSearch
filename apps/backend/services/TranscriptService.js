/**
 * TranscriptService — fetches YouTube captions.
 *
 * Strategy order (first to yield a transcript wins):
 *   1. INVIDIOUS/PIPED front-ends — these fetch YouTube from THEIR own IPs and
 *      return captions as clean data (WebVTT), so YouTube can't rate-limit
 *      Truegle's datacenter IP. This is the same decentralized YouTube pathway
 *      SearXNG uses, and is the primary fix for the "YouTube is rate-limiting
 *      Truegle's server" error.
 *   2. DIRECT watch-page scrape — load the watch page, read `captionTracks`
 *      from `ytInitialPlayerResponse`, fetch+parse the timedtext XML. Kept as a
 *      last-resort fallback; can be routed through TRANSCRIPT_PROXY_URL.
 *
 * Throws a `TranscriptError` with a stable `.code` so the route returns an
 * accurate, non-misleading message.
 */
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const config = require('../config/env');

// Public Invidious instances (override with TRANSCRIPT_INVIDIOUS_INSTANCES).
// Instances come and go, so we try several and fail over on any error.
const DEFAULT_INVIDIOUS = [
  'https://invidious.nerdvpn.de',
  'https://inv.nadeko.net',
  'https://invidious.jing.rocks',
  'https://yewtu.be',
  'https://invidious.privacyredirect.com',
];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

class TranscriptError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'TranscriptError';
    this.code = code; // RATE_LIMITED | NO_CAPTIONS | AGE_RESTRICTED | UNAVAILABLE | FETCH_FAILED
  }
}

function requestOptions(extra = {}) {
  const opts = {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'en-US,en;q=0.9',
      // CONSENT cookie skips the EU consent interstitial that otherwise hides the page.
      Cookie: 'CONSENT=YES+cb',
    },
    timeout: 15000,
    responseType: 'text',
    maxRedirects: 5,
    validateStatus: () => true,
    ...extra,
  };
  if (config.transcript && config.transcript.proxyUrl) {
    const agent = new HttpsProxyAgent(config.transcript.proxyUrl);
    opts.httpsAgent = agent;
    opts.httpAgent = agent;
    opts.proxy = false; // let the agent handle it, not axios's own proxy logic
  }
  return opts;
}

// YouTube blocks datacenter IPs with /sorry/ + reCAPTCHA. Detect so we report
// the truth ("rate limited") instead of "captions disabled".
function looksRateLimited(status, html) {
  if (status === 429) return true;
  return /unusual traffic|\/sorry\/|g-recaptcha|recaptcha|detected unusual traffic/i.test(html);
}

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
  const lang = opts.lang;
  const instances = (config.transcript && config.transcript.invidiousInstances) || DEFAULT_INVIDIOUS;
  let sawNoCaptions = false;
  let lastErr = null;

  for (const base of instances) {
    try {
      const listResp = await axios.get(
        `${base}/api/v1/captions/${videoId}`,
        requestOptions({ responseType: 'json' })
      );
      if (listResp.status === 429) { lastErr = new TranscriptError('RATE_LIMITED'); continue; }
      if (listResp.status >= 400) { lastErr = new TranscriptError('FETCH_FAILED', `captions list HTTP ${listResp.status}`); continue; }

      const caps = listResp.data && listResp.data.captions;
      if (!Array.isArray(caps) || caps.length === 0) { sawNoCaptions = true; continue; }

      const track = pickTrack(caps, lang, 'languageCode');
      // Invidious returns `url` as an instance-relative path (e.g.
      // /api/v1/captions/<id>?label=English); make it absolute.
      const capUrl = /^https?:\/\//i.test(track.url) ? track.url : `${base}${track.url}`;

      const vttResp = await axios.get(capUrl, requestOptions({ responseType: 'text' }));
      if (vttResp.status >= 400) { lastErr = new TranscriptError('FETCH_FAILED', `caption HTTP ${vttResp.status}`); continue; }

      const body = String(vttResp.data || '');
      // Invidious usually returns WebVTT; some instances proxy raw timedtext XML.
      const segments = /^\s*WEBVTT/.test(body) || body.includes('-->') ? parseVtt(body) : parseTimedText(body);
      if (segments.length) return segments;
      sawNoCaptions = true;
    } catch (err) {
      lastErr = new TranscriptError('FETCH_FAILED', err.message);
    }
  }

  if (sawNoCaptions && !lastErr) throw new TranscriptError('NO_CAPTIONS');
  throw lastErr || new TranscriptError('FETCH_FAILED', 'no invidious instance responded');
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
  _internals: { extractPlayerResponse, parseTimedText, parseVtt, decodeEntities, looksRateLimited, pickTrack, vttTimeToSeconds },
};
