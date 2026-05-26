// IntegratedBackground.jsx
// PHASE 0: Minimal test version for systematic layer implementation
// Original backup saved as IntegratedBackground.jsx.backup-full

import { useState, useEffect, useRef, memo } from 'react';

// =============================================================================
// LAYER IMPORTS - Uncomment one at a time during testing
// =============================================================================
// import Iridescence from './Iridescence';
import Galaxy from './Galaxy';
// import Particles from './Particles';

// =============================================================================
// CONFIGURATION - Adjust these to test different layers
// =============================================================================
const ACTIVE_LAYER = 'galaxy'; // Options: 'none', 'iridescence', 'galaxy', 'particles'
const DEBUG_MODE = false;

// Static config values
const IRIDESCENCE_COLOR = [0.15, 0.15, 0.25];
const PARTICLE_COLORS = ['#ffffff', '#a0a0ff', '#c0c0ff'];

function IntegratedBackground() {
  const [webGLAvailable, setWebGLAvailable] = useState(true);
  const [deviceTier, setDeviceTier] = useState('high');
  const isInitializedRef = useRef(false);
  const containerRef = useRef(null);

  // Debug logging
  if (DEBUG_MODE) {
    console.log('[IntegratedBackground] Rendering - Active Layer:', ACTIVE_LAYER);
  }

  // Detect WebGL support and device tier - only once
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const detectWebGL = () => {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        const available = !!gl;
        setWebGLAvailable(available);
        if (DEBUG_MODE) {
          console.log('[IntegratedBackground] WebGL available:', available);
        }
      } catch (e) {
        setWebGLAvailable(false);
        if (DEBUG_MODE) {
          console.log('[IntegratedBackground] WebGL detection error:', e);
        }
      }
    };

    const determineDeviceTier = () => {
      if ('hardwareConcurrency' in navigator) {
        const cores = navigator.hardwareConcurrency;
        const tier = cores < 4 ? 'low' : cores < 8 ? 'medium' : 'high';
        setDeviceTier(tier);
        if (DEBUG_MODE) {
          console.log('[IntegratedBackground] Device tier:', tier, '(cores:', cores, ')');
        }
      }
    };

    detectWebGL();
    determineDeviceTier();
  }, []);

  // Animation pause on tab blur
  useEffect(() => {
    const handleBlur = () => document.body.classList.add('animations-paused');
    const handleFocus = () => document.body.classList.remove('animations-paused');
    const handleVisibilityChange = () => {
      document.hidden
        ? document.body.classList.add('page-hidden')
        : document.body.classList.remove('page-hidden');
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // =============================================================================
  // RENDER ACTIVE LAYER
  // =============================================================================
  const renderActiveLayer = () => {
    switch (ACTIVE_LAYER) {
      case 'iridescence':
        // Uncomment import above before using
        // return (
        //   <div className="absolute inset-0" style={{ border: DEBUG_MODE ? '2px solid cyan' : 'none' }}>
        //     <Iridescence
        //       color={IRIDESCENCE_COLOR}
        //       mouseReact={false}
        //       amplitude={0.1}
        //       speed={0.5}
        //     />
        //   </div>
        // );
        return <div className="absolute inset-0 flex items-center justify-center text-white">Iridescence layer - uncomment import</div>;

      case 'galaxy':
        return (
          <div className="absolute inset-0" style={{ border: DEBUG_MODE ? '2px solid magenta' : 'none' }}>
            <Galaxy
              mouseInteraction={true}
              mouseRepulsion={true}
              density={1.5}
              glowIntensity={0.5}
              saturation={0.7}
              hueShift={220}
              transparent={true}
              speed={0.9}
              twinkleIntensity={0.4}
              rotationSpeed={0.02}
              repulsionStrength={2}
            />
          </div>
        );

      case 'particles':
        // Uncomment import above before using
        // return (
        //   <div className="absolute inset-0" style={{ border: DEBUG_MODE ? '2px solid yellow' : 'none' }}>
        //     <Particles
        //       particleColors={PARTICLE_COLORS}
        //       particleCount={150}
        //       particleSpread={12}
        //       speed={0.15}
        //       particleBaseSize={60}
        //       alphaParticles={true}
        //     />
        //   </div>
        // );
        return <div className="absolute inset-0 flex items-center justify-center text-white">Particles layer - uncomment import</div>;

      case 'none':
      default:
        return null;
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full overflow-hidden"
      style={{
        // Gradient background to verify container visibility
        background: 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0a1a2e 100%)',
        zIndex: 0,
      }}
    >
      {/* Debug overlay - shows container is rendering */}
      {DEBUG_MODE && (
        <div
          className="absolute top-2 left-2 px-3 py-1 rounded text-xs font-mono z-50"
          style={{ background: 'rgba(0,255,0,0.2)', color: '#0f0', border: '1px solid #0f0' }}
        >
          BG Container OK | Layer: {ACTIVE_LAYER} | WebGL: {webGLAvailable ? 'Yes' : 'No'} | Tier: {deviceTier}
        </div>
      )}

      {/* Active layer renders here */}
      {renderActiveLayer()}
    </div>
  );
}

export default memo(IntegratedBackground);