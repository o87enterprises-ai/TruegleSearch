/**
 * Orchestrator — the OptimizationOrchestrator (DeepSeek plan Part 1) on the
 * real stack. Produces ONE gate-passed post per run:
 *
 *   selectTopic → SEO scaffold → draft via fallback router → AEO/GEO shaping
 *   → quality gate (retry with feedback) → return post (publishing is separate).
 *
 * It never writes files and never touches the user-facing AI prompts.
 */

const config = require('./config');
const log = require('./log');
const { selectTopic } = require('./topicSource');
const seoAgent = require('./agents/seoAgent');
const aeoAgent = require('./agents/aeoAgent');
const geoAgent = require('./agents/geoAgent');
const { SYSTEM, buildUserPrompt } = require('./prompts');
const FallbackRouter = require('./fallbackRouter');
const gate = require('./qualityGate');

function parseDraftJson(text) {
  let t = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a === -1 || b === -1) throw new Error('no JSON object in model output');
  return JSON.parse(t.slice(a, b + 1));
}

function assemble({ draft, topic, seo, provider }) {
  const { shortAnswer, faq } = aeoAgent.shapeAnswerLayer(draft);
  const sections = geoAgent.normalizeSections(draft);
  sections.push(geoAgent.buildTruegleSection(seo.internalLinks));

  const post = {
    slug: seo.slug,
    title: String(draft.title || topic.question).trim(),
    description: String(draft.description || '').trim(),
    date: new Date().toISOString().slice(0, 10),
    shortAnswer,
    faq,
    sections,
    targetPhrase: seo.targetPhrase,
    _meta: { provider, cluster: topic.cluster },
  };
  const words = gate.countWords(post);
  post.readingTime = `${Math.max(3, Math.round(words / 200))} min read`;
  return post;
}

/**
 * @param {FallbackRouter} [router] injectable for tests
 * @returns {Promise<{ok:boolean, post?:object, reason?:string, topic?:object, source?:string, demand?:number, matched?:string[]}>}
 */
async function generate(router) {
  const selection = await selectTopic();
  if (!selection) return { ok: false, reason: 'no remaining topics in the universe' };

  const { topic, publishedPosts, source, demand, matched } = selection;
  const seo = seoAgent.planSeo(topic, publishedPosts);
  router = router || new FallbackRouter();
  log.info(`providers: ${router.available().join(', ') || '(none)'}`);

  let feedback = '';
  for (let attempt = 1; attempt <= config.MAX_GENERATION_ATTEMPTS; attempt++) {
    log.info(`generation attempt ${attempt}/${config.MAX_GENERATION_ATTEMPTS} for "${seo.slug}"`);
    try {
      const userPrompt = buildUserPrompt(topic, seo.targetPhrase, feedback);
      const { content, provider } = await router.complete(userPrompt, { system: SYSTEM });
      const draft = parseDraftJson(content);
      const post = assemble({ draft, topic, seo, provider });
      const verdict = gate.check(post);
      if (verdict.ok) {
        log.ok(`passed gate (${verdict.words} words, via ${provider})`);
        return { ok: true, post, topic, source, demand, matched };
      }
      feedback = verdict.reasons.join('; ');
      log.warn(`gate failed: ${feedback}`);
    } catch (e) {
      feedback = e.message;
      log.warn(`attempt ${attempt} error: ${e.message}`);
    }
  }
  return { ok: false, reason: `no draft passed the quality gate after ${config.MAX_GENERATION_ATTEMPTS} attempts (last: ${feedback})`, topic };
}

module.exports = { generate, assemble, parseDraftJson };
