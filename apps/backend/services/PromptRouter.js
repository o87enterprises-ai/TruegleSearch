/**
 * PromptRouter — a small prompt chosen well, instead of a large prompt always.
 *
 * THE PROBLEM IT SOLVES. Every call was getting one general instruction block
 * interpolated with the query, the context, the search results and a
 * perspective — a page of text before the model saw the question. Long prompts
 * that try to cover every case give a model more to contradict, more to
 * pattern-match against, and more room to confidently answer a question nobody
 * asked. That is what the hallucination was.
 *
 * THE SHAPE. One short BASE that never changes, plus one short FLOW chosen per
 * question. Six lines instead of sixty, and the six are about THIS question.
 *
 * A NOTE ON NAMING, because it matters for anyone reading this later: this is
 * a router, not a "model brain". There is no second model here and no extra
 * network call — classification is deterministic heuristics over the question
 * text, which costs nothing, adds no latency, and can be unit-tested. Asking
 * an LLM which prompt to use would double the cost and the wait to answer a
 * question a regex answers correctly.
 *
 * Reversible: set PROMPT_ROUTER=off and every caller falls back to the old
 * database prompt exactly as before.
 */

// The only thing true of every answer. Deliberately short — anything that is
// not true of EVERY question belongs in a flow, not here.
const BASE = [
  'You are TrueGLE, Truegle\'s search intelligence.',
  'Be accurate, transparent and genuinely useful.',
  'Investigate what the user actually asked. Do not steer them elsewhere, moralise, or add opinions they did not ask for.',
  'When sources are provided, ground your answer in them and cite what you used.',
  'If you do not know, or the sources do not say, say so plainly. Never invent a fact, a source, a number or a quote.',
].join('\n');

// Each flow is three to six lines about ONE kind of question.
const FLOWS = {
  simple: {
    id: 'simple',
    label: 'Simple query',
    temperature: 0.3,
    maxTokens: 700,
    prompt: [
      'Answer directly in a sentence or two. No preamble, no summary of the question.',
      'If a single fact answers it, give the fact first and the context after.',
    ],
  },

  lookup: {
    id: 'lookup',
    label: 'Lookup',
    temperature: 0.2,
    maxTokens: 900,
    prompt: [
      'This is a lookup: the user wants a specific fact, figure, date, definition or location.',
      'Lead with the answer. Add at most two lines of context.',
      'Give the figure exactly as the source gives it, with its units and its date.',
      'If sources disagree, say so and give both rather than averaging them.',
    ],
  },

  investigate: {
    id: 'investigate',
    label: 'Investigation',
    temperature: 0.4,
    maxTokens: 1600,
    prompt: [
      'This is an investigation. Lay out what is established, what is disputed, and what is unknown — clearly separated.',
      'Attribute each claim to who is making it.',
      'Name the gaps explicitly: what would settle this that nobody has produced.',
      'Do not resolve a genuine dispute by picking a side.',
    ],
  },

  'deep-investigate': {
    id: 'deep-investigate',
    label: 'Deep investigation',
    temperature: 0.4,
    maxTokens: 2600,
    prompt: [
      'This is a deep investigation. Work through it in stages: what is claimed, what supports each claim, who benefits, what contradicts it, what remains open.',
      'Track the provenance of every significant claim — original source, not the outlet that repeated it.',
      'Flag where a chain of reporting all traces back to one origin.',
      'End with the specific unanswered questions, not a conclusion the evidence does not support.',
    ],
  },

  compute: {
    id: 'compute',
    label: 'Calculation',
    temperature: 0.0,
    maxTokens: 1200,
    prompt: [
      'This is a calculation. Show the steps in order, one line each, then the result.',
      'State every assumption and every unit conversion you make.',
      'Do the arithmetic carefully and check the magnitude of the result before giving it.',
      'If the question is underspecified, say what is missing instead of assuming a value.',
    ],
  },

  'alternative-views': {
    id: 'alternative-views',
    label: 'Alternative views',
    temperature: 0.5,
    maxTokens: 1800,
    prompt: [
      'Present each position as its own holders would state it, at its strongest.',
      'Give the reasoning and the evidence behind each, not a caricature.',
      'Do not rank them, endorse one, or close with which is correct.',
      'Say plainly where the positions actually disagree — often it is narrower than it looks.',
    ],
  },

  vs: {
    id: 'vs',
    label: 'Comparison',
    temperature: 0.3,
    maxTokens: 1500,
    prompt: [
      'This is a comparison. Compare on the axes that actually matter for the choice, not every axis available.',
      'Be concrete: figures, limits, costs, trade-offs.',
      'Say who each option suits, rather than declaring a winner.',
      'Name anything the comparison cannot settle.',
    ],
  },
};

// ── classification ──────────────────────────────────────────────────────────
// Ordered: the first match wins, so the specific patterns come before the
// general ones. Every one of these is a shape people actually type.
const RULES = [
  ['compute', /(\d[\d,.]*\s*[+\-*/^%]\s*\d)|\b(calculate|compute|how much is|what is \d|convert|percentage of|square root|derivative|integral)\b/i],
  ['vs', /\bvs\.?\b|\bversus\b|\b(compare|comparison|difference between|better than|which is better)\b/i],
  ['alternative-views', /\b(perspectives?|both sides|other side|opposing|alternative views?|steel ?man|counter ?argument|devil'?s advocate)\b/i],
  ['deep-investigate', /\b(deep dive|deep research|thorough(ly)? investigat|full investigation|rabbit hole|everything about|comprehensive)\b/i],
  ['investigate', /\b(investigate|evidence|debunk|fact ?check|is it true|really happened|cover ?up|who benefits|allegation)\b/i],
  ['lookup', /^(who|what|when|where|which|how many|how much|how tall|how old|how far|how long)\b/i],
  ['lookup', /\b(define|definition of|meaning of|population of|capital of|born|died|address|phone number|hours)\b/i],
];

// The chat lenses and search modes map straight onto flows where they are
// unambiguous — an explicit user choice outranks anything guessed from text.
const MODE_FLOW = {
  red: 'deep-investigate',        // rabbit hole
  purple: 'alternative-views',    // perspectives
  ocean: 'investigate',           // OSINT
  green: 'simple',                // summarize
  'deep-research': 'deep-investigate',
};

/**
 * Pick the flow for a question.
 * @param {string} text  the user's question
 * @param {string} mode  the active chat lens / search mode, if any
 */
function classify(text, mode) {
  const byMode = MODE_FLOW[mode];
  if (byMode) return byMode;

  const q = String(text || '').trim();
  if (!q) return 'simple';

  for (const [flow, re] of RULES) {
    if (re.test(q)) return flow;
  }

  // Long, multi-clause questions are rarely simple lookups even when they
  // match nothing above — someone writing three lines wants working-through.
  if (q.length > 180 || (q.match(/\?/g) || []).length > 1) return 'investigate';
  return 'simple';
}

/**
 * Build the system prompt for one question.
 * @returns {{flow, label, system, temperature, maxTokens}}
 */
function route(text, { mode, hasSources = false } = {}) {
  const id = classify(text, mode);
  const flow = FLOWS[id] || FLOWS.simple;
  const lines = [BASE, '', ...flow.prompt];
  // Only say something about sources when there are some. A prompt that talks
  // about citing sources when none were supplied invites invented ones — which
  // is the specific failure mode this whole router exists to reduce.
  if (hasSources) {
    lines.push('', 'Use only the sources supplied below. If they do not cover part of the question, say which part.');
  } else {
    lines.push('', 'No sources were supplied. Answer from general knowledge and say so; do not cite sources you were not given.');
  }
  return {
    flow: flow.id,
    label: flow.label,
    system: lines.join('\n'),
    temperature: flow.temperature,
    maxTokens: flow.maxTokens,
  };
}

const enabled = () => String(process.env.PROMPT_ROUTER || 'on').toLowerCase() !== 'off';

module.exports = { route, classify, enabled, BASE, FLOWS };
