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

  // Database
  MONGODB_URI: Joi.string().optional().description('MongoDB connection string'),

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
  GROQ_MODEL: Joi.string().optional().default('llama-3.1-8b-instant').description('Groq model id'),

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

  // Deepgram API (Voice Search)
  DEEPGRAM_API_KEY: Joi.string().optional().description('Deepgram API Key'),

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

  // Google OAuth
  GOOGLE_CLIENT_ID: Joi.string().optional().description('Google OAuth Client ID'),
  GOOGLE_CLIENT_SECRET: Joi.string().optional().description('Google OAuth Client Secret'),

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

  // Database
  mongoose: {
    url: envVars.MONGODB_URI + (envVars.NODE_ENV === 'test' ? '-test' : ''),
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },

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

  // Email (Resend)
  email: {
    resend: {
      apiKey: envVars.RESEND_API_KEY,
      fromEmail: envVars.RESEND_FROM_EMAIL,
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

  // Google OAuth
  googleOAuth: {
    clientId: envVars.GOOGLE_CLIENT_ID,
    clientSecret: envVars.GOOGLE_CLIENT_SECRET,
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

  // Email
  email: {
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      auth: {
        user: envVars.SMTP_USER,
        pass: envVars.SMTP_PASS,
      },
    },
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
