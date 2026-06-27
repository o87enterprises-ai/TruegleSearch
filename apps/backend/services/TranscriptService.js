/**
 * TranscriptService — fetches YouTube captions without the `youtube-transcript`
 * package, which (a) returns generic errors and (b) can't be routed through a
 * proxy. YouTube blocks datacenter IPs (Vercel/AWS) with a captcha wall, so in
 * production this must go through an HTTP(S) proxy — see TRANSCRIPT_PROXY_URL.
 *
 * Mirrors what the library does: load the watch page, read `captionTracks` out
 * of `ytInitialPlayerResponse`, then fetch + parse the timedtext XML. Throws a
 * `TranscriptError` with a stable `.code` so the route can return an accurate,
 * non-misleading message.
 */
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const config = require('../config/env');

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

/**
 * @param {string} videoId  11-char YouTube ID
 * @param {object} [opts]
 * @param {string} [opts.lang]  Preferred caption language code (e.g. 'en')
 * @returns {Promise<Array<{text:string, offset:number, duration:number}>>}
 */
async function fetchTranscript(videoId, opts = {}) {
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

  const track =
    (lang && tracks.find((t) => t.languageCode === lang)) ||
    tracks.find((t) => t.languageCode && t.languageCode.startsWith('en')) ||
    tracks[0];

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

module.exports = {
  fetchTranscript,
  TranscriptError,
  // exported for unit testing
  _internals: { extractPlayerResponse, parseTimedText, decodeEntities, looksRateLimited },
};
