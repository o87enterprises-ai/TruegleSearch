import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import TruegleLogo from '../components/ui/TruegleLogo';
import SearchBar from '../components/ui/SearchBar';
import FallbackBackground from '../components/backgrounds/FallbackBackground';

export default function SearchPortalDebug() {
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');
  const [debugInfo, setDebugInfo] = useState({
    webglSupported: false,
    canvasCount: 0,
    errors: [],
  });

  useEffect(() => {
    // Check WebGL support
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    const webglSupported = !!(gl && gl instanceof WebGLRenderingContext);
    
    // Count canvas elements
    const canvasCount = document.querySelectorAll('canvas').length;
    
    // Check for any existing errors
    const errors = [];
    if (!webglSupported) errors.push('WebGL not supported');
    if (canvasCount === 0) errors.push('No canvas elements found');
    
    setDebugInfo({
      webglSupported,
      canvasCount,
      errors,
    });
    
    console.log('Debug Info:', { webglSupported, canvasCount, errors });
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchValue.trim()) {
      console.log('Searching for:', searchValue);
    }
  };

  return (
    <div className="relative min-h-0 w-full bg-black">
      {/* Simple CSS background */}
      <FallbackBackground />
      
      {/* Debug info overlay */}
      <div className="fixed top-4 left-4 z-50 p-4 bg-black/80 backdrop-blur-sm rounded-lg border border-cyan-500">
        <h3 className="text-cyan-400 font-bold mb-2">DEBUG MODE</h3>
        <div className="text-white text-sm space-y-1">
          <div>WebGL Supported: <span className={debugInfo.webglSupported ? 'text-green-400' : 'text-red-400'}>
            {debugInfo.webglSupported ? 'Yes' : 'No'}
          </span></div>
          <div>Canvas Count: <span className="text-yellow-400">{debugInfo.canvasCount}</span></div>
          <div>Errors: <span className="text-red-400">{debugInfo.errors.length}</span></div>
          {debugInfo.errors.map((error, i) => (
            <div key={i} className="text-xs text-red-300">• {error}</div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-0 p-8">
        <div className="max-w-7xl mx-auto">
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

          <h1 className="text-3xl font-bold text-white text-center mb-4">
            Debug Mode - Background Animation Test
          </h1>
          <p className="text-white/70 text-center mb-8">
            This version uses CSS-only backgrounds to avoid WebGL errors
          </p>

          {/* Search Bar */}
          <div className="max-w-4xl mx-auto mb-8">
            <SearchBar
              value={searchValue}
              onChange={setSearchValue}
              onSubmit={handleSearch}
              placeholder="Search the web..."
              showPillToggle={true}
            />
          </div>

          {/* Test buttons */}
          <div className="flex flex-col gap-4 max-w-md mx-auto">
            <button
              onClick={() => {
                // Test WebGL
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                if (gl) {
                  alert('WebGL is supported!');
                } else {
                  alert('WebGL is NOT supported');
                }
              }}
              className="px-6 py-3 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500"
            >
              Test WebGL Support
            </button>
            
            <button
              onClick={() => {
                // Count canvas elements
                const count = document.querySelectorAll('canvas').length;
                alert(`Found ${count} canvas element(s)`);
              }}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-500"
            >
              Count Canvas Elements
            </button>
            
            <button
              onClick={() => {
                // Clear console
                console.clear();
                console.log('Console cleared');
              }}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
            >
              Clear Console
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
