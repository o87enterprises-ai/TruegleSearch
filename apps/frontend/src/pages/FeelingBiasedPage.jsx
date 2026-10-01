import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Logo from '../components/branding/Logo';
import { mockPerspectiveResults, mockAds } from '../services/mockSearch';

const PERSPECTIVES = [
  { id: 'mainstream', label: 'Mainstream', color: '#007AFF' },
  { id: 'alternative', label: 'Alternative', color: '#FF9500' },
  { id: 'conspiracy', label: 'Conspiracy', color: '#AF52DE' },
  { id: 'left-leaning', label: 'Left Leaning', color: '#FF3B30' },
  { id: 'centrist', label: 'Centrist', color: '#34C759' },
  { id: 'right-leaning', label: 'Right Leaning', color: '#FF3B30' },
  { id: 'religious', label: 'Religious', color: '#FFCC00' },
  { id: 'atheist', label: 'Atheist', color: '#007AFF' },
  { id: 'spiritual', label: 'Spiritual', color: '#AF52DE' },
  { id: 'universal', label: 'Universal', color: '#34C759' },
  { id: 'scientific', label: 'Scientific', color: '#007AFF' },
];

const FeelingBiasedPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const perspectivesParam = searchParams.get('perspectives') || '';

  // Get initial perspective from URL or default to 'mainstream'
  const initialPerspective = perspectivesParam ? perspectivesParam.split(',')[0] : 'mainstream';
  const [selectedPerspective, setSelectedPerspective] = useState(initialPerspective);
  const [currentAds, setCurrentAds] = useState(mockAds);
  const [results, setResults] = useState([]);

  useEffect(() => {
    setResults(mockPerspectiveResults[selectedPerspective]?.results || []);
    setCurrentAds(
      mockAds.map((ad) => ({
        ...ad,
        content: `[Mock Ad for ${selectedPerspective}]`,
      }))
    );
  }, [selectedPerspective]);

  return (
    <div className="min-h-screen bg-black text-white">
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

      <header className="relative z-10 py-6 px-4 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <Logo size="sm" />

          <div className="flex-1 max-w-2xl flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-lg px-4 py-2 border border-white/20">
            <span className="text-xl">🔍</span>
            <input
              type="text"
              value={query}
              readOnly
              className="flex-1 bg-transparent text-white outline-none"
              placeholder="Search query"
            />
          </div>

          <button
            onClick={() => navigate(`/search?q=${encodeURIComponent(query)}`)}
            className="px-4 py-2 rounded-lg font-semibold text-white
                     bg-gradient-to-r from-green-500 to-blue-500
                     hover:scale-105 transition-all"
          >
            Back to Unbiased Results
          </button>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10 sticky top-4">
              <h3 className="text-lg font-bold mb-4">Select Perspective</h3>
              <div className="space-y-2">
                {PERSPECTIVES.map((perspective) => (
                  <button
                    key={perspective.id}
                    onClick={() => setSelectedPerspective(perspective.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all ${
                      selectedPerspective === perspective.id
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                        : 'bg-white/5 text-white/80 hover:bg-white/10'
                    }`}
                  >
                    {perspective.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="mb-6">
              <h2
                className="text-2xl font-bold mb-2"
                style={{
                  color: PERSPECTIVES.find((p) => p.id === selectedPerspective)
                    ?.color,
                }}
              >
                {PERSPECTIVES.find((p) => p.id === selectedPerspective)?.label}{' '}
                Perspective
              </h2>
              <p className="text-white/60">
                Results filtered through {selectedPerspective} lens
              </p>
            </div>

            <div className="space-y-4">
              {results.length > 0 ? (
                results.map((result, index) => (
                  <div key={index}>

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
                          {result.source}
                        </p>
                        <p className="text-white/80">{result.snippet}</p>
                      </a>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-white/60">
                  No results for this perspective
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="space-y-4 sticky top-4">
              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                <p className="text-xs text-white/40 mb-2">Advertisement</p>
                <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg p-4 text-center">
                  <p className="text-sm text-white/80">
                    {currentAds[0]?.content}
                  </p>
                  <p className="text-xs text-white/40 mt-2">
                    Perspective: {selectedPerspective}
                  </p>
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                <p className="text-xs text-white/40 mb-2">Advertisement</p>
                <div className="bg-gradient-to-r from-blue-500/20 to-green-500/20 rounded-lg p-4 text-center">
                  <p className="text-sm text-white/80">
                    {currentAds[1]?.content}
                  </p>
                  <p className="text-xs text-white/40 mt-2">
                    Dynamically updates
                  </p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 backdrop-blur-sm rounded-lg p-4 border border-yellow-500/20">
                <h4 className="font-bold text-yellow-400 mb-2">Go Ad-Free</h4>
                <p className="text-sm text-white/80 mb-3">Upgrade to Premium</p>
                <button
                  onClick={() => navigate('/pricing')}
                  className="w-full px-4 py-2 rounded-lg font-semibold text-white
                           bg-gradient-to-r from-yellow-500 to-orange-500
                           hover:scale-105 transition-all"
                >
                  Upgrade Now
                </button>
              </div>
            </div>
          </div>
        </div>
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

export default FeelingBiasedPage;
