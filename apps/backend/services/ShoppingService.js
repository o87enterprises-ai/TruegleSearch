/**
 * Shopping Service - Product Search and Price Comparison
 *
 * Provides shopping functionality with caching and price comparison
 */
const serpApiService = require('./SerpApiService');
const paidBudget = require('./PaidProviderBudget');
const config = require('../config/env');
const Redis = require('ioredis');

class ShoppingService {
  constructor() {
    // Cache TTL (1 hour default)
    this.cacheTTL = parseInt(process.env.SHOPPING_CACHE_TTL) || 3600;
    this.resultsLimit = parseInt(process.env.SHOPPING_RESULTS_LIMIT) || 50;
    this.redis = null;
    this.redisEnabled = process.env.REDIS_ENABLED !== 'false';
  }

  /**
   * Initialize Redis connection (lazy initialization)
   */
  initRedis() {
    if (this.redis || !this.redisEnabled) return;

    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        retryStrategy: (times) => {
          if (times > 3) return null; // Stop retrying after 3 attempts
          return Math.min(times * 200, 1000);
        },
        lazyConnect: true,
      });

      this.redis.on('error', (err) => {
        console.error('Redis connection error:', err.message);
        this.redis = null; // Disable Redis on persistent errors
      });

      // Try to connect
      this.redis.connect().catch((err) => {
        console.warn('Redis unavailable, caching disabled:', err.message);
        this.redis = null;
      });
    } catch (error) {
      console.warn('Redis initialization failed:', error.message);
      this.redis = null;
    }
  }

  /**
   * Search for products
   */
  async searchProducts(query, options = {}) {
    if (!query || query.trim().length === 0) {
      throw new Error('Search query is required');
    }

    // Initialize Redis if enabled
    this.initRedis();

    // Generate cache key
    const cacheKey = `shopping:search:${query}:${JSON.stringify(options)}`;

    // Try to get from cache (if Redis is available)
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          console.log('Shopping cache hit');
          return JSON.parse(cached);
        }
      } catch (error) {
        console.error('Redis get error:', error.message);
        // Continue without cache
      }
    }

    // SHOPPING IS THE OTHER PAID TAP. It goes to the same SerpApi account the
    // search fallback drained, so it draws on the same daily budget — a cap
    // that only covered one of two callers would not be a cap.
    const budget = paidBudget.claim('serpapi', (config.serp && config.serp.dailyLimit) || 0);
    if (!budget.ok) {
      // An empty list rather than a throw: shopping is a category tab, and a
      // spent budget is a limit on us, not an error the shopper caused.
      const err = new Error(`Shopping is unavailable — ${budget.reason}`);
      err.code = 'BUDGET_EXHAUSTED';
      throw err;
    }
    const results = await serpApiService.shoppingSearch(query, {
      ...options,
      numResults: this.resultsLimit,
    });

    // Process and format results
    const formattedResults = this.formatResults(results);

    // Cache the results (if Redis is available)
    if (this.redis) {
      try {
        await this.redis.setex(
          cacheKey,
          this.cacheTTL,
          JSON.stringify(formattedResults)
        );
      } catch (error) {
        console.error('Redis setex error:', error.message);
        // Continue without caching
      }
    }

    return formattedResults;
  }

  /**
   * Compare prices for a product across stores
   */
  async comparePrice(productName, options = {}) {
    const results = await this.searchProducts(productName, options);

    if (!results.products || results.products.length === 0) {
      return {
        productName,
        found: false,
        message: 'No products found',
      };
    }

    // Group by store and find best prices
    const pricesByStore = {};
    results.products.forEach((product) => {
      const store = product.store;
      if (!pricesByStore[store] || product.price < pricesByStore[store].price) {
        pricesByStore[store] = product;
      }
    });

    // Find cheapest overall
    const cheapest = results.products.reduce((min, product) =>
      product.price < min.price ? product : min
    );

    return {
      productName,
      found: true,
      cheapest,
      pricesByStore,
      averagePrice: this.calculateAveragePrice(results.products),
      priceRange: this.getPriceRange(results.products),
    };
  }

  /**
   * Get detailed product information
   */
  async getProductDetails(productId) {
    // This would require additional API integration (e.g., Amazon Product API)
    // For now, return a placeholder
    throw new Error('Product details feature not yet implemented');
  }

  /**
   * Format results for frontend consumption
   */
  formatResults(rawResults) {
    if (!rawResults.products || rawResults.products.length === 0) {
      return {
        mainProduct: null,
        otherProducts: [],
        totalResults: 0,
      };
    }

    const products = rawResults.products;

    // Filter out products without valid prices
    const validProducts = products.filter(
      (p) => p.price && p.price > 0 && this.isAppropriate(p)
    );

    if (validProducts.length === 0) {
      return {
        mainProduct: null,
        otherProducts: [],
        totalResults: 0,
      };
    }

    // Sort by price to find cheapest
    const sortedByPrice = [...validProducts].sort((a, b) => a.price - b.price);

    // Find product that's a good deal (cheapest or highly rated)
    const cheapest = sortedByPrice[0];

    // Calculate savings potential
    const pricesForComparison = this.getPricesForComparison(validProducts, cheapest);

    const mainProduct = {
      ...cheapest,
      amazonPrice: pricesForComparison.amazonPrice,
      walmartPrice: pricesForComparison.walmartPrice,
      targetPrice: pricesForComparison.targetPrice,
    };

    // Get other products (exclude the main one)
    const otherProducts = validProducts
      .filter((p) => p.id !== cheapest.id)
      .slice(0, 10);

    return {
      mainProduct,
      otherProducts,
      totalResults: rawResults.totalResults,
      searchTime: rawResults.searchTime,
    };
  }

  /**
   * Get prices from major retailers for comparison
   */
  getPricesForComparison(products, mainProduct) {
    const stores = {
      amazon: ['amazon', 'amazon.com'],
      walmart: ['walmart', 'walmart.com'],
      target: ['target', 'target.com'],
    };

    const comparison = {
      amazonPrice: null,
      walmartPrice: null,
      targetPrice: null,
    };

    // Find prices from each major retailer
    for (const product of products) {
      const storeLower = product.store.toLowerCase();

      if (stores.amazon.some((s) => storeLower.includes(s)) && !comparison.amazonPrice) {
        comparison.amazonPrice = product.price;
      }
      if (stores.walmart.some((s) => storeLower.includes(s)) && !comparison.walmartPrice) {
        comparison.walmartPrice = product.price;
      }
      if (stores.target.some((s) => storeLower.includes(s)) && !comparison.targetPrice) {
        comparison.targetPrice = product.price;
      }
    }

    // If we don't have prices from major retailers, use average price as fallback
    const avgPrice = this.calculateAveragePrice(products);

    return {
      amazonPrice: comparison.amazonPrice || avgPrice * 1.1,
      walmartPrice: comparison.walmartPrice || avgPrice * 1.05,
      targetPrice: comparison.targetPrice || avgPrice * 1.08,
    };
  }

  /**
   * Calculate average price
   */
  calculateAveragePrice(products) {
    if (!products || products.length === 0) return 0;

    const sum = products.reduce((total, p) => total + (p.price || 0), 0);
    return sum / products.length;
  }

  /**
   * Get price range (min and max)
   */
  getPriceRange(products) {
    if (!products || products.length === 0) {
      return { min: 0, max: 0 };
    }

    const prices = products.map((p) => p.price).filter((p) => p > 0);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }

  /**
   * Check if product is appropriate (filter adult/inappropriate content)
   */
  isAppropriate(product) {
    const inappropriateKeywords = [
      'adult',
      'xxx',
      'nsfw',
      'explicit',
      'tobacco',
      'cigarette',
      'vape',
      'cannabis',
    ];

    const text = `${product.name} ${product.description}`.toLowerCase();

    return !inappropriateKeywords.some((keyword) => text.includes(keyword));
  }

  /**
   * Clear cache for a specific query
   */
  async clearCache(query) {
    if (!this.redis) {
      return { cleared: 0, message: 'Redis not available' };
    }

    try {
      const pattern = `shopping:search:${query}:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      return { cleared: keys.length };
    } catch (error) {
      console.error('Clear cache error:', error.message);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    if (!this.redis) {
      return {
        cachedSearches: 0,
        cacheTTL: this.cacheTTL,
        resultsLimit: this.resultsLimit,
        redisStatus: 'disabled',
      };
    }

    try {
      const keys = await this.redis.keys('shopping:search:*');
      return {
        cachedSearches: keys.length,
        cacheTTL: this.cacheTTL,
        resultsLimit: this.resultsLimit,
        redisStatus: 'connected',
      };
    } catch (error) {
      console.error('Get cache stats error:', error.message);
      return {
        cachedSearches: 0,
        cacheTTL: this.cacheTTL,
        resultsLimit: this.resultsLimit,
        redisStatus: 'error',
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.redis) {
      return {
        healthy: true,
        cache: 'disabled',
        stats: await this.getCacheStats(),
      };
    }

    try {
      // Test Redis connection
      await this.redis.ping();
      return {
        healthy: true,
        cache: 'connected',
        stats: await this.getCacheStats(),
      };
    } catch (error) {
      return {
        healthy: true,
        cache: 'disconnected',
        error: error.message,
      };
    }
  }
}

module.exports = new ShoppingService();
