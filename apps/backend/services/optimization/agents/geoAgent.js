/**
 * GEO agent — Generative Engine Optimization layer. Assembles the final,
 * well-structured body (clear headings + entity-clear prose is what LLM answer
 * engines quote), and appends the Truegle context + internal links
 * DETERMINISTICALLY (the model is told not to add links or marketing, so this
 * stage owns branding/linking). Pure assembly — no AI call.
 */

const { QUALITY } = require('../config');

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

function normalizeKind(kind) {
  const k = String(kind || '').toLowerCase();
  if (['steps', 'ordered', 'ol', 'how-to', 'howto'].includes(k)) return 'steps';
  if (['points', 'bullets', 'ul', 'unordered', 'list'].includes(k)) return 'points';
  return 'prose';
}

function normalizeSections(draft) {
  return (Array.isArray(draft.sections) ? draft.sections : [])
    .map((s) => ({
      heading: clean(s.heading),
      kind: normalizeKind(s.kind),
      content: (Array.isArray(s.content) ? s.content : [s.content])
        .map(clean)
        .filter(Boolean),
    }))
    .filter((s) => s.heading && s.content.length)
    .slice(0, QUALITY.MAX_SECTIONS);
}

/** The neutral, always-valid closing section with internal links. */
function buildTruegleSection(internalLinks) {
  return {
    heading: 'Where Truegle fits',
    kind: 'links',
    intro:
      "Truegle is a privacy-first search engine built on exactly these principles: it doesn't track or profile you, it aggregates results from multiple providers so no single company's ranking decides what you see, and its perspective modes let you compare framings on any query. To go deeper, see:",
    links: internalLinks,
  };
}

module.exports = { normalizeSections, buildTruegleSection };
