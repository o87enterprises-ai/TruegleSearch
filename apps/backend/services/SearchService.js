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

    // Unsplash API (images)
    this.unsplashAccessKey = config.unsplash && config.unsplash.accessKey;

    // Brave Search API (whole-web fallback)
    this.braveApiKey = config.brave && config.brave.apiKey;
    this.braveBaseUrl = 'https://api.search.brave.com/res/v1/web/search';

    // SerpAPI (Google whole-web fallback)
    this.serpApiKey = config.serp && config.serp.apiKey;
    this.serpBaseUrl = 'https://serpapi.com/search';

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
   * Perform search across multiple sources.
   * mode: 'blue-pill' | 'red-pill' | 'purple' | 'ocean'
   */
  async performSearch(query, filters, mode = 'blue-pill') {
    try {
      console.log('🔍 SearchService.performSearch called with:', { query, filters, mode });

      // Ocean mode: OSINT-only pipeline — no web search
      if (mode === 'ocean') {
        return this.performOsintSearch(query, filters);
      }

      const isRedPill = mode === 'red-pill';
      const isPurple = mode === 'purple';
      const searchPromises = [];

      const searchWeb = filters.category === 'all' || filters.category === 'web';
      const searchNews = filters.category === 'all' || filters.category === 'news' || isRedPill;
      const searchVideos = filters.category === 'all' || filters.category === 'videos';
      const searchImages = filters.category === 'images';
      const searchSocial = filters.category === 'social';

      if (searchImages && this.unsplashAccessKey) {
        searchPromises.push(this.performUnsplashSearch(query, filters));
      }

      if (searchSocial) {
        if (this.googleApiKey && this.googleSearchEngineId) {
          searchPromises.push(this.performGoogleSearch(
            `${query} site:reddit.com OR site:twitter.com OR site:facebook.com`,
            { ...filters, perPage: 10 }
          ));
        }
      }

      if (searchWeb) {
        if (this.googleApiKey && this.googleSearchEngineId) {
          searchPromises.push(this.performGoogleSearch(query, filters));

          if (isRedPill) {
            // Red pill: explicitly hunt for alternative, suppressed, and independent sources
            searchPromises.push(this.performGoogleSearch(
              `${query} site:substack.com OR site:rumble.com OR site:odysee.com OR site:zerohedge.com OR site:rt.com`,
              { ...filters, perPage: 10 }
            ));
            searchPromises.push(this.performGoogleSearch(
              `${query} "censored" OR "suppressed" OR "they don't want you to know" OR "alternative view" OR "independent analysis"`,
              { ...filters, perPage: 5 }
            ));
            searchPromises.push(this.performGoogleSearch(
              `${query} site:theintercept.com OR site:thegrayzone.com OR site:mintpressnews.com OR site:corbettreport.com OR site:off-guardian.org`,
              { ...filters, perPage: 5 }
            ));
          }
        }
        if (this.bingApiKey) {
          searchPromises.push(this.performBingSearch(query, filters));
        }
        if (this.braveApiKey) {
          searchPromises.push(this.performBraveSearch(query, filters));
        }
      }

      if (searchNews) {
        if (this.newsApiKey) {
          searchPromises.push(this.performNewsSearch(query, filters));
        }
      }

      if (searchVideos) {
        if (this.youtubeApiKey) {
          searchPromises.push(this.performYoutubeSearch(query, filters));
          if (isRedPill) {
            searchPromises.push(this.performYoutubeSearch(
              `${query} independent documentary whistleblower`,
              { ...filters, perPage: 5 }
            ));
          }
        }
      }

      console.log(`📦 Total search promises: ${searchPromises.length}`);

      const results = await Promise.allSettled(searchPromises);
      let combinedResults = this.combineResults(results);
      console.log(`🔗 Combined results: ${combinedResults.length}`);

      // SerpAPI fallback: fire only when web results are thin (< 5)
      const webResultCount = combinedResults.filter(r => r.category === 'web').length;
      if (searchWeb && webResultCount < 5 && this.serpApiKey) {
        console.log(`⚡ SerpAPI fallback triggered (only ${webResultCount} web results)`);
        try {
          const serpData = await this.performSerpSearch(query, filters);
          const serpResults = this.formatSerpResults(serpData);
          const existingUrls = new Set(combinedResults.map(r => r.url));
          const newResults = serpResults.filter(r => !existingUrls.has(r.url));
          combinedResults = [...combinedResults, ...newResults];
          console.log(`⚡ SerpAPI added ${newResults.length} results`);
        } catch (err) {
          console.error('SerpAPI fallback error:', err.message);
        }
      }

      const categorizedResults = this.categorizeByBias(combinedResults);
      console.log(`🏷️  Categorized results: ${categorizedResults.length}`);

      // Purple mode: strict perspective filter — only return results matching selected biases
      if (isPurple && filters.perspectives && filters.perspectives.length > 0) {
        const mapped = this.mapPerspectivesToBias(filters.perspectives);
        const filtered = categorizedResults.filter(r => mapped.includes(r.bias));
        console.log(`🟣 Purple strict filter: ${filtered.length} results for perspectives [${filters.perspectives.join(',')}]`);
        return filtered;
      }

      let finalResults = this.sortAndFilter(categorizedResults, filters);

      if (isRedPill) {
        finalResults = this.sortRedPill(finalResults);
      }

      console.log(`✨ Final results: ${finalResults.length}`);
      return finalResults;
    } catch (error) {
      console.error('SearchService error:', error);
      throw new Error('Search service unavailable');
    }
  }

  /**
   * Map purple-mode UI perspective IDs to internal bias tiers
   */
  mapPerspectivesToBias(perspectives) {
    const map = {
      conservative: 'right',
      libertarian: 'right',
      liberal: 'left',
      progressive: 'left',
      centrist: 'center',
      bipartisan: 'center',
      religious: 'right',
      secular: 'center',
      scientific: 'unbiased',
      skeptical: 'unbiased',
      mainstream: 'mainstream',
      alternative: 'alternative',
      conspiracy: 'conspiracy',
      independent: 'independent',
      neutral: 'neutral',
      // faith/societal catch-alls
      spiritual: 'alternative',
      new_world: 'conspiracy',
      old_world: 'alternative',
      universal: 'center',
      atheist: 'unbiased',
      government: 'mainstream',
      community: 'neutral',
      traditional: 'right',
      // economic
      local_economy: 'alternative',
      global_economics: 'mainstream',
      investors: 'center',
      consumers: 'neutral',
      small_business: 'alternative',
      corporate: 'mainstream',
    };
    const biases = [...new Set(perspectives.map(p => map[p] || 'neutral'))];
    return biases;
  }

  /**
   * Red pill sort: conspiracy and alternative float to top, mainstream sinks to bottom.
   * Order: conspiracy → alternative → independent → neutral → center → unbiased → left → right → mainstream
   */
  sortRedPill(results) {
    const order = {
      conspiracy: 0,
      alternative: 1,
      independent: 2,
      neutral: 3,
      center: 4,
      unbiased: 5,
      left: 6,
      right: 7,
      mainstream: 8,
    };
    return [...results].sort((a, b) => {
      const aRank = order[a.bias] !== undefined ? order[a.bias] : 3;
      const bRank = order[b.bias] !== undefined ? order[b.bias] : 3;
      return aRank - bRank;
    });
  }

  /**
   * OSINT-only search pipeline for ocean mode.
   * Returns investigation-focused results only (domain intel, social profiles, etc.)
   */
  async performOsintSearch(query, filters) {
    const searchPromises = [];

    // Search for digital footprint: social profiles, domain info, leaked data mentions
    if (this.googleApiKey && this.googleSearchEngineId) {
      searchPromises.push(this.performGoogleSearch(
        `"${query}" site:linkedin.com OR site:twitter.com OR site:facebook.com OR site:instagram.com OR site:github.com`,
        { ...filters, perPage: 10 }
      ));
      searchPromises.push(this.performGoogleSearch(
        `"${query}" whois OR "domain registration" OR "IP address" OR "email leak" OR "data breach"`,
        { ...filters, perPage: 5 }
      ));
      searchPromises.push(this.performGoogleSearch(
        `"${query}" site:pastebin.com OR site:haveibeenpwned.com OR site:dehashed.com OR site:intelx.io`,
        { ...filters, perPage: 5 }
      ));
    }
    if (this.braveApiKey) {
      searchPromises.push(this.performBraveSearch(
        `"${query}" site:linkedin.com OR site:twitter.com OR site:github.com`,
        { ...filters, perPage: 5 }
      ));
    }

    const results = await Promise.allSettled(searchPromises);
    const combined = this.combineResults(results);
    const categorized = this.categorizeByBias(combined);

    // Tag all results as osint category
    return categorized.map(r => ({ ...r, category: 'osint', isOsint: true }));
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

    // Safe search: 'safe' (default) | 'blur' | 'off'
    if (filters.safeSearch === 'off') {
      // no safe param = unrestricted
    } else if (filters.safeSearch === 'blur') {
      params.safe = 'medium';
    } else {
      params.safe = 'active'; // 'safe' or anything else defaults to on
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
      safesearch: filters.safeSearch === 'off' ? 'Off' : filters.safeSearch === 'blur' ? 'Moderate' : 'Strict',
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
   * Perform Brave Search (whole-web, no domain restrictions)
   */
  async performBraveSearch(query, filters) {
    if (!this.braveApiKey) {
      throw new Error('Brave Search API not configured');
    }

    const params = {
      q: query,
      count: Math.min(filters.perPage || 10, 20),
      offset: ((filters.page || 1) - 1) * (filters.perPage || 10),
      safesearch: filters.safeSearch === 'off' ? 'off' : filters.safeSearch === 'blur' ? 'moderate' : 'strict',
    };

    if (filters.dateRange && filters.dateRange !== 'any') {
      const rangeMap = { day: 'pd', week: 'pw', month: 'pm', year: 'py' };
      if (rangeMap[filters.dateRange]) params.freshness = rangeMap[filters.dateRange];
    }

    try {
      const response = await axios.get(this.braveBaseUrl, {
        headers: { 'X-Subscription-Token': this.braveApiKey, Accept: 'application/json' },
        params,
        timeout: 8000,
      });
      return { ...response.data, _source: 'brave' };
    } catch (error) {
      console.error('Brave Search API error:', error.response?.data || error.message);
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Brave API key invalid');
      }
      if (error.response?.status === 429) {
        throw new Error('Brave API rate limit exceeded');
      }
      throw new Error('Brave Search service unavailable');
    }
  }

  formatBraveResults(data) {
    if (!data || !data.web || !data.web.results) return [];

    return data.web.results.map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.description || '',
      source: 'brave',
      sourceName: 'Brave Search',
      date: item.page_age || new Date().toISOString(),
      image: item.thumbnail?.src || null,
      favicon: item.profile?.img || null,
      domain: this.extractDomain(item.url),
      category: 'web',
      verified: true,
    }));
  }

  /**
   * Perform SerpAPI search (whole-web Google results, used as fallback only)
   */
  async performSerpSearch(query, filters) {
    if (!this.serpApiKey) {
      throw new Error('SerpAPI not configured');
    }

    const params = {
      api_key: this.serpApiKey,
      q: query,
      num: Math.min(filters.perPage || 10, 10),
      start: ((filters.page || 1) - 1) * (filters.perPage || 10),
      safe: filters.safeSearch === 'off' ? 'off' : 'active',
      engine: 'google',
    };

    if (filters.dateRange && filters.dateRange !== 'any') {
      const rangeMap = { day: 'd1', week: 'w1', month: 'm1', year: 'y1' };
      if (rangeMap[filters.dateRange]) params.tbs = `qdr:${rangeMap[filters.dateRange]}`;
    }

    try {
      const response = await axios.get(this.serpBaseUrl, { params, timeout: 10000 });
      return { ...response.data, _source: 'serp' };
    } catch (error) {
      console.error('SerpAPI error:', error.response?.data || error.message);
      throw new Error('SerpAPI unavailable');
    }
  }

  formatSerpResults(data) {
    if (!data || !data.organic_results) return [];

    return data.organic_results.map((item) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet || '',
      source: 'serp',
      sourceName: 'Google (via SerpAPI)',
      date: item.date || new Date().toISOString(),
      image: item.thumbnail || null,
      favicon: item.favicon || null,
      domain: this.extractDomain(item.link),
      category: 'web',
      verified: true,
    }));
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
   * Perform Unsplash image search
   */
  async performUnsplashSearch(query, filters) {
    if (!this.unsplashAccessKey) {
      throw new Error('Unsplash API not configured');
    }

    const params = {
      query,
      per_page: Math.min(filters.perPage || 20, 30),
      page: filters.page || 1,
      client_id: this.unsplashAccessKey,
    };

    // Apply content filter mapping
    if (filters.safeSearch !== 'off') {
      params.content_filter = 'high';
    }

    try {
      const response = await axios.get('https://api.unsplash.com/search/photos', {
        params,
        timeout: 8000,
      });
      // Tag the response so detectSource can identify it
      return { ...response.data, _source: 'unsplash' };
    } catch (error) {
      console.error('Unsplash API error:', error.response?.data || error.message);
      throw new Error('Unsplash service unavailable');
    }
  }

  formatUnsplashResults(data) {
    if (!data || !data.results) return [];

    return data.results.map((photo) => ({
      title: photo.alt_description || photo.description || 'Untitled Photo',
      url: photo.links?.html || `https://unsplash.com/photos/${photo.id}`,
      snippet: photo.description || photo.alt_description || '',
      source: 'unsplash',
      sourceName: 'Unsplash',
      date: photo.created_at || new Date().toISOString(),
      image: photo.urls?.regular || photo.urls?.small || null,
      thumbnail: photo.urls?.thumb || null,
      favicon: null,
      domain: 'unsplash.com',
      category: 'images',
      verified: true,
      photographer: photo.user?.name || null,
      photographerUrl: photo.user?.links?.html || null,
    }));
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
      case 'unsplash':
        return this.formatUnsplashResults(data);
      case 'brave':
        return this.formatBraveResults(data);
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
    if (data.items && data.kind === 'youtube#searchListResponse') return 'youtube';
    if (data._source === 'unsplash') return 'unsplash';
    if (data._source === 'brave') return 'brave';
    return 'unknown';
  }

  /**
   * Categorize results by bias
   */
  categorizeByBias(results) {
    const biasLabels = {
      left: 'Left-Leaning',
      right: 'Right-Leaning',
      center: 'Center',
      unbiased: 'Fact-Based',
      neutral: 'Unknown',
      mainstream: 'Mainstream Media',
      alternative: 'Alternative Media',
      conspiracy: 'Fringe / Conspiracy',
      independent: 'Independent',
    };

    return results.map((result) => {
      const bias = this.detectBias(result) || 'neutral';
      const category = this.detectCategory(result);

      return {
        ...result,
        bias,
        biasLabel: biasLabels[bias] || 'Unknown Bias',
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
      'theintercept.com': 'left',
      'truthout.org': 'left',
      'inthesetimes.com': 'left',

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
      'theamericanconservative.com': 'right',
      'powerlineblog.com': 'right',
      'legalinsurrection.com': 'right',
      'pjmedia.com': 'right',
      'dailysignal.com': 'right',
      'westernjournal.com': 'right',

      // CENTER/UNBIASED SOURCES
      'reuters.com': 'unbiased',
      'apnews.com': 'unbiased',
      'bbc.com': 'center',
      'bbc.co.uk': 'center',
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
      'factcheck.org': 'unbiased',
      'snopes.com': 'unbiased',
      'politifact.com': 'unbiased',

      // MAINSTREAM/GENERAL
      'google.com': 'mainstream',
      'bing.com': 'mainstream',
      'yahoo.com': 'mainstream',
      'wikipedia.org': 'unbiased',
      'en.wikipedia.org': 'unbiased',
      'youtube.com': 'mainstream',
      'msn.com': 'mainstream',

      // ALTERNATIVE — independent voices, non-corporate media, dissident press
      'substack.com': 'alternative',
      'greenwald.substack.com': 'alternative',
      'racket.news': 'alternative',
      'thegrayzone.com': 'alternative',
      'mintpressnews.com': 'alternative',
      'consortiumnews.com': 'alternative',
      'off-guardian.org': 'alternative',
      'globalresearch.ca': 'alternative',
      'theintercept.com': 'alternative',
      'unlimitedhangout.com': 'alternative',
      'corbettreport.com': 'alternative',
      'zerohedge.com': 'alternative',
      'rumble.com': 'alternative',
      'odysee.com': 'alternative',
      'bitchute.com': 'alternative',
      'banned.video': 'alternative',
      'brighteon.com': 'alternative',
      'rt.com': 'alternative',
      'sputniknews.com': 'alternative',
      'strategic-culture.org': 'alternative',
      'unz.com': 'alternative',
      'lewrockwell.com': 'alternative',
      'antiwar.com': 'alternative',

      // CONSPIRACY / FRINGE
      'infowars.com': 'conspiracy',
      'naturalnews.com': 'conspiracy',
      'activistpost.com': 'conspiracy',
      'beforeitsnews.com': 'conspiracy',
      'whatreallyhappened.com': 'conspiracy',
      'henrymakow.com': 'conspiracy',
      'rense.com': 'conspiracy',
      'veterans-today.com': 'conspiracy',
      'thepeoplesvoice.tv': 'conspiracy',
      'neonnettle.com': 'conspiracy',

      // INDEPENDENT — personal blogs, independent journalists, non-partisan
      'medium.com': 'independent',
      'substack.com': 'independent',
      'wordpress.com': 'independent',
      'blogspot.com': 'independent',
      'ghost.io': 'independent',
      'patreon.com': 'independent',
      'locals.com': 'independent',
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
