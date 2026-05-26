import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Logo from '../components/branding/Logo';
import SearchBar from '../components/ui/SearchBar';
import { mockSearchResults } from '../services/mockSearch';

const SEARCH_TYPES = [
  { id: 'web', label: 'Web', icon: '🌐' },
  { id: 'images', label: 'Images', icon: '🖼️' },
  { id: 'videos', label: 'Videos', icon: '🎥' },
  { id: 'reels', label: 'Reels', icon: '📱' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️' },
  { id: 'socials', label: 'Socials', icon: '💬' },
];

const SearchPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [searchType, setSearchType] = useState('web');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!searchParams.get('q'));
  const [isRedPillMode, setIsRedPillMode] = useState(true); // Default to Red Pill on search page

  // Set canonical URL for SEO
  useEffect(() => {
    // Remove any existing canonical link
    const existingLink = document.querySelector('link[rel="canonical"]');
    if (existingLink) {
      existingLink.remove();
    }

    // Create new canonical link if there's a search query
    if (query) {
      const canonicalUrl = `${window.location.origin}/search?q=${encodeURIComponent(query)}`;
      const link = document.createElement('link');
      link.rel = 'canonical';
      link.href = canonicalUrl;
      document.head.appendChild(link);
    }

    // Cleanup function to remove the canonical link when component unmounts
    return () => {
      const canonicalLink = document.querySelector('link[rel="canonical"]');
      if (canonicalLink) {
        canonicalLink.remove();
      }
    };
  }, [query]);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);

    setTimeout(() => {
      setResults(mockSearchResults[searchType] || mockSearchResults.web);
      setLoading(false);
    }, 800);
  };

  const handleFeelingBiased = () => {
    if (!query.trim()) {
      alert('Please enter a search query first');
      return;
    }
    navigate(`/feeling-biased?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-y-auto">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-radial from-purple-900/20 via-black to-black"></div>
        <div className="absolute inset-0 opacity-30">
          {[...Array(100)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-twinkle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10">
        <header className="py-8 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Logo
              size={hasSearched ? 'sm' : 'md'}
              className="transition-all duration-300"
            />
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 mb-8">
          <form onSubmit={handleSearch} className="space-y-4">
            {/* GREEN SEARCH BAR */}
            <SearchBar
              value={query}
              onChange={(val) => setQuery(val)}
              onSearch={handleSearch}
              placeholder="Search Truegle"
              showPillToggle={true}
              isRedPillMode={isRedPillMode}
              onPillModeChange={setIsRedPillMode}
            />

            <div className="flex flex-wrap gap-2 justify-center">
              {SEARCH_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSearchType(type.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    searchType === type.id
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                >
                  <span className="mr-2">{type.icon}</span>
                  {type.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 justify-center">
              <button
                type="submit"
                className="px-6 py-3 rounded-lg font-bold text-white
                         bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500
                         shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              >
                Search Truegle
              </button>

              <button
                type="button"
                onClick={handleFeelingBiased}
                className="px-6 py-3 rounded-lg font-bold text-white
                         bg-gradient-to-r from-yellow-400 via-green-400 to-orange-500
                         shadow-lg hover:shadow-xl hover:scale-105 transition-all"
              >
                Feeling Biased?
              </button>
            </div>
          </form>
        </div>

        {hasSearched && (
          <div className="max-w-4xl mx-auto px-4 pb-16">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                <p className="mt-4 text-white/60">Searching...</p>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-white/60 text-sm">
                  About {results.length} results ({searchType} search)
                </p>

                {results.map((result, index) => (
                  <div key={index}>
                    {/* Ad Banner after every 3rd result */}
                    {index > 0 && index % 3 === 0 && (
                      <div className="mb-4 p-4 rounded-2xl bg-gradient-to-br from-[#FFEB3B]/[0.3125] to-[#FFC107]/[0.3125] backdrop-blur-xl border-2 border-yellow-400/60 shadow-lg shadow-yellow-400/40 cursor-pointer transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,235,59,0.5),0_0_50px_rgba(255,193,7,0.3)] hover:border-yellow-300 hover:from-[#FFEB3B]/[0.375] hover:to-[#FFC107]/[0.375]">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs text-yellow-200 mb-1">
                              Sponsored
                            </div>
                            <div className="text-sm font-semibold text-white">
                              Premium Ad Content
                            </div>
                            <div className="text-xs text-white/90">
                              High-quality products and services
                            </div>
                          </div>
                          <button className="px-6 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-semibold whitespace-nowrap hover:from-orange-400 hover:to-red-400 transition-all shadow-lg shadow-orange-500/25">
                            Learn More
                          </button>
                        </div>
                      </div>
                    )}

                    <div
                      className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10 hover:bg-white/10 transition-all"
                    >
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <h3 className="text-xl font-semibold text-blue-400 hover:underline mb-2">
                          {result.title}
                        </h3>
                        <p className="text-green-400 text-sm mb-2">
                          {result.source || result.url}
                        </p>
                        <p className="text-white/80">
                          {result.snippet || result.description}
                        </p>
                      </a>

                      {result.biasRating && (
                        <div className="mt-3 flex items-center gap-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded ${
                              result.biasRating.bias_rating === 'center'
                                ? 'bg-green-500/20 text-green-300'
                                : 'bg-blue-500/20 text-blue-300'
                            }`}
                          >
                            {result.biasRating.bias_rating}
                          </span>
                          <span className="text-white/60">
                            Credibility:{' '}
                            {(result.biasRating.credibility_score * 100).toFixed(
                              0
                            )}
                            %
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        .animate-twinkle {
          animation: twinkle 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default SearchPage;
