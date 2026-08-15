const Joi = require('joi');

// Environment variables schema for validation
const envVarsSchema = Joi.object({
  // Server Configuration
  NODE_ENV: Joi.string()
    .default('production'),
  PORT: Joi.number().default(3001),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:5173'),

  // Security
  JWT_SECRET: Joi.string().required().description('JWT secret key'),
  ENCRYPTION_KEY: Joi.string()
    .required()
    .description('Encryption key for sensitive data'),

  // Search API Keys (These should NEVER be exposed to frontend)
  GOOGLE_API_KEY: Joi.string()
    .required()
    .description('Google Custom Search API Key'),
  GOOGLE_SEARCH_ENGINE_ID: Joi.string()
    .required()
    .description('Google Custom Search Engine ID'),
  NEWS_API_KEY: Joi.string().optional().description('NewsAPI.org API Key'),
  BING_API_KEY: Joi.string().optional().description('Bing Web Search API Key'),
  YOUTUBE_API_KEY: Joi.string().optional().description('YouTube Data API Key'),

  // Weather API Keys
  OPENWEATHER_API_KEY: Joi.string().optional().description('OpenWeather API Key'),
  OPENWEATHER_API_KEY_2: Joi.string().optional().description('OpenWeather API Key 2'),

  // AI API Keys
  HUGGINGFACE_API_KEY: Joi.string().optional().description('HuggingFace API Key - Deprecated'),
  OPENROUTER_API_KEY: Joi.string().optional().description('OpenRouter API Key'),
  OPENROUTER_API_KEY_UNLIMITED: Joi.string().optional().description('OpenRouter Unlimited API Key'),
  OPENROUTER_API_KEY_2: Joi.string().optional().description('OpenRouter API Key 2'),
  OPENROUTER_API_KEY_3: Joi.string().optional().description('OpenRouter API Key 3'),
  OPENROUTER_API_KEY_4: Joi.string().optional().description('OpenRouter Unlimited API Key 2'),
  OPENROUTER_API_KEY_5: Joi.string().optional().description('OpenRouter API Key 5'),
  OPENROUTER_API_KEY_6: Joi.string().optional().description('OpenRouter API Key 6'),
  GEMINI_API_KEY: Joi.string().optional().description('Google Gemini API Key'),
  GEMINI_MODEL: Joi.string().optional().default('gemini-2.0-flash').description('Gemini model id'),
  OPENAI_API_KEY: Joi.string().optional().description('OpenAI API Key (Backup AI Provider)'),
  ANTHROPIC_API_KEY: Joi.string().optional().description('Anthropic Claude API Key'),
  DEEPSEEK_API_KEY: Joi.string().optional().description('DeepSeek API Key - Deprecated - DO NOT USE'),
  NEPHESH_BASE_URL: Joi.string().optional().description('Nephesh 1.3 API Base URL (self-hosted Ollama-compatible server — Truegle\'s own model, first-priority AI provider)'),
  NEPHESH_MODEL: Joi.string().optional().default('nephesh:1.3').description('Nephesh model tag as served (pinned; upgrades are a HANDOFF.md entry)'),
  NEPHESH_AUTH_TOKEN: Joi.string().optional().description('Shared-secret bearer token for the remote Nephesh instance behind its auth proxy (required for non-localhost URLs)'),
  OLLAMA_BASE_URL: Joi.string().optional().default('http://localhost:11434').description('Ollama API Base URL (local server, or a self-hosted remote box e.g. AWS)'),
  OLLAMA_MODEL: Joi.string().optional().default('qwen3-coder:480b').description('Ollama Model Name (supports cloud models when signed in)'),
  OLLAMA_AUTH_TOKEN: Joi.string().optional().description('Shared-secret bearer token for a remote Ollama instance sitting behind an auth proxy'),
  NVIDIA_API_KEY: Joi.string().optional().description('NVIDIA NIM API Key (integrate.api.nvidia.com)'),
  NVIDIA_MODEL: Joi.string().optional().default('nvidia/nemotron-3-ultra-550b-a55b').description('NVIDIA NIM model id'),
  GROQ_API_KEY: Joi.string().optional().description('Groq API Key (console.groq.com) — free tier, no credit card'),
  GROQ_API_KEY_2: Joi.string().optional().description('Groq API Key 2 — rotated to when key 1 rate-limits'),
  GROQ_API_KEY_3: Joi.string().optional().description('Groq API Key 3 — rotated to when key 2 rate-limits'),
  GROQ_API_KEY_4: Joi.string().optional().description('Groq API Key 4 — rotated to when key 3 rate-limits'),
  GROQ_API_KEY_5: Joi.string().optional().description('Groq API Key 5 — rotated to when key 4 rate-limits'),
  // Default to the 70B model: the 8b-instant default produced weak, shallow
  // summaries (the "poor unbiased summaries" complaint). 70b-versatile is still
  // free-tier; its lower TPM is covered by multi-key rotation (GROQ_API_KEY..._5).
  // Override per-deploy with GROQ_MODEL if a different model is preferred.
  GROQ_MODEL: Joi.string().optional().default('llama-3.3-70b-versatile').description('Groq model id'),
  // Vision-capable model, used only for image-attached chat turns.
  GROQ_VISION_MODEL: Joi.string().optional().default('qwen/qwen3.6-27b').description('Groq vision model id'),

  // Radar API (Maps)
  RADAR_LIVE_SECRET_KEY: Joi.string().optional().description('Radar Live Secret Key'),
  RADAR_LIVE_PUBLISHABLE_KEY: Joi.string().optional().description('Radar Live Publishable Key'),
  RADAR_TEST_SECRET_KEY: Joi.string().optional().description('Radar Test Secret Key'),
  RADAR_TEST_PUBLISHABLE_KEY: Joi.string().optional().description('Radar Test Publishable Key'),

  // Mapbox API (Alternative Maps Provider)
  MAPBOX_ACCESS_TOKEN: Joi.string().optional().description('Mapbox Access Token'),

  // TomTom API (Alternative Maps Provider)
  TOMTOM_API_KEY: Joi.string().optional().description('TomTom API Key'),

  // SERP API (Google Search Scraping Fallback)
  SERP_API_KEY: Joi.string().optional().description('SerpApi API Key'),

  // Deepgram API (Voice Search — legacy)
  DEEPGRAM_API_KEY: Joi.string().optional().description('Deepgram API Key'),

  // Speech-to-text (voice search). Defaults to Groq-hosted open-source Whisper
  // (reuses the GROQ_API_KEY pool, free tier). Point STT_BASE_URL at a
  // self-hosted OpenAI-compatible Whisper server (whisper.cpp / faster-whisper)
  // to drop the external dependency — no code change needed.
  STT_BASE_URL: Joi.string().optional().description('OpenAI-compatible STT base URL (default: Groq)'),
  STT_MODEL: Joi.string().optional().description('STT model id (default: whisper-large-v3-turbo)'),
  STT_API_KEY: Joi.string().optional().description('STT key for a non-Groq/self-hosted endpoint'),

  // Ensemble Social Media API
  ENSEMBLE_SOCIAL_API_KEY: Joi.string().optional().description('Ensemble Social Media API Key'),

  // Apify API (Social Media Scrappers)
  APIFY_API_KEY: Joi.string().optional().description('Apify API Key'),

  // Hunter.io API (OSINT)
  HUNTER_IO_API_KEY: Joi.string().optional().description('Hunter.io API Key'),

  // Shodan API
  SHODAN_API_KEY: Joi.string().optional().description('Shodan API Key'),

  // PayPal API
  PAYPAL_CLIENT_ID: Joi.string().optional().description('PayPal Client ID'),
  PAYPAL_SECRET: Joi.string().optional().description('PayPal Secret'),

  // Unsplash API
  UNSPLASH_ACCOUNT_ID: Joi.string().optional().description('Unsplash Account ID'),
  UNSPLASH_ACCESS_KEY: Joi.string().optional().description('Unsplash Access Key'),
  UNSPLASH_SECRET_KEY: Joi.string().optional().description('Unsplash Secret Key'),

  // Ad Services
  ADMOB_APP_ID: Joi.string().optional().description('Google AdMob App ID'),
  ADMOB_API_KEY: Joi.string().optional().description('Google AdMob API Key'),
  ADSENSE_PUBLISHER_ID: Joi.string()
    .optional()
    .description('Google AdSense Publisher ID'),

  // Payment Gateway
  STRIPE_SECRET_KEY: Joi.string().optional().description('Stripe Secret Key'),
  STRIPE_PUBLISHABLE_KEY: Joi.string()
    .optional()
    .description('Stripe Publishable Key'),
  STRIPE_WEBHOOK_SECRET: Joi.string()
    .optional()
    .description('Stripe Webhook Secret'),

  // Analytics
  SENTRY_DSN: Joi.string()
    .optional()
    .description('Sentry DSN for error tracking'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),

  // Cache
  REDIS_URL: Joi.string()
    .optional()
    .description('Redis connection URL for caching'),

  // Resend Email API
  RESEND_API_KEY: Joi.string().optional().description('Resend transactional email API key'),
  RESEND_FROM_EMAIL: Joi.string().optional().default('onboarding@resend.dev'),

  // Brave Search API
  BRAVE_API_KEY: Joi.string().optional().description('Brave Search API key'),

  // SearXNG self-hosted instance URL (no API key required)
  SEARXNG_URL: Joi.string().optional().description('SearXNG instance URL e.g. https://xyz.ngrok-free.dev'),
  SEARXNG_PRIMARY: Joi.boolean().default(false).description('Query SearXNG first; paid API providers become fallback'),
  SEARXNG_PRIMARY_MIN: Joi.number().integer().min(1).default(5).description('Min SearXNG results before the API providers are skipped'),
  // Anonymous "proxied page view" (Startpage-style). When the SearXNG host runs a
  // result proxy (Morty / SearXNG `result_proxy`), set these so the backend can
  // attach a signed proxy link to each result. URL points at the proxy root; the
  // key is the base64 of the proxy's HMAC key (the same `!!binary` value used in
  // SearXNG settings.yml → result_proxy.key). Unset → feature off (no behavior change).
  SEARXNG_RESULT_PROXY_URL: Joi.string().optional().description('SearXNG/Morty result-proxy base URL for anonymous page views'),
  SEARXNG_RESULT_PROXY_KEY: Joi.string().optional().description('Base64 HMAC key matching the proxy (settings.yml result_proxy.key)'),

  // YouTube blocks datacenter IPs (Vercel/AWS) with a captcha wall, which breaks
  // transcript extraction in production. Set this to an HTTP(S) proxy
  // (ideally residential/rotating) to route transcript fetches through it.
  // Format: http://user:pass@host:port  — unset → direct (works locally only).
  TRANSCRIPT_PROXY_URL: Joi.string().optional().description('HTTP(S) proxy for YouTube transcript fetches (bypasses datacenter-IP captcha)'),
  // Comma-separated Invidious/Piped-compatible instances. Transcripts are pulled
  // from these front-ends FIRST — they fetch YouTube from their own IPs, so
  // YouTube can't rate-limit Truegle's server. The direct watch-page scrape is
  // only a last-resort fallback. Same decentralized pathway SearXNG uses for YT.
  TRANSCRIPT_INVIDIOUS_INSTANCES: Joi.string().optional().description('Comma-separated Invidious instance base URLs for transcript fetching'),

  // Reddit — the only social provider that can serve a real home feed for
  // free. Absent by default: the adapter runs in demo mode until both are set.
  REDDIT_CLIENT_ID: Joi.string().optional().description('Reddit OAuth client id'),
  REDDIT_CLIENT_SECRET: Joi.string().optional().description('Reddit OAuth client secret'),

  // Google OAuth

  // Bright Data (web scraping proxy)
  BRIGHT_DATA_API_KEY: Joi.string().optional().description('Bright Data API key'),

  // PostgreSQL (Neon)
  DATABASE_URL: Joi.string().optional().description('PostgreSQL connection string'),

  // Email Service (for notifications)
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().optional(),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASS: Joi.string().optional(),

  // File Upload
  MAX_FILE_SIZE: Joi.number().default(5242880), // 5MB
  ALLOWED_FILE_TYPES: Joi.string().default('image/jpeg,image/png,image/gif'),
}).unknown();

const { value: envVars, error } = envVarsSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

// Environment configuration
const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  frontendUrl: envVars.FRONTEND_URL,

  // Security
  jwtSecret: envVars.JWT_SECRET,
  encryptionKey: envVars.ENCRYPTION_KEY,

  // Search APIs
  searchApis: {
    google: {
      apiKey: envVars.GOOGLE_API_KEY,
      searchEngineId: envVars.GOOGLE_SEARCH_ENGINE_ID,
    },
    news: {
      apiKey: envVars.NEWS_API_KEY,
    },
    bing: {
      apiKey: envVars.BING_API_KEY,
    },
    youtube: {
      apiKey: envVars.YOUTUBE_API_KEY,
    },
    weather: {
      apiKey: envVars.OPENWEATHER_API_KEY,
      apiKey2: envVars.OPENWEATHER_API_KEY_2,
    },
  },

  // AI Services
  ai: {
    huggingface: {
      apiKey: envVars.HUGGINGFACE_API_KEY,
    },
    openRouter: {
      apiKey: envVars.OPENROUTER_API_KEY,
      apiKeyUnlimited: envVars.OPENROUTER_API_KEY_UNLIMITED,
      keys: [
        envVars.OPENROUTER_API_KEY_2,
        envVars.OPENROUTER_API_KEY_3,
        envVars.OPENROUTER_API_KEY_4,
        envVars.OPENROUTER_API_KEY_5,
        envVars.OPENROUTER_API_KEY_6,
      ].filter(k => k),
    },
    openai: {
      apiKey: envVars.OPENAI_API_KEY,
    },
    anthropic: {
      apiKey: envVars.ANTHROPIC_API_KEY,
    },
    gemini: {
      apiKey: envVars.GEMINI_API_KEY,
      model: envVars.GEMINI_MODEL,
    },
    nephesh: {
      baseUrl: envVars.NEPHESH_BASE_URL,
      model: envVars.NEPHESH_MODEL,
      authToken: envVars.NEPHESH_AUTH_TOKEN,
    },
    ollama: {
      baseUrl: envVars.OLLAMA_BASE_URL,
      model: envVars.OLLAMA_MODEL,
      authToken: envVars.OLLAMA_AUTH_TOKEN,
    },
    nvidia: {
      apiKey: envVars.NVIDIA_API_KEY,
      model: envVars.NVIDIA_MODEL,
    },
    groq: {
      apiKey: envVars.GROQ_API_KEY,
      model: envVars.GROQ_MODEL,
      // Vision-capable model for image-attached chat turns (extract/describe
      // an uploaded image). Only used when a request carries an image — the
      // default text model doesn't understand image_url content parts.
      visionModel: envVars.GROQ_VISION_MODEL || 'qwen/qwen3.6-27b',
      keys: [
        envVars.GROQ_API_KEY,
        envVars.GROQ_API_KEY_2,
        envVars.GROQ_API_KEY_3,
        envVars.GROQ_API_KEY_4,
        envVars.GROQ_API_KEY_5,
      ].filter(k => k),
    },
    deepseek: {
      apiKey: envVars.DEEPSEEK_API_KEY, // DEPRECATED - DO NOT USE
    },
  },

  // Speech-to-text for voice search (open-source Whisper, Groq-hosted by default)
  stt: {
    baseUrl: envVars.STT_BASE_URL || 'https://api.groq.com/openai/v1',
    model: envVars.STT_MODEL || 'whisper-large-v3-turbo',
    apiKey: envVars.STT_API_KEY || null,
    groqKeys: [
      envVars.GROQ_API_KEY,
      envVars.GROQ_API_KEY_2,
      envVars.GROQ_API_KEY_3,
      envVars.GROQ_API_KEY_4,
      envVars.GROQ_API_KEY_5,
    ].filter(Boolean),
  },

  // Maps
  maps: {
    radar: {
      live: {
        secretKey: envVars.RADAR_LIVE_SECRET_KEY,
        publishableKey: envVars.RADAR_LIVE_PUBLISHABLE_KEY,
      },
      test: {
        secretKey: envVars.RADAR_TEST_SECRET_KEY,
        publishableKey: envVars.RADAR_TEST_PUBLISHABLE_KEY,
      },
    },
    mapbox: {
      accessToken: envVars.MAPBOX_ACCESS_TOKEN,
    },
    tomtom: {
      apiKey: envVars.TOMTOM_API_KEY,
    },
  },
  serp: {
    apiKey: envVars.SERP_API_KEY,
  },

  // Email — Resend (transactional, used by EmailService) + legacy SMTP.
  // NOTE: these were previously two separate `email:` keys; the second silently
  // overrode the first, leaving config.email.resend undefined and Resend email
  // dead. Merged into one object so both survive.
  email: {
    resend: {
      apiKey: envVars.RESEND_API_KEY,
      fromEmail: envVars.RESEND_FROM_EMAIL,
    },
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      auth: {
        user: envVars.SMTP_USER,
        pass: envVars.SMTP_PASS,
      },
    },
  },

  // Brave Search
  brave: {
    apiKey: envVars.BRAVE_API_KEY,
  },

  // SearXNG (self-hosted, no API key needed)
  searxng: {
    url: envVars.SEARXNG_URL,
    primary: envVars.SEARXNG_PRIMARY,
    primaryMin: envVars.SEARXNG_PRIMARY_MIN,
    resultProxyUrl: envVars.SEARXNG_RESULT_PROXY_URL,
    resultProxyKey: envVars.SEARXNG_RESULT_PROXY_KEY,
  },

  // Content extraction (YouTube transcripts)
  transcript: {
    proxyUrl: envVars.TRANSCRIPT_PROXY_URL,
    invidiousInstances: envVars.TRANSCRIPT_INVIDIOUS_INSTANCES
      ? envVars.TRANSCRIPT_INVIDIOUS_INSTANCES.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)
      : null,
  },

  // Bright Data
  brightData: {
    apiKey: envVars.BRIGHT_DATA_API_KEY,
  },

  // PostgreSQL
  database: {
    url: envVars.DATABASE_URL,
  },

  // Voice
  deepgram: {
    apiKey: envVars.DEEPGRAM_API_KEY,
  },

  // Social Media
  ensemble: {
    apiKey: envVars.ENSEMBLE_SOCIAL_API_KEY,
  },

  // Apify API
  apify: {
    apiKey: envVars.APIFY_API_KEY,
  },

  // Hunter.io API
  hunterIo: {
    apiKey: envVars.HUNTER_IO_API_KEY,
  },

  // Shodan API
  shodan: {
    apiKey: envVars.SHODAN_API_KEY,
  },

  // PayPal API
  paypal: {
    clientId: envVars.PAYPAL_CLIENT_ID,
    secret: envVars.PAYPAL_SECRET,
  },
  reddit: {
    clientId: envVars.REDDIT_CLIENT_ID,
    clientSecret: envVars.REDDIT_CLIENT_SECRET,
  },

  // Unsplash API
  unsplash: {
    accountId: envVars.UNSPLASH_ACCOUNT_ID,
    accessKey: envVars.UNSPLASH_ACCESS_KEY,
    secretKey: envVars.UNSPLASH_SECRET_KEY,
  },

  // Ad Services
  ads: {
    admob: {
      appId: envVars.ADMOB_APP_ID,
      apiKey: envVars.ADMOB_API_KEY,
    },
    adsense: {
      publisherId: envVars.ADSENSE_PUBLISHER_ID,
    },
  },

  // Payment
  stripe: {
    secretKey: envVars.STRIPE_SECRET_KEY,
    publishableKey: envVars.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: envVars.STRIPE_WEBHOOK_SECRET,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    max: envVars.RATE_LIMIT_MAX_REQUESTS,
  },

  // File Upload
  upload: {
    maxFileSize: envVars.MAX_FILE_SIZE,
    allowedFileTypes: envVars.ALLOWED_FILE_TYPES.split(','),
  },

  // External Services
  external: {
    sentryDsn: envVars.SENTRY_DSN,
    redisUrl: envVars.REDIS_URL,
  },
};

// Mask sensitive information for logging
config.getSafeConfig = () => {
  const safeConfig = { ...config };

  // Mask API keys and secrets
  if (safeConfig.searchApis) {
    Object.keys(safeConfig.searchApis).forEach((service) => {
      if (safeConfig.searchApis[service].apiKey) {
        safeConfig.searchApis[service].apiKey = '***MASKED***';
      }
    });
  }

  if (safeConfig.ai) {
    Object.keys(safeConfig.ai).forEach((service) => {
      if (safeConfig.ai[service].apiKey) {
        safeConfig.ai[service].apiKey = '***MASKED***';
      }
      if (safeConfig.ai[service].apiKeyUnlimited) {
        safeConfig.ai[service].apiKeyUnlimited = '***MASKED***';
      }
      if (safeConfig.ai[service].keys) {
        safeConfig.ai[service].keys = safeConfig.ai[service].keys.map(() => '***MASKED***');
      }
      if (safeConfig.ai[service].authToken) {
        safeConfig.ai[service].authToken = '***MASKED***';
      }
    });
  }

  if (safeConfig.maps) {
    if (safeConfig.maps.radar) {
      if (safeConfig.maps.radar.live) {
        if (safeConfig.maps.radar.live.secretKey) {
          safeConfig.maps.radar.live.secretKey = '***MASKED***';
        }
      }
      if (safeConfig.maps.radar.test) {
        if (safeConfig.maps.radar.test.secretKey) {
          safeConfig.maps.radar.test.secretKey = '***MASKED***';
        }
      }
    }

    if (safeConfig.maps.mapbox) {
      if (safeConfig.maps.mapbox.accessToken) {
        safeConfig.maps.mapbox.accessToken = '***MASKED***';
      }
    }

    if (safeConfig.maps.tomtom) {
      if (safeConfig.maps.tomtom.apiKey) {
        safeConfig.maps.tomtom.apiKey = '***MASKED***';
      }
    }
  }

  if (safeConfig.serp) {
    if (safeConfig.serp.apiKey) {
      safeConfig.serp.apiKey = '***MASKED***';
    }
  }

  if (safeConfig.deepgram) {
    if (safeConfig.deepgram.apiKey) {
      safeConfig.deepgram.apiKey = '***MASKED***';
    }
  }

  if (safeConfig.ensemble) {
    if (safeConfig.ensemble.apiKey) {
      safeConfig.ensemble.apiKey = '***MASKED***';
    }
  }

  if (safeConfig.apify) {
    if (safeConfig.apify.apiKey) {
      safeConfig.apify.apiKey = '***MASKED***';
    }
  }

  if (safeConfig.hunterIo) {
    if (safeConfig.hunterIo.apiKey) {
      safeConfig.hunterIo.apiKey = '***MASKED***';
    }
  }

  if (safeConfig.shodan) {
    if (safeConfig.shodan.apiKey) {
      safeConfig.shodan.apiKey = '***MASKED***';
    }
  }

  if (safeConfig.paypal) {
    if (safeConfig.paypal.clientId) {
      safeConfig.paypal.clientId = '***MASKED***';
    }
    if (safeConfig.paypal.secret) {
      safeConfig.paypal.secret = '***MASKED***';
    }
  }
  if (safeConfig.reddit) {
    if (safeConfig.reddit.clientId) { safeConfig.reddit.clientId = '***MASKED***'; }
    if (safeConfig.reddit.clientSecret) { safeConfig.reddit.clientSecret = '***MASKED***'; }
  }

  if (safeConfig.unsplash) {
    if (safeConfig.unsplash.accountId) {
      safeConfig.unsplash.accountId = '***MASKED***';
    }
    if (safeConfig.unsplash.accessKey) {
      safeConfig.unsplash.accessKey = '***MASKED***';
    }
    if (safeConfig.unsplash.secretKey) {
      safeConfig.unsplash.secretKey = '***MASKED***';
    }
  }

  if (safeConfig.stripe) {
    safeConfig.stripe.secretKey = '***MASKED***';
    safeConfig.stripe.webhookSecret = '***MASKED***';
  }

  if (safeConfig.ads) {
    if (safeConfig.ads.admob) {
      safeConfig.ads.admob.apiKey = '***MASKED***';
    }
  }

  if (safeConfig.email && safeConfig.email.smtp && safeConfig.email.smtp.auth) {
    safeConfig.email.smtp.auth.pass = '***MASKED***';
  }

  return safeConfig;
};

module.exports = config;
