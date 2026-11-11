/**
 * The SPOKEN language of a YouTube video (owner, 2026-11-09: "an english titled
 * video played a foreign language audio").
 *
 * Two keyless-or-cheap sources, in order:
 *   1. The Data API's `defaultAudioLanguage` (videos.list, 50 ids per call,
 *      1 quota unit) when a key is configured and quota is open.
 *   2. YouTube's AUTO-GENERATED captions: YouTube transcribes the audio in the
 *      language it hears, so the language of the "(auto-generated)" track IS the
 *      spoken language. Read through the Invidious pool (services/YouTubeGateway).
 * A video never changes its audio, so every answer is remembered. Unknown stays
 * unknown (no guessing). Other platforms (TikTok, Instagram, Facebook, Rumble)
 * publish no spoken-language signal at all, so this is YouTube only.
 */
const gateway = require('./YouTubeGateway');

const known = new Map(); // videoId -> 'en' | 'es' | ... | null (asked, no answer)
const MAX_KNOWN = 20000;
const remember = (id, lang) => {
  if (known.size >= MAX_KNOWN) known.delete(known.keys().next().value);
  known.set(id, lang);
};
const primary = (code) => (code ? String(code).toLowerCase().split(/[-_]/)[0] : null);

async function viaDataApi(ids, fetchImpl) {
  const key = process.env.YOUTUBE_API_KEY;
  const out = new Map();
  if (!key || !ids.length) return out;
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    try {
      const r = await fetchImpl(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${batch.join(',')}&key=${key}`);
      if (!r.ok) break; // quota out or key refused: the caption route still runs
      const j = await r.json();
      for (const it of j.items || []) {
        const l = primary(it.snippet?.defaultAudioLanguage);
        if (it.id && l) out.set(it.id, l);
      }
    } catch { break; }
  }
  return out;
}

const AUTO = /auto-?generated|automatisch|automático|automática|automatique|automatico/i;
async function viaCaptions(id, captionList) {
  try {
    const hit = await captionList(id);
    const caps = hit?.data?.captions || [];
    const auto = caps.find((c) => AUTO.test(String(c.label || '')));
    return primary(auto?.languageCode || auto?.language_code);
  } catch { return null; }
}

/**
 * Spoken language for each id that can be found within the budget.
 * @returns {Promise<Map<string,string>>} id -> language (only the known ones)
 */
async function lookup(ids, { budgetMs = 3000, concurrency = 4, max = 30, fetchImpl = fetch, captionList = gateway.captionList } = {}) {
  const want = [...new Set((ids || []).filter(Boolean))].slice(0, max);
  const result = new Map();
  const todo = [];
  for (const id of want) {
    if (known.has(id)) { if (known.get(id)) result.set(id, known.get(id)); } else todo.push(id);
  }
  if (!todo.length) return result;
  const deadline = Date.now() + budgetMs;
  const timeLeft = () => Math.max(0, deadline - Date.now());
  const race = (p) => Promise.race([p, new Promise((r) => { setTimeout(() => r(null), timeLeft()); })]);

  const fromApi = await race(viaDataApi(todo, fetchImpl)) || new Map();
  for (const [id, l] of fromApi) { remember(id, l); result.set(id, l); }

  const queue = todo.filter((id) => !fromApi.has(id));
  const worker = async () => {
    while (queue.length && timeLeft() > 0) {
      const id = queue.shift();
      const l = await race(viaCaptions(id, captionList));
      if (l) { remember(id, l); result.set(id, l); } else if (timeLeft() > 0) remember(id, null);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  return result;
}

module.exports = { lookup, __known: known };
