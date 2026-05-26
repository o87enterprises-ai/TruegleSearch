import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ChevronDown, Zap, TrendingUp, Mic, Camera, Paperclip } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import TruegleLogo from '../components/ui/TruegleLogo';
import CategoryBar from '../components/ui/CategoryBar';
import SearchBar from '../components/ui/SearchBar';
import FallbackBackground from '../components/backgrounds/FallbackBackground';

// This is a simplified version that uses CSS-only backgrounds
// Use this if WebGL continues to fail

export default function SearchPortalSimple() {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');
  const [isRedPillMode, setIsRedPillMode] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    if (searchValue.trim()) {
      console.log('Searching for:', searchValue);
      // In a real app, you would call your search API here
    }
  };

  const togglePillMode = () => {
    if (!isRedPillMode) {
      setShowWarning(true);
    } else {
      setIsRedPillMode(false);
    }
  };

  const confirmRedPill = () => {
    setIsRedPillMode(true);
    setShowWarning(false);
  };

  return (
    <div className="relative min-h-0 w-full bg-black">
      {/* Use CSS background instead of WebGL */}
      <FallbackBackground />

      {/* Content */}
      <div className="relative z-10 min-h-0 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Top Navigation */}
          <div className="flex justify-end items-center gap-4 mb-4">
            <button className="px-4 py-2 text-sm text-white/70 hover:text-white transition-all">
              Sign In
            </button>
          </div>

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center mb-8"
          >
            <TruegleLogo
              className="scale-[1.5] sm:scale-[1.8]"
              onClick={() => navigate('/')}
            />
          </motion.div>

          {/* Search Bar with Integrated Pill Toggle */}
          <div className="max-w-4xl mx-auto mb-6">
            <SearchBar
              value={searchValue}
              onChange={setSearchValue}
              onSubmit={handleSearch}
              placeholder="Search the web..."
              showPillToggle={true}
              isRedPillMode={isRedPillMode}
              onPillModeChange={setIsRedPillMode}
              // The media input icons (mic, camera, file) are now built into the SearchBar
              // so we don't need to pass them as rightIcons anymore
            />
          </div>

          {/* Ad Banner */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto mb-6 p-4 rounded-2xl bg-gradient-to-br from-[#FFEB3B]/20 to-[#FFC107]/20 backdrop-blur-xl border-2 border-yellow-400/60"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-yellow-200 mb-1">Sponsored</div>
                <div className="text-sm font-semibold text-white">
                  Truegle Premium - Ad-Free Experience
                </div>
              </div>
              <button className="px-6 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-semibold">
                Upgrade Now
              </button>
            </div>
          </motion.div>

          {/* Category Bar */}
          <CategoryBar
            activeCategory="all"
            onCategoryChange={() => {}}
          />
        </div>
      </div>

      {/* Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-black p-8 rounded-2xl border-2 border-red-500">
            <h2 className="text-3xl font-bold text-red-500 mb-6 text-center">WARNING!</h2>
            <p className="text-white text-lg mb-8 text-center">
              Are you sure you want to switch to Red Pill mode?
            </p>
            <div className="flex justify-center gap-6">
              <button
                onClick={confirmRedPill}
                className="px-8 py-4 bg-gradient-to-r from-red-600 to-red-800 text-white font-bold rounded-xl"
              >
                YES
              </button>
              <button
                onClick={() => setShowWarning(false)}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold rounded-xl"
              >
                NO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
