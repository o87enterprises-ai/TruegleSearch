/**
 * YouTubeGateway — one rotating, health-checked front door to YouTube.
 *
 * THE PROBLEM. YouTube blocks datacenter IPs. Vercel and AWS are datacenter
 * IPs. So every unauthenticated call we make from the server — the watch-page
 * scrape behind transcripts, the channel RSS behind creator pages, the channel
 * page behind the creator card — can come back as `/sorry/` + reCAPTCHA
 * instead of data, and the whole feature reads as broken.
 *
 * THE FIX, AND WHY IT COSTS NOTHING. Public Invidious instances fetch YouTube
 * from THEIR own IPs and hand back clean JSON. A pool of them is, in effect, a
 * rotating proxy chain — a different IP per request — without paying a proxy
 * vendor and, more importantly, without routing anything through an unknown
 * third party that can read it. (Residential rotating proxies run $50–300/mo,
 * and the free pools are the ones you should trust least. For a product whose
 * pitch is privacy, "we send your requests through someone else's server so
 * they can log them" is a regression, not a workaround.)
 *
 * WHAT THIS ADDS OVER THE OLD PER-SERVICE LOOP. TranscriptService already
 * walked a list of five instances in order. Three problems with that, all
 * fixed here:
 *
 *   1. NO MEMORY. A dead instance was retried on the very next request, and
 *      the one after that, paying its full timeout every time. Failures now
 *      earn an exponential cooldown (2 → 4 → 8 … capped at an hour), so a dead
 *      instance is skipped instead of re-discovered.
 *   2. ALWAYS THE SAME FIRST HOP. Fixed order means instance #1 takes every
 *      request and gets itself rate-limited on our behalf — the exact problem
 *      the pool exists to solve. A rotating cursor spreads the load, which is
 *      what actually makes "a different IP each time" true.
 *   3. TRANSCRIPTS ONLY. The RSS and channel-page calls had no failover at
 *      all: one captcha and the creator page went blank. They use the pool now
 *      too.
 *
 * Direct youtube.com stays as a first try where it is cheap and usually works
 * (RSS in particular is tolerant), with the pool underneath it. The keyed Data
 * API is untouched and is not part of this: it is quota-limited, not IP-limited,
 * and never sees a captcha.
 */
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const config = require('../config/env');
const logger = require('../utils/logger');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Public Invidious instances. Wider than the old five on purpose — the pool's
// value is proportional to how many independent IPs are in it, and instances
// come and go, so a list that survives attrition needs slack in it.
// Override wholesale with TRANSCRIPT_INVIDIOUS_INSTANCES.
const DEFAULT_INSTANCES = [
  'https://invidious.nerdvpn.de',
  'https://inv.nadeko.net',
  'https://invidious.jing.rocks',
  'https://yewtu.be',
  'https://invidious.privacyredirect.com',
  'https://invidious.f5.si',
  'https://iv.melmac.space',
  'https://invidious.protokolla.fi',
  'https://inv.tux.pizza',
  'https://invidious.reallyaweso.me',
  'https://iv.datura.network',
  'https://invidious.einfachzocken.eu',
];

const COOLDOWN_BASE_MS = 2 * 60 * 1000;   // first failure sits out two minutes
const COOLDOWN_MAX_MS = 60 * 60 * 1000;   // …doubling to an hour, no further
const REQUEST_TIMEOUT_MS = 8000;          // a front-end that is slow IS a failure

/** health[base] = { fails, until, lastOk } */
const health = new Map();
let cursor = 0;

const instances = () =>
  (config.transcript && config.transcript.invidiousInstances) || DEFAULT_INSTANCES;

function state(base) {
  let s = health.get(base);
  if (!s) { s = { fails: 0, until: 0, lastOk: 0 }; health.set(base, s); }
  return s;
}

/**
 * A failure buys silence. Doubling matters more than the starting value: an
 * instance that is genuinely gone should stop costing us a timeout per request
 * within a few minutes, not keep costing one all day.
 */
function penalize(base, reason) {
  const s = state(base);
  s.fails += 1;
  s.until = Date.now() + Math.min(COOLDOWN_BASE_MS * 2 ** (s.fails - 1), COOLDOWN_MAX_MS);
  logger.debug?.('yt front-end cooling down', { base, reason, fails: s.fails, forMs: s.until - Date.now() });
}

/** One success clears the whole penalty. Instances recover; grudges are noise. */
function reward(base) {
  const s = state(base);
  s.fails = 0;
  s.until = 0;
  s.lastOk = Date.now();
}

/**
 * The instances worth trying, in the order to try them.
 *
 * The rotating start is the point: without it the first healthy instance in the
 * list serves every request and earns its own rate-limit, which is the failure
 * this pool exists to avoid. Instances still cooling down go last rather than
 * being dropped — if every instance is cold, a long-shot attempt beats
 * returning nothing.
 */
function ordered() {
  const all = instances();
  if (!all.length) return [];
  const now = Date.now();
  const start = cursor % all.length;
  cursor = (cursor + 1) % all.length;
  const rotated = [...all.slice(start), ...all.slice(0, start)];
  const ready = rotated.filter((b) => state(b).until <= now);
  const cold = rotated.filter((b) => state(b).until > now);
  return [...ready, ...cold];
}

// YouTube's block wall, whatever door it arrives at. Detecting it matters
// beyond retrying: without it the caller reports "no captions" or "channel not
// found" for a video that has captions and a channel that exists.
//
// The body check runs on STRINGS ONLY, and that is the whole subtlety. Ask
// axios for JSON and hand it an HTML captcha page and it gives you back the
// raw string — a 200 with a body that parses as nothing. Skipping the body
// test on JSON requests let exactly that sail through as a healthy "no
// results", so the instance serving a captcha was rewarded instead of cooled
// down, and a caller with a permissive accept() would return the captcha page
// as data. Parsed objects can't contain the wall, so testing them is free and
// harmless; not testing strings was the bug.
function looksBlocked(status, body) {
  if (status === 429) return true;
  if (typeof body !== 'string') return false;
  return /unusual traffic|\/sorry\/|g-recaptcha|recaptcha|detected unusual traffic/i.test(body);
}

function requestOptions(extra = {}) {
  const opts = {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'en-US,en;q=0.9',
      // Skips the EU consent interstitial that otherwise hides the page.
      Cookie: 'CONSENT=YES+cb',
    },
    timeout: REQUEST_TIMEOUT_MS,
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

/**
 * Ask the pool for one path until an instance answers.
 *
 * @param {string} path  instance-relative, e.g. `/api/v1/channels/UC…`
 * @param {object} [opts]
 * @param {'json'|'text'} [opts.as='json']
 * @param {(data:any)=>boolean} [opts.accept]  treat a 200 as a MISS unless this
 *   passes. Some instances answer 200 with an empty envelope; without this the
 *   first such instance ends the search with nothing.
 * @returns {Promise<{base:string, data:any}|null>}
 */
async function fromPool(path, { as = 'json', accept } = {}) {
  for (const base of ordered()) {
    try {
      const r = await axios.get(`${base}${path}`, requestOptions({ responseType: as }));
      if (r.status === 429 || r.status >= 500 || looksBlocked(r.status, r.data)) {
        penalize(base, `http ${r.status}`);
        continue;
      }
      // A 404 is the INSTANCE ANSWERING — the video or channel is not there.
      // Penalising it would cool down a perfectly healthy front-end for
      // telling us the truth, so it is a miss, not a fault.
      if (r.status >= 400) { reward(base); continue; }
      if (accept && !accept(r.data)) { reward(base); continue; }
      reward(base);
      return { base, data: r.data };
    } catch (err) {
      penalize(base, err.code || err.message);
    }
  }
  return null;
}

/**
 * Fetch straight from youtube.com. Returns null when the response is the block
 * wall, so callers can fall through to the pool instead of parsing a captcha
 * page and reporting whatever nonsense it yields.
 */
async function direct(url, { as = 'text' } = {}) {
  try {
    const r = await axios.get(url, requestOptions({ responseType: as }));
    if (looksBlocked(r.status, r.data)) {
      logger.warn('youtube blocked a direct request (datacenter IP)', { url: url.slice(0, 80) });
      return null;
    }
    if (r.status >= 400) return null;
    return r.data;
  } catch {
    return null;
  }
}

// ── the calls the rest of the app actually makes ────────────────────────────

/** Latest uploads for a channel. Direct RSS first (tolerant, and the richest
 *  payload), the pool second. Returns raw RSS XML or an Invidious video list. */
async function channelUploads(channelId) {
  const xml = await direct(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`);
  if (typeof xml === 'string' && xml.includes('<entry')) return { kind: 'rss', data: xml };

  const hit = await fromPool(`/api/v1/channels/${encodeURIComponent(channelId)}/videos`, {
    accept: (d) => Array.isArray(d?.videos) ? d.videos.length > 0 : Array.isArray(d) && d.length > 0,
  });
  if (!hit) return null;
  return { kind: 'invidious', data: Array.isArray(hit.data) ? hit.data : hit.data.videos, via: hit.base };
}

/** Name, bio and avatar for a channel, without a key. */
async function channelAbout(channelId) {
  const hit = await fromPool(`/api/v1/channels/${encodeURIComponent(channelId)}`, {
    accept: (d) => !!(d && d.author),
  });
  if (!hit) return null;
  const d = hit.data;
  const thumbs = Array.isArray(d.authorThumbnails) ? d.authorThumbnails : [];
  const biggest = thumbs.length ? thumbs[thumbs.length - 1].url : null;
  return {
    channelId,
    name: d.author || null,
    bio: String(d.description || '').slice(0, 600) || null,
    avatar: biggest && (biggest.startsWith('//') ? `https:${biggest}` : biggest),
    handle: d.authorHandle || null,
    subscribers: typeof d.subCount === 'number' ? d.subCount : null,
    source: 'invidious',
    via: hit.base,
  };
}

/** @handle → UC… id. Newer Invidious resolves handles on the channels route. */
async function resolveHandle(handle) {
  const clean = String(handle).replace(/^@+/, '');
  const hit = await fromPool(`/api/v1/channels/@${encodeURIComponent(clean)}`, {
    accept: (d) => /^UC[A-Za-z0-9_-]{20,30}$/.test(d?.authorId || ''),
  });
  if (hit) return hit.data.authorId;

  const search = await fromPool(`/api/v1/search?q=${encodeURIComponent(clean)}&type=channel`, {
    accept: (d) => Array.isArray(d) && d.length > 0,
  });
  const match = Array.isArray(search?.data)
    ? search.data.find((c) => String(c.author || '').toLowerCase().replace(/\s+/g, '') === clean.toLowerCase()
        || String(c.authorHandle || '').replace(/^@/, '').toLowerCase() === clean.toLowerCase())
    : null;
  return match && /^UC[A-Za-z0-9_-]{20,30}$/.test(match.authorId || '') ? match.authorId : null;
}

/** Caption tracks for a video, from whichever front-end answers. */
const captionList = (videoId) =>
  fromPool(`/api/v1/captions/${encodeURIComponent(videoId)}`, {
    accept: (d) => Array.isArray(d?.captions),
  });

/** A caption track's body. `url` may be instance-relative, hence the base. */
async function captionBody(base, url) {
  const abs = /^https?:\/\//i.test(url) ? url : `${base}${url}`;
  try {
    const r = await axios.get(abs, requestOptions({ responseType: 'text' }));
    if (r.status >= 400) { penalize(base, `caption http ${r.status}`); return null; }
    return String(r.data || '');
  } catch (err) {
    penalize(base, err.code || err.message);
    return null;
  }
}

/** Operational visibility — which front-ends are up, which are sitting out. */
function poolStatus() {
  const now = Date.now();
  return instances().map((base) => {
    const s = state(base);
    return {
      base,
      ready: s.until <= now,
      fails: s.fails,
      cooldownMs: Math.max(0, s.until - now),
      lastOk: s.lastOk || null,
    };
  });
}

module.exports = {
  channelUploads,
  channelAbout,
  resolveHandle,
  captionList,
  captionBody,
  direct,
  fromPool,
  looksBlocked,
  requestOptions,
  poolStatus,
  DEFAULT_INSTANCES,
  // exported for tests
  _internals: { penalize, reward, ordered, health },
};
