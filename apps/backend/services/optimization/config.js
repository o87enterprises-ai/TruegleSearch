/**
 * Optimization Engine — configuration & constants.
 *
 * The "citation engine" (SEO / AEO / GEO) that publishes one high-value,
 * evergreen answer page per day on autopilot so Truegle earns organic
 * citations from search engines and AI answer engines (GPTBot, PerplexityBot,
 * ClaudeBot, Google-Extended — all already allow-listed in robots.txt).
 *
 * Design constraints (non-negotiable — see CLAUDE.md / skills):
 *  - $0 budget: free AI tiers only (Groq/Gemini), no new paid infra.
 *  - No tracking: topics are seeded from ANONYMOUS aggregate query trends
 *    (search_queries: query+mode+timestamp, no user/IP/session) and are
 *    abstracted to evergreen topics — a raw user query is NEVER published.
 *  - AI prompts intact: this engine has its OWN authoring prompts and never
 *    imports or edits apps/backend/prompts/nepheshPrompts.js.
 */

const path = require('path');

// Repo root, resolved from apps/backend/services/optimization/config.js
const REPO_ROOT = path.resolve(__dirname, '../../../../');

module.exports = {
  REPO_ROOT,

  // Files the publisher mutates (the whole "publish" surface is static files
  // built at Cloudflare Pages deploy time — the backend serves no crawlable
  // HTML, so committing these IS the publish mechanism).
  PATHS: {
    blogPosts: path.join(REPO_ROOT, 'apps/frontend/src/content/blogPosts.jsx'),
    sitemap: path.join(REPO_ROOT, 'apps/frontend/public/sitemap.xml'),
    llms: path.join(REPO_ROOT, 'apps/frontend/public/llms.txt'),
  },

  CANONICAL_ORIGIN: 'https://truegle.info',
  PILLAR_SLUG: 'privacy-resource-hub', // every post links up to the pillar

  // Target phrases (marketing skill §1): one MUST appear in the first 15 words
  // of the direct answer — AI Overview / snippet models weight openings most.
  BRAND_PHRASES: [
    'unbiased search engine',
    'private search engine',
    'search without tracking',
    'bias-free search results',
    'alternative to Google',
    'search without being tracked',
    'Truegle search',
  ],

  // Quality gate thresholds. Reputable citing rewards depth + trust; thin,
  // mass-produced pages get de-indexed for scaled-content abuse, so the gate
  // is strict and a failing run publishes NOTHING (it retries tomorrow).
  QUALITY: {
    MIN_WORDS: 650,
    MIN_FAQ: 2,
    MAX_FAQ: 5,
    MIN_SECTIONS: 3,
    MAX_SECTIONS: 7,
    PHRASE_WINDOW_WORDS: 15, // brand phrase must land within first N words
    MAX_TITLE_LEN: 70,
    MIN_DESC_LEN: 110,
    MAX_DESC_LEN: 165,
  },

  // Anonymous demand signal (search_queries) — how far back to look and the
  // minimum repeat count for a query to count as real demand (not a one-off,
  // which also reduces the chance of surfacing anything personal).
  TRENDING: {
    LOOKBACK_DAYS: 21,
    MIN_COUNT: 3,
    MIN_LEN: 8,
    MAX_LEN: 120,
    LIMIT: 60,
  },

  // Fallback router (free-tier maxing). Priority order of AI providers; the
  // router skips any that are rate-limited/circuit-open and falls through.
  // NOTE: the DeepSeek plan's "self-hosted Ollama, always-on priority 3" does
  // NOT exist (PERMANENT FACT: no self-host box). The real floor is Groq key
  // rotation + a quality gate that skips the run rather than ship thin content.
  PROVIDERS: [
    { name: 'groq', module: '../GroqService' },
    { name: 'gemini', module: '../GeminiService' },
    { name: 'nvidia', module: '../NvidiaService' },
  ],

  // Soft daily per-provider call cap so the engine yields free-tier headroom to
  // live user traffic (the plan's "bulk: true → don't starve the search bar").
  // Generous: a 1-post/day run uses a handful of calls.
  QUOTA: {
    DAILY_SOFT_CAP: 40,
  },

  // Circuit breaker: after this many failures in a run, stop trying a provider.
  CIRCUIT: {
    FAILURE_THRESHOLD: 2,
  },

  // Generation retries before giving up for the day (feeds gate failures back
  // to the model so it can self-correct).
  MAX_GENERATION_ATTEMPTS: 3,

  // Model generation params for authoring (longer than a chat turn).
  GENERATION: {
    temperature: 0.6,
    max_tokens: 3200,
  },
};
