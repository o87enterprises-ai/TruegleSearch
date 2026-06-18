const express = require('express');
const axios = require('axios');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { rateLimitSearch } = require('../middleware/rateLimit');
const SearchService = require('../services/SearchService');
// WeatherService exports a singleton instance (not a class)
const weatherService = require('../services/WeatherService');

// Initialize search service
const searchService = new SearchService();

/**
 * @route   POST /api/search
 * @desc    Perform unbiased search across multiple sources
 * @access  Public (rate limited)
 */
router.post('/', rateLimitSearch, async (req, res) => {
  try {
    const { query, filters = {}, mode = 'blue-pill' } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Search query is required and must be a non-empty string',
      });
    }

    // Validate filters
    const validFilters = validateFilters(filters);

    // Perform search using the search service
    const results = await searchService.performSearch(query, validFilters, mode);

    const instantAnswer = await buildInstantAnswer(query.trim(), results);

    res.json({
      success: true,
      query: query.trim(),
      filters: validFilters,
      results: results,
      instantAnswer: instantAnswer || null,
      timestamp: new Date().toISOString(),
      resultCount: results.length,
    });
  } catch (error) {
    console.error('Search error:', error);

    if (
      error.message.includes('API key') ||
      error.message.includes('authentication')
    ) {
      return res.status(500).json({
        error: 'Service configuration error',
        message:
          'Search service is temporarily unavailable. Please try again later.',
      });
    }

    if (
      error.message.includes('rate limit') ||
      error.message.includes('quota')
    ) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Search quota exceeded. Please try again in a few moments.',
      });
    }

    res.status(500).json({
      error: 'Search failed',
      message: 'Unable to perform search at this time. Please try again.',
    });
  }
});

/**
 * @route   GET /api/search/sources
 * @desc    Get available search sources and their status
 * @access  Private
 */
router.get('/sources', authenticate, async (req, res) => {
  try {
    const sources = await searchService.getAvailableSources();
    res.json({
      success: true,
      sources: sources,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sources error:', error);
    res.status(500).json({
      error: 'Unable to fetch sources',
      message: 'Failed to retrieve search source information',
    });
  }
});

/**
 * @route   GET /api/search/health
 * @desc    Check search service health
 * @access  Public
 */
router.get('/health', async (req, res) => {
  try {
    const health = await searchService.getHealthStatus();
    res.json({
      status: 'OK',
      services: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'Degraded',
      error: 'Search service unhealthy',
      message: 'One or more search services are unavailable',
    });
  }
});

// Helper function to validate and sanitize filters
function validateFilters(filters) {
  const defaultFilters = {
    category: 'all',
    dateRange: 'any',
    bias: 'all',
    sortBy: 'relevance',
    order: 'desc',
    safeSearch: 'safe', // 'safe' | 'blur' | 'off'
    page: 1,
    perPage: 10,
  };

  const validFilters = { ...defaultFilters, ...filters };

  // Validate category
  const validCategories = [
    'all',
    'web',
    'news',
    'videos',
    'images',
    'shopping',
    'social',
  ];
  if (!validCategories.includes(validFilters.category)) {
    validFilters.category = 'all';
  }

  // Validate dateRange
  const validDateRanges = ['any', 'day', 'week', 'month', 'year'];
  if (!validDateRanges.includes(validFilters.dateRange)) {
    validFilters.dateRange = 'any';
  }

  // Validate bias
  const validBiases = [
    'all', 'left', 'right', 'center', 'unbiased', 'mainstream',
    'alternative', 'conspiracy', 'independent', 'neutral',
  ];
  if (!validBiases.includes(validFilters.bias)) {
    validFilters.bias = 'all';
  }

  // Perspectives: array of UI perspective IDs for purple mode
  if (Array.isArray(filters.perspectives)) {
    validFilters.perspectives = filters.perspectives.filter(p => typeof p === 'string');
  }

  // Validate sortBy / order
  const validSortBy = ['relevance', 'date', 'views'];
  if (!validSortBy.includes(validFilters.sortBy)) {
    validFilters.sortBy = 'relevance';
  }
  const validOrder = ['asc', 'desc'];
  if (!validOrder.includes(validFilters.order)) {
    validFilters.order = 'desc';
  }

  // Validate pagination
  validFilters.page = Math.max(1, parseInt(validFilters.page) || 1);
  validFilters.perPage = Math.min(
    Math.max(1, parseInt(validFilters.perPage) || 10),
    50
  );

  // Validate language (ISO 639-1 two-letter code); default 'en'
  const rawLanguage =
    typeof filters.language === 'string'
      ? filters.language.toLowerCase().slice(0, 2).replace(/[^a-z]/g, '')
      : '';
  validFilters.language = /^[a-z]{2}$/.test(rawLanguage) ? rawLanguage : 'en';

  // Validate optional region/country (ISO 3166-1 alpha-2), e.g. 'US', 'BR'
  const rawCountry =
    typeof filters.country === 'string'
      ? filters.country.toUpperCase().slice(0, 2).replace(/[^A-Z]/g, '')
      : '';
  validFilters.country = /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : '';

  return validFilters;
}

/**
 * Detect query type to determine instant answer card type.
 */
function detectQueryType(query) {
  const q = query.toLowerCase().trim();

  // Phone number pattern
  if (/[\+\d][\d\s\-\(\)]{7,}/.test(query)) return 'phone';

  // Business/local: "near me", "hours", "address", "phone number"
  if (/\b(near me|hours|open now|address|phone number|directions|location)\b/.test(q))
    return 'local_business';

  // Direct business name (contains common business suffixes)
  if (/\b(walmart|target|safeway|starbucks|mcdonald|walgreens|cvs|costco|amazon|apple store|home depot|kroger|whole foods|trader joe)\b/.test(q))
    return 'local_business';

  // Weather
  if (/^(weather|forecast|temperature)\b/.test(q) || /\bweather\b/.test(q)) return 'weather';

  // Calculator: trailing "=", word operators, or a bare arithmetic expression like "2+2", "15% of 200"
  if (
    /^[\d\s\+\-\*\/\^\(\)\.%]+=?\s*$/.test(q) && /[\d]/.test(q) && /[\+\-\*\/\^%]/.test(q) ||
    /\d+\s*(plus|minus|times|multiplied by|divided by|percent of|mod)\s*\d+/i.test(q) ||
    /\d+\s*%\s*of\s*\d+/i.test(q)
  )
    return 'calculation';

  // Unit / currency conversion: "10 km to miles", "100 usd in eur", "20 c to f"
  if (/^-?\d+(?:\.\d+)?\s*(?:[a-zµ°]+|\$|€|£)\s+(?:to|in|into|as)\s+(?:[a-zµ°]+|\$|€|£)\s*$/i.test(q))
    return 'conversion';

  // World clock: "time in tokyo", "what time is it in london", "current time in paris"
  if (/\btime\b/.test(q) && /\bin\s+[a-z]/.test(q)) return 'time';

  // Dictionary definition: "define stoic", "definition of serendipity", "what does ephemeral mean"
  if (/^(?:define|definition of|meaning of|what does)\b/.test(q) || /\bdefine\b/.test(q))
    return 'definition';

  // Social profile / person search (name + platform)
  if (/\b(facebook|instagram|twitter|linkedin|tiktok|youtube)\b/.test(q)) return 'social_profile';

  // Apps / AI models / dev tools / services (direct name lookup)
  if (APP_NAMES.includes(q) || APP_NAMES.some((name) => q === `${name} app`)) return 'app';

  // Person name (2-4 capitalized words, no other keywords)
  if (/^[A-Z][a-z]+ ([A-Z][a-z]+ ?){1,2}$/.test(query)) return 'person';

  return null;
}

// Known app / AI model / dev-tool / service names for direct lookup queries.
const APP_NAMES = [
  'chatgpt', 'gpt-4', 'gpt-5', 'claude', 'gemini', 'copilot', 'github copilot', 'perplexity', 'grok',
  'deepseek', 'midjourney', 'dall-e', 'stable diffusion', 'notion', 'slack', 'discord', 'telegram',
  'whatsapp', 'zoom', 'spotify', 'netflix', 'figma', 'canva', 'trello', 'asana', 'airtable', 'dropbox',
  'github', 'gitlab', 'docker', 'vercel', 'cloudflare', 'openai', 'anthropic',
];

/**
 * Extract structured instant answer data from search results + pagemap.
 */
async function buildInstantAnswer(query, results) {
  const type = detectQueryType(query);
  if (!type) return null;

  // these types are computed independently of web results
  const needsResults = !['calculation', 'weather', 'conversion', 'time', 'definition'].includes(type);
  if (needsResults && (!results || results.length === 0)) return null;

  const top = (results && results[0]) || {};
  const pagemap = top.pagemap || {};
  const meta = (pagemap.metatags || [])[0] || {};
  const org = (pagemap.organization || [])[0] || {};
  const local = (pagemap.localbusiness || [])[0] || {};
  const person = (pagemap.person || [])[0] || {};

  if (type === 'local_business') {
    const name = local.name || org.name || top.title || query;
    const phone = local.telephone || org.telephone || meta['og:phone_number'] || null;
    const address = local.address || org.address ||
      (local['address.streetaddress']
        ? `${local['address.streetaddress']}, ${local['address.addresslocality'] || ''} ${local['address.addressregion'] || ''}`.trim()
        : null) || null;
    const hours = local.openingHours || local.openinghours || null;
    const rating = local.aggregateRating || local.ratingvalue || null;
    const website = top.url || null;
    const image = top.image || meta['og:image'] || null;
    const lat = local.latitude || null;
    const lng = local.longitude || null;

    if (!name && !phone && !address) return null;

    return {
      type: 'local_business',
      name,
      phone,
      address,
      hours,
      rating,
      website,
      image,
      coordinates: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
      mapsQuery: address || name,
    };
  }

  if (type === 'social_profile') {
    const profiles = results.slice(0, 5).map(r => ({
      name: r.title,
      url: r.url,
      snippet: r.snippet,
      image: r.image || null,
      platform: detectPlatform(r.url),
    })).filter(p => p.platform);

    if (profiles.length === 0) return null;
    return { type: 'social_profile', query, profiles };
  }

  if (type === 'person') {
    const p = {
      name: person.name || query,
      description: meta['og:description'] || top.snippet || null,
      image: top.image || meta['og:image'] || null,
      url: top.url,
      title: person.jobtitle || null,
      profiles: results.slice(0, 4).filter(r => detectPlatform(r.url)).map(r => ({
        platform: detectPlatform(r.url),
        url: r.url,
        title: r.title,
      })),
    };
    if (!p.description && !p.image) return null;
    return { type: 'person', ...p };
  }

  if (type === 'calculation') {
    const calc = safeCalculate(query);
    if (calc === null) return null;
    return { type: 'calculation', expression: query.replace(/=\s*$/, '').trim(), result: calc };
  }

  if (type === 'weather') {
    const location = extractWeatherLocation(query);
    if (!location) return null;
    try {
      const data = await weatherService.getCurrentWeather(location);
      return { type: 'weather', ...data };
    } catch {
      // Weather API unavailable — fall through; web results still render.
      return null;
    }
  }

  if (type === 'conversion') {
    const conv = await computeConversion(query);
    return conv ? { type: 'conversion', ...conv } : null;
  }

  if (type === 'time') {
    const t = getTimeForQuery(query);
    return t ? { type: 'time', ...t } : null;
  }

  if (type === 'definition') {
    const def = await fetchDefinition(query);
    return def ? { type: 'definition', ...def } : null;
  }

  if (type === 'app') {
    const name = meta['og:site_name'] || top.title || query;
    const description = meta['og:description'] || top.snippet || null;
    const image = meta['og:image'] || top.image || null;
    const url = top.url || null;
    if (!description && !image && !url) return null;
    return { type: 'app', name, description, image, url, query };
  }

  return null;
}

/**
 * Pull a location out of a weather query: "weather in Paris" / "weather Paris" /
 * "Tokyo weather" / "forecast for Berlin". Returns null when no location given.
 */
function extractWeatherLocation(query) {
  let q = query.trim();
  // strip the weather keyword + optional connector
  q = q.replace(/\b(weather|forecast|temperature)\b/gi, ' ');
  q = q.replace(/\b(in|for|at|of|today|now|current|currently)\b/gi, ' ');
  q = q.replace(/[?!.]/g, ' ').replace(/\s+/g, ' ').trim();
  return q.length >= 2 ? q : null;
}

/**
 * Safely evaluate a basic arithmetic expression. Accepts digits, + - * / ^ % ( )
 * and the word operators normalized below. Rejects anything with letters/identifiers
 * so there is no code-execution surface.
 */
function safeCalculate(query) {
  let expr = query.toLowerCase()
    .replace(/=\s*$/, '')
    .replace(/\bplus\b/g, '+')
    .replace(/\bminus\b/g, '-')
    .replace(/\b(times|multiplied by)\b/g, '*')
    .replace(/\bdivided by\b/g, '/')
    .replace(/\bmod\b/g, '%')
    .replace(/\^/g, '**')
    .trim();

  // "15% of 200" -> "15/100*200"
  expr = expr.replace(/(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)/g, '($1/100*$2)');
  // bare trailing percent "50%" -> "(50/100)"
  expr = expr.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)');

  // Only digits, operators, parens, dots, spaces allowed now.
  if (!/^[\d\s+\-*/().]+$/.test(expr)) return null;
  if (!/\d/.test(expr)) return null;
  if (expr.length > 100) return null;

  try {
    // eslint-disable-next-line no-new-func — input is sanitized to arithmetic only above
    const val = Function(`"use strict"; return (${expr});`)();
    if (typeof val !== 'number' || !isFinite(val)) return null;
    // round to avoid floating noise like 0.1+0.2
    return Math.round(val * 1e10) / 1e10;
  } catch {
    return null;
  }
}

function detectPlatform(url) {
  if (!url) return null;
  if (url.includes('facebook.com')) return 'Facebook';
  if (url.includes('instagram.com')) return 'Instagram';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'X / Twitter';
  if (url.includes('linkedin.com')) return 'LinkedIn';
  if (url.includes('tiktok.com')) return 'TikTok';
  if (url.includes('youtube.com')) return 'YouTube';
  if (url.includes('github.com')) return 'GitHub';
  if (url.includes('reddit.com')) return 'Reddit';
  return null;
}

// ── Unit & currency conversion ────────────────────────────────────────────────

// Maps every accepted spelling/abbreviation to a canonical unit token.
const UNIT_ALIASES = {
  // length (base: meter)
  mm: 'mm', millimeter: 'mm', millimeters: 'mm', millimetre: 'mm', millimetres: 'mm',
  cm: 'cm', centimeter: 'cm', centimeters: 'cm', centimetre: 'cm', centimetres: 'cm',
  m: 'm', meter: 'm', meters: 'm', metre: 'm', metres: 'm',
  km: 'km', kilometer: 'km', kilometers: 'km', kilometre: 'km', kilometres: 'km',
  in: 'in', inch: 'in', inches: 'in',
  ft: 'ft', foot: 'ft', feet: 'ft',
  yd: 'yd', yard: 'yd', yards: 'yd',
  mi: 'mi', mile: 'mi', miles: 'mi',
  // mass (base: gram)
  mg: 'mg', milligram: 'mg', milligrams: 'mg',
  g: 'g', gram: 'g', grams: 'g',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg',
  t: 't', tonne: 't', tonnes: 't',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  st: 'st', stone: 'st', stones: 'st',
  // temperature
  c: 'c', celsius: 'c', centigrade: 'c',
  f: 'f', fahrenheit: 'f',
  k: 'k', kelvin: 'k',
  // volume (base: liter)
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  floz: 'floz',
  cup: 'cup', cups: 'cup',
  pt: 'pt', pint: 'pt', pints: 'pt',
  qt: 'qt', quart: 'qt', quarts: 'qt',
  gal: 'gal', gallon: 'gal', gallons: 'gal',
  // speed (base: m/s)
  mph: 'mph', kph: 'kph', kmh: 'kph', mps: 'mps', knot: 'knot', knots: 'knot',
  // digital storage (base: byte)
  byte: 'B', bytes: 'B',
  kb: 'KB', kilobyte: 'KB', kilobytes: 'KB',
  mb: 'MB', megabyte: 'MB', megabytes: 'MB',
  gb: 'GB', gigabyte: 'GB', gigabytes: 'GB',
  tb: 'TB', terabyte: 'TB', terabytes: 'TB',
};

// Per-dimension conversion factors to the dimension's base unit.
const UNIT_DIMENSIONS = {
  length: { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 },
  mass: { mg: 0.001, g: 1, kg: 1000, t: 1e6, oz: 28.349523125, lb: 453.59237, st: 6350.29318 },
  volume: { ml: 0.001, l: 1, tsp: 0.00492892, tbsp: 0.0147868, floz: 0.0295735, cup: 0.236588, pt: 0.473176, qt: 0.946353, gal: 3.785412 },
  speed: { mps: 1, kph: 0.277778, mph: 0.44704, knot: 0.514444 },
  digital: { B: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 },
};

// Reverse lookup: canonical unit -> dimension name.
const UNIT_TO_DIM = Object.entries(UNIT_DIMENSIONS).reduce((acc, [dim, units]) => {
  Object.keys(units).forEach((u) => { acc[u] = dim; });
  return acc;
}, {});

const TEMP_UNITS = new Set(['c', 'f', 'k']);
const TEMP_LABEL = { c: '°C', f: '°F', k: 'K' };

const CURRENCY_SYMBOLS = { $: 'USD', '€': 'EUR', '£': 'GBP' };
const CURRENCY_WORDS = {
  dollar: 'USD', dollars: 'USD', usd: 'USD',
  euro: 'EUR', euros: 'EUR', eur: 'EUR',
  pound: 'GBP', pounds: 'GBP', gbp: 'GBP', sterling: 'GBP',
  yen: 'JPY', jpy: 'JPY', yuan: 'CNY', cny: 'CNY', rmb: 'CNY',
  rupee: 'INR', rupees: 'INR', inr: 'INR',
  cad: 'CAD', aud: 'AUD', chf: 'CHF', nzd: 'NZD', mxn: 'MXN', brl: 'BRL',
  krw: 'KRW', won: 'KRW', rub: 'RUB', ruble: 'RUB', zar: 'ZAR', sek: 'SEK',
  nok: 'NOK', dkk: 'DKK', pln: 'PLN', try: 'TRY', aed: 'AED', sgd: 'SGD', hkd: 'HKD',
  btc: 'BTC', bitcoin: 'BTC', eth: 'ETH', ethereum: 'ETH',
};

function resolveCurrency(tok) {
  if (CURRENCY_SYMBOLS[tok]) return CURRENCY_SYMBOLS[tok];
  if (CURRENCY_WORDS[tok]) return CURRENCY_WORDS[tok];
  return null;
}

function roundTo(value, places) {
  const f = Math.pow(10, places);
  return Math.round(value * f) / f;
}

function tempConvert(value, from, to) {
  // normalize to celsius, then to target
  const c = from === 'c' ? value : from === 'f' ? (value - 32) * 5 / 9 : value - 273.15;
  return to === 'c' ? c : to === 'f' ? c * 9 / 5 + 32 : c + 273.15;
}

/**
 * Compute a unit or currency conversion from a query like "10 km to miles".
 * Returns a structured result, or null when the query isn't a valid conversion.
 */
async function computeConversion(query) {
  const m = query.trim().toLowerCase().match(
    /^(-?\d+(?:\.\d+)?)\s*([a-zµ°]+|\$|€|£)\s+(?:to|in|into|as)\s+([a-zµ°]+|\$|€|£)\s*$/i
  );
  if (!m) return null;

  const amount = parseFloat(m[1]);
  if (!isFinite(amount)) return null;
  const fromRaw = m[2];
  const toRaw = m[3];

  // Currency conversion (both sides must look like money)
  const fromCur = resolveCurrency(fromRaw);
  const toCur = resolveCurrency(toRaw);
  if (fromCur && toCur) return fetchCurrencyConversion(amount, fromCur, toCur);

  const from = UNIT_ALIASES[fromRaw];
  const to = UNIT_ALIASES[toRaw];
  if (!from || !to) return null;

  // Temperature (offset-based, not factor-based)
  if (TEMP_UNITS.has(from) && TEMP_UNITS.has(to)) {
    return {
      conversionType: 'temperature',
      inputValue: amount, result: roundTo(tempConvert(amount, from, to), 2),
      fromUnit: from, toUnit: to, fromLabel: TEMP_LABEL[from], toLabel: TEMP_LABEL[to],
    };
  }

  const dim = UNIT_TO_DIM[from];
  if (!dim || dim !== UNIT_TO_DIM[to]) return null; // incompatible dimensions

  const factors = UNIT_DIMENSIONS[dim];
  const result = roundTo((amount * factors[from]) / factors[to], 6);
  return { conversionType: dim, inputValue: amount, result, fromUnit: from, toUnit: to };
}

/**
 * Live currency conversion via the free, no-key open.er-api.com endpoint.
 * Fully graceful: any failure returns null so web results still render.
 */
async function fetchCurrencyConversion(amount, from, to) {
  try {
    const resp = await axios.get(`https://open.er-api.com/v6/latest/${from}`, { timeout: 6000 });
    const rate = resp.data?.rates?.[to];
    if (!rate) return null;
    return {
      conversionType: 'currency',
      inputValue: amount, fromUnit: from, toUnit: to,
      result: roundTo(amount * rate, 2), rate: roundTo(rate, 4),
    };
  } catch {
    return null;
  }
}

// ── World clock ───────────────────────────────────────────────────────────────

// Curated city/region -> IANA timezone. Lower-cased keys.
const CITY_TZ = {
  'new york': 'America/New_York', 'nyc': 'America/New_York', 'washington': 'America/New_York',
  'boston': 'America/New_York', 'miami': 'America/New_York', 'atlanta': 'America/New_York',
  'toronto': 'America/Toronto', 'chicago': 'America/Chicago', 'dallas': 'America/Chicago',
  'houston': 'America/Chicago', 'denver': 'America/Denver', 'phoenix': 'America/Phoenix',
  'los angeles': 'America/Los_Angeles', 'la': 'America/Los_Angeles', 'san francisco': 'America/Los_Angeles',
  'seattle': 'America/Los_Angeles', 'vancouver': 'America/Vancouver', 'mexico city': 'America/Mexico_City',
  'sao paulo': 'America/Sao_Paulo', 'buenos aires': 'America/Argentina/Buenos_Aires',
  'london': 'Europe/London', 'dublin': 'Europe/Dublin', 'lisbon': 'Europe/Lisbon',
  'paris': 'Europe/Paris', 'madrid': 'Europe/Madrid', 'barcelona': 'Europe/Madrid',
  'berlin': 'Europe/Berlin', 'munich': 'Europe/Berlin', 'rome': 'Europe/Rome',
  'amsterdam': 'Europe/Amsterdam', 'brussels': 'Europe/Brussels', 'zurich': 'Europe/Zurich',
  'vienna': 'Europe/Vienna', 'stockholm': 'Europe/Stockholm', 'oslo': 'Europe/Oslo',
  'copenhagen': 'Europe/Copenhagen', 'warsaw': 'Europe/Warsaw', 'athens': 'Europe/Athens',
  'moscow': 'Europe/Moscow', 'istanbul': 'Europe/Istanbul', 'dubai': 'Asia/Dubai',
  'tel aviv': 'Asia/Jerusalem', 'jerusalem': 'Asia/Jerusalem', 'riyadh': 'Asia/Riyadh',
  'mumbai': 'Asia/Kolkata', 'delhi': 'Asia/Kolkata', 'new delhi': 'Asia/Kolkata',
  'bangalore': 'Asia/Kolkata', 'karachi': 'Asia/Karachi', 'dhaka': 'Asia/Dhaka',
  'bangkok': 'Asia/Bangkok', 'singapore': 'Asia/Singapore', 'kuala lumpur': 'Asia/Kuala_Lumpur',
  'jakarta': 'Asia/Jakarta', 'manila': 'Asia/Manila', 'hong kong': 'Asia/Hong_Kong',
  'shanghai': 'Asia/Shanghai', 'beijing': 'Asia/Shanghai', 'taipei': 'Asia/Taipei',
  'seoul': 'Asia/Seoul', 'tokyo': 'Asia/Tokyo', 'osaka': 'Asia/Tokyo',
  'sydney': 'Australia/Sydney', 'melbourne': 'Australia/Melbourne', 'perth': 'Australia/Perth',
  'auckland': 'Pacific/Auckland', 'honolulu': 'Pacific/Honolulu',
  'cairo': 'Africa/Cairo', 'lagos': 'Africa/Lagos', 'nairobi': 'Africa/Nairobi',
  'johannesburg': 'Africa/Johannesburg', 'cape town': 'Africa/Johannesburg', 'casablanca': 'Africa/Casablanca',
  'utc': 'UTC', 'gmt': 'UTC',
};

/**
 * Resolve "time in <place>" to the current local time/date in that place.
 * Returns null when no known place is matched.
 */
function getTimeForQuery(query) {
  const m = query.toLowerCase().match(/\bin\s+([a-z .'-]+?)\s*\??$/);
  if (!m) return null;
  const place = m[1].trim().replace(/\s+/g, ' ');
  const tz = CITY_TZ[place];
  if (!tz) return null;

  const now = new Date();
  try {
    const time = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(now);
    const date = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, weekday: 'long', month: 'long', day: 'numeric',
    }).format(now);
    const location = place.replace(/\b\w/g, (c) => c.toUpperCase());
    return { location, time, date, timezone: tz };
  } catch {
    return null;
  }
}

// ── Dictionary definition ─────────────────────────────────────────────────────

/**
 * Look up a word via the free, no-key dictionaryapi.dev. Graceful on failure.
 */
async function fetchDefinition(query) {
  const word = query.trim().toLowerCase()
    .replace(/^(?:define|definition of|meaning of|what does|what is the meaning of)\s+/i, '')
    .replace(/\s+mean(?:ing)?\s*\??$/i, '')
    .replace(/[?.!]/g, '')
    .trim();
  if (!word || word.split(/\s+/).length > 3) return null;

  try {
    const resp = await axios.get(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { timeout: 6000 }
    );
    const entry = Array.isArray(resp.data) ? resp.data[0] : null;
    if (!entry) return null;

    const meanings = (entry.meanings || []).slice(0, 3).map((me) => ({
      partOfSpeech: me.partOfSpeech || '',
      definition: me.definitions?.[0]?.definition || '',
      example: me.definitions?.[0]?.example || null,
    })).filter((me) => me.definition);
    if (meanings.length === 0) return null;

    const phonetic = entry.phonetic || (entry.phonetics || []).map((p) => p.text).find(Boolean) || null;
    const audio = (entry.phonetics || []).map((p) => p.audio).find(Boolean) || null;
    return { word: entry.word || word, phonetic, audio, meanings };
  } catch {
    return null;
  }
}

module.exports = router;
