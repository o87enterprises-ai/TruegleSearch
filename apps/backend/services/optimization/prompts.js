/**
 * Authoring prompts for the citation engine.
 *
 * IMPORTANT: these are the ENGINE's OWN prompts. They are deliberately separate
 * from apps/backend/prompts/nepheshPrompts.js — the user-facing AI modes,
 * mandates and attribution are never imported or modified here. This file only
 * governs how the engine drafts a blog article.
 *
 * The model is constrained to return STRUCTURED JSON (never raw JSX/HTML), so
 * the serializer — not the model — generates the code that ships. That keeps
 * the build safe and the house style consistent.
 */

const { QUALITY } = require('./config');

const SYSTEM = `You are the content engineer for Truegle, a privacy-first, unbiased search engine.
You write evergreen, genuinely useful explainer articles that people and AI answer engines cite as a trustworthy source.

Absolute rules (non-negotiable — Truegle's brand is trust):
- 100% honest. NEVER invent studies, statistics, quotes, dates, product features, or sources. If you don't have a hard fact, explain the concept in plain language instead of fabricating evidence.
- Neutral and non-promotional. Do NOT pitch Truegle, do NOT add marketing spin, do NOT insert hyperlinks or HTML. Just answer the question well. (Truegle branding and internal links are added later, automatically.)
- Plain, direct, skimmable. Short paragraphs. Concrete, practical guidance.
- Accurate and lawful. For privacy/OSINT topics, stay ethics-first and public-records-only; never help identify or target a private individual.

Output format: respond with ONLY a single valid JSON object. No markdown, no code fences, no commentary before or after.`;

/**
 * @param {{question:string, intent:string}} topic
 * @param {string} targetPhrase   one of the brand phrases; must open the answer
 * @param {string} [retryFeedback] why the previous attempt failed the gate
 */
function buildUserPrompt(topic, targetPhrase, retryFeedback = '') {
  const schema = `{
  "title": "compelling H1, <= ${QUALITY.MAX_TITLE_LEN} characters, includes the core keyword",
  "description": "meta description, ${QUALITY.MIN_DESC_LEN}-${QUALITY.MAX_DESC_LEN} characters, answers the query and invites the click",
  "shortAnswer": "2-4 sentence direct answer. It MUST begin with the exact phrase \\"${targetPhrase}\\" within the first ${QUALITY.PHRASE_WINDOW_WORDS} words, and read as a standalone, quotable answer.",
  "sections": [
    { "heading": "clear H2", "kind": "prose", "content": ["paragraph", "paragraph"] },
    { "heading": "a how-to H2", "kind": "steps", "content": ["step one", "step two", "step three"] },
    { "heading": "a list H2", "kind": "points", "content": ["point", "point"] }
  ],
  "faq": [
    { "q": "a real question people ask about this", "a": "1-3 sentence self-contained answer" }
  ]
}`;

  return `Write a Truegle explainer article that answers this search intent:

Question: ${topic.question}
Angle: ${topic.intent}
Target phrase (must open the answer): "${targetPhrase}"

Requirements:
- ${QUALITY.MIN_SECTIONS}-${QUALITY.MAX_SECTIONS} "sections", each with a distinct H2 "heading". Use "kind": "prose" for paragraphs, "steps" for an ordered how-to, or "points" for a bulleted list. Put each paragraph / step / point as its own string in "content".
- Total body across all sections must be at least ${QUALITY.MIN_WORDS} words of substance (no padding, no repetition).
- ${QUALITY.MIN_FAQ}-${QUALITY.MAX_FAQ} "faq" entries, each a genuinely-asked question with a concise, quotable answer (these become FAQ schema for answer engines).
- Do not include any links, HTML, Truegle marketing, or a conclusion that pitches a product. Keep it educational.
${retryFeedback ? `\nThe previous draft was rejected: ${retryFeedback}\nFix exactly that and return corrected JSON.` : ''}

Return ONLY the JSON object described here:
${schema}`;
}

module.exports = { SYSTEM, buildUserPrompt };
