/**
 * What language is this short text in? For the Feed/Tube "Local" filter.
 *
 * No dependency and no network: posts and titles are short, so this does two
 * cheap, explainable things.
 *   1. SCRIPT. Most of the world's languages are told apart by their alphabet
 *      alone (Cyrillic, Arabic, Devanagari, Thai, Hangul, kana, Han ...).
 *   2. For LATIN-script text, which many languages share, it counts common
 *      function words ("the", "de", "que", "und" ...) per language.
 * When neither gives a clear answer it says 'und' (undetermined) rather than
 * guess: a wrong "not your language" hides a good post.
 *
 * @returns {{ lang: string, script: string }} ISO 639-1 code (or 'und'), and the
 *   dominant script ('latin', 'cyrillic', ..., or 'none').
 */

// Script ranges -> a language when the script maps to (practically) one.
const SCRIPTS = [
  ['hangul', /[가-힯ᄀ-ᇿ]/g, 'ko'],
  ['kana', /[぀-ヿ]/g, 'ja'],
  ['han', /[一-鿿]/g, 'zh'],
  ['cyrillic', /[Ѐ-ӿ]/g, 'ru'],
  ['arabic', /[؀-ۿݐ-ݿ]/g, 'ar'],
  ['hebrew', /[֐-׿]/g, 'he'],
  ['devanagari', /[ऀ-ॿ]/g, 'hi'],
  ['bengali', /[ঀ-৿]/g, 'bn'],
  ['tamil', /[஀-௿]/g, 'ta'],
  ['telugu', /[ఀ-౿]/g, 'te'],
  ['thai', /[฀-๿]/g, 'th'],
  ['greek', /[Ͱ-Ͽ]/g, 'el'],
  ['georgian', /[Ⴀ-ჿ]/g, 'ka'],
  ['armenian', /[԰-֏]/g, 'hy'],
];
const LATIN = /[a-zA-ZÀ-ɏ]/g;

// Frequent function words per Latin-script language. Words shared by several
// languages ("a", "e", "o", "de") are deliberately left out of all of them.
const STOP = {
  en: 'the and of to in is you that it for on with this was are be at have not your what how why my we they from by just like when all can will about one out get if so do new watch video first best',
  es: 'el la los las que y en del se por con para una es al lo como más pero sus le ya muy sin sobre también hay esto está cuando nuevo mejor todo vez hasta',
  pt: 'que não uma com para os das dos pelo pela mais mas como seu sua também já está isso muito quando você vocês então nós ele ela foi são tem',
  fr: 'le les des est une pour dans qui que pas sur avec ce cette sont plus mais aussi comme tout être nous vous elle il ils fait très',
  de: 'der die das und ist nicht ein eine mit auf für den dem sich auch es von zu im wie wir ich sie aber noch nur oder wenn',
  it: 'il di che è per una sono con non gli della del come anche più ma questo questa nel alla tutto molto cosa perché',
  nl: 'het een van en de is dat niet op voor met zijn ook als maar bij nog wat er dit naar je',
  id: 'yang dan di ini itu dengan untuk tidak ada dari ke dalam akan juga saya kamu kami mereka bisa sudah lagi sangat',
  tr: 've bir bu da de için ile çok ne gibi daha ama olan var mı en ben sen o',
  pl: 'nie się jest że na to jak ale czy już tak jego tylko dla przez może bardzo',
  sv: 'och att det som en är på för med inte jag har av till den om',
  vi: 'và của là có không được người những một các cho này với trong đã',
};
const STOP_SETS = Object.fromEntries(Object.entries(STOP).map(([k, v]) => [k, new Set(v.split(/\s+/))]));

function detectLang(text) {
  const s = String(text || '');
  if (!s.trim()) return { lang: 'und', script: 'none' };

  // 1. Script: the most frequent non-Latin script wins if it is a real share.
  const latinCount = (s.match(LATIN) || []).length;
  let best = null;
  for (const [script, re, lang] of SCRIPTS) {
    const n = (s.match(re) || []).length;
    if (n && (!best || n > best.n)) best = { script, lang, n };
  }
  if (best && best.n >= Math.max(2, latinCount * 0.3)) {
    // Han with kana around it is Japanese, not Chinese.
    if (best.script === 'han' && (s.match(/[぀-ヿ]/g) || []).length) return { lang: 'ja', script: 'han' };
    return { lang: best.lang, script: best.script };
  }
  if (!latinCount) return { lang: 'und', script: 'none' };

  // 2. Latin: function-word votes.
  const words = s.toLowerCase().normalize('NFC').match(/[a-zÀ-ɏḀ-ỿ]+/g) || [];
  const score = {};
  for (const w of words) for (const [lang, set] of Object.entries(STOP_SETS)) if (set.has(w)) score[lang] = (score[lang] || 0) + 1;
  // Vietnamese is told by its stacked diacritics as much as by words.
  if (/[ạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹđ]/i.test(s)) score.vi = (score.vi || 0) + 2;
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return { lang: 'und', script: 'latin' };
  const [top, n] = ranked[0];
  const second = ranked[1]?.[1] || 0;
  // Needs a clear lead: two votes, or one vote with nothing competing in a short text.
  if ((n >= 2 && n > second) || (n === 1 && second === 0 && words.length <= 6)) return { lang: top, script: 'latin' };
  return { lang: 'und', script: 'latin' };
}

/** Which script a language is written in (for "is this text even plausible?"). */
const SCRIPT_OF = { ko: 'hangul', ja: 'kana', zh: 'han', ru: 'cyrillic', uk: 'cyrillic', bg: 'cyrillic', ar: 'arabic', fa: 'arabic', ur: 'arabic', he: 'hebrew', hi: 'devanagari', mr: 'devanagari', ne: 'devanagari', bn: 'bengali', ta: 'tamil', te: 'telugu', th: 'thai', el: 'greek', ka: 'georgian', hy: 'armenian' };
const scriptOf = (lang) => SCRIPT_OF[lang] || 'latin';

module.exports = { detectLang, scriptOf };
