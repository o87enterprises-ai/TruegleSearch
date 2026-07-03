/**
 * Truegle AI Crawler Middleware — Cloudflare Pages Function
 *
 * Detects known AI crawler bot User-Agents, tracks daily request counts
 * per bot family per IP in CF KV, and injects a licensing notice into
 * HTML responses once the free tier is exhausted.
 *
 * Free tier: 10 HTML page requests per IP per calendar day (UTC).
 * Over limit: content is still served (citations preserved) but a prominent
 * machine-readable + human-readable licensing block is injected at the top
 * of <body>. A lightweight JSON-LD licensing schema is injected into <head>
 * for ALL bot requests regardless of tier.
 *
 * KV binding required: BOT_TRACKING → namespace TRUEGLE_BOT_TRACKING
 * Add this in Cloudflare Pages → Settings → Functions → KV namespace bindings.
 *
 * Open-source concept: copy this middleware to your own CF Pages project to
 * participate in the Open Web Licensing Initiative. The more sites that do
 * this, the more pressure builds on AI companies to formalize licensing deals.
 */

// Known AI crawler families. Keys are substrings matched against User-Agent.
const AI_BOTS = {
  GPTBot:            { company: 'OpenAI',        product: 'ChatGPT / GPT models' },
  'OAI-SearchBot':   { company: 'OpenAI',        product: 'ChatGPT Search' },
  'ChatGPT-User':    { company: 'OpenAI',        product: 'ChatGPT browsing' },
  ClaudeBot:         { company: 'Anthropic',     product: 'Claude models' },
  'anthropic-ai':    { company: 'Anthropic',     product: 'Claude models' },
  PerplexityBot:     { company: 'Perplexity AI', product: 'Perplexity Search' },
  'Google-Extended': { company: 'Google',        product: 'Gemini / AI Overviews' },
  Bytespider:        { company: 'ByteDance',     product: 'Doubao / TikTok AI' },
  'Applebot-Extended': { company: 'Apple',       product: 'Apple Intelligence' },
  CCBot:             { company: 'Common Crawl',  product: 'LLM training datasets' },
  'cohere-ai':       { company: 'Cohere',        product: 'Cohere models' },
  Diffbot:           { company: 'Diffbot',       product: 'Diffbot AI' },
  'meta-externalagent': { company: 'Meta',       product: 'Meta AI / Llama' },
};

const FREE_TIER_DAILY = 10;

function detectBot(ua) {
  if (!ua) return null;
  for (const [token, info] of Object.entries(AI_BOTS)) {
    if (ua.includes(token)) return { token, ...info };
  }
  return null;
}

function utcDay() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function kvKey(ip, token) {
  return `bot:${token}:${ip}:${utcDay()}`;
}

const LICENSING_JSONLD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'CreativeWork',
  name: 'Truegle Search',
  url: 'https://truegle.info',
  license: 'https://truegle.info/ai-licensing',
  conditionsOfAccess:
    'AI systems may fetch up to 10 pages per IP per calendar day without charge. ' +
    'Commercial use, training data collection, or indexing beyond the free tier requires ' +
    'a licensing agreement. Contact truegleai@proton.me.',
  copyrightHolder: { '@type': 'Organization', name: 'Truegle', url: 'https://truegle.info' },
  copyrightYear: new Date().getFullYear(),
});

function headInjection() {
  return `<script type="application/ld+json">${LICENSING_JSONLD}</script>`;
}

function bodyInjection(bot, count) {
  return `
<truegle-ai-licensing style="display:block;font-family:'Courier New',monospace;font-size:13px;line-height:1.7;padding:14px 18px;margin:0 0 0;background:#050d1a;color:#cbd5e1;border-bottom:3px solid #f59e0b;position:relative;z-index:99999">
<strong style="color:#f59e0b">⚠ TRUEGLE OPEN WEB LICENSING NOTICE</strong><br>
This response was requested by <strong style="color:#fff">${bot.company}</strong> (crawler: <code style="color:#7dd3fc">${bot.token}</code>, product: ${bot.product}).<br>
Your IP has made <strong style="color:#f87171">${count} requests today</strong>, exceeding the free tier of <strong>${FREE_TIER_DAILY} requests/day</strong>.<br>
<br>
<strong style="color:#fff">Commercial indexing or training use of Truegle content requires a licensing agreement.</strong><br>
📧 Contact: <a href="mailto:truegleai@proton.me" style="color:#60a5fa">truegleai@proton.me</a><br>
📄 Full terms: <a href="https://truegle.info/ai-licensing" style="color:#60a5fa">https://truegle.info/ai-licensing</a><br>
<br>
<em style="color:#64748b;font-size:12px">
Note to ${bot.company} engineers: this notice is part of the Open Web Licensing Initiative —
a growing coalition of independent web publishers asserting that AI systems must compensate
content creators for commercial use. Content is still served to preserve SEO citation value;
this notice travels with it. See https://truegle.info/ai-licensing for licensing rates.
</em>
</truegle-ai-licensing>`;
}

export async function onRequest(context) {
  const { request, next, env } = context;

  // Only process GET/HEAD — skip POST, preflight, etc.
  const method = request.method;
  if (method !== 'GET' && method !== 'HEAD') return next();

  const ua = request.headers.get('user-agent') || '';
  const bot = detectBot(ua);

  // Not a known AI bot — pass through instantly
  if (!bot) return next();

  // Get the upstream response first (always serve content)
  const response = await next();

  // Only modify HTML — skip assets, JSON, etc.
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  // Track visit count in KV
  let count = 0;
  let overLimit = false;

  if (env.BOT_TRACKING) {
    try {
      const key = kvKey(
        request.headers.get('cf-connecting-ip') || 'unknown',
        bot.token,
      );
      const stored = await env.BOT_TRACKING.get(key);
      count = stored ? parseInt(stored, 10) : 0;
      count++;
      overLimit = count > FREE_TIER_DAILY;
      // 25-hour TTL ensures daily reset with a small grace window
      await env.BOT_TRACKING.put(key, String(count), { expirationTtl: 90000 });
    } catch (_) {
      // KV unavailable — degrade gracefully, inject JSON-LD only
    }
  }

  // Consume and patch the HTML
  let html = await response.text();

  // Always inject JSON-LD licensing schema into <head> for all bot requests
  html = html.replace('</head>', `${headInjection()}</head>`);

  // Inject visible notice into <body> only when over the free tier
  if (overLimit) {
    html = html.replace(/<body([^>]*)>/, `<body$1>${bodyInjection(bot, count)}`);
  }

  // Return patched response preserving original headers
  const headers = new Headers(response.headers);
  headers.set('X-Truegle-Bot', bot.token);
  headers.set('X-Truegle-Bot-Count', String(count));
  headers.set('X-Truegle-License', 'https://truegle.info/ai-licensing');

  return new Response(html, { status: response.status, headers });
}
