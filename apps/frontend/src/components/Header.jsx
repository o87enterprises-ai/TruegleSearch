import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../common/SafeIcon';
import truegleLogo from '../assets/images/truegle.png';

const { FiSearch, FiSettings, FiShield, FiMenu, FiUser, FiLogOut } = FiIcons;

const Header = ({ onSearch, searchQuery }) => {
  const [query, setQuery] = useState(searchQuery || '');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, logout, isAdmin } = useAuth();
  const isHomePage = location.pathname === '/';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
      navigate('/search');
    }
  };

  const handleLogoClick = () => {
    navigate('/');
    setQuery('');
  };

  const handleLogout = () => {
    logout();
    navigate('/auth/login');
    setShowUserMenu(false);
  };

  return (
    <header
      className={`w-full ${isHomePage ? 'py-4' : 'py-3 border-b border-gray-200'}`}
    >
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
        {/* Logo */}
        <div
          className="flex items-center cursor-pointer"
          onClick={handleLogoClick}
        >
          <img
            src={truegleLogo}
            alt="Truegle Logo"
            className="h-8 w-auto"
          />
          <SafeIcon icon={FiShield} className="ml-2 text-green-600" size={20} />
        </div>

        {/* Catch Phrase */}
        <div className="hidden md:block ml-4">
          <p className="text-sm font-medium text-gray-700">
            Truegle: Unbiased, Transparent, and Secure Search
          </p>
        </div>

        {/* Search Bar */}
        {!isHomePage && isAuthenticated && (
          <form onSubmit={handleSubmit} className="flex-1 max-w-2xl mx-8">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search without bias..."
                className="w-full px-4 py-3 pl-12 pr-12 text-gray-900 border border-gray-300 rounded-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <SafeIcon
                icon={FiSearch}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
              >
                <SafeIcon icon={FiSearch} size={16} />
              </button>
            </div>
          </form>
        )}

        {/* Navigation */}
        <nav className="flex items-center space-x-4">
          {isAuthenticated ? (
            <>
              <button
                onClick={() => navigate('/settings')}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
              >
                <SafeIcon icon={FiSettings} size={20} />
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <SafeIcon icon={FiUser} size={20} />
                  {isAdmin && (
                    <div className="w-2 h-2 bg-red-500 rounded-full" title="Admin Account" />
                  )}
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200">
                    <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">Signed in as</p>
                        {isAdmin && (
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                            Admin
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 truncate">{user?.email || user?.userId}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <SafeIcon icon={FiLogOut} className="mr-2" size={16} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <button
              onClick={() => navigate('/auth/login')}
              className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
            >
              Sign In
            </button>
          )}

          <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors">
            <SafeIcon icon={FiMenu} size={20} />
          </button>
        </nav>
      </div>

      {/* Dropdown backdrop */}
      {showUserMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </header>
  );
};

export default Header;
