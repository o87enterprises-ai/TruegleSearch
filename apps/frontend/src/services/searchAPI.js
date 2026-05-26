// Search API service for integrating real search results
import { SEARCH_CONFIG } from '../config/searchConfig.jsx';

class SearchAPI {
  constructor() {
    this.endpoints = {
      // Primary search APIs
      serpApi: 'https://serpapi.com/search',
      bingApi: 'https://api.bing.microsoft.com/v7.0/search',
      googleCustomSearch: 'https://www.googleapis.com/customsearch/v1',

      // News APIs for unbiased content
      newsApi: 'https://newsapi.org/v2/everything',
      mediastack: 'https://api.mediastack.com/v1/news',

      // Social media APIs
      twitterApi: 'https://api.twitter.com/2/tweets/search/recent',
      redditApi: 'https://www.reddit.com/search.json',

      // Video APIs
      youtubeApi: 'https://www.googleapis.com/youtube/v3/search',

      // Alternative search engines
      duckduckgo: 'https://api.duckduckgo.com/',
      yandex: 'https://yandex.com/search/xml',
    };
  }

  // Main search orchestrator
  async performUnbiasedSearch(query, filters = {}) {
    try {
      const searchPromises = [];

      // Get results from multiple sources simultaneously
      if (filters.category === 'all' || filters.category === 'mainstream') {
        searchPromises.push(this.searchMainstream(query, filters));
      }

      if (filters.category === 'all' || filters.category === 'news') {
        searchPromises.push(this.searchNews(query, filters));
      }

      if (filters.category === 'all' || filters.category === 'videos') {
        searchPromises.push(this.searchVideos(query, filters));
      }

      if (filters.category === 'all' || filters.category === 'socials') {
        searchPromises.push(this.searchSocial(query, filters));
      }

      if (filters.category === 'all' || filters.category === 'shopping') {
        searchPromises.push(this.searchShopping(query, filters));
      }

      // Wait for all searches to complete
      const results = await Promise.allSettled(searchPromises);

      // Combine and process results
      const combinedResults = this.combineResults(results, filters);

      // Apply bias detection and categorization
      const categorizedResults = this.categorizeByBias(combinedResults);

      // Sort and filter results
      return this.sortAndFilter(categorizedResults, filters);
    } catch (error) {
      console.error('Search error:', error);
      throw new Error('Search service unavailable');
    }
  }

  // Search mainstream sources (Google, Bing)
  async searchMainstream(query, filters) {
    const results = [];

    try {
      // Google Custom Search
      if (SEARCH_CONFIG.google.apiKey) {
        const googleResults = await this.searchGoogle(query, filters);
        results.push(...googleResults);
      }

      // Bing Search
      if (SEARCH_CONFIG.bing.apiKey) {
        const bingResults = await this.searchBing(query, filters);
        results.push(...bingResults);
      }

      // SerpAPI (aggregates multiple search engines)
      if (SEARCH_CONFIG.serpApi.apiKey) {
        const serpResults = await this.searchSerpAPI(query, filters);
        results.push(...serpResults);
      }
    } catch (error) {
      console.error('Mainstream search error:', error);
    }

    return results;
  }

  // Google Custom Search implementation
  async searchGoogle(query, filters) {
    try {
      const params = new URLSearchParams({
        key: SEARCH_CONFIG.google.apiKey,
        cx: SEARCH_CONFIG.google.searchEngineId,
        q: query,
        num: 10,
        start: 1,
      });

      if (filters.dateRange && filters.dateRange !== 'any') {
        params.append('dateRestrict', this.formatDateRange(filters.dateRange));
      }

      const response = await fetch(
        `${this.endpoints.googleCustomSearch}?${params}`
      );
      const data = await response.json();

      return this.formatGoogleResults(data.items || []);
    } catch (error) {
      console.error('Google search error:', error);
      return [];
    }
  }

  // Bing Search implementation
  async searchBing(query, filters) {
    try {
      const headers = {
        'Ocp-Apim-Subscription-Key': SEARCH_CONFIG.bing.apiKey,
      };

      const params = new URLSearchParams({
        q: query,
        count: 10,
        offset: 0,
        mkt: 'en-US',
        safesearch: 'Moderate',
      });

      if (filters.dateRange && filters.dateRange !== 'any') {
        params.append('freshness', this.formatBingDateRange(filters.dateRange));
      }

      const response = await fetch(`${this.endpoints.bingApi}?${params}`, {
        headers,
      });
      const data = await response.json();

      return this.formatBingResults(data.webPages?.value || []);
    } catch (error) {
      console.error('Bing search error:', error);
      return [];
    }
  }

  // News API search for diverse news sources
  async searchNews(query, filters) {
    try {
      const results = [];

      // Get news from multiple sources with different biases
      const newsSources = [
        { sources: 'bbc-news,reuters,ap-news', bias: 'center' },
        { sources: 'cnn,the-washington-post,the-new-york-times', bias: 'left' },
        {
          sources: 'fox-news,the-wall-street-journal,breitbart-news',
          bias: 'right',
        },
        { sources: 'npr,pbs-newshour,c-span', bias: 'unbiased' },
      ];

      for (const sourceGroup of newsSources) {
        try {
          const params = new URLSearchParams({
            apiKey: SEARCH_CONFIG.newsApi.apiKey,
            q: query,
            sources: sourceGroup.sources,
            sortBy: filters.sortBy === 'date' ? 'publishedAt' : 'relevancy',
            pageSize: 20,
          });

          if (filters.dateRange && filters.dateRange !== 'any') {
            const dateFrom = this.calculateDateFrom(filters.dateRange);
            params.append('from', dateFrom);
          }

          const response = await fetch(`${this.endpoints.newsApi}?${params}`);
          const data = await response.json();

          if (data.articles) {
            const formattedResults = this.formatNewsResults(
              data.articles,
              sourceGroup.bias
            );
            results.push(...formattedResults);
          }
        } catch (error) {
          console.error(`News search error for ${sourceGroup.bias}:`, error);
        }
      }

      return results;
    } catch (error) {
      console.error('News search error:', error);
      return [];
    }
  }

  // YouTube search for video content
  async searchVideos(query, filters) {
    try {
      const params = new URLSearchParams({
        key: SEARCH_CONFIG.youtube.apiKey,
        part: 'snippet,statistics',
        q: query,
        type: 'video',
        maxResults: 25,
        order: filters.sortBy === 'views' ? 'viewCount' : 'relevance',
      });

      if (filters.dateRange && filters.dateRange !== 'any') {
        const dateAfter = this.calculateDateFrom(filters.dateRange);
        params.append('publishedAfter', new Date(dateAfter).toISOString());
      }

      const response = await fetch(`${this.endpoints.youtubeApi}?${params}`);
      const data = await response.json();

      return this.formatYouTubeResults(data.items || []);
    } catch (error) {
      console.error('YouTube search error:', error);
      return [];
    }
  }

  // Social media search using backend proxy
  async searchSocial(query, filters) {
    try {
      const results = [];

      // Use our backend proxy to search social media via Apify
      const response = await fetch('/api/social/direct-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          platform: filters.platform || 'all',
          limit: filters.limit || 10
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.results) {
          const formattedResults = this.formatSocialResults(data.results);
          results.push(...formattedResults);
        }
      }

      // Fallback to Reddit search if backend fails
      if (results.length === 0) {
        const redditParams = new URLSearchParams({
          q: query,
          sort: filters.sortBy === 'date' ? 'new' : 'relevance',
          limit: 25,
          type: 'link',
        });

        const redditResponse = await fetch(
          `${this.endpoints.redditApi}?${redditParams}`
        );
        const redditData = await redditResponse.json();

        if (redditData.data?.children) {
          const redditResults = this.formatRedditResults(
            redditData.data.children
          );
          results.push(...redditResults);
        }
      }

      return results;
    } catch (error) {
      console.error('Social search error:', error);
      return [];
    }
  }

  // Format social media results from our backend
  formatSocialResults(items) {
    return items.map((item) => ({
      title: item.title || item.text || item.caption || 'Social Media Post',
      snippet: item.description || item.summary || item.text || item.caption || 'Social media content',
      url: item.url || item.link || '#',
      domain: this.extractDomain(item.url || item.link || ''),
      publishedAt: this.formatDate(item.publishedAt || item.timestamp || item.created_at || item.date),
      views: item.likes || item.engagement || this.generateViews(),
      bias: 'neutral',
      category: 'social',
      verified: item.verified || false,
      source: item.source || 'social',
    }));
  }

  // Shopping search implementation
  async searchShopping(query, filters) {
    try {
      // Use Google Shopping API or other shopping APIs
      const params = new URLSearchParams({
        key: SEARCH_CONFIG.google.apiKey,
        cx: SEARCH_CONFIG.google.shoppingEngineId,
        q: query,
        num: 10,
      });

      const response = await fetch(
        `${this.endpoints.googleCustomSearch}?${params}`
      );
      const data = await response.json();

      return this.formatShoppingResults(data.items || []);
    } catch (error) {
      console.error('Shopping search error:', error);
      return [];
    }
  }

  // Bias detection and categorization
  categorizeByBias(results) {
    return results.map((result) => {
      const bias = this.detectBias(result);
      const category = this.detectCategory(result);

      return {
        ...result,
        bias: bias || result.bias || 'unbiased',
        category: category || result.category || 'news',
      };
    });
  }

  // Simple bias detection based on source domain
  detectBias(result) {
    const domain = this.extractDomain(result.url || result.link || '');

    const biasMap = {
      // Left-leaning sources
      'cnn.com': 'left',
      'msnbc.com': 'left',
      'nytimes.com': 'left',
      'washingtonpost.com': 'left',
      'huffpost.com': 'left',
      'theguardian.com': 'left',

      // Right-leaning sources
      'foxnews.com': 'right',
      'breitbart.com': 'right',
      'dailywire.com': 'right',
      'nypost.com': 'right',
      'wsj.com': 'right',
      'nationalreview.com': 'right',

      // Center/Unbiased sources
      'reuters.com': 'unbiased',
      'apnews.com': 'unbiased',
      'bbc.com': 'center',
      'npr.org': 'unbiased',
      'pbs.org': 'unbiased',
      'c-span.org': 'unbiased',

      // Mainstream
      'google.com': 'mainstream',
      'bing.com': 'mainstream',
      'yahoo.com': 'mainstream',
    };

    return biasMap[domain] || 'unbiased';
  }

  // Category detection
  detectCategory(result) {
    const url = result.url || result.link || '';
    const title = result.title || '';

    if (url.includes('youtube.com') || url.includes('vimeo.com')) {
      return 'video';
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

    return 'news';
  }

  // Result formatting methods
  formatGoogleResults(items) {
    return items.map((item) => ({
      title: item.title,
      snippet: item.snippet,
      url: item.link,
      domain: this.extractDomain(item.link),
      publishedAt: this.formatDate(
        item.pagemap?.metatags?.[0]?.['article:published_time']
      ),
      category: 'news',
      verified: true,
      source: 'google',
    }));
  }

  formatBingResults(items) {
    return items.map((item) => ({
      title: item.name,
      snippet: item.snippet,
      url: item.url,
      domain: this.extractDomain(item.url),
      publishedAt: this.formatDate(item.dateLastCrawled),
      category: 'news',
      verified: true,
      source: 'bing',
    }));
  }

  formatNewsResults(articles, bias) {
    return articles.map((article) => ({
      title: article.title,
      snippet: article.description,
      url: article.url,
      domain: this.extractDomain(article.url),
      publishedAt: this.formatDate(article.publishedAt),
      views: this.generateViews(),
      bias: bias,
      category: 'news',
      verified: true,
      source: 'news',
    }));
  }

  formatYouTubeResults(items) {
    return items.map((item) => ({
      title: item.snippet.title,
      snippet: item.snippet.description,
      url: `https://youtube.com/watch?v=${item.id.videoId}`,
      domain: 'youtube.com',
      publishedAt: this.formatDate(item.snippet.publishedAt),
      views: item.statistics?.viewCount || this.generateViews(),
      bias: 'unbiased',
      category: 'video',
      verified: true,
      source: 'youtube',
    }));
  }

  formatRedditResults(posts) {
    return posts.map((post) => ({
      title: post.data.title,
      snippet:
        post.data.selftext ||
        `Reddit discussion with ${post.data.num_comments} comments`,
      url: `https://reddit.com${post.data.permalink}`,
      domain: 'reddit.com',
      publishedAt: this.formatDate(new Date(post.data.created_utc * 1000)),
      views: post.data.score || this.generateViews(),
      bias: 'center',
      category: 'social',
      verified: false,
      source: 'reddit',
    }));
  }

  // Utility methods
  extractDomain(url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown.com';
    }
  }

  formatDate(dateString) {
    if (!dateString) return 'Recently';

    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now - date;
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;

    return `${Math.floor(diffInDays / 30)} months ago`;
  }

  generateViews() {
    const views = Math.floor(Math.random() * 10000000);
    if (views > 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views > 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  }

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

  formatDateRange(dateRange) {
    const ranges = {
      hour: 'd1',
      day: 'd1',
      week: 'w1',
      month: 'm1',
      year: 'y1',
    };

    return ranges[dateRange] || '';
  }

  formatBingDateRange(dateRange) {
    const ranges = {
      hour: 'Day',
      day: 'Day',
      week: 'Week',
      month: 'Month',
    };

    return ranges[dateRange] || '';
  }

  combineResults(results, filters) {
    const combined = [];

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        combined.push(...result.value);
      }
    });

    // Remove duplicates based on URL
    const uniqueResults = combined.filter(
      (result, index, self) =>
        index === self.findIndex((r) => r.url === result.url)
    );

    return uniqueResults;
  }

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
        const aDate = new Date(a.publishedAt);
        const bDate = new Date(b.publishedAt);
        return filters.order === 'desc' ? bDate - aDate : aDate - bDate;
      });
    } else if (filters.sortBy === 'views') {
      filtered.sort((a, b) => {
        const aViews = this.parseViews(a.views);
        const bViews = this.parseViews(b.views);
        return filters.order === 'desc' ? bViews - aViews : aViews - bViews;
      });
    }

    return filtered;
  }

  parseViews(viewString) {
    if (typeof viewString === 'number') return viewString;
    if (!viewString) return 0;

    const match = viewString.toString().match(/([\d.]+)([KMB]?)/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2];

    const multipliers = { K: 1000, M: 1000000, B: 1000000000 };
    return value * (multipliers[unit] || 1);
  }
}

export default SearchAPI;
