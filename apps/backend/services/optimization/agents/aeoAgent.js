/**
 * AEO agent — Answer Engine Optimization layer. Shapes the direct answer and
 * the FAQ so they win featured snippets / AI Overviews and render as FAQPage
 * schema (BlogPost.jsx already emits FAQPage JSON-LD from the `faq` array).
 * Pure post-processing of the model draft — no AI call.
 */

const { QUALITY } = require('../config');

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

function shapeAnswerLayer(draft) {
  const shortAnswer = clean(draft.shortAnswer);

  const faq = (Array.isArray(draft.faq) ? draft.faq : [])
    .map((f) => ({ q: clean(f.q), a: clean(f.a) }))
    .filter((f) => f.q && f.a)
    .map((f) => ({ q: /[?]$/.test(f.q) ? f.q : `${f.q}?`, a: f.a }))
    .slice(0, QUALITY.MAX_FAQ);

  return { shortAnswer, faq };
}

module.exports = { shapeAnswerLayer };
