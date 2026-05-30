/**
 * Brave Search Service - Privacy-Focused Search API
 *
 * Use as alternative search provider
 * Good for privacy-focused searches
 */
const axios = require('axios');
const config = require('../config/env');

class BraveSearchService {
  constructor() {
    this.apiKey = config.brave?.apiKey;
    this.baseUrl = 'https://api.search.brave.com/res/v1';
  }

  /**
   * Perform web search
   */
  async webSearch(query, options = {}) {
    if (!this.apiKey) {
      throw new Error('Brave Search API key not configured');
    }

    const {
      count = 10,
      offset = 0,
      country = 'US',
      language = 'en',
      safeSearch = 'moderate', // off, moderate, strict
      freshness = null, // pd (past day), pw (past week), pm (past month), py (past year)
    } = options;

    try {
      const response = await axios.get(`${this.baseUrl}/web/search`, {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': this.apiKey,
        },
        params: {
          q: query,
          count,
          offset,
          country,
          search_lang: language,
          safesearch: safeSearch,
          freshness,
        },
        timeout: 15000,
      });

      return this.formatWebResults(response.data);
    } catch (error) {
      console.error('Brave Search API error:', error.response?.data || error.message);

      if (error.response?.status === 401) {
        throw new Error('Invalid Brave Search API key');
      }
      if (error.response?.status === 429) {
        throw new Error('Brave Search rate limit exceeded');
      }
      if (error.response?.status === 422) {
        throw new Error(`Brave Search invalid request: ${error.response.data?.message || 'Check query parameters'}`);
      }

      throw new Error(`Brave Search service unavailable: ${error.message}`);
    }
  }

  /**
   * Perform news search
   */
  async newsSearch(query, options = {}) {
    if (!this.apiKey) {
      throw new Error('Brave Search API key not configured');
    }

    const { count = 10, offset = 0, country = 'US' } = options;

    try {
      const response = await axios.get(`${this.baseUrl}/news/search`, {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': this.apiKey,
        },
        params: {
          q: query,
          count,
          offset,
          country,
        },
        timeout: 15000,
      });

      return this.formatNewsResults(response.data);
    } catch (error) {
      console.error('Brave News Search error:', error.response?.data || error.message);
      throw new Error('Brave News Search failed');
    }
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(query) {
    if (!this.apiKey) {
      throw new Error('Brave Search API key not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/suggest/search`, {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': this.apiKey,
        },
        params: { q: query },
        timeout: 5000,
      });

      return response.data[1] || []; // Suggestions are in second array element
    } catch (error) {
      console.error('Brave suggestions error:', error.message);
      return [];
    }
  }

  /**
   * Format web search results
   */
  formatWebResults(data) {
    const results = [];

    // Web results
    if (data.web?.results) {
      data.web.results.forEach((result) => {
        results.push({
          title: result.title,
          url: result.url,
          snippet: result.description,
          source: 'brave',
          sourceName: 'Brave Search',
          date: result.age || new Date().toISOString(),
          domain: this.extractDomain(result.url),
          category: 'web',
          verified: true,
          deepLinks: result.extra_snippets || [],
        });
      });
    }

    return {
      results,
      totalResults: data.web?.results?.length || 0,
      query: data.query?.original,
      infobox: data.infobox,
      news: this.formatNewsSnippets(data.news),
      videos: this.formatVideoSnippets(data.videos),
      locations: data.locations,
    };
  }

  /**
   * Format news results
   */
  formatNewsResults(data) {
    const results = [];

    if (data.results) {
      data.results.forEach((article) => {
        results.push({
          title: article.title,
          url: article.url,
          snippet: article.description,
          source: 'brave-news',
          sourceName: article.source?.name || 'Brave News',
          date: article.age || article.breaking_published_at || new Date().toISOString(),
          image: article.thumbnail?.src,
          category: 'news',
          verified: true,
        });
      });
    }

    return results;
  }

  /**
   * Format news snippets from web results
   */
  formatNewsSnippets(newsData) {
    if (!newsData?.results) return [];

    return newsData.results.map((article) => ({
      title: article.title,
      url: article.url,
      source: article.source?.name,
      age: article.age,
    }));
  }

  /**
   * Format video snippets
   */
  formatVideoSnippets(videoData) {
    if (!videoData?.results) return [];

    return videoData.results.map((video) => ({
      title: video.title,
      url: video.url,
      thumbnail: video.thumbnail?.src,
      duration: video.meta_url?.duration,
    }));
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
      const response = await axios.get(`${this.baseUrl}/web/search`, {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': this.apiKey,
        },
        params: { q: 'test', count: 1 },
        timeout: 5000,
      });
      return { healthy: true, results: response.data.web?.results?.length || 0 };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

module.exports = new BraveSearchService();
