/* ── Spelling mode ──────────────────────────────────────────────────────────
 *
 * THE ASK: "a 'spelling' trigger that compiles the letters spoken into words
 * and can identify commands such as space, period, comma, etc so the user can
 * continue searching for songs without needing to type (useful for driving and
 * exercise)."
 *
 * WHY IT IS NEEDED AT ALL, given that dictation already exists. Speech
 * recognition is a LANGUAGE model: it is guessing the most likely sentence, so
 * it is very good at ordinary words and very bad at exactly the things people
 * search for in music — artist names, invented spellings, handles. Say
 * "Lefty Gunplay" and you may get "lefty gun play"; say "MF DOOM" and you get
 * "MF doom" or "em eff doom". Spelling sidesteps the model's strength: one
 * letter at a time is not a sentence for it to improve on.
 *
 * THE HARD PART is that a recogniser does not return letters. Asked for "b" it
 * returns "be" or "bee"; for "c", "see" or "sea"; for "u", "you"; for "r",
 * "are". These are not errors — they are the most likely English words for
 * those sounds, and the model is right to prefer them. So the alphabet below
 * maps the SOUNDS back to letters, which is the whole trick, and is why NATO
 * words are accepted too ("alpha", "bravo") for anyone who knows to use them.
 *
 * Everything here is pure and synchronous so it can be tested without a
 * microphone — see scripts/verify-spelling.mjs.
 */

// Sounds a recogniser actually returns for each letter. First entry is the
// letter itself; the rest are what it says instead.
const LETTER_SOUNDS = {
  a: ['a', 'ay', 'eh', 'alpha', 'alfa'],
  b: ['b', 'be', 'bee', 'bravo'],
  c: ['c', 'see', 'sea', 'si', 'charlie'],
  d: ['d', 'dee', 'delta'],
  e: ['e', 'ee', 'echo'],
  f: ['f', 'ef', 'eff', 'foxtrot'],
  g: ['g', 'gee', 'golf'],
  h: ['h', 'aitch', 'hotel'],
  i: ['i', 'eye', 'india'],
  j: ['j', 'jay', 'juliet', 'juliett'],
  k: ['k', 'kay', 'kilo'],
  l: ['l', 'el', 'ell', 'lima'],
  m: ['m', 'em', 'mike'],
  n: ['n', 'en', 'november'],
  o: ['o', 'oh', 'owe', 'oscar'],
  p: ['p', 'pee', 'pea', 'papa'],
  q: ['q', 'cue', 'queue', 'quebec'],
  r: ['r', 'are', 'ar', 'romeo'],
  s: ['s', 'es', 'ess', 'sierra'],
  t: ['t', 'tee', 'tea', 'tango'],
  u: ['u', 'you', 'ewe', 'uniform'],
  v: ['v', 'vee', 'victor'],
  w: ['w', 'double u', 'double you', 'whiskey', 'whisky'],
  x: ['x', 'ex', 'xray', 'x-ray'],
  y: ['y', 'why', 'wye', 'yankee'],
  z: ['z', 'zee', 'zed', 'zulu'],
};

const DIGIT_SOUNDS = {
  0: ['0', 'zero', 'oh', 'nought'],
  1: ['1', 'one', 'won'],
  2: ['2', 'two', 'too', 'to'],
  3: ['3', 'three'],
  4: ['4', 'four', 'for', 'fore'],
  5: ['5', 'five'],
  6: ['6', 'six'],
  7: ['7', 'seven'],
  8: ['8', 'eight', 'ate'],
  9: ['9', 'nine'],
};

// Spoken punctuation. Longest phrases must be matched first — "question mark"
// has to win over "question", and "full stop" over "full".
const PUNCTUATION = {
  'question mark': '?',
  'exclamation mark': '!',
  'exclamation point': '!',
  'open bracket': '(',
  'close bracket': ')',
  'open paren': '(',
  'close paren': ')',
  'full stop': '.',
  'double quote': '"',
  'quotation mark': '"',
  ampersand: '&',
  apostrophe: "'",
  underscore: '_',
  semicolon: ';',
  asterisk: '*',
  percent: '%',
  hyphen: '-',
  period: '.',
  comma: ',',
  colon: ':',
  slash: '/',
  dash: '-',
  minus: '-',
  plus: '+',
  equals: '=',
  hash: '#',
  hashtag: '#',
  at: '@',
  dot: '.',
  quote: "'",
  space: ' ',
};

// Editing and control words. These do not append text, they act.
export const COMMANDS = {
  backspace: 'delete',
  delete: 'delete',
  'delete that': 'delete',
  undo: 'delete',
  clear: 'clear',
  'clear all': 'clear',
  'start over': 'clear',
  scratch: 'clear',
  enter: 'submit',
  submit: 'submit',
  search: 'submit',
  go: 'submit',
  play: 'submit',
  done: 'submit',
  stop: 'stop',
  cancel: 'cancel',
};

/** sound -> letter/digit, built once. */
const SOUND_MAP = (() => {
  const map = new Map();
  for (const [ch, sounds] of Object.entries(LETTER_SOUNDS)) {
    for (const s of sounds) map.set(s, ch);
  }
  for (const [ch, sounds] of Object.entries(DIGIT_SOUNDS)) {
    // Letters win a collision: "oh" is far more often the letter O than a zero
    // when someone is spelling, and "to"/"too" are more often the digit 2 only
    // because nobody spells with them. Set only if unclaimed.
    for (const s of sounds) if (!map.has(s)) map.set(s, ch);
  }
  return map;
})();

// Punctuation phrases, longest first, so multi-word ones match before their
// first word is consumed as something else.
const PUNCT_PHRASES = Object.keys(PUNCTUATION).sort((a, b) => b.split(' ').length - a.split(' ').length);

/**
 * Compile a spoken utterance into typed text.
 *
 * @param {string} transcript what the recogniser heard
 * @param {string} [existing] text typed so far (delete/clear act on this)
 * @returns {{text: string, action: string|null}}
 *   action is 'submit' | 'stop' | 'cancel' | null. `text` is the full new value,
 *   not a delta, so a caller never has to reconstruct state.
 */
export function compileSpelling(transcript, existing = '') {
  let text = existing;
  let action = null;

  // Punctuation is spoken, so the recogniser's OWN punctuation is noise here:
  // "period" arriving as "period." would otherwise add a full stop nobody said.
  const words = String(transcript || '')
    .toLowerCase()
    .replace(/[.,!?;:]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  for (let i = 0; i < words.length;) {
    // Try the longest phrases first: two-word punctuation, then commands, then
    // single sounds.
    let matched = false;

    for (const phrase of PUNCT_PHRASES) {
      const parts = phrase.split(' ');
      if (parts.length > words.length - i) continue;
      if (words.slice(i, i + parts.length).join(' ') !== phrase) continue;
      text += PUNCTUATION[phrase];
      i += parts.length;
      matched = true;
      break;
    }
    if (matched) continue;

    const two = words.slice(i, i + 2).join(' ');
    if (COMMANDS[two]) {
      ({ text, action } = applyCommand(COMMANDS[two], text, action));
      i += 2;
      continue;
    }
    const one = words[i];
    if (COMMANDS[one]) {
      ({ text, action } = applyCommand(COMMANDS[one], text, action));
      i += 1;
      continue;
    }

    // "double u" for W is the only two-word letter sound.
    if (SOUND_MAP.has(two)) { text += SOUND_MAP.get(two); i += 2; continue; }
    if (SOUND_MAP.has(one)) { text += SOUND_MAP.get(one); i += 1; continue; }

    // Not a letter, not a command, not punctuation. It is a WORD the recogniser
    // was confident about — most likely the user gave up spelling mid-way and
    // just said it. Taking it literally is far more useful than dropping it,
    // and dropping it silently is how a voice UI earns its reputation.
    text += one;
    i += 1;
  }

  return { text, action };
}

function applyCommand(cmd, text, action) {
  if (cmd === 'delete') return { text: text.slice(0, -1), action };
  if (cmd === 'clear') return { text: '', action };
  return { text, action: cmd };
}

/**
 * Plain dictation: no letter mapping, just what was heard, appended.
 * Kept here beside spelling so the two modes share one entry point and a
 * caller only ever chooses a flag.
 */
export function compileDictation(transcript, existing = '') {
  const heard = String(transcript || '').trim();
  if (!heard) return { text: existing, action: null };

  // The control words still work in plain dictation — "clear" and "search" are
  // how you fix and finish a query without a keyboard, and needing to switch
  // modes to say them would defeat the point.
  const key = heard.toLowerCase().replace(/[.!?]+$/, '');
  if (COMMANDS[key]) return applyCommand(COMMANDS[key], existing, null);

  return {
    text: existing ? `${existing.replace(/\s+$/, '')} ${heard}` : heard,
    action: null,
  };
}

/**
 * Did the user ask to switch modes mid-utterance? Returns 'spell', 'dictate',
 * or null. This is the "spelling trigger" itself — saying "spelling" turns it
 * on, so the mode is reachable hands-free rather than needing a button that
 * cannot be pressed while driving.
 */
export function modeTrigger(transcript) {
  const t = String(transcript || '').toLowerCase().trim().replace(/[.!?]+$/, '');
  if (/^(spelling|spell mode|spelling mode|start spelling|letter by letter)$/.test(t)) return 'spell';
  if (/^(dictation|dictate|normal mode|stop spelling|word mode)$/.test(t)) return 'dictate';
  return null;
}
