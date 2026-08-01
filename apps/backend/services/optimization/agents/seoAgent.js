/**
 * SEO agent — deterministic search-engine scaffolding decided BEFORE writing.
 * Picks the target brand phrase (goes in the first 15 words), the URL slug, and
 * the internal links that will be woven in (every post links up to the pillar).
 * No AI call here — this is the structural/keyword layer.
 */

const { BRAND_PHRASES, PILLAR_SLUG } = require('../config');

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Choose the brand phrase that best fits the topic (falls back to a default). */
function pickTargetPhrase(topic) {
  const hay = `${topic.question} ${topic.intent || ''}`.toLowerCase();
  const byCluster = {
    'private-search': 'private search engine',
    bias: 'unbiased search engine',
    osint: 'search without tracking',
    access: 'search without being tracked',
    'how-truegle-works': 'alternative to Google',
  };
  if (topic.cluster && byCluster[topic.cluster]) return byCluster[topic.cluster];
  // keyword overlap fallback
  const hit = BRAND_PHRASES.find((p) => hay.includes(p.split(' ')[0]));
  return hit || BRAND_PHRASES[0];
}

/**
 * Pick 2-3 internal link targets: always the pillar, plus the most
 * topically-related already-published posts (by shared keywords).
 * @param {Array<{slug:string,title:string}>} publishedPosts
 */
function pickInternalLinks(topic, publishedPosts) {
  const links = [{ href: `/${PILLAR_SLUG}`, text: 'The Ultimate Digital Privacy & OSINT Resource Hub' }];
  const words = new Set(
    `${topic.question} ${topic.intent || ''}`.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3)
  );
  const scored = publishedPosts
    .filter((p) => p.slug !== topic.slug)
    .map((p) => {
      const t = p.title.toLowerCase();
      let score = 0;
      words.forEach((w) => { if (t.includes(w)) score += 1; });
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  for (const { p } of scored) {
    links.push({ href: `/blog/${p.slug}`, text: p.title });
  }
  return links;
}

function planSeo(topic, publishedPosts) {
  return {
    targetPhrase: pickTargetPhrase(topic),
    slug: topic.slug || slugify(topic.question),
    internalLinks: pickInternalLinks(topic, publishedPosts),
  };
}

module.exports = { planSeo, slugify, pickTargetPhrase, pickInternalLinks };
