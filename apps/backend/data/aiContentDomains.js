/**
 * AI-content-farm domain blocklist for Green mode.
 *
 * Green mode promises "0 AI-generated results". Reliable per-page AI detection
 * is unsolved, so we take the predictable, zero-false-positive-on-trusted-sites
 * route: filter out results from domains that are known to publish primarily
 * AI-generated / machine-written content.
 *
 * This is a SEED list meant to be expanded. To grow it without code changes,
 * set the AI_CONTENT_DOMAINS env var to a comma-separated list of extra domains
 * (merged with this list at runtime). A maintained external feed (e.g. a
 * NewsGuard-style AI tracker export) can be appended here over time.
 *
 * Matching is done on the registrable domain and any subdomain (see
 * SearchService.isAiContentDomain), so "example.com" also blocks
 * "blog.example.com".
 */

const AI_CONTENT_DOMAINS = [
  // --- AI text generators whose hosted/demo output is AI-written by definition ---
  'articleforge.com',
  'article-generator.com',
  'textcortex.com',
  'rytr.me',
  'copymatic.ai',
  'writesonic.com',
  'simplified.com',
  'aicontentfy.com',
  'contentbot.ai',
  'wordhero.co',
  'neuraltext.com',
  'autoblogging.ai',
  'journalist.ai',
  'byword.ai',
  'koala.sh',
  'zimmwriter.com',
  'machinewrites.com',

  // --- AI-generated content farms / auto-published article networks ---
  'aiarticlewriter.com',
  'ai-articles.net',
  'generatedstories.com',
  'newsgptlive.com',
  'a-i-news.com',
  'gpt-news.net',
  'aicontenthub.net',
  'autocontent.blog',
  'aigeneratedarticles.com',
];

module.exports = { AI_CONTENT_DOMAINS };
