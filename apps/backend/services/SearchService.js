const axios = require('axios');
const config = require('../config/env');

class SearchService {
  constructor() {
    // Google Custom Search
    this.googleApiKey = config.searchApis.google.apiKey;
    this.googleSearchEngineId = config.searchApis.google.searchEngineId;
    this.googleBaseUrl = 'https://www.googleapis.com/customsearch/v1';

    // Bing Search API
    this.bingApiKey = config.searchApis.bing.apiKey;
    this.bingBaseUrl = 'https://api.bing.microsoft.com/v7.0/search';

    // News API
    this.newsApiKey = config.searchApis.news.apiKey;
    this.newsBaseUrl = 'https://newsapi.org/v2/everything';

    // YouTube Data API
    this.youtubeApiKey = config.searchApis.youtube.apiKey;
    this.youtubeBaseUrl = 'https://www.googleapis.com/youtube/v3/search';

    // Rate limiting configuration
    this.rateLimits = {
      google: 100, // requests per minute
      bing: 1000, // requests per minute
      news: 500, // requests per day
      youtube: 100, // requests per minute
    };

    this.requestTimestamps = {
      google: [],
      bing: [],
      news: [],
      youtube: [],
    };
  }

  /**
   * Perform search across multiple sources
   */
  async performSearch(query, filters) {
    try {
      console.log('🔍 SearchService.performSearch called with:', { query, filters });
      const searchPromises = [];

      // Add search sources based on category filter
      if (filters.category === 'all' || filters.category === 'web') {
        if (this.googleApiKey && this.googleSearchEngineId) {
          console.log('✅ Adding Google Search');
          searchPromises.push(this.performGoogleSearch(query, filters));
        }
        if (this.bingApiKey) {
          console.log('✅ Adding Bing Search');
          searchPromises.push(this.performBingSearch(query, filters));
        }
      }

      if (filters.category === 'all' || filters.category === 'news') {
        if (this.newsApiKey) {
          console.log('✅ Adding News API');
          searchPromises.push(this.performNewsSearch(query, filters));
        }
      }

      if (filters.category === 'all' || filters.category === 'videos') {
        if (this.youtubeApiKey) {
          console.log('✅ Adding YouTube API');
          searchPromises.push(this.performYoutubeSearch(query, filters));
        }
      }

      console.log(`📦 Total search promises: ${searchPromises.length}`);

      // Wait for all searches to complete
      const results = await Promise.allSettled(searchPromises);

      // Combine and process results
      const combinedResults = this.combineResults(results);
      console.log(`🔗 Combined results: ${combinedResults.length}`);

      // Apply bias detection and categorization
      const categorizedResults = this.categorizeByBias(combinedResults);
      console.log(`🏷️  Categorized results: ${categorizedResults.length}`);

      // Sort and filter results
      const finalResults = this.sortAndFilter(categorizedResults, filters);
      console.log(`✨ Final results after filtering: ${finalResults.length}`);

      return finalResults;
    } catch (error) {
      console.error('SearchService error:', error);
      throw new Error('Search service unavailable');
    }
  }

  /**
   * Perform Google Custom Search
   */
  async performGoogleSearch(query, filters) {
    if (!this.googleApiKey || !this.googleSearchEngineId) {
      throw new Error('Google Search API not configured');
    }

    // Google Custom Search API only allows num 1-10
    const googlePerPage = Math.min(filters.perPage || 10, 10);

    const params = {
      key: this.googleApiKey,
      cx: this.googleSearchEngineId,
      q: query,
      num: googlePerPage,
      start: ((filters.page || 1) - 1) * googlePerPage + 1,
    };

    // Add safe search filter
    if (filters.safeSearch !== false) {
      params.safe = 'active';
    }

    try {
      const response = await axios.get(this.googleBaseUrl, { params });
      return response.data;
    } catch (error) {
      console.error(
        'Google Search API error:',
        JSON.stringify(error.response?.data, null, 2) || error.message
      );

      if (error.response?.status === 403) {
        throw new Error('Google API key invalid or quota exceeded');
      }
      if (error.response?.status === 429) {
        throw new Error('Google API rate limit exceeded');
      }
      if (error.response?.status === 400) {
        console.error('Google 400 error - Bad request. Query might be invalid.');
        throw new Error('Google Search bad request');
      }

      throw new Error('Google Search service unavailable');
    }
  }

  /**
   * Perform Bing Web Search
   */
  async performBingSearch(query, filters) {
    if (!this.bingApiKey) {
      throw new Error('Bing Search API not configured');
    }

    const headers = {
      'Ocp-Apim-Subscription-Key': this.bingApiKey,
    };

    const params = {
      q: query,
      count: filters.perPage || 10,
      offset: ((filters.page || 1) - 1) * (filters.perPage || 10),
      mkt: 'en-US',
      safesearch: filters.safeSearch !== false ? 'Moderate' : 'Off',
    };

    // Add date range filter
    if (filters.dateRange && filters.dateRange !== 'any') {
      params.freshness = this.formatBingDateRange(filters.dateRange);
    }

    try {
      const response = await axios.get(this.bingBaseUrl, { headers, params });
      return response.data;
    } catch (error) {
      console.error(
        'Bing Search API error:',
        error.response?.data || error.message
      );

      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Bing API key invalid');
      }
      if (error.response?.status === 429) {
        throw new Error('Bing API rate limit exceeded');
      }

      throw new Error('Bing Search service unavailable');
    }
  }

  /**
   * Perform News API Search
   */
  async performNewsSearch(query, filters) {
    if (!this.newsApiKey) {
      throw new Error('News API not configured');
    }

    const params = {
      apiKey: this.newsApiKey,
      q: query,
      pageSize: filters.perPage || 20,
      page: filters.page || 1,
      sortBy: filters.sortBy === 'date' ? 'publishedAt' : 'relevancy',
      language: 'en',
    };

    // Add date range filter
    if (filters.dateRange && filters.dateRange !== 'any') {
      const dateFrom = this.calculateDateFrom(filters.dateRange);
      params.from = dateFrom;
    }

    try {
      const response = await axios.get(this.newsBaseUrl, { params });
      return response.data;
    } catch (error) {
      console.error('News API error:', JSON.stringify(error.response?.data, null, 2) || error.message);

      if (error.response?.status === 401) {
        throw new Error('News API key invalid');
      }
      if (error.response?.status === 429) {
        throw new Error('News API rate limit exceeded');
      }

      throw new Error('News service unavailable');
    }
  }

  /**
   * Perform YouTube Search
   */
  async performYoutubeSearch(query, filters) {
    if (!this.youtubeApiKey) {
      throw new Error('YouTube API not configured');
    }

    const params = {
      key: this.youtubeApiKey,
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: filters.perPage || 25,
      order: filters.sortBy === 'views' ? 'viewCount' : 'relevance',
    };

    // Add date range filter
    if (filters.dateRange && filters.dateRange !== 'any') {
      const dateAfter = this.calculateDateFrom(filters.dateRange);
      params.publishedAfter = new Date(dateAfter).toISOString();
    }

    try {
      const response = await axios.get(this.youtubeBaseUrl, { params });
      return response.data;
    } catch (error) {
      console.error(
        'YouTube API error:',
        error.response?.data || error.message
      );

      if (error.response?.status === 403) {
        throw new Error('YouTube API key invalid or quota exceeded');
      }
      if (error.response?.status === 429) {
        throw new Error('YouTube API rate limit exceeded');
      }

      throw new Error('YouTube service unavailable');
    }
  }

  /**
   * Format search results into consistent format
   */
  formatResults(data, source) {
    switch (source) {
      case 'google':
        return this.formatGoogleResults(data);
      case 'bing':
        return this.formatBingResults(data);
      case 'news':
        return this.formatNewsResults(data);
      case 'youtube':
        return this.formatYouTubeResults(data);
      default:
        return [];
    }
  }

  formatGoogleResults(googleData) {
    if (!googleData || !googleData.items) return [];

    return googleData.items.map((item) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      source: 'google',
      sourceName: 'Google',
      date: item.date || new Date().toISOString(),
      image: item.pagemap?.cse_image?.[0]?.src || null,
      favicon: item.pagemap?.cse_thumbnail?.[0]?.src || null,
      domain: this.extractDomain(item.link),
      category: 'web',
      verified: true,
    }));
  }

  /**
   * Combine results from multiple search sources
   */
  combineResults(results) {
    const combined = [];

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        const source = this.detectSource(result.value);
        const formatted = this.formatResults(result.value, source);
        combined.push(...formatted);
      }
    });

    // Remove duplicates based on URL
    const uniqueResults = combined.filter(
      (result, index, self) =>
        index === self.findIndex((r) => r.url === result.url)
    );

    return uniqueResults;
  }

  /**
   * Detect source from API response
   */
  detectSource(data) {
    if (data.items && data.kind === 'customsearch#search') return 'google';
    if (data.webPages && data._type === 'SearchResponse') return 'bing';
    if (data.articles && data.status === 'ok') return 'news';
    if (data.items && data.kind === 'youtube#searchListResponse')
      return 'youtube';
    return 'unknown';
  }

  /**
   * Categorize results by bias
   */
  categorizeByBias(results) {
    return results.map((result) => {
      const bias = this.detectBias(result);
      const category = this.detectCategory(result);

      return {
        ...result,
        bias: bias || 'unbiased',
        category: category || result.category || 'web',
      };
    });
  }

  /**
   * Detect bias based on source domain
   */
  detectBias(result) {
    const domain = result.domain || this.extractDomain(result.url || '');

    const biasMap = {
      // LEFT-LEANING SOURCES
      'cnn.com': 'left',
      'msnbc.com': 'left',
      'nytimes.com': 'left',
      'washingtonpost.com': 'left',
      'huffpost.com': 'left',
      'theguardian.com': 'left',
      'slate.com': 'left',
      'vox.com': 'left',
      'thedailybeast.com': 'left',
      'motherjones.com': 'left',
      'thenation.com': 'left',
      'salon.com': 'left',
      'thinkprogress.org': 'left',
      'commondreams.org': 'left',
      'democracynow.org': 'left',
      'jacobin.com': 'left',
      'newrepublic.com': 'left',
      'talkingpointsmemo.com': 'left',
      'rawstory.com': 'left',
      'alternet.org': 'left',

      // RIGHT-LEANING SOURCES
      'foxnews.com': 'right',
      'breitbart.com': 'right',
      'dailywire.com': 'right',
      'nypost.com': 'right',
      'wsj.com': 'right',
      'nationalreview.com': 'right',
      'theblaze.com': 'right',
      'townhall.com': 'right',
      'redstate.com': 'right',
      'thefederalist.com': 'right',
      'washingtonexaminer.com': 'right',
      'washingtontimes.com': 'right',
      'newsmax.com': 'right',
      'oann.com': 'right',
      'americanthinker.com': 'right',
      'conservativereview.com': 'right',
      'weeklystandard.com': 'right',
      'theamericanconservative.com': 'right',
      'powerlineblog.com': 'right',
      'legalinsurrection.com': 'right',

      // CENTER/UNBIASED SOURCES
      'reuters.com': 'unbiased',
      'apnews.com': 'unbiased',
      'bbc.com': 'center',
      'npr.org': 'center',
      'pbs.org': 'unbiased',
      'c-span.org': 'unbiased',
      'thehill.com': 'center',
      'politico.com': 'center',
      'axios.com': 'center',
      'bloomberg.com': 'center',
      'fortune.com': 'center',
      'usatoday.com': 'center',
      'cbsnews.com': 'center',
      'abcnews.go.com': 'center',
      'nbcnews.com': 'center',
      'time.com': 'center',
      'newsweek.com': 'center',
      'economist.com': 'center',
      'ft.com': 'center',

      // MAINSTREAM/GENERAL
      'google.com': 'mainstream',
      'bing.com': 'mainstream',
      'yahoo.com': 'mainstream',
      'wikipedia.org': 'unbiased',
      'en.wikipedia.org': 'unbiased',
      'youtube.com': 'mainstream',
    };

    return biasMap[domain] || 'neutral';
  }

  /**
   * Detect category based on URL and content
   */
  detectCategory(result) {
    const url = result.url || '';
    const title = result.title || '';

    if (url.includes('youtube.com') || url.includes('vimeo.com')) {
      return 'videos';
    }

    if (
      url.includes('reddit.com') ||
      url.includes('twitter.com') ||
      url.includes('facebook.com')
    ) {
      return 'social';
    }

    if (
      url.includes('shop') ||
      url.includes('buy') ||
      url.includes('store') ||
      url.includes('amazon')
    ) {
      return 'shopping';
    }

    if (
      title.toLowerCase().includes('music') ||
      url.includes('spotify') ||
      url.includes('soundcloud')
    ) {
      return 'music';
    }

    return result.category || 'web';
  }

  /**
   * Sort and filter results
   */
  sortAndFilter(results, filters) {
    let filtered = results;

    // Apply bias filter
    if (filters.bias !== 'all') {
      filtered = filtered.filter((result) => result.bias === filters.bias);
    }

    // Apply category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(
        (result) => result.category === filters.category
      );
    }

    // Sort results
    if (filters.sortBy === 'date') {
      filtered.sort((a, b) => {
        const aDate = new Date(a.date);
        const bDate = new Date(b.date);
        return filters.order === 'desc' ? bDate - aDate : aDate - bDate;
      });
    }

    return filtered;
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
   * Calculate date from range
   */
  calculateDateFrom(dateRange) {
    const now = new Date();
    const ranges = {
      hour: new Date(now - 60 * 60 * 1000),
      day: new Date(now - 24 * 60 * 60 * 1000),
      week: new Date(now - 7 * 24 * 60 * 60 * 1000),
      month: new Date(now - 30 * 24 * 60 * 60 * 1000),
      year: new Date(now - 365 * 24 * 60 * 60 * 1000),
    };

    return ranges[dateRange]?.toISOString().split('T')[0] || null;
  }

  /**
   * Format Bing date range
   */
  formatBingDateRange(dateRange) {
    const ranges = {
      hour: 'Day',
      day: 'Day',
      week: 'Week',
      month: 'Month',
    };

    return ranges[dateRange] || '';
  }

  formatNewsResults(newsData) {
    if (!newsData || !newsData.articles) return [];

    return newsData.articles.map((article) => ({
      title: article.title,
      url: article.url,
      snippet: article.description,
      source: 'news',
      sourceName: 'News API',
      date: article.publishedAt || new Date().toISOString(),
      image: article.urlToImage || null,
      favicon: null,
      domain: this.extractDomain(article.url),
      category: 'news',
      verified: true,
    }));
  }

  formatYouTubeResults(youtubeData) {
    if (!youtubeData || !youtubeData.items) return [];

    return youtubeData.items.map((item) => ({
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      snippet: item.snippet.description,
      source: 'youtube',
      sourceName: 'YouTube',
      date: item.snippet.publishedAt || new Date().toISOString(),
      image: item.snippet.thumbnails?.high?.url || null,
      favicon: null,
      domain: 'youtube.com',
      category: 'videos',
      verified: true,
    }));
  }

  /**
   * Get available search sources and their status
   */
  async getAvailableSources() {
    const sources = [
      {
        id: 'google',
        name: 'Google Search',
        enabled: !!this.googleApiKey && !!this.googleSearchEngineId,
        requiresAuth: true,
        description: 'Web search results from Google',
        configured: !!this.googleApiKey && !!this.googleSearchEngineId,
      },
      {
        id: 'bing',
        name: 'Bing Search',
        enabled: !!this.bingApiKey,
        requiresAuth: true,
        description: 'Web search results from Bing',
        configured: !!this.bingApiKey,
      },
      {
        id: 'news',
        name: 'News API',
        enabled: !!this.newsApiKey,
        requiresAuth: true,
        description: 'News articles from various sources',
        configured: !!this.newsApiKey,
      },
      {
        id: 'youtube',
        name: 'YouTube',
        enabled: !!this.youtubeApiKey,
        requiresAuth: true,
        description: 'Video content from YouTube',
        configured: !!this.youtubeApiKey,
      },
    ];

    return sources;
  }

  /**
   * Get health status of search services
   */
  async getHealthStatus() {
    const sources = await this.getAvailableSources();
    const healthStatus = {};

    for (const source of sources) {
      if (source.enabled) {
        try {
          // Test each source with a simple query
          switch (source.id) {
            case 'google':
              await this.performGoogleSearch('test', { perPage: 1 });
              healthStatus[source.id] = 'healthy';
              break;
            case 'bing':
              await this.performBingSearch('test', { perPage: 1 });
              healthStatus[source.id] = 'healthy';
              break;
            case 'news':
              await this.performNewsSearch('test', { perPage: 1 });
              healthStatus[source.id] = 'healthy';
              break;
            case 'youtube':
              await this.performYoutubeSearch('test', { perPage: 1 });
              healthStatus[source.id] = 'healthy';
              break;
            default:
              healthStatus[source.id] = 'configured';
          }
        } catch (error) {
          console.error(`Health check failed for ${source.id}:`, error.message);
          healthStatus[source.id] = 'unhealthy';
        }
      } else {
        healthStatus[source.id] = 'not_configured';
      }
    }

    return healthStatus;
  }
}

module.exports = SearchService;
