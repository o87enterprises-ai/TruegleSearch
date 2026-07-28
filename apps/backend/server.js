const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

const config = require('./config/env');
const { generalLimiter, authLimiter, mapsLimiter, suspiciousBotLimiter } = require('./middleware/rateLimit');
const { botDetection, blockBadBots } = require('./middleware/botDetection');
const { privacyMiddleware, noTrackMiddleware, searchPrivacyMiddleware } = require('./middleware/privacy');
const { securityHeaders, contentPolicyMiddleware } = require('./middleware/security');
const { attributionMiddleware } = require('./middleware/attribution');
const database = require('./utils/database'); // Use PostgreSQL connection wrapper
const logger = require('./utils/logger');

const app = express();
const PORT = config.port;

// Running behind Vercel's proxy: trust the first proxy hop so express-rate-limit
// (and req.ip / secure cookies) read the real client IP from X-Forwarded-For.
app.set('trust proxy', 1);

// CORS - must run before all other middleware
const ALLOWED_ORIGINS = [
  config.frontendUrl,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:3001',
  'https://trumpafi.online',
  'https://www.trumpafi.online',
  'https://truegle.info',
  'https://www.truegle.info',
  /\.ngrok-free\.app$/,
  /\.ngrok\.io$/,
  /\.vercel\.app$/,
  /\.pages\.dev$/,
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    const isAllowed = ALLOWED_ORIGINS.some((allowed) =>
      allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
    );
    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'X-Requested-With',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'ngrok-skip-browser-warning',
    'User-Agent',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: [
    'Content-Range',
    'X-Content-Range',
    'X-Total-Count',
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Credentials'
  ],
  maxAge: 600,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Security middleware - Relaxed for development and ngrok
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          'https://pagead2.googlesyndication.com',
          'https://www.googletagservices.com',
          'https://apis.google.com',
          'https://js.stripe.com',
          'https://api.mapbox.com',
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://api.mapbox.com', 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
        connectSrc: [
          "'self'",
          'https://api.mapbox.com',
          'https://events.mapbox.com',
          'https://*.tiles.mapbox.com',
          'https://api.tomtom.com',
          'https://api.radar.io',
          'https://pagead2.googlesyndication.com',
          'https://js.stripe.com',
          'wss:',
          'ws:',
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        frameSrc: ["'self'", 'https://js.stripe.com', 'https://www.paypal.com', 'https://pagead2.googlesyndication.com'],
        workerSrc: ["'self'", 'blob:'],
        childSrc: ["'self'", 'blob:'],
        mediaSrc: ["'self'", 'blob:', 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
  })
);

// Rate limiting
app.use(generalLimiter);

// Privacy middleware - anonymize IPs before any logging
app.use(privacyMiddleware);
app.use(noTrackMiddleware);

// Additional security headers
app.use(securityHeaders);
app.use(contentPolicyMiddleware);

// Attribution watermark - stamps every response with a Truegle provenance tag
app.use(attributionMiddleware);

// Bot detection - annotates req.botInfo for downstream enforcement
app.use(botDetection);

// Compression
app.use(compression());

// HTTP request logging with Morgan -> Winston
app.use(
  morgan(config.env === 'production' ? 'combined' : 'dev', {
    stream: logger.stream,
  })
);

// Ngrok bypass header
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

// Stripe webhook needs raw body BEFORE express.json() parses it
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory (for test.html)
app.use(express.static('public'));

// SEO: sitemap.xml (uses SitemapGenerator util)
app.get('/sitemap.xml', (req, res) => {
  try {
    const SitemapGenerator = require('./utils/sitemap');
    const baseURL = (config.frontendUrl || 'https://truegle.info').replace(/\/$/, '');
    const generator = new SitemapGenerator(baseURL);
    // hreflang cluster shared by the home + localized landing pages.
    const alternates = [
      { hreflang: 'en', href: `${baseURL}/` },
      { hreflang: 'de', href: `${baseURL}/de` },
      { hreflang: 'es', href: `${baseURL}/es` },
      { hreflang: 'fr', href: `${baseURL}/fr` },
      { hreflang: 'x-default', href: `${baseURL}/` },
    ];
    generator.addURL('/', null, 'daily', 1.0, alternates);
    generator.addURL('/search', null, 'daily', 0.9);
    generator.addURL('/green', null, 'weekly', 0.6);
    generator.addURL('/privacy-resource-hub', null, 'monthly', 0.9);
    // Localized landing pages for the top non-English, high-CPM/high-reach markets.
    generator.addURL('/de', null, 'weekly', 0.8, alternates);
    generator.addURL('/es', null, 'weekly', 0.8, alternates);
    generator.addURL('/fr', null, 'weekly', 0.8, alternates);
    res.header('Content-Type', 'application/xml');
    res.send(generator.generateSitemap());
  } catch (error) {
    res.status(500).send('Error generating sitemap');
  }
});

// SEO: robots.txt
app.get('/robots.txt', (req, res) => {
  const baseURL = (config.frontendUrl || 'https://truegle.info').replace(/\/$/, '');
  res.type('text/plain').send(
    `User-agent: *\nAllow: /\nDisallow: /auth/\nDisallow: /onboarding\nDisallow: /settings\n\nSitemap: ${baseURL}/sitemap.xml\n`
  );
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = await database.healthCheck();

    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(200).json({
      status: 'DEGRADED',
      timestamp: new Date().toISOString(),
    });
  }
});

// API routes
app.use('/api/search', [blockBadBots, suspiciousBotLimiter, searchPrivacyMiddleware, require('./routes/search')]);
app.use('/api/auth', [authLimiter, require('./routes/auth')]);
app.use('/api/analytics', require('./routes/analytics').router);
app.use('/api/tokens', require('./routes/tokens'));
// Rewards reworked 2026-07-28 to OFFER/CONVERSION-based (Adsterra pays on
// conversions, not views/clicks): users earn a revenue-share of real, network-
// confirmed offer conversions attributed via a per-user ref and credited by a
// secret-gated S2S postback (see routes/rewards.js + RewardsService.js).
app.use('/api/rewards', require('./routes/rewards'));
// Admin-only (ADMIN_API_KEY via x-admin-key header): manual reward crediting
// after verifying a user's forwarded conversion-confirmation email.
app.use('/api/admin', require('./routes/admin'));
// Geo-targeted ad configuration (IP country-of-origin -> highest-CPM zones)
app.use('/api/ads', require('./routes/ads'));
app.use('/api/creators', require('./routes/creators'));
app.use('/api/session', require('./routes/session'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/prompts', require('./routes/prompts'));
app.use('/api/weather', require('./routes/weather'));
app.use('/api/radar', [mapsLimiter, require('./routes/radar')]);
app.use('/api/maps', [mapsLimiter, require('./routes/maps')]);
app.use('/api/shopping', require('./routes/shopping'));
app.use('/api/social', require('./routes/social'));
app.use('/api/osint', require('./routes/osint'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/shodan', require('./routes/shodan'));
app.use('/api/paypal', require('./routes/paypal'));
app.use('/api/voice', require('./routes/voice'));
app.use('/api/unsplash', require('./routes/unsplash'));
app.use('/api/osint-tools', require('./routes/osint-proxy'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/extract', require('./routes/extract'));
app.use('/api/share', require('./routes/share'));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource was not found.',
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.logError(err, req);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid JSON payload',
    });
  }

  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message:
      config.env === 'development' ? err.message : 'Something went wrong',
  });
});

// Run any outstanding auto-migrations (idempotent — uses IF NOT EXISTS).
// Keeps schema in sync on Vercel deploys without a manual migration step.
//
// Two migration directories exist for historical reasons — both are scanned:
//   apps/backend/migrations/     — the main numbered schema (001-009: users,
//                                  tokens, rewards, shared_threads, ...)
//   apps/backend/db/migrations/  — the AI-prompt-management subsystem
// (`shared_threads`, used by the chat/investigation Share feature, lives in
// the first directory — it was silently never created because this function
// used to only scan the second one.)
const { query: dbQuery } = require('./db/connection');
const fs = require('fs');
const path = require('path');
async function runMigrationsIn(migrationsDir) {
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.includes('rollback'))
    .sort();
  for (const file of files) {
    try {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await dbQuery(sql);
    } catch (err) {
      logger.warn(`Auto-migration ${file} skipped/failed: ${err.message}`);
    }
  }
}
async function autoMigrate() {
  await runMigrationsIn(path.join(__dirname, 'migrations'));
  await runMigrationsIn(path.join(__dirname, 'db', 'migrations'));
}

// Start server with database connection
const startServer = async () => {
  try {
    // Connect to database
    await database.connect();
    await autoMigrate();

    app.listen(PORT, () => {
      logger.info('Truegle Backend Server started', {
        port: PORT,
        environment: config.env,
        frontendUrl: config.frontendUrl,
        database: database.isConnected ? 'Connected' : 'Using in-memory store',
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

// Only start server if not in Vercel serverless environment
if (process.env.VERCEL !== '1') {
  startServer();
} else {
  // Initialize database connection for serverless
  database.connect()
    .then(() => autoMigrate())
    .catch(err => {
      logger.error('Database connection failed in serverless', { error: err.message });
    });
}

module.exports = app;
