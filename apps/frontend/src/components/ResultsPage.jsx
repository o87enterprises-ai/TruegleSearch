import React, { useState, useEffect } from 'react';
import SearchFilters from './SearchFilters';
import SearchResults from './SearchResults';
import AISummary from './AISummary';
import AdSlot from './AdSlot';
import {
  performRealSearch,
  generateRealAISummary,
} from '../utils/realSearchData';
import { SEARCH_CONFIG } from '../config/searchConfig';

const ResultsPage = ({ searchQuery, filters, onFiltersChange }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [error, setError] = useState(null);
  const [searchSource, setSearchSource] = useState('');

  useEffect(() => {
    if (searchQuery) {
      performSearch();
    }
  }, [searchQuery, filters]);

  const performSearch = async () => {
    setLoading(true);
    setError(null);

    try {
      // Check if real APIs are configured
      const hasRealAPIs = Object.values(SEARCH_CONFIG).some(
        (config) => config.apiKey && config.apiKey.length > 0
      );

      if (hasRealAPIs) {
        setSearchSource('real');
        console.log('Using real search APIs...');
      } else {
        setSearchSource('mock');
        console.log('No API keys configured, using mock data...');
      }

      // Perform the search
      const searchResults = await performRealSearch(searchQuery, filters);

      // Generate AI summary
      const summary = await generateRealAISummary(searchQuery, searchResults);

      setResults(searchResults);
      setAiSummary(summary);
    } catch (error) {
      console.error('Search error:', error);
      setError(error.message);

      // Fallback to mock data on error
      const { mockSearchResults, generateAISummary } =
        await import('../utils/mockData');
      const fallbackResults = mockSearchResults(searchQuery, filters);
      const fallbackSummary = generateAISummary(searchQuery);

      setResults(fallbackResults);
      setAiSummary(fallbackSummary);
      setSearchSource('fallback');
    } finally {
      setLoading(false);
    }
  };

  if (!searchQuery) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Enter a search query to see results</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-600">
            About {results.length.toLocaleString()} results (
            {loading ? '...' : '0.45'} seconds)
          </p>

          {/* Search source indicator */}
          <div className="flex items-center space-x-2">
            {searchSource === 'real' && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                Live Results
              </span>
            )}
            {searchSource === 'mock' && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                Demo Mode
              </span>
            )}
            {searchSource === 'fallback' && (
              <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                Fallback Mode
              </span>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-800 text-sm">
              <strong>Search Error:</strong> {error}
            </p>
            <p className="text-red-600 text-xs mt-1">
              Showing demo results instead.
            </p>
          </div>
        )}

        {/* API configuration notice */}
        {searchSource === 'mock' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-blue-800 text-sm">
              <strong>Demo Mode:</strong> Configure API keys in your environment
              to enable real search results.
            </p>
            <p className="text-blue-600 text-xs mt-1">
              Add REACT_APP_GOOGLE_API_KEY, REACT_APP_NEWS_API_KEY, etc. to your
              .env file.
            </p>
          </div>
        )}

        <SearchFilters filters={filters} onFiltersChange={onFiltersChange} />
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <AISummary
            query={searchQuery}
            summary={aiSummary}
            loading={loading}
          />

          <SearchResults
            results={results}
            loading={loading}
            filters={filters}
          />
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-6">
            {/* Sidebar Ad */}
            <div className="mb-4">
              <AdSlot
                position="results-sidebar"
                size="sidebar"
                className="w-full"
              />
            </div>

            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <h3 className="font-semibold mb-2">Search Tips</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Use quotes for exact phrases</li>
                <li>• Filter by bias to see different perspectives</li>
                <li>• Sort by date for latest information</li>
                <li>• Enable real APIs for live results</li>
              </ul>
            </div>

            {/* API Status */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">API Status</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span>Google Search:</span>
                  <span
                    className={
                      SEARCH_CONFIG.google.apiKey
                        ? 'text-green-600'
                        : 'text-red-600'
                    }
                  >
                    {SEARCH_CONFIG.google.apiKey ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>News API:</span>
                  <span
                    className={
                      SEARCH_CONFIG.newsApi.apiKey
                        ? 'text-green-600'
                        : 'text-red-600'
                    }
                  >
                    {SEARCH_CONFIG.newsApi.apiKey ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>YouTube API:</span>
                  <span
                    className={
                      SEARCH_CONFIG.youtube.apiKey
                        ? 'text-green-600'
                        : 'text-red-600'
                    }
                  >
                    {SEARCH_CONFIG.youtube.apiKey ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Bing API:</span>
                  <span
                    className={
                      SEARCH_CONFIG.bing.apiKey
                        ? 'text-green-600'
                        : 'text-red-600'
                    }
                  >
                    {SEARCH_CONFIG.bing.apiKey ? '✓' : '✗'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsPage;
