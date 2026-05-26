import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { shoppingAPI } from '../../services/api';

/**
 * As Seen On Component
 * Shows real shopping search results with pictures, prices, and descriptions
 * Displays the cheapest priced product that matches the user's search with price comparisons
 * Also shows other top results in a scrollable interface
 */
const AsSeenOn = ({ searchQuery = '', title = "As Seen On" }) => {
  const [mainProduct, setMainProduct] = useState(null);
  const [otherProducts, setOtherProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Function to fetch real shopping search results
  const fetchShoppingResults = async (query) => {
    setLoading(true);
    setError(null);

    try {
      // Call real shopping API
      const response = await shoppingAPI.search(query, {
        location: 'United States',
        language: 'en',
      });

      if (response.data && response.data.success && response.data.data) {
        const { mainProduct, otherProducts } = response.data.data;

        setMainProduct(mainProduct);
        setOtherProducts(otherProducts || []);
        setLoading(false);

        return { mainProduct, otherProducts: otherProducts || [] };
      } else {
        throw new Error('No products found');
      }
    } catch (err) {
      console.error('Shopping search error:', err);
      setError(err.response?.data?.message || 'Failed to fetch shopping results');
      setMainProduct(null);
      setOtherProducts([]);
      setLoading(false);
      return { mainProduct: null, otherProducts: [] };
    }
  };

  useEffect(() => {
    if (searchQuery) {
      fetchShoppingResults(searchQuery);
    } else {
      setMainProduct(null);
      setOtherProducts([]);
    }
  }, [searchQuery]);

  // Function to scroll the product container left/right
  const scrollProducts = (direction, elementId) => {
    const container = document.getElementById(elementId);
    if (container) {
      const scrollAmount = container.clientWidth * 0.8; // Scroll 80% of container width
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (!searchQuery) {
    return null; // Don't render if no search query
  }

  return (
    <section className="py-6 px-4 bg-gradient-to-b from-gray-900 to-black border-t border-gray-800">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
          <p className="text-gray-400 text-sm">The cheapest prices available online</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        ) : error ? (
          <div className="text-center text-red-500 py-4">{error}</div>
        ) : mainProduct ? (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 mb-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex-shrink-0">
                <img
                  src={mainProduct.image}
                  alt={mainProduct.name}
                  className="w-24 h-24 object-contain rounded-lg"
                  onError={(e) => {
                    e.target.src = `https://placehold.co/120x120/333333/FFFFFF?text=${encodeURIComponent(mainProduct.name.substring(0, 10))}`;
                  }}
                />
              </div>

              <div className="flex-1 text-center md:text-left">
                <h3 className="text-lg font-semibold text-white mb-2">{mainProduct.name}</h3>
                <p className="text-gray-400 text-sm mb-3">{mainProduct.description}</p>

                <div className="mb-3">
                  <span className="text-2xl font-bold text-green-400">
                    ${mainProduct.price.toFixed(2)}
                  </span>
                  <span className="text-gray-400 ml-2">from {mainProduct.store}</span>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className={`w-4 h-4 ${i < Math.floor(mainProduct.rating) ? 'text-yellow-400' : 'text-gray-600'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461c.969 0 1.371-1.24.588-1.81L9.049 2.927z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-sm text-gray-400">({mainProduct.reviews} reviews)</span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Compared to</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-red-900/30 p-3 rounded-lg border border-red-800">
                      <div className="text-sm text-red-300">Amazon</div>
                      <div className="text-lg font-semibold text-white">${mainProduct.amazonPrice.toFixed(2)}</div>
                    </div>

                    <div className="bg-blue-900/30 p-3 rounded-lg border border-blue-800">
                      <div className="text-sm text-blue-300">Walmart</div>
                      <div className="text-lg font-semibold text-white">${mainProduct.walmartPrice.toFixed(2)}</div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <a
                      href={mainProduct.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
                    >
                      {mainProduct.price < mainProduct.amazonPrice
                        ? `Save $${(mainProduct.amazonPrice - mainProduct.price).toFixed(2)} vs Amazon`
                        : 'View on Store'}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Other Top Results Section */}
        {otherProducts.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Other Top Results</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => scrollProducts('left', 'other-products-container')}
                  className="p-2 rounded-full bg-gray-700 text-white hover:bg-gray-600"
                >
                  &lt;
                </button>
                <button
                  onClick={() => scrollProducts('right', 'other-products-container')}
                  className="p-2 rounded-full bg-gray-700 text-white hover:bg-gray-600"
                >
                  &gt;
                </button>
              </div>
            </div>

            <div
              id="other-products-container"
              className="flex overflow-x-auto gap-4 pb-2 hide-scrollbar"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {otherProducts.map((product) => (
                <a
                  key={product.id}
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 w-48 bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700 hover:border-cyan-500 transition-colors"
                >
                  <div className="flex flex-col h-full">
                    <div className="flex-shrink-0">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-24 object-contain rounded-lg mb-2"
                        onError={(e) => {
                          e.target.src = `https://placehold.co/120x120/444444/FFFFFF?text=${encodeURIComponent(product.name.substring(0, 10))}`;
                        }}
                      />
                    </div>

                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-white mb-1 line-clamp-2 h-10">{product.name}</h4>
                      <p className="text-xs text-gray-400 mb-2 line-clamp-2 h-10">{product.description}</p>

                      <div className="flex items-center gap-1 mb-2">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            className={`w-3 h-3 ${i < Math.floor(product.rating) ? 'text-yellow-400' : 'text-gray-600'}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461c.969 0 1.371-1.24.588-1.81L9.049 2.927z" />
                          </svg>
                        ))}
                        <span className="text-xs text-gray-400 ml-1">({product.reviews})</span>
                      </div>

                      <div className="flex justify-between items-center mt-auto">
                        <span className="text-lg font-bold text-green-400">${product.price.toFixed(2)}</span>
                        <span className="text-xs text-gray-400">{product.store}</span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </section>
  );
};

AsSeenOn.propTypes = {
  /** The current search query to match products against */
  searchQuery: PropTypes.string,
  /** Title for the section */
  title: PropTypes.string,
};

export default AsSeenOn;