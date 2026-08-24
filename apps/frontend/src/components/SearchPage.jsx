import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';

const { FiSearch, FiShield, FiEye, FiLock } = FiIcons;

const SearchPage = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
      navigate('/search');
    }
  };

  const features = [
    {
      icon: FiShield,
      title: 'Unbiased Results',
      description: 'No hidden agendas or algorithmic manipulation',
    },
    {
      icon: FiEye,
      title: 'Multiple Perspectives',
      description: 'See all sides of every story with clear categorization',
    },
    {
      icon: FiLock,
      title: 'Privacy First',
      description: 'No tracking, no cookies, no data collection',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Main Logo */}
      <div className="text-center mb-12">
        <div className="text-6xl md:text-8xl font-bold mb-4">
          <span className="text-blue-600">T</span>
          <span className="text-red-500">r</span>
          <span className="text-yellow-500">u</span>
          <span className="text-blue-600">e</span>
          <span className="text-green-500">g</span>
          <span className="text-red-500">l</span>
          <span className="text-purple-600">e</span>
        </div>
        <p className="text-xl text-gray-600 mb-2">Search Without Bias</p>
        <p className="text-sm text-gray-500">
          Unbiased • Transparent • Private
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-2xl mb-8">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for unbiased information..."
            className="w-full px-6 py-4 pl-14 pr-14 text-lg text-gray-900 border border-gray-300 rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:shadow-xl transition-shadow"
          />
          <SafeIcon
            icon={FiSearch}
            className="absolute left-5 top-1/2 transform -translate-y-1/2 text-gray-400"
            size={24}
          />
          <button
            type="submit"
            className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
          >
            <SafeIcon icon={FiSearch} size={20} />
          </button>
        </div>
      </form>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3 mb-12">
        <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors">
          Truegle Search
        </button>
        <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors">
          I'm Feeling Unbiased
        </button>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-8 max-w-4xl">
        {features.map((feature, index) => (
          <div
            key={index}
            className="text-center p-6 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex justify-center mb-4">
              <SafeIcon
                icon={feature.icon}
                size={32}
                className="text-blue-600"
              />
            </div>
            <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
            <p className="text-gray-600 text-sm">{feature.description}</p>
          </div>
        ))}
      </div>

    </div>
  );
};

export default SearchPage;
