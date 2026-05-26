import { useState, useCallback } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * Shared search hook for all pages
 * Provides consistent search functionality across the app
 */
export function useSearch() {
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [lastQuery, setLastQuery] = useState('');
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  /**
   * Perform a search query
   */
  const performSearch = useCallback(async (query, options = {}) => {
    if (!query?.trim()) {
      console.log('Empty query, skipping search');
      return { results: [], perspectives: [] };
    }

    const {
      category = 'all',
      bias = 'all',
      dateRange = 'any',
      isRedPillMode = false,
      perPage = 20
    } = options;

    setSearchLoading(true);
    setSearchError(null);
    setLastQuery(query);

    console.log('🔍 Performing search:', query);

    try {
      const response = await fetch(`${BACKEND_URL}/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          filters: {
            category,
            bias: isRedPillMode ? 'all' : bias,
            dateRange,
            sortBy: 'relevance',
            order: 'desc',
            perPage
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Search API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Search results:', data.results?.length || 0, 'items');

      setSearchResults(data.results || []);

      // Fetch AI summary in the background
      if (data.results && data.results.length > 0) {
        fetchAiSummary(query, data.results);
      }

      return {
        results: data.results || [],
        perspectives: data.perspectives || generatePerspectives(query)
      };
    } catch (error) {
      console.error('❌ Search error:', error);
      setSearchError(error.message);

      // Return fallback results
      const fallbackResults = generateFallbackResults(query, isRedPillMode);
      setSearchResults(fallbackResults);

      return {
        results: fallbackResults,
        perspectives: generatePerspectives(query)
      };
    } finally {
      setSearchLoading(false);
    }
  }, []);

  /**
   * Fetch AI summary for search results
   */
  const fetchAiSummary = useCallback(async (query, results) => {
    setAiLoading(true);
    setAiSummary(null);

    try {
      console.log('🤖 Fetching AI summary...');
      const response = await fetch(`${BACKEND_URL}/api/ai/summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          results: results.slice(0, 10), // Send top 10 results
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ AI summary received:', data.model);

      setAiSummary({
        summary: data.summary,
        perspectives: data.perspectives,
        sourcesAnalyzed: data.sourcesAnalyzed,
        model: data.model,
      });
    } catch (error) {
      console.error('❌ AI summary error:', error);
      // Set a fallback summary
      setAiSummary({
        summary: `Search results for "${query}" cover multiple perspectives from various sources.`,
        perspectives: generatePerspectives(query),
        sourcesAnalyzed: results.length,
        model: 'fallback',
      });
    } finally {
      setAiLoading(false);
    }
  }, []);

  /**
   * Clear search results
   */
  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setSearchError(null);
    setLastQuery('');
    setAiSummary(null);
  }, []);

  return {
    searchResults,
    searchLoading,
    searchError,
    lastQuery,
    performSearch,
    clearSearch,
    setSearchResults,
    aiSummary,
    aiLoading,
    fetchAiSummary,
  };
}

/**
 * Generate perspective summaries for a query
 */
function generatePerspectives(query) {
  return [
    {
      type: 'left',
      title: 'Progressive View',
      summary: `Progressive perspectives on "${query}" emphasize social equity, environmental concerns, and systemic change.`
    },
    {
      type: 'center',
      title: 'Balanced View',
      summary: `Mainstream analysis of "${query}" presents multiple viewpoints and focuses on consensus-driven understanding.`
    },
    {
      type: 'right',
      title: 'Conservative View',
      summary: `Conservative perspectives on "${query}" emphasize traditional values, free markets, and individual responsibility.`
    }
  ];
}

/**
 * Generate fallback results when API fails
 */
function generateFallbackResults(query, isRedPillMode) {
  if (isRedPillMode) {
    return [
      {
        id: 1,
        title: `Alternative Perspectives on: ${query}`,
        url: '#',
        snippet: 'Explore lesser-known viewpoints and alternative analyses on this topic.',
        source: 'Alternative Sources',
        date: new Date().toISOString()
      },
      {
        id: 2,
        title: `Deep Dive: ${query}`,
        url: '#',
        snippet: 'Uncover hidden aspects and rarely discussed elements of this subject.',
        source: 'Independent Research',
        date: new Date().toISOString()
      }
    ];
  }

  return [
    {
      id: 1,
      title: `Search results for: ${query}`,
      url: '#',
      snippet: 'Unable to fetch live results. Please check your connection and try again.',
      source: 'Truegle',
      date: new Date().toISOString()
    }
  ];
}

export default useSearch;
