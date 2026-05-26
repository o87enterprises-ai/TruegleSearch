/**
 * SERP API Service - Google Search Results Scraping
 *
 * Use this as a fallback when Google Custom Search API quota is exhausted
 * or for more advanced search features
 */
const axios = require('axios');
const config = require('../config/env');

class SerpApiService {
  constructor() {
    this.apiKey = config.serp?.apiKey;
    this.baseUrl = 'https://serpapi.com/search.json';
  }

  /**
   * Perform Google search via SERP API
   */
  async googleSearch(query, options = {}) {
    if (!this.apiKey) {
      throw new Error('SERP API key not configured');
    }

    const {
      location = 'United States',
      language = 'en',
      numResults = 10,
      page = 1,
      safeSearch = true,
    } = options;

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          engine: 'google',
          q: query,
          api_key: this.apiKey,
          location,
          hl: language,
          gl: 'us',
          num: numResults,
          start: (page - 1) * numResults,
          safe: safeSearch ? 'active' : 'off',
        },
        timeout: 15000,
      });

      return this.formatGoogleResults(response.data);
    } catch (error) {
      console.error('SERP API error:', error.response?.data || error.message);

      if (error.response?.status === 401) {
        throw new Error('Invalid SERP API key');
      }
      if (error.response?.status === 429) {
        throw new Error('SERP API rate limit exceeded');
      }

      throw new Error(`SERP API service unavailable: ${error.message}`);
    }
  }

  /**
   * Perform Google News search
   */
  async newsSearch(query, options = {}) {
    if (!this.apiKey) {
      throw new Error('SERP API key not configured');
    }

    const { location = 'United States', language = 'en' } = options;

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          engine: 'google_news',
          q: query,
          api_key: this.apiKey,
          location,
          hl: language,
          gl: 'us',
        },
        timeout: 15000,
      });

      return this.formatNewsResults(response.data);
    } catch (error) {
      console.error('SERP API news error:', error.response?.data || error.message);
      throw new Error('SERP API news search failed');
    }
  }

  /**
   * Perform Google Images search
   */
  async imageSearch(query, options = {}) {
    if (!this.apiKey) {
      throw new Error('SERP API key not configured');
    }

    const { numResults = 20 } = options;

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          engine: 'google_images',
          q: query,
          api_key: this.apiKey,
          num: numResults,
        },
        timeout: 15000,
      });

      return this.formatImageResults(response.data);
    } catch (error) {
      console.error('SERP API image error:', error.response?.data || error.message);
      throw new Error('SERP API image search failed');
    }
  }

  /**
   * Get related searches and "People also ask"
   */
  async getRelatedSearches(query) {
    if (!this.apiKey) {
      throw new Error('SERP API key not configured');
    }

    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          engine: 'google',
          q: query,
          api_key: this.apiKey,
        },
        timeout: 15000,
      });

      return {
        relatedSearches: response.data.related_searches || [],
        peopleAlsoAsk: response.data.related_questions || [],
      };
    } catch (error) {
      console.error('SERP API related searches error:', error.message);
      return { relatedSearches: [], peopleAlsoAsk: [] };
    }
  }

  /**
   * Perform Google Shopping search
   */
  async shoppingSearch(query, options = {}) {
    if (!this.apiKey) {
      throw new Error('SERP API key not configured');
    }

    const {
      location = 'United States',
      language = 'en',
      numResults = 50,
      minPrice,
      maxPrice,
    } = options;

    try {
      const params = {
        engine: 'google_shopping',
        q: query,
        api_key: this.apiKey,
        location,
        hl: language,
        gl: 'us',
        num: numResults,
      };

      // Add price filters if provided
      if (minPrice !== undefined) params.min_price = minPrice;
      if (maxPrice !== undefined) params.max_price = maxPrice;

      const response = await axios.get(this.baseUrl, {
        params,
        timeout: 15000,
      });

      return this.formatShoppingResults(response.data);
    } catch (error) {
      console.error('SERP API shopping error:', error.response?.data || error.message);

      if (error.response?.status === 401) {
        throw new Error('Invalid SERP API key');
      }
      if (error.response?.status === 429) {
        throw new Error('SERP API rate limit exceeded');
      }

      throw new Error(`SERP API shopping search failed: ${error.message}`);
    }
  }

  /**
   * Format Google search results
   */
  formatGoogleResults(data) {
    const results = [];

    // Organic results
    if (data.organic_results) {
      data.organic_results.forEach((result) => {
        results.push({
          title: result.title,
          url: result.link,
          snippet: result.snippet,
          source: 'serpapi-google',
          sourceName: 'Google (SERP API)',
          date: result.date || new Date().toISOString(),
          position: result.position,
          domain: this.extractDomain(result.link),
          category: 'web',
          verified: true,
        });
      });
    }

    return {
      results,
      totalResults: data.search_information?.total_results || 0,
      searchTime: data.search_information?.time_taken_displayed || 0,
      relatedSearches: data.related_searches || [],
      peopleAlsoAsk: data.related_questions || [],
    };
  }

  /**
   * Format news results
   */
  formatNewsResults(data) {
    const results = [];

    if (data.news_results) {
      data.news_results.forEach((article) => {
        results.push({
          title: article.title,
          url: article.link,
          snippet: article.snippet,
          source: 'serpapi-news',
          sourceName: article.source || 'Google News',
          date: article.date || new Date().toISOString(),
          image: article.thumbnail,
          category: 'news',
          verified: true,
        });
      });
    }

    return results;
  }

  /**
   * Format image results
   */
  formatImageResults(data) {
    const results = [];

    if (data.images_results) {
      data.images_results.forEach((image) => {
        results.push({
          title: image.title,
          url: image.original,
          thumbnail: image.thumbnail,
          source: image.source,
          width: image.original_width,
          height: image.original_height,
        });
      });
    }

    return results;
  }

  /**
   * Format shopping results
   */
  formatShoppingResults(data) {
    const products = [];

    if (data.shopping_results) {
      data.shopping_results.forEach((product) => {
        products.push({
          id: product.product_id || product.position,
          name: product.title,
          price: product.extracted_price || product.price || 0,
          priceRaw: product.price,
          store: product.source || product.merchant || 'Unknown',
          url: product.link,
          image: product.thumbnail,
          rating: product.rating || null,
          reviews: product.reviews || product.reviews_count || 0,
          description: product.snippet || '',
          availability: product.delivery || product.shipping || 'Check store',
          position: product.position,
          // Additional metadata
          compareAtPrice: product.compare_at_price,
          extensions: product.extensions || [],
        });
      });
    }

    return {
      products,
      totalResults: data.search_information?.total_results || 0,
      searchTime: data.search_information?.time_taken_displayed || 0,
    };
  }

  /**
   * Extract domain from URL
   */
  extractDomain(url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown.com';
    }
  }

  /**
   * Check service health
   */
  async healthCheck() {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          engine: 'google',
          q: 'test',
          api_key: this.apiKey,
        },
        timeout: 5000,
      });
      return { healthy: true, creditsUsed: response.data.search_metadata?.credits_used || 0 };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

module.exports = new SerpApiService();
