/**
 * Is this YouTube video a Short? — for the creators feed's Shorts / Videos / All
 * filter.
 *
 * YouTube's uploads lists (Data API playlistItems, channel RSS) do not mark
 * Shorts. Its own /shorts/<id> URL does, keylessly: a Short answers 200, any
 * other video redirects to /watch. A video never changes type, so every answer
 * is cached for good. Costs no API quota (the Data API's is already exhausted
 * most days).
 *
 * FAIL OPEN: a probe that times out, errors or is refused leaves that video
 * UNKNOWN — it is treated as a normal video for now and asked again next time,
 * never cached as a guess.
 */
const TIMEOUT_MS = 4000;
const CONCURRENCY = 8;
const BUDGET_MS = 6000; // whole batch; a slow YouTube must not stall the feed

const known = new Map(); // videoId -> true (Short) | false (not a Short)

async function probeOne(id, fetchImpl, timeoutMs) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetchImpl(`https://www.youtube.com/shorts/${encodeURIComponent(id)}`, {
      method: 'HEAD', redirect: 'manual', signal: ctl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TruegleBot/1.0)', 'Accept-Language': 'en' },
    });
    if (r.status === 200) return true;
    if (r.status >= 300 && r.status < 400) return false; // redirected to /watch
    return undefined; // 404/429/anything else: do not guess
  } catch {
    return undefined;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Stamp `short: true|false` on each video whose type is known; leave it off
 * (unknown) when not. Mutates and returns `videos`.
 */
async function annotateShorts(videos, { fetchImpl = fetch, timeoutMs = TIMEOUT_MS, budgetMs = BUDGET_MS } = {}) {
  const list = Array.isArray(videos) ? videos : [];
  const todo = [...new Set(list.map((v) => v?.videoId).filter((id) => id && !known.has(id)))];
  if (todo.length) {
    const deadline = Date.now() + budgetMs;
    const queue = [...todo];
    const worker = async () => {
      while (queue.length && Date.now() < deadline) {
        const id = queue.shift();
        const res = await probeOne(id, fetchImpl, timeoutMs);
        if (res !== undefined) known.set(id, res);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));
  }
  for (const v of list) {
    if (v?.videoId && known.has(v.videoId)) v.short = known.get(v.videoId);
  }
  return list;
}

/** 'short' → Shorts only; 'video' → everything that is not a Short; else all. */
function matchesKind(v, kind) {
  if (kind === 'short') return v.short === true;
  if (kind === 'video') return v.short !== true;
  return true;
}

module.exports = { annotateShorts, matchesKind, __known: known };
