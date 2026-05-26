import React from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiFilter, FiChevronDown } = FiIcons;

const SearchFilters = ({ filters, onFiltersChange }) => {
  const filterOptions = {
    sortBy: [
      { value: 'relevance', label: 'Relevance' },
      { value: 'date', label: 'Date' },
      { value: 'views', label: 'Views' },
    ],
    order: [
      { value: 'desc', label: 'High to Low' },
      { value: 'asc', label: 'Low to High' },
    ],
    category: [
      { value: 'all', label: 'All Results' },
      { value: 'mainstream', label: 'Mainstream' },
      { value: 'conspiracy', label: 'Conspiracy' },
      { value: 'democratic', label: 'Democratic' },
      { value: 'republican', label: 'Republican' },
      { value: 'nonpartisan', label: 'Nonpartisan' },
      { value: 'music', label: 'Music' },
      { value: 'videos', label: 'Videos' },
      { value: 'socials', label: 'Socials' },
      { value: 'reels', label: 'Reels/Shorts' },
      { value: 'shopping', label: 'Shopping' },
    ],
    dateRange: [
      { value: 'any', label: 'Any Time' },
      { value: 'hour', label: 'Past Hour' },
      { value: 'day', label: 'Past 24 Hours' },
      { value: 'week', label: 'Past Week' },
      { value: 'month', label: 'Past Month' },
      { value: 'year', label: 'Past Year' },
    ],
    bias: [
      { value: 'all', label: 'All Perspectives' },
      { value: 'unbiased', label: 'Unbiased Only' },
      { value: 'left', label: 'Left-leaning' },
      { value: 'center', label: 'Center' },
      { value: 'right', label: 'Right-leaning' },
    ],
  };

  const handleFilterChange = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
      <div className="flex items-center mb-4">
        <SafeIcon icon={FiFilter} className="mr-2 text-gray-600" />
        <h3 className="font-semibold text-gray-800">Filter Results</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Sort By */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sort By
          </label>
          <select
            value={filters.sortBy}
            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {filterOptions.sortBy.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Order */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Order
          </label>
          <select
            value={filters.order}
            onChange={(e) => handleFilterChange('order', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {filterOptions.order.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {filterOptions.category.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date
          </label>
          <select
            value={filters.dateRange}
            onChange={(e) => handleFilterChange('dateRange', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {filterOptions.dateRange.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Bias */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Perspective
          </label>
          <select
            value={filters.bias}
            onChange={(e) => handleFilterChange('bias', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {filterOptions.bias.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default SearchFilters;
