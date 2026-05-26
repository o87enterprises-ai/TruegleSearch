import SearchAPI from '../services/searchAPI';

// Initialize search API
const searchAPI = new SearchAPI();

// Enhanced search function that uses real APIs
export const performRealSearch = async (query, filters = {}) => {
  try {
    // Use real search API
    const results = await searchAPI.performUnbiasedSearch(query, filters);

    // If no results from real APIs, fall back to mock data
    if (!results || results.length === 0) {
      console.warn('No real search results, falling back to mock data');
      const { mockSearchResults } = await import('./mockData');
      return mockSearchResults(query, filters);
    }

    return results;
  } catch (error) {
    console.error('Real search failed:', error);

    // Fallback to mock data on error
    const { mockSearchResults } = await import('./mockData');
    return mockSearchResults(query, filters);
  }
};

// Generate AI summary from real search results
export const generateRealAISummary = async (query, searchResults = []) => {
  try {
    // If we have real search results, analyze them
    if (searchResults && searchResults.length > 0) {
      const perspectives = analyzeMultiplePerspectives(searchResults);
      return generateSummaryFromPerspectives(query, perspectives);
    }

    // Fallback to mock summary
    const { generateAISummary } = await import('./mockData');
    return generateAISummary(query);
  } catch (error) {
    console.error('AI summary generation failed:', error);

    // Fallback to mock summary
    const { generateAISummary } = await import('./mockData');
    return generateAISummary(query);
  }
};

// Analyze different perspectives from search results
const analyzeMultiplePerspectives = (results) => {
  const perspectives = {
    left: [],
    right: [],
    center: [],
    unbiased: [],
    mainstream: [],
    conspiracy: [],
  };

  results.forEach((result) => {
    if (perspectives[result.bias]) {
      perspectives[result.bias].push({
        title: result.title,
        snippet: result.snippet,
        source: result.domain,
      });
    }
  });

  return perspectives;
};

// Generate summary from different perspectives
const generateSummaryFromPerspectives = (query, perspectives) => {
  const perspectiveCount = Object.keys(perspectives).filter(
    (key) => perspectives[key].length > 0
  ).length;

  if (perspectiveCount === 0) {
    return `No comprehensive information found for "${query}". Please try a different search term.`;
  }

  let summary = `Based on analysis of ${perspectiveCount} different perspectives, "${query}" presents varied viewpoints:\n\n`;

  // Left-leaning perspective
  if (perspectives.left.length > 0) {
    const leftTitles = perspectives.left
      .slice(0, 2)
      .map((r) => r.title)
      .join(', ');
    summary += `**Progressive/Liberal sources** (${perspectives.left.length} articles) focus on social justice and policy implications. Key coverage includes: ${leftTitles}.\n\n`;
  }

  // Right-leaning perspective
  if (perspectives.right.length > 0) {
    const rightTitles = perspectives.right
      .slice(0, 2)
      .map((r) => r.title)
      .join(', ');
    summary += `**Conservative sources** (${perspectives.right.length} articles) emphasize traditional values and economic considerations. Notable reporting: ${rightTitles}.\n\n`;
  }

  // Center/Unbiased perspective
  if (perspectives.center.length > 0 || perspectives.unbiased.length > 0) {
    const centerCount =
      perspectives.center.length + perspectives.unbiased.length;
    const centerTitles = [
      ...perspectives.center.slice(0, 1),
      ...perspectives.unbiased.slice(0, 1),
    ]
      .map((r) => r.title)
      .join(', ');
    summary += `**Neutral/Fact-based sources** (${centerCount} articles) provide objective analysis: ${centerTitles}.\n\n`;
  }

  // Mainstream perspective
  if (perspectives.mainstream.length > 0) {
    summary += `**Mainstream media** (${perspectives.mainstream.length} sources) offers comprehensive coverage from established outlets.\n\n`;
  }

  // Alternative perspective
  if (perspectives.conspiracy.length > 0) {
    summary += `**Alternative viewpoints** (${perspectives.conspiracy.length} sources) present non-mainstream interpretations that challenge conventional narratives.\n\n`;
  }

  summary += `**Key Recommendation**: Review multiple perspectives to form a well-rounded understanding. Consider source credibility, fact-checking, and potential biases when evaluating information about "${query}".`;

  return summary;
};

// Rate limiting for API calls
class RateLimiter {
  constructor() {
    this.calls = new Map();
  }

  async checkLimit(apiName, limit) {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    if (!this.calls.has(apiName)) {
      this.calls.set(apiName, []);
    }

    const apiCalls = this.calls.get(apiName);

    // Remove old calls outside the window
    const recentCalls = apiCalls.filter((time) => time > windowStart);
    this.calls.set(apiName, recentCalls);

    if (recentCalls.length >= limit) {
      const waitTime = recentCalls[0] + 60000 - now;
      throw new Error(
        `Rate limit exceeded for ${apiName}. Wait ${Math.ceil(waitTime / 1000)} seconds.`
      );
    }

    // Add current call
    recentCalls.push(now);
    this.calls.set(apiName, recentCalls);
  }
}

export const rateLimiter = new RateLimiter();

// Search result caching
class SearchCache {
  constructor() {
    this.cache = new Map();
    this.maxAge = 5 * 60 * 1000; // 5 minutes
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  generateKey(query, filters) {
    return `${query}-${JSON.stringify(filters)}`;
  }
}

export const searchCache = new SearchCache();
