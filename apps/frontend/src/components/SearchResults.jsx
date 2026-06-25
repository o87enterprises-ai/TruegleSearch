import React from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import AdSlot from './AdSlot';

const { FiExternalLink, FiClock, FiEye, FiTag } = FiIcons;

const SearchResults = ({ results, loading, filters }) => {
  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(10)].map((_, index) => (
          <div key={index} className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-1"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  const getBiasColor = (bias) => {
    const colors = {
      left: 'bg-blue-100 text-blue-800',
      center: 'bg-green-100 text-green-800',
      right: 'bg-red-100 text-red-800',
      unbiased: 'bg-gray-100 text-gray-800',
      mainstream: 'bg-purple-100 text-purple-800',
      conspiracy: 'bg-orange-100 text-orange-800',
    };
    return colors[bias] || 'bg-gray-100 text-gray-800';
  };

  const getCategoryColor = (category) => {
    const colors = {
      news: 'bg-blue-100 text-blue-800',
      video: 'bg-red-100 text-red-800',
      social: 'bg-green-100 text-green-800',
      shopping: 'bg-yellow-100 text-yellow-800',
      music: 'bg-pink-100 text-pink-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {results.map((result, index) => (
        <React.Fragment key={index}>
          <div className="border-b border-gray-200 pb-6 last:border-b-0">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>{result.domain}</span>
                <SafeIcon icon={FiClock} size={12} />
                <span>{result.publishedAt}</span>
                <SafeIcon icon={FiEye} size={12} />
                <span>{result.views} views</span>
              </div>
              <SafeIcon
                icon={FiExternalLink}
                className="text-gray-400"
                size={16}
              />
            </div>

            <h3 className="text-xl text-blue-600 hover:text-blue-800 cursor-pointer mb-2 font-medium">
              {result.title}
            </h3>

            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              {result.snippet}
            </p>

            <div className="flex items-center space-x-2">
              <span
                className={`text-xs px-2 py-1 rounded-full ${getBiasColor(result.bias)}`}
              >
                {result.bias}
              </span>
              <span
                className={`text-xs px-2 py-1 rounded-full ${getCategoryColor(result.category)}`}
              >
                {result.category}
              </span>
              {result.verified && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  Verified
                </span>
              )}
            </div>
          </div>

          {/* Inline Ad after every 3rd result */}
          {(index + 1) % 3 === 0 && (
            <div className="my-6">
              <AdSlot
                position={`results-inline-${Math.floor((index + 1) / 3)}`}
                size="medium"
                className="mx-auto"
              />
            </div>
          )}
        </React.Fragment>
      ))}

      {results.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">
            No results found for your search.
          </p>
          <p className="text-sm text-gray-400">
            Try different keywords or adjust your filters.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="pt-4 mt-2 border-t border-gray-100 flex items-center justify-center">
          <span className="inline-flex items-center space-x-1.5 text-xs text-gray-400">
            <SafeIcon icon={FiTag} size={12} />
            <span>
              Results from{' '}
              <a
                href="https://truegle.info"
                className="text-gray-500 hover:text-blue-600"
                rel="noopener noreferrer"
              >
                Truegle
              </a>{' '}
              &mdash; the unbiased search engine
            </span>
          </span>
        </div>
      )}
    </div>
  );
};

export default SearchResults;
