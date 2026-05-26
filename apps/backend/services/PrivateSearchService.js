/**
 * Private Search Service
 * Implements bias-resistant ranking without user profiling
 * Part of P1 Core Foundation - Core Search Engine
 */
const logger = require('../utils/logger');
const { privacySafeLog } = require('../middleware/privacy');

/**
 * Search result with ranking metadata
 * @typedef {Object} SearchResult
 * @property {string} title - Page title
 * @property {string} url - Page URL
 * @property {string} snippet - Text snippet
 * @property {string} domain - Source domain
 * @property {number} relevanceScore - TF-IDF based relevance
 * @property {number} diversityScore - Source diversity score
 * @property {number} recencyScore - Recency factor
 * @property {number} finalScore - Combined ranking score
 */

class PrivateSearchService {
  constructor() {
    // Domain diversity tracking per search
    this.domainCounts = new Map();

    // Source diversity penalty factor
    this.DIVERSITY_PENALTY = 0.15;

    // Recency boost factor (for time-sensitive queries)
    this.RECENCY_BOOST = 0.1;

    // Maximum results from same domain
    this.MAX_SAME_DOMAIN = 3;
  }

  /**
   * Calculate TF-IDF relevance score
   * @param {string} query - Search query
   * @param {Object} document - Document with title, snippet, content
   * @returns {number} - Relevance score 0-1
   */
  calculateRelevance(query, document) {
    const queryTerms = this.tokenize(query.toLowerCase());
    const docText = `${document.title} ${document.snippet} ${document.content || ''}`.toLowerCase();
    const docTerms = this.tokenize(docText);

    if (docTerms.length === 0) return 0;

    let matchScore = 0;
    let exactPhraseBoost = 0;

    // Check for exact phrase match
    if (docText.includes(query.toLowerCase())) {
      exactPhraseBoost = 0.2;
    }

    // Term frequency scoring
    queryTerms.forEach((term) => {
      const termCount = docTerms.filter((t) => t === term || t.includes(term)).length;
      const tf = termCount / docTerms.length;
      matchScore += tf;
    });

    // Normalize and add phrase boost
    const normalizedScore = Math.min(matchScore / queryTerms.length + exactPhraseBoost, 1);

    // Title match boost
    const titleText = document.title.toLowerCase();
    const titleMatchBoost = queryTerms.some((term) => titleText.includes(term)) ? 0.15 : 0;

    return Math.min(normalizedScore + titleMatchBoost, 1);
  }

  /**
   * Calculate source diversity score
   * Penalizes multiple results from the same domain
   * @param {string} domain - Source domain
   * @param {Map} domainCounts - Current domain count map
   * @returns {number} - Diversity score 0-1
   */
  calculateDiversity(domain, domainCounts) {
    const count = domainCounts.get(domain) || 0;

    // First result from domain gets full score
    if (count === 0) return 1;

    // Exponential penalty for subsequent results
    const penalty = Math.pow(this.DIVERSITY_PENALTY, count);
    return Math.max(penalty, 0.1); // Minimum 10% score
  }

  /**
   * Calculate recency score
   * Boosts recent content for time-sensitive queries
   * @param {Date|string} publishDate - Content publish date
   * @param {boolean} isTimeSensitive - Whether query is time-sensitive
   * @returns {number} - Recency score 0-1
   */
  calculateRecency(publishDate, isTimeSensitive = false) {
    if (!publishDate || !isTimeSensitive) return 0.5; // Neutral score

    const date = new Date(publishDate);
    const now = new Date();
    const daysDiff = (now - date) / (1000 * 60 * 60 * 24);

    if (daysDiff < 1) return 1; // Today
    if (daysDiff < 7) return 0.9; // This week
    if (daysDiff < 30) return 0.7; // This month
    if (daysDiff < 365) return 0.5; // This year
    return 0.3; // Older
  }

  /**
   * Detect if query is time-sensitive
   * @param {string} query - Search query
   * @returns {boolean}
   */
  isTimeSensitiveQuery(query) {
    const timeSensitiveTerms = [
      'news',
      'latest',
      'today',
      'recent',
      'current',
      'now',
      'breaking',
      'update',
      '2024',
      '2025',
      '2026',
    ];
    const lowerQuery = query.toLowerCase();
    return timeSensitiveTerms.some((term) => lowerQuery.includes(term));
  }

  /**
   * Tokenize text into terms
   * @param {string} text - Text to tokenize
   * @returns {string[]} - Array of terms
   */
  tokenize(text) {
    return text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((term) => term.length > 2);
  }

  /**
   * Extract domain from URL
   * @param {string} url - Full URL
   * @returns {string} - Domain
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  /**
   * Rank search results using bias-resistant algorithm
   * @param {string} query - Search query
   * @param {Object[]} results - Raw search results
   * @returns {SearchResult[]} - Ranked results with scores
   */
  rankResults(query, results) {
    if (!results || results.length === 0) return [];

    const isTimeSensitive = this.isTimeSensitiveQuery(query);
    const domainCounts = new Map();

    // Calculate scores for each result
    const scoredResults = results.map((result) => {
      const domain = this.extractDomain(result.url || result.link);

      // Calculate individual scores
      const relevanceScore = this.calculateRelevance(query, result);
      const diversityScore = this.calculateDiversity(domain, domainCounts);
      const recencyScore = this.calculateRecency(result.publishDate, isTimeSensitive);

      // Update domain count for next iteration
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);

      // Combined score (weighted average)
      // Relevance: 60%, Diversity: 30%, Recency: 10%
      const finalScore = relevanceScore * 0.6 + diversityScore * 0.3 + recencyScore * 0.1;

      return {
        title: result.title,
        url: result.url || result.link,
        snippet: result.snippet || result.description || '',
        domain,
        relevanceScore: Math.round(relevanceScore * 100) / 100,
        diversityScore: Math.round(diversityScore * 100) / 100,
        recencyScore: Math.round(recencyScore * 100) / 100,
        finalScore: Math.round(finalScore * 100) / 100,
        // Include original data for display
        image: result.image,
        publishDate: result.publishDate,
      };
    });

    // Sort by final score (descending)
    scoredResults.sort((a, b) => b.finalScore - a.finalScore);

    // Apply domain limit
    return this.applyDomainLimit(scoredResults);
  }

  /**
   * Limit results from same domain
   * @param {SearchResult[]} results - Scored results
   * @returns {SearchResult[]} - Filtered results
   */
  applyDomainLimit(results) {
    const domainCounts = new Map();
    const filteredResults = [];

    for (const result of results) {
      const count = domainCounts.get(result.domain) || 0;

      if (count < this.MAX_SAME_DOMAIN) {
        filteredResults.push(result);
        domainCounts.set(result.domain, count + 1);
      }
    }

    return filteredResults;
  }

  /**
   * Perform a privacy-preserving search
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<{results: SearchResult[], meta: Object}>}
   */
  async search(query, options = {}) {
    const startTime = Date.now();

    try {
      // In production, this would call actual search APIs
      // For now, we'll integrate with the existing SearchService

      // Import the existing search service
      const SearchService = require('./SearchService');
      const searchService = new SearchService();

      // Get raw results (without user personalization)
      const rawResults = await searchService.search(query, {
        ...options,
        // Ensure no user-specific parameters are passed
        userId: undefined,
        userHistory: undefined,
        personalize: false,
      });

      // Apply bias-resistant ranking
      const rankedResults = this.rankResults(query, rawResults.results || []);

      const duration = Date.now() - startTime;

      // Log search (privacy-safe - no query or user info)
      privacySafeLog.info('Search completed', {
        resultCount: rankedResults.length,
        duration: `${duration}ms`,
        isTimeSensitive: this.isTimeSensitiveQuery(query),
      });

      return {
        results: rankedResults,
        meta: {
          query: query, // Only returned to requesting client, not logged
          totalResults: rankedResults.length,
          duration,
          rankingMethod: 'bias-resistant',
          personalized: false,
          cached: false,
        },
      };
    } catch (error) {
      logger.error('Private search failed', { error: error.message });
      throw error;
    }
  }
}

module.exports = PrivateSearchService;
