const axios = require('axios');
const config = require('../config/env');
const { AI_CONTENT_DOMAINS } = require('../data/aiContentDomains');

// YouTube's Data API returns titles/descriptions HTML-entity-encoded
// (e.g. "&#39;" for an apostrophe) since they're meant for HTML embeds —
// decode before they reach the frontend, which renders them as plain text.
const NAMED_HTML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeHtmlEntities(str) {
  if (!str) return str;
  return str.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const code = parseInt(isHex ? entity.slice(2) : entity.slice(1), isHex ? 16 : 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_HTML_ENTITIES[entity] ?? match;
  });
}

class SearchService {
  constructor() {
    // Green-mode AI-content blocklist. Seed list + optional env-provided extras
    // (AI_CONTENT_DOMAINS="a.com,b.com"). Stored lowercased in a Set for O(1) lookup.
    const envDomains = (process.env.AI_CONTENT_DOMAINS || '')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    this.aiContentDomains = new Set(
      [...AI_CONTENT_DOMAINS, ...envDomains].map((d) => d.toLowerCase())
    );

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

    // SearXNG (self-hosted metasearch, no API key needed)
    this.searxngUrl = config.searxng && config.searxng.url;
    // Opt-in: when SEARXNG_PRIMARY=true, SearXNG is queried first and the paid
    // API providers (Google/Bing/Brave) only run as a fallback when SearXNG is
    // offline or returns fewer than SEARXNG_PRIMARY_MIN web results. Default off
    // → unchanged behavior (all providers fire in parallel).
    this.searxngPrimary = !!(config.searxng && config.searxng.primary);
    this.searxngPrimaryMin = (config.searxng && config.searxng.primaryMin) || 5;

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
      // Green: same retrieval as blue-pill, but AI-generated-content domains are
      // filtered out of the final results (Green mode promises 0 AI results).
      const isGreen = mode === 'green';
      const searchPromises = [];
      // Results that are fetched + formatted synchronously (SearXNG-primary mode)
      // rather than via the searchPromises/Promise.allSettled batch below.
      const preformattedResults = [];

      const searchWeb = filters.category === 'all' || filters.category === 'web';
      const searchNews = filters.category === 'all' || filters.category === 'news' || isRedPill;
      const searchVideos = filters.category === 'all' || filters.category === 'videos';
      const searchImages = filters.category === 'images';
      const searchSocial = filters.category === 'social';

      if (searchImages) {
        const hasGoogleImages = !!(this.googleApiKey && this.googleSearchEngineId);
        const hasBraveImages = !!this.braveApiKey;
        if (hasGoogleImages) {
          searchPromises.push(this.performGoogleImageSearch(query, filters));
        }
        if (hasBraveImages) {
          searchPromises.push(this.performBraveImageSearch(query, filters));
        }
        // Unsplash is generic stock photography, not real photos of the actual
        // subject — only used as a last resort when no real image source is configured.
        if (!hasGoogleImages && !hasBraveImages && this.unsplashAccessKey) {
          searchPromises.push(this.performUnsplashSearch(query, filters));
        }
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
        // SearXNG-primary mode (opt-in): query the self-hosted metasearch first
        // and skip the paid API providers when it returns enough results. Not
        // used for red-pill, which depends on Brave's alternative-media querying.
        let searxngServed = false;
        if (this.searxngPrimary && this.searxngUrl && !isRedPill) {
          try {
            const sx = await this.performSearXNGSearch(query, filters);
            const sxResults = this.formatSearXNGResults(sx);
            if (sxResults.length >= this.searxngPrimaryMin) {
              preformattedResults.push(...sxResults);
              searxngServed = true;
              console.log(`🔎 SearXNG-primary served ${sxResults.length} web results`);
            } else {
              console.log(`🔎 SearXNG-primary thin (${sxResults.length} < ${this.searxngPrimaryMin}) — falling back to API providers`);
            }
          } catch {
            // Offline/error — fall through to the API providers below.
          }
        }

        if (!searxngServed) {
          if (this.googleApiKey && this.googleSearchEngineId) {
            searchPromises.push(this.performGoogleSearch(query, filters));
          }
          if (this.bingApiKey) {
            searchPromises.push(this.performBingSearch(query, filters));
          }
          // Parallel-mode SearXNG (skipped above only when it ran as primary).
          if (this.searxngUrl && !this.searxngPrimary) {
            searchPromises.push(this.performSearXNGSearch(query, filters));
          }
          if (this.braveApiKey) {
            searchPromises.push(this.performBraveSearch(query, filters));

            if (isRedPill) {
              // Red pill: use Brave (whole-web index) with alternative-media query terms
              // Brave indexes rumble/substack/odysee — Google CSE typically does not
              searchPromises.push(this.performBraveSearch(
                `${query} site:substack.com OR site:rumble.com OR site:odysee.com OR site:zerohedge.com OR site:rt.com OR site:corbettreport.com`,
                { ...filters, perPage: 10 }
              ));
              searchPromises.push(this.performBraveSearch(
                `${query} censored suppressed alternative independent whistleblower`,
                { ...filters, perPage: 10 }
              ));
            }
          } else if (isRedPill && this.googleApiKey && this.googleSearchEngineId) {
            // Brave not available — fall back to Google for alternative terms
            searchPromises.push(this.performGoogleSearch(
              `${query} "censored" OR "suppressed" OR "alternative view" OR "independent analysis"`,
              { ...filters, perPage: 5 }
            ));
            searchPromises.push(this.performGoogleSearch(
              `${query} site:theintercept.com OR site:thegrayzone.com OR site:mintpressnews.com OR site:corbettreport.com`,
              { ...filters, perPage: 5 }
            ));
          }
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
        // Resilient video fallback for the dedicated Videos tab only
        // (category === 'videos', not 'all'). The YouTube Data API on this project
        // is frequently 403/quota-limited, which silently left the Videos tab
        // empty (searchWeb is false for a non-web category, so nothing else ran).
        // Pull videos via Brave constrained to YouTube; youtube.com links
        // categorize as 'videos' downstream. Scoped to the Videos tab so the mixed
        // 'all' feed isn't flooded with 20 youtube links and we don't add a Brave
        // call to every all-search.
        if (filters.category === 'videos') {
          if (this.braveApiKey) {
            searchPromises.push(this.performBraveSearch(`${query} site:youtube.com`, { ...filters, perPage: 20 }));
          } else if (this.googleApiKey && this.googleSearchEngineId) {
            searchPromises.push(this.performGoogleSearch(`${query} site:youtube.com`, { ...filters, perPage: 20 }));
          }
        }
      }

      console.log(`📦 Total search promises: ${searchPromises.length}`);

      const results = await Promise.allSettled(searchPromises);
      let combinedResults = this.combineResults(results);

      // Merge SearXNG-primary results (fetched outside the promise batch), de-duped by URL.
      if (preformattedResults.length) {
        const seen = new Set(combinedResults.map((r) => r.url));
        combinedResults = [
          ...combinedResults,
          ...preformattedResults.filter((r) => r.url && !seen.has(r.url)),
        ];
      }
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

      // Quoted-phrase broadening. A query like '"grown shit" mac dre' makes the
      // web providers (Brave/Google) do strict exact-phrase matching, which can
      // return very few results and starve the category tabs — especially Videos,
      // which are just youtube.com links surfaced by the web providers (the
      // dedicated YouTube API is not configured). When a quoted query comes back
      // thin, re-run the de-quoted variant and merge in anything new. Exact-match
      // results were fetched first and still rank highest via relevance scoring.
      if (/["']/.test(query) && combinedResults.length < 12) {
        const broadened = query.replace(/["']/g, ' ').replace(/\s+/g, ' ').trim();
        if (broadened && broadened !== query) {
          console.log(`🔁 Thin quoted-query result (${combinedResults.length}) — broadening to "${broadened}"`);
          const broadenPromises = [];
          if (this.braveApiKey) broadenPromises.push(this.performBraveSearch(broadened, filters));
          if (this.googleApiKey && this.googleSearchEngineId) broadenPromises.push(this.performGoogleSearch(broadened, filters));
          if (this.youtubeApiKey) broadenPromises.push(this.performYoutubeSearch(broadened, filters));
          if (broadenPromises.length) {
            try {
              const broadenResults = this.combineResults(await Promise.allSettled(broadenPromises));
              const seen = new Set(combinedResults.map((r) => r.url));
              const extra = broadenResults.filter((r) => r.url && !seen.has(r.url));
              combinedResults = [...combinedResults, ...extra];
              console.log(`🔁 Broaden merged ${extra.length} extra results (total ${combinedResults.length})`);
            } catch (broadenErr) {
              console.error('Quoted-query broaden failed:', broadenErr.message);
            }
          }
        }
      }

      const categorizedResults = this.categorizeByBias(combinedResults);
      console.log(`🏷️  Categorized results: ${categorizedResults.length}`);

      // Purple mode: strict perspective filter — ONLY results matching the
      // selected perspective(s), strictly date-ranked. No padding with
      // unrelated "neutral" results — if the filter is sparse, it stays sparse.
      if (isPurple && filters.perspectives && filters.perspectives.length > 0) {
        const mapped = this.mapPerspectivesToBias(filters.perspectives);
        const filtered = categorizedResults.filter(r => mapped.includes(r.bias));
        console.log(`🟣 Purple strict filter: ${filtered.length} results for perspectives [${filters.perspectives.join(',')}]`);

        return [...filtered].sort((a, b) => {
          const diff = new Date(b.date) - new Date(a.date);
          return filters.order === 'asc' ? -diff : diff;
        });
      }

      let finalResults = this.sortAndFilter(categorizedResults, filters);

      // Default ranking: combined relevance + recency + source diversity, so
      // switching category/filters with the same query always re-ranks. Skipped
      // when the user explicitly asked for a pure date sort (sortAndFilter already
      // handled that above). Red-pill blends in a bias-tier weight so alternative/
      // independent sources rank above mainstream ones, instead of a crude tier sort.
      if (filters.sortBy !== 'date') {
        finalResults = this.rankResults(query, finalResults, { boostAlternative: isRedPill });
      }

      // Green mode: strip results from known AI-generated-content domains.
      if (isGreen) {
        const before = finalResults.length;
        finalResults = finalResults.filter((r) => !this.isAiContentDomain(r.url || r.domain));
        console.log(`🟢 Green AI-filter: removed ${before - finalResults.length} AI-content result(s)`);
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
   * TF-based relevance score (0-1): term frequency in title+snippet, with a
   * boost for an exact phrase match and for query terms appearing in the title.
   */
  calculateRelevance(query, result) {
    const q = (query || '').toLowerCase().trim();
    if (!q) return 0;

    const queryTerms = q.replace(/[^\w\s]/g, ' ').split(/\s+/).filter((t) => t.length > 2);
    if (queryTerms.length === 0) return 0;

    const title = (result.title || '').toLowerCase();
    const snippet = (result.snippet || '').toLowerCase();
    const docText = `${title} ${snippet}`;
    const docTerms = docText.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
    if (docTerms.length === 0) return 0;

    let matchScore = 0;
    queryTerms.forEach((term) => {
      const count = docTerms.filter((t) => t === term || t.includes(term)).length;
      matchScore += count / docTerms.length;
    });

    let score = Math.min(matchScore / queryTerms.length, 1);
    if (docText.includes(q)) score = Math.min(score + 0.2, 1);
    if (queryTerms.some((term) => title.includes(term))) score = Math.min(score + 0.15, 1);
    return score;
  }

  /**
   * Recency score (0-1): newer results score higher, decaying over roughly a year.
   */
  calculateRecency(dateStr) {
    if (!dateStr) return 0.3;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 0.3;
    const daysDiff = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff < 1) return 1;
    if (daysDiff < 7) return 0.9;
    if (daysDiff < 30) return 0.75;
    if (daysDiff < 90) return 0.6;
    if (daysDiff < 365) return 0.4;
    return 0.2;
  }

  /**
   * Diversity score (0-1): penalizes repeat results from the same domain so one
   * site can't dominate a results page.
   */
  calculateDiversity(domain, domainCounts) {
    const count = domainCounts.get(domain) || 0;
    if (count === 0) return 1;
    return Math.max(Math.pow(0.5, count), 0.1);
  }

  /**
   * Bias-tier weight (0-1) used only in red-pill mode to favor alternative/
   * independent sources over mainstream ones without a crude tier-only sort.
   */
  biasTierWeight(bias) {
    const weights = {
      conspiracy: 1,
      alternative: 0.9,
      independent: 0.8,
      neutral: 0.5,
      center: 0.45,
      unbiased: 0.4,
      left: 0.35,
      right: 0.35,
      mainstream: 0.1,
    };
    return weights[bias] !== undefined ? weights[bias] : 0.5;
  }

  /**
   * Detect if a query is navigational — a short brand/service name lookup
   * where the user wants the official website, not editorial commentary about it.
   */
  isNavigationalQuery(query) {
    const q = (query || '').trim();
    const words = q.split(/\s+/);
    if (words.length > 3) return false;
    // Exclude informational question patterns
    if (/^(what|how|why|when|who|where|is|are|was|were|will|can|does|do|did|define|explain)\b/i.test(q)) return false;
    return true;
  }

  /**
   * Score how "official" a result URL is for a navigational query.
   * High score = the official/homepage result (e.g. aws.amazon.com for "aws").
   * Social media profile pages and deeply nested paths score near zero.
   */
  calculateNavigationalScore(query, result) {
    const q = (query || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const url = (result.url || '').toLowerCase();

    let hostname = '';
    let pathParts = [];
    try {
      const parsed = new URL(url);
      hostname = parsed.hostname.toLowerCase();
      pathParts = parsed.pathname.split('/').filter(Boolean);
    } catch { return 0; }

    const subdomain = hostname.split('.')[0].replace(/[^a-z0-9]/g, '');
    const hostNorm = hostname.replace(/[^a-z0-9]/g, '');
    const isHomepage = pathParts.length === 0;
    const isShallow = pathParts.length <= 1;

    const SOCIAL = ['instagram.com', 'linkedin.com', 'twitter.com', 'facebook.com', 'tiktok.com'];
    const isSocial = SOCIAL.some((s) => hostname.includes(s));

    let score = 0;

    if (subdomain === q || subdomain.includes(q)) {
      // e.g. "aws.amazon.com" for query "aws"
      score = isHomepage ? 1.0 : (isShallow ? 0.8 : 0.55);
    } else if (hostNorm.startsWith(q) || hostNorm.includes(q)) {
      // e.g. "cloudflare.com" for query "cloudflare"
      score = isHomepage ? 0.9 : (isShallow ? 0.65 : 0.4);
    } else if (isHomepage) {
      score = 0.15; // small homepage bonus for any domain
    }

    if (isSocial) score *= 0.25; // heavy penalty — social profiles ≠ official site

    return Math.min(score, 1.0);
  }

  /**
   * Rank results by combined relevance + recency + source diversity — the
   * default "most relevant / most recent first" ranking. In red-pill mode,
   * `boostAlternative` blends in a bias-tier weight so alternative/independent
   * sources rank above mainstream ones.
   *
   * Navigational queries (short brand-name lookups like "AWS", "cloudflare")
   * get a strong navigational-score component so the official homepage always
   * surfaces at the top instead of social-media profiles or job boards.
   */
  rankResults(query, results, { boostAlternative = false } = {}) {
    if (!results || results.length === 0) return [];

    const isNavigational = this.isNavigationalQuery(query);
    const domainCounts = new Map();
    const scored = results.map((result) => {
      const domain = result.domain || this.extractDomain(result.url || '');
      const relevanceScore = this.calculateRelevance(query, result);
      const recencyScore = this.calculateRecency(result.date);
      const diversityScore = this.calculateDiversity(domain, domainCounts);
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);

      let finalScore = relevanceScore * 0.5 + recencyScore * 0.35 + diversityScore * 0.15;

      if (isNavigational) {
        const navScore = this.calculateNavigationalScore(query, result);
        // Navigational queries: nav score dominates (70 %), quality signals fill the rest
        finalScore = finalScore * 0.3 + navScore * 0.7;
      }

      if (boostAlternative) {
        finalScore = finalScore * 0.6 + this.biasTierWeight(result.bias) * 0.4;
      }

      return { ...result, relevanceScore, recencyScore, diversityScore, finalScore };
    });

    scored.sort((a, b) => b.finalScore - a.finalScore);
    return scored;
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

    // Localization: restrict results + interface language to the user's locale
    if (filters.language) {
      params.lr = `lang_${filters.language}`; // restrict to documents in this language
      params.hl = filters.language; // interface/host language
    }
    if (filters.country) {
      params.gl = filters.country.toLowerCase(); // geolocation boost (e.g. 'br')
    }

    try {
      const response = await axios.get(this.googleBaseUrl, { params, timeout: 8000 });
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
   * Perform Google Image Search (real photos via Custom Search, searchType=image).
   * Uses the same Google API key/CSE as web search — no separate key required.
   */
  async performGoogleImageSearch(query, filters) {
    if (!this.googleApiKey || !this.googleSearchEngineId) {
      throw new Error('Google Search API not configured');
    }

    const googlePerPage = Math.min(filters.perPage || 10, 10);
    const params = {
      key: this.googleApiKey,
      cx: this.googleSearchEngineId,
      q: query,
      searchType: 'image',
      num: googlePerPage,
      start: ((filters.page || 1) - 1) * googlePerPage + 1,
    };

    if (filters.safeSearch === 'off') {
      // no safe param = unrestricted
    } else if (filters.safeSearch === 'blur') {
      params.safe = 'medium';
    } else {
      params.safe = 'active';
    }

    if (filters.language) {
      params.lr = `lang_${filters.language}`;
      params.hl = filters.language;
    }
    if (filters.country) {
      params.gl = filters.country.toLowerCase();
    }

    try {
      const response = await axios.get(this.googleBaseUrl, { params, timeout: 8000 });
      return { ...response.data, _source: 'google-images' };
    } catch (error) {
      console.error(
        'Google Image Search API error:',
        JSON.stringify(error.response?.data, null, 2) || error.message
      );
      if (error.response?.status === 403) {
        throw new Error('Google API key invalid or quota exceeded');
      }
      if (error.response?.status === 429) {
        throw new Error('Google API rate limit exceeded');
      }
      throw new Error('Google Image Search service unavailable');
    }
  }

  formatGoogleImageResults(data) {
    if (!data || !data.items) return [];
    return data.items.map((item) => ({
      title: item.title || 'Untitled Image',
      url: item.image?.contextLink || item.link,
      snippet: item.snippet || '',
      source: 'google-images',
      sourceName: 'Google Images',
      date: new Date().toISOString(),
      image: item.link || null,
      thumbnail: item.image?.thumbnailLink || null,
      favicon: null,
      domain: this.extractDomain(item.image?.contextLink || item.link || ''),
      category: 'images',
      verified: true,
    }));
  }

  /**
   * Perform Brave Image Search (real photos). Uses the same Brave API key as
   * web search — no separate key required.
   */
  async performBraveImageSearch(query, filters) {
    if (!this.braveApiKey) {
      throw new Error('Brave Search API not configured');
    }

    const params = {
      q: query,
      count: Math.min(filters.perPage || 20, 50),
      safesearch: filters.safeSearch === 'off' ? 'off' : filters.safeSearch === 'blur' ? 'moderate' : 'strict',
    };
    if (filters.country) params.country = filters.country;
    if (filters.language) params.search_lang = filters.language;

    try {
      const response = await axios.get('https://api.search.brave.com/res/v1/images/search', {
        headers: { 'X-Subscription-Token': this.braveApiKey, Accept: 'application/json' },
        params,
        timeout: 8000,
      });
      return { ...response.data, _source: 'brave-images' };
    } catch (error) {
      console.error('Brave Image Search API error:', error.response?.data || error.message);
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Brave API key invalid');
      }
      if (error.response?.status === 429) {
        throw new Error('Brave API rate limit exceeded');
      }
      throw new Error('Brave Image Search service unavailable');
    }
  }

  formatBraveImageResults(data) {
    if (!data || !data.results) return [];
    return data.results.map((item) => {
      const pageUrl = item.url || item.source || '';
      const imageUrl = item.properties?.url || item.thumbnail?.original || item.thumbnail?.src || null;
      return {
        title: item.title || 'Untitled Image',
        url: pageUrl,
        snippet: item.title || '',
        source: 'brave-images',
        sourceName: 'Brave Images',
        date: item.page_age || item.age || new Date().toISOString(),
        image: imageUrl,
        thumbnail: item.thumbnail?.src || null,
        favicon: null,
        domain: this.extractDomain(pageUrl),
        category: 'images',
        verified: true,
      };
    });
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
      const response = await axios.get(this.bingBaseUrl, { headers, params, timeout: 8000 });
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

    // Localization
    if (filters.language) params.search_lang = filters.language;
    if (filters.country) params.country = filters.country;

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

  /**
   * Perform SearXNG metasearch (self-hosted, aggregates Google/Bing/DDG/Brave/etc.)
   */
  async performSearXNGSearch(query, filters) {
    if (!this.searxngUrl) {
      throw new Error('SearXNG not configured');
    }

    const params = {
      q: query,
      format: 'json',
      pageno: filters.page || 1,
    };

    try {
      const response = await axios.get(`${this.searxngUrl}/search`, {
        params,
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'TruegleSearch/1.0',
        },
        // Short timeout on purpose: SearXNG is self-hosted and may be offline.
        // It must never add latency or risk the serverless function timeout —
        // the API providers (Brave/Google/News/YouTube) cover search regardless.
        timeout: 4500,
      });
      return { ...response.data, _source: 'searxng' };
    } catch (error) {
      // Expected and non-fatal when the self-hosted SearXNG host is offline.
      // Search still succeeds via the API providers, so warn (don't error).
      console.warn('SearXNG unavailable (non-fatal, API providers cover search):', error.response?.status || error.code || error.message);
      throw new Error('SearXNG unavailable');
    }
  }

  formatSearXNGResults(data) {
    if (!data || !data.results) return [];

    return data.results.map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.content || '',
      source: 'searxng',
      sourceName: item.engine || 'SearXNG',
      date: item.publishedDate || new Date().toISOString(),
      image: item.img_src || null,
      favicon: null,
      domain: this.extractDomain(item.url),
      category: 'web',
      verified: true,
    }));
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

    // NewsAPI only supports this subset of language codes; fall back to English otherwise
    const NEWS_SUPPORTED_LANGS = [
      'ar', 'de', 'en', 'es', 'fr', 'he', 'it', 'nl', 'no', 'pt', 'ru', 'sv', 'ud', 'zh',
    ];
    const newsLanguage = NEWS_SUPPORTED_LANGS.includes(filters.language)
      ? filters.language
      : 'en';

    const params = {
      apiKey: this.newsApiKey,
      q: query,
      pageSize: filters.perPage || 20,
      page: filters.page || 1,
      sortBy: filters.sortBy === 'date' ? 'publishedAt' : 'relevancy',
      language: newsLanguage,
    };

    // Add date range filter
    if (filters.dateRange && filters.dateRange !== 'any') {
      const dateFrom = this.calculateDateFrom(filters.dateRange);
      params.from = dateFrom;
    }

    try {
      const response = await axios.get(this.newsBaseUrl, { params, timeout: 8000 });
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

    const runSearch = async (q) => {
      const params = {
        key: this.youtubeApiKey,
        part: 'snippet',
        q,
        type: 'video',
        maxResults: filters.perPage || 25,
        order: filters.sortBy === 'views' ? 'viewCount' : 'relevance',
      };

      // Add date range filter
      if (filters.dateRange && filters.dateRange !== 'any') {
        const dateAfter = this.calculateDateFrom(filters.dateRange);
        params.publishedAfter = new Date(dateAfter).toISOString();
      }

      const response = await axios.get(this.youtubeBaseUrl, { params, timeout: 8000 });
      return response.data;
    };

    try {
      const data = await runSearch(query);

      // A strict/quoted query (e.g. '"grown shit" mac dre') can over-constrain
      // YouTube into 0-1 hits, leaving the Videos tab nearly empty for an
      // otherwise findable query. When the strict result set is thin, also run a
      // broadened query (quote operators stripped) and MERGE: strict hits stay
      // first (most precise), broadened extras fill the rest, deduped by id.
      const want = filters.perPage || 25;
      const strictCount = (data.items || []).length;
      if (strictCount < Math.min(5, want) && /["']/.test(query)) {
        const broadened = query.replace(/["']/g, ' ').replace(/\s+/g, ' ').trim();
        if (broadened && broadened !== query) {
          console.log(`📺 YouTube: thin strict result (${strictCount}), merging broadened "${broadened}"`);
          try {
            const more = await runSearch(broadened);
            const seen = new Set((data.items || []).map((i) => i.id?.videoId).filter(Boolean));
            const extra = (more.items || []).filter(
              (i) => i.id?.videoId && !seen.has(i.id.videoId)
            );
            data.items = [...(data.items || []), ...extra].slice(0, want);
          } catch (broadenErr) {
            console.error('YouTube broadened retry failed:', broadenErr.message);
          }
        }
      }

      // Enrich with duration + view counts via a videos.list call (search.list omits these)
      try {
        const ids = (data.items || [])
          .map((i) => i.id?.videoId)
          .filter(Boolean);
        if (ids.length) {
          const detailsResp = await axios.get(
            'https://www.googleapis.com/youtube/v3/videos',
            {
              params: {
                key: this.youtubeApiKey,
                part: 'contentDetails,statistics',
                id: ids.join(','),
              },
              timeout: 8000,
            }
          );
          const detailMap = {};
          (detailsResp.data.items || []).forEach((d) => {
            detailMap[d.id] = d;
          });
          data.items = (data.items || []).map((i) => ({
            ...i,
            contentDetails: detailMap[i.id?.videoId]?.contentDetails,
            statistics: detailMap[i.id?.videoId]?.statistics,
          }));
        }
      } catch (enrichErr) {
        console.error('YouTube details enrichment failed:', enrichErr.message);
      }

      return data;
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
      case 'searxng':
        return this.formatSearXNGResults(data);
      case 'google-images':
        return this.formatGoogleImageResults(data);
      case 'brave-images':
        return this.formatBraveImageResults(data);
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
    // Explicit _source tags first: Google Images shares `kind: 'customsearch#search'`
    // with plain Google web results, so it must be checked before the generic check below.
    if (data._source === 'unsplash') return 'unsplash';
    if (data._source === 'brave') return 'brave';
    if (data._source === 'searxng') return 'searxng';
    if (data._source === 'google-images') return 'google-images';
    if (data._source === 'brave-images') return 'brave-images';
    if (data.items && data.kind === 'customsearch#search') return 'google';
    if (data.webPages && data._type === 'SearchResponse') return 'bing';
    if (data.articles && data.status === 'ok') return 'news';
    if (data.items && data.kind === 'youtube#searchListResponse') return 'youtube';
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

    if (biasMap[domain]) return biasMap[domain];

    // Keyword-based bias detection for unlisted domains
    const url = (result.url || '').toLowerCase();
    const title = (result.title || '').toLowerCase();
    const snippet = (result.snippet || '').toLowerCase();
    const text = `${url} ${title} ${snippet}`;

    // Conspiracy / fringe signals
    if (/deep.?state|new.?world.?order|illuminati|crisis.?actor|flat.?earth|plandemic|great.?reset.?exposed|chemtrail|microchip.?vaccine|5g.?covid/i.test(text))
      return 'conspiracy';

    // Alternative / suppressed signals
    if (/censored|suppressed|shadow.?ban|banned|they.?don.?t.?want|mainstream.?media.?lies|msm.?lies|whistleblower|leaked|cover.?up|truth.?about/i.test(text))
      return 'alternative';

    // Left-leaning signals
    if (/systemic.?racism|white.?privilege|defund.?police|social.?justice|equity.?diversity|climate.?justice|reproductive.?rights|transgender.?rights/i.test(text))
      return 'left';

    // Right-leaning signals
    if (/make.?america.?great|maga|election.?fraud|illegal.?immigration|second.?amendment|woke.?agenda|deep.?state|patriot.?movement|conservative.?values/i.test(text))
      return 'right';

    // Mainstream signals (large institutional sites)
    if (/\.gov\b|\.edu\b/.test(url)) return 'unbiased';

    return 'neutral';
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
   * Green mode: is this URL/domain a known AI-generated-content source?
   * Matches the registrable domain and any subdomain (blocklisted "x.com"
   * also blocks "blog.x.com").
   */
  isAiContentDomain(urlOrDomain) {
    if (!urlOrDomain || this.aiContentDomains.size === 0) return false;
    let host;
    try {
      host = urlOrDomain.includes('://')
        ? new URL(urlOrDomain).hostname
        : urlOrDomain;
    } catch {
      host = urlOrDomain;
    }
    host = String(host).toLowerCase().replace(/^www\./, '');
    if (this.aiContentDomains.has(host)) return true;
    // Subdomain match: blog.example.com -> example.com
    for (const blocked of this.aiContentDomains) {
      if (host === blocked || host.endsWith(`.${blocked}`)) return true;
    }
    return false;
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
      title: decodeHtmlEntities(item.snippet.title),
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      snippet: decodeHtmlEntities(item.snippet.description),
      source: 'youtube',
      sourceName: 'YouTube',
      channel: decodeHtmlEntities(item.snippet.channelTitle) || 'YouTube',
      date: item.snippet.publishedAt || new Date().toISOString(),
      image: item.snippet.thumbnails?.high?.url || null,
      favicon: null,
      domain: 'youtube.com',
      category: 'videos',
      duration: this.parseYouTubeDuration(item.contentDetails?.duration),
      views: item.statistics?.viewCount
        ? Number(item.statistics.viewCount)
        : null,
      verified: true,
    }));
  }

  /**
   * Convert an ISO-8601 duration (e.g. "PT1H2M3S") to "h:mm:ss" / "m:ss".
   */
  parseYouTubeDuration(iso) {
    if (!iso) return null;
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return null;
    const h = parseInt(m[1] || '0', 10);
    const min = parseInt(m[2] || '0', 10);
    const s = parseInt(m[3] || '0', 10);
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(min)}:${pad(s)}` : `${min}:${pad(s)}`;
  }

  formatBingResults(bingData) {
    if (!bingData || !bingData.webPages || !bingData.webPages.value) return [];

    return bingData.webPages.value.map((item) => ({
      title: item.name,
      url: item.url,
      snippet: item.snippet,
      source: 'bing',
      sourceName: 'Bing',
      date: item.dateLastCrawled || new Date().toISOString(),
      image: null,
      favicon: null,
      domain: this.extractDomain(item.url),
      category: 'web',
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
