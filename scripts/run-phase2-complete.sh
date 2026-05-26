#!/bin/bash

# run-phase2-complete.sh
# TRUEGLE - Phase 2: API Integration
# Tasks: 0.200-0.204

START_TIME=$(date +%s)

echo "╔════════════════════════════════════════╗"
echo "║  TRUEGLE - PHASE 2 API INTEGRATION    ║"
echo "║  Search + Bias Detection + Caching    ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Create necessary directories
mkdir -p backend/src/services
mkdir -p backend/src/utils
mkdir -p backend/src/config
mkdir -p .eigent/scripts

# ============================================
# Task 0.200: API Configuration
# ============================================
cat > .eigent/scripts/phase2-api-config.sh << 'TASK200'
#!/bin/bash

echo "======================================"
echo "🔑 PHASE 2: API CONFIGURATION"
echo "======================================"
echo ""
echo "Task 0.200: Setting up API configuration..."

# Create API config file
cat > backend/src/config/apiConfig.js << 'APICONFIG'
// API Configuration for all external services
require('dotenv').config();

module.exports = {
  // Google Custom Search API
  google: {
    apiKey: process.env.GOOGLE_API_KEY,
    searchEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID,
    baseUrl: 'https://www.googleapis.com/customsearch/v1',
    dailyLimit: 100,
    rateLimitPerMinute: 100
  },

  // News API
  newsApi: {
    apiKey: process.env.NEWS_API_KEY,
    baseUrl: 'https://newsapi.org/v2',
    dailyLimit: 100,
    rateLimitPerMinute: 5
  },

  // Bing Search API (backup)
  bing: {
    apiKey: process.env.BING_API_KEY,
    baseUrl: 'https://api.bing.microsoft.com/v7.0/search',
    dailyLimit: 1000,
    rateLimitPerMinute: 3
  },

  // MediaBias/FactCheck API (if available)
  mediaBias: {
    apiKey: process.env.MEDIABIAS_API_KEY,
    baseUrl: 'https://mediabiasfactcheck.com/api/v1',
    cacheDuration: 86400000 // 24 hours
  },

  // Rate limiting config
  rateLimit: {
    maxRequestsPerMinute: 60,
    maxRequestsPerHour: 1000,
    maxRequestsPerDay: 10000
  },

  // Cache config
  cache: {
    searchResults: 3600000, // 1 hour
    biasRatings: 86400000,  // 24 hours
    aiSummaries: 7200000    // 2 hours
  }
};
APICONFIG

# Create .env.example for reference
cat > backend/.env.example << 'ENVEXAMPLE'
# Database
DATABASE_URL=your_bolt_database_url
DB_HOST=localhost
DB_PORT=5432
DB_NAME=truegle
DB_USER=your_username
DB_PASSWORD=your_password

# API Keys
GOOGLE_API_KEY=your_google_api_key
GOOGLE_SEARCH_ENGINE_ID=your_search_engine_id
NEWS_API_KEY=your_newsapi_key
BING_API_KEY=your_bing_api_key
MEDIABIAS_API_KEY=your_mediabias_key

# OpenAI (for AI summaries)
OPENAI_API_KEY=your_openai_key

# Session
SESSION_SECRET=your_session_secret

# Environment
NODE_ENV=development
PORT=3000
ENVEXAMPLE

echo "✅ Task 0.200 complete: API configuration created"
echo ""

# Update catalog
{
echo ""
echo "### 0.200 - API Configuration (COMPLETE ✅)"
echo "- **Date:** $(date +%Y-%m-%d)"
echo "- **Status:** ✅ Complete"
echo "- **Output:** backend/src/config/apiConfig.js"
echo "- **APIs:** Google Search, News API, Bing, MediaBias"
} >> TRUEGLE_BUILD_CATALOG.md

echo "======================================"
echo "API configuration complete!"
echo "======================================"
TASK200

chmod +x .eigent/scripts/phase2-api-config.sh

# ============================================
# Task 0.201: Search Service
# ============================================
cat > .eigent/scripts/phase2-search-service.sh << 'TASK201'
#!/bin/bash

echo "======================================"
echo "🔍 PHASE 2: SEARCH SERVICE"
echo "======================================"
echo ""
echo "Task 0.201: Creating search aggregation service..."

cat > backend/src/services/searchService.js << 'SEARCHSERVICE'
const axios = require('axios');
const apiConfig = require('../config/apiConfig');
const db = require('../db/boltClient');

class SearchService {
  constructor() {
    this.cache = new Map();
  }

  // Main search method - aggregates from multiple sources
  async search(query, options = {}) {
    const {
      page = 1,
      limit = 10,
      sources = ['google', 'news'],
      biasBalance = true
    } = options;

    // Check cache first
    const cacheKey = `${query}-${page}-${limit}-${sources.join(',')}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    // Log search to database
    await this.logSearch(query, options);

    // Fetch from multiple sources
    const results = await Promise.allSettled([
      sources.includes('google') ? this.searchGoogle(query, page, limit) : null,
      sources.includes('news') ? this.searchNews(query, page, limit) : null,
      sources.includes('bing') ? this.searchBing(query, page, limit) : null
    ]);

    // Aggregate and deduplicate results
    const aggregated = this.aggregateResults(results);

    // Apply bias balancing if requested
    const balanced = biasBalance 
      ? await this.applyBiasBalancing(aggregated)
      : aggregated;

    // Cache results
    this.setCache(cacheKey, balanced);

    return balanced;
  }

  // Google Custom Search
  async searchGoogle(query, page = 1, limit = 10) {
    try {
      const start = (page - 1) * limit + 1;
      const response = await axios.get(apiConfig.google.baseUrl, {
        params: {
          key: apiConfig.google.apiKey,
          cx: apiConfig.google.searchEngineId,
          q: query,
          start,
          num: Math.min(limit, 10)
        }
      });

      return this.formatGoogleResults(response.data);
    } catch (error) {
      console.error('Google search error:', error.message);
      return { results: [], error: error.message };
    }
  }

  // News API search
  async searchNews(query, page = 1, limit = 10) {
    try {
      const response = await axios.get(`${apiConfig.newsApi.baseUrl}/everything`, {
        params: {
          apiKey: apiConfig.newsApi.apiKey,
          q: query,
          page,
          pageSize: Math.min(limit, 100),
          sortBy: 'relevancy'
        }
      });

      return this.formatNewsResults(response.data);
    } catch (error) {
      console.error('News API error:', error.message);
      return { results: [], error: error.message };
    }
  }

  // Bing Search (backup)
  async searchBing(query, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      const response = await axios.get(apiConfig.bing.baseUrl, {
        params: {
          q: query,
          count: limit,
          offset
        },
        headers: {
          'Ocp-Apim-Subscription-Key': apiConfig.bing.apiKey
        }
      });

      return this.formatBingResults(response.data);
    } catch (error) {
      console.error('Bing search error:', error.message);
      return { results: [], error: error.message };
    }
  }

  // Format results from different sources
  formatGoogleResults(data) {
    if (!data.items) return { results: [] };
    
    return {
      results: data.items.map(item => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        source: this.extractDomain(item.link),
        publishedAt: item.pagemap?.metatags?.[0]?.['article:published_time'],
        sourceType: 'google'
      })),
      total: data.searchInformation?.totalResults || 0
    };
  }

  formatNewsResults(data) {
    if (!data.articles) return { results: [] };
    
    return {
      results: data.articles.map(article => ({
        title: article.title,
        url: article.url,
        snippet: article.description,
        source: article.source.name,
        publishedAt: article.publishedAt,
        imageUrl: article.urlToImage,
        sourceType: 'news'
      })),
      total: data.totalResults || 0
    };
  }

  formatBingResults(data) {
    if (!data.webPages?.value) return { results: [] };
    
    return {
      results: data.webPages.value.map(item => ({
        title: item.name,
        url: item.url,
        snippet: item.snippet,
        source: this.extractDomain(item.url),
        publishedAt: item.dateLastCrawled,
        sourceType: 'bing'
      })),
      total: data.webPages.totalEstimatedMatches || 0
    };
  }

  // Aggregate results from multiple sources
  aggregateResults(results) {
    const allResults = [];
    const seenUrls = new Set();

    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value?.results) {
        result.value.results.forEach(item => {
          // Deduplicate by URL
          if (!seenUrls.has(item.url)) {
            seenUrls.add(item.url);
            allResults.push(item);
          }
        });
      }
    });

    return {
      results: allResults,
      total: allResults.length,
      sources: results.filter(r => r.status === 'fulfilled').length
    };
  }

  // Apply bias balancing algorithm
  async applyBiasBalancing(data) {
    const BiasService = require('./biasService');
    const biasService = new BiasService();

    // Get bias ratings for all sources
    const resultsWithBias = await Promise.all(
      data.results.map(async result => {
        const rating = await biasService.getBiasRating(result.source);
        return { ...result, biasRating: rating };
      })
    );

    // Sort to balance left/center/right
    const balanced = this.balanceByBias(resultsWithBias);

    return {
      ...data,
      results: balanced,
      biasBalance: this.calculateBiasBalance(balanced)
    };
  }

  balanceByBias(results) {
    const left = results.filter(r => r.biasRating?.bias_rating === 'left');
    const center = results.filter(r => r.biasRating?.bias_rating === 'center');
    const right = results.filter(r => r.biasRating?.bias_rating === 'right');
    const unknown = results.filter(r => !r.biasRating?.bias_rating);

    // Interleave results to maintain balance
    const balanced = [];
    const maxLength = Math.max(left.length, center.length, right.length);

    for (let i = 0; i < maxLength; i++) {
      if (center[i]) balanced.push(center[i]);
      if (left[i]) balanced.push(left[i]);
      if (right[i]) balanced.push(right[i]);
    }

    return [...balanced, ...unknown];
  }

  calculateBiasBalance(results) {
    const counts = {
      left: 0,
      center: 0,
      right: 0,
      unknown: 0
    };

    results.forEach(r => {
      const bias = r.biasRating?.bias_rating || 'unknown';
      counts[bias]++;
    });

    return counts;
  }

  // Cache management
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > apiConfig.cache.searchResults) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // Log search to database
  async logSearch(query, options) {
    try {
      const insertQuery = `
        INSERT INTO search_history (query, filters, created_at)
        VALUES ($1, $2, NOW())
      `;
      await db.query(insertQuery, [query, JSON.stringify(options)]);
    } catch (error) {
      console.error('Failed to log search:', error.message);
    }
  }

  // Utility: Extract domain from URL
  extractDomain(url) {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch {
      return url;
    }
  }
}

module.exports = SearchService;
SEARCHSERVICE

echo "✅ Task 0.201 complete: Search service created"
echo ""

# Update catalog
{
echo ""
echo "### 0.201 - Search Service (COMPLETE ✅)"
echo "- **Date:** $(date +%Y-%m-%d)"
echo "- **Status:** ✅ Complete"
echo "- **Output:** backend/src/services/searchService.js"
echo "- **Features:** Multi-source aggregation, deduplication, bias balancing"
} >> TRUEGLE_BUILD_CATALOG.md

echo "======================================"
echo "Search service complete!"
echo "======================================"
TASK201

chmod +x .eigent/scripts/phase2-search-service.sh

# ============================================
# Task 0.202: Bias Detection Service
# ============================================
cat > .eigent/scripts/phase2-bias-service.sh << 'TASK202'
#!/bin/bash

echo "======================================"
echo "⚖️  PHASE 2: BIAS DETECTION SERVICE"
echo "======================================"
echo ""
echo "Task 0.202: Creating bias detection service..."

cat > backend/src/services/biasService.js << 'BIASSERVICE'
const db = require('../db/boltClient');
const apiConfig = require('../config/apiConfig');

class BiasService {
  constructor() {
    this.cache = new Map();
  }

  // Get bias rating for a source
  async getBiasRating(sourceName) {
    // Check cache first
    const cached = this.getFromCache(sourceName);
    if (cached) return cached;

    // Check database
    try {
      const query = `
        SELECT * FROM bias_sources 
        WHERE LOWER(name) = LOWER($1) OR LOWER(domain) = LOWER($1)
        LIMIT 1
      `;
      const result = await db.query(query, [sourceName]);
      
      if (result.rows.length > 0) {
        const rating = result.rows[0];
        this.setCache(sourceName, rating);
        return rating;
      }

      // If not found, return unknown
      return this.getUnknownRating(sourceName);
    } catch (error) {
      console.error('Bias rating error:', error.message);
      return this.getUnknownRating(sourceName);
    }
  }

  // Get multiple bias ratings efficiently
  async getBiasRatings(sourceNames) {
    const uniqueSources = [...new Set(sourceNames)];
    return Promise.all(
      uniqueSources.map(source => this.getBiasRating(source))
    );
  }

  // Analyze bias distribution in search results
  analyzeBiasDistribution(results) {
    const distribution = {
      left: { count: 0, percentage: 0, sources: [] },
      center: { count: 0, percentage: 0, sources: [] },
      right: { count: 0, percentage: 0, sources: [] },
      unknown: { count: 0, percentage: 0, sources: [] }
    };

    results.forEach(result => {
      const bias = result.biasRating?.bias_rating || 'unknown';
      distribution[bias].count++;
      distribution[bias].sources.push(result.source);
    });

    const total = results.length;
    Object.keys(distribution).forEach(key => {
      distribution[key].percentage = 
        ((distribution[key].count / total) * 100).toFixed(1);
    });

    return {
      distribution,
      isBalanced: this.checkIfBalanced(distribution),
      total
    };
  }

  // Check if distribution is balanced
  checkIfBalanced(distribution) {
    const leftRight = Math.abs(
      distribution.left.count - distribution.right.count
    );
    const centerThreshold = distribution.center.count >= (distribution.left.count + distribution.right.count) * 0.3;
    
    return leftRight <= 2 && centerThreshold;
  }

  // Calculate credibility score for search results
  calculateCredibilityScore(results) {
    if (results.length === 0) return 0;

    const totalScore = results.reduce((sum, result) => {
      return sum + (result.biasRating?.credibility_score || 0.5);
    }, 0);

    return (totalScore / results.length).toFixed(2);
  }

  // Get fact-check status summary
  getFactCheckSummary(results) {
    const summary = {
      verified: 0,
      mixed: 0,
      questionable: 0,
      unknown: 0
    };

    results.forEach(result => {
      const rating = result.biasRating?.fact_check_rating || 'unknown';
      summary[rating] = (summary[rating] || 0) + 1;
    });

    return summary;
  }

  // Get unknown rating placeholder
  getUnknownRating(sourceName) {
    return {
      name: sourceName,
      domain: sourceName,
      bias_rating: 'unknown',
      bias_score: 0,
      credibility_score: 0.5,
      fact_check_rating: 'unknown',
      verified: false
    };
  }

  // Cache management
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > apiConfig.cache.biasRatings) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // Add or update bias source in database
  async updateBiasSource(sourceData) {
    const query = `
      INSERT INTO bias_sources (
        name, domain, bias_rating, bias_score, 
        credibility_score, fact_check_rating, 
        categories, verified
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (domain) 
      DO UPDATE SET
        bias_rating = EXCLUDED.bias_rating,
        bias_score = EXCLUDED.bias_score,
        credibility_score = EXCLUDED.credibility_score,
        fact_check_rating = EXCLUDED.fact_check_rating,
        verified = EXCLUDED.verified,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await db.query(query, [
      sourceData.name,
      sourceData.domain,
      sourceData.bias_rating,
      sourceData.bias_score,
      sourceData.credibility_score,
      sourceData.fact_check_rating,
      JSON.stringify(sourceData.categories || []),
      sourceData.verified || false
    ]);

    // Clear cache
    this.cache.delete(sourceData.domain);
    this.cache.delete(sourceData.name);

    return result.rows[0];
  }
}

module.exports = BiasService;
BIASSERVICE

echo "✅ Task 0.202 complete: Bias service created"
echo ""

# Update catalog
{
echo ""
echo "### 0.202 - Bias Detection Service (COMPLETE ✅)"
echo "- **Date:** $(date +%Y-%m-%d)"
echo "- **Status:** ✅ Complete"
echo "- **Output:** backend/src/services/biasService.js"
echo "- **Features:** Source rating, distribution analysis, credibility scoring"
} >> TRUEGLE_BUILD_CATALOG.md

echo "======================================"
echo "Bias detection service complete!"
echo "======================================"
TASK202

chmod +x .eigent/scripts/phase2-bias-service.sh

# ============================================
# Task 0.203: Rate Limiter
# ============================================
cat > .eigent/scripts/phase2-rate-limiter.sh << 'TASK203'
#!/bin/bash

echo "======================================"
echo "🚦 PHASE 2: RATE LIMITER"
echo "======================================"
echo ""
echo "Task 0.203: Creating rate limiter..."

cat > backend/src/utils/rateLimiter.js << 'RATELIMITER'
const db = require('../db/boltClient');
const apiConfig = require('../config/apiConfig');

class RateLimiter {
  constructor() {
    this.limits = apiConfig.rateLimit;
    this.requests = new Map();
  }

  // Check if request is allowed
  async isAllowed(userId, endpoint = 'search') {
    const now = Date.now();
    const key = `${userId}-${endpoint}`;
    
    // Get current request counts
    const counts = this.getRequestCounts(key, now);
    
    // Check limits
    if (counts.minute >= this.limits.maxRequestsPerMinute) {
      return { allowed: false, reason: 'Minute limit exceeded', retryAfter: 60 };
    }
    
    if (counts.hour >= this.limits.maxRequestsPerHour) {
      return { allowed: false, reason: 'Hour limit exceeded', retryAfter: 3600 };
    }
    
    if (counts.day >= this.limits.maxRequestsPerDay) {
      return { allowed: false, reason: 'Daily limit exceeded', retryAfter: 86400 };
    }
    
    // Log request
    await this.logRequest(userId, endpoint);
    this.addRequest(key, now);
    
    return { 
      allowed: true, 
      remaining: {
        minute: this.limits.maxRequestsPerMinute - counts.minute - 1,
        hour: this.limits.maxRequestsPerHour - counts.hour - 1,
        day: this.limits.maxRequestsPerDay - counts.day - 1
      }
    };
  }

  // Get current request counts for all time windows
  getRequestCounts(key, now) {
    const requests = this.requests.get(key) || [];
    
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;
    
    return {
      minute: requests.filter(t => t > oneMinuteAgo).length,
      hour: requests.filter(t => t > oneHourAgo).length,
      day: requests.filter(t => t > oneDayAgo).length
    };
  }

  // Add request to tracking
  addRequest(key, timestamp) {
    const requests = this.requests.get(key) || [];
    requests.push(timestamp);
    
    // Clean old requests (older than 1 day)
    const oneDayAgo = timestamp - 86400000;
    const cleaned = requests.filter(t => t > oneDayAgo);
    
    this.requests.set(key, cleaned);
  }

  // Log request to database for analytics
  async logRequest(userId, endpoint) {
    try {
      const query = `
        INSERT INTO api_usage (user_id, endpoint, created_at)
        VALUES ($1, $2, NOW())
      `;
      await db.query(query, [userId, endpoint]);
    } catch (error) {
      console.error('Failed to log API usage:', error.message);
    }
  }

  // Get usage statistics
  async getUsageStats(userId, period = 'day') {
    const intervals = {
      day: '1 day',
      week: '7 days',
      month: '30 days'
    };

    const query = `
      SELECT 
        endpoint,
        COUNT(*) as count,
        DATE_TRUNC('hour', created_at) as hour
      FROM api_usage
      WHERE user_id = $1
        AND created_at > NOW() - INTERVAL '${intervals[period]}'
      GROUP BY endpoint, hour
      ORDER BY hour DESC
    `;

    const result = await db.query(query, [userId]);
    return result.rows;
  }

  // Express middleware
  middleware() {
    return async (req, res, next) => {
      const userId = req.session?.userId || req.ip;
      const endpoint = req.path;

      const result = await this.isAllowed(userId, endpoint);

      if (!result.allowed) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: result.reason,
          retryAfter: result.retryAfter
        });
      }

      // Add rate limit headers
      res.set({
        'X-RateLimit-Remaining-Minute': result.remaining.minute,
        'X-RateLimit-Remaining-Hour': result.remaining.hour,
        'X-RateLimit-Remaining-Day': result.remaining.day
      });

      next();
    };
  }
}

module.exports = RateLimiter;
RATELIMITER

echo "✅ Task 0.203 complete: Rate limiter created"
echo ""

# Update catalog
{
echo ""
echo "### 0.203 - Rate Limiter (COMPLETE ✅)"
echo "- **Date:** $(date +%Y-%m-%d)"
echo "- **Status:** ✅ Complete"
echo "- **Output:** backend/src/utils/rateLimiter.js"
echo "- **Limits:** Per-minute, per-hour, per-day tracking"
} >> TRUEGLE_BUILD_CATALOG.md

echo "======================================"
echo "Rate limiter complete!"
echo "======================================"
TASK203

chmod +x .eigent/scripts/phase2-rate-limiter.sh

# ============================================
# Task 0.204: Package Dependencies
# ============================================
cat > .eigent/scripts/phase2-dependencies.sh << 'TASK204'
#!/bin/bash

echo "======================================"
echo "📦 PHASE 2: INSTALL DEPENDENCIES"
echo "======================================"
echo ""
echo "Task 0.204: Installing required packages..."

cd backend

# Install all required dependencies
npm install axios dotenv

echo ""
echo "✅ Task 0.204 complete: Dependencies installed"
echo ""

# Update catalog
{
echo ""
echo "### 0.204 - Dependencies Installation (COMPLETE ✅)"
echo "- **Date:** $(date +%Y-%m-%d)"
echo "- **Status:** ✅ Complete"
echo "- **Packages:** axios, dotenv"
} >> ../TRUEGLE_BUILD_CATALOG.md

cd ..

echo "======================================"
echo "Dependencies installed!"
echo "======================================"
TASK204

chmod +x .eigent/scripts/phase2-dependencies.sh

# ============================================
# Execute all Phase 2 tasks
# ============================================

echo "📍 Step 1/5: Setting up API configuration..."
./.eigent/scripts/phase2-api-config.sh
echo ""

echo "📍 Step 2/5: Creating search service..."
./.eigent/scripts/phase2-search-service.sh
echo ""

echo "📍 Step 3/5: Creating bias detection service..."
./.eigent/scripts/phase2-bias-service.sh
echo ""

echo "📍 Step 4/5: Creating rate limiter..."
./.eigent/scripts/phase2-rate-limiter.sh
echo ""

echo "📍 Step 5/5: Installing dependencies..."
./.eigent/scripts/phase2-dependencies.sh
echo ""

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "╔════════════════════════════════════════╗"
echo "║  ✅ PHASE 2 COMPLETE                  ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Duration: ${DURATION} seconds"
echo ""
echo "📄 Generated Files:"
echo "   API Layer:"
echo "   - backend/src/config/apiConfig.js"
echo "   - backend/src/services/searchService.js"
echo "   - backend/src/services/biasService.js"
echo "   - backend/src/utils/rateLimiter.js"
echo "   - backend/.env.example"
echo ""
echo "📊 Build Catalog Updated:"
echo "   - Tasks 0.200, 0.201, 0.202, 0.203, 0.204 complete"
echo ""
echo "🎯 Next Steps:"
echo "   1. Set up .env file with API keys"
echo "   2. Test search aggregation"
echo "   3. Verify bias detection"
echo "   4. Test rate limiting"
echo "   5. Proceed to Phase 3: API Routes"
echo ""
echo "⚠️  Remember to add your API keys to backend/.env:"
echo "   - GOOGLE_API_KEY"
echo "   - NEWS_API_KEY"
echo "   - BING_API_KEY (optional)"
echo ""
