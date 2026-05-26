/**
 * Platform-Aware Animation Configuration System
 * Implements the Cosmic Search Portal animation system with desktop/mobile differentiation
 */

// Device detection and configuration
export const getAnimationConfig = () => {
  const isMobile = window.innerWidth <= 768 || 
                   'ontouchstart' in window ||
                   navigator.maxTouchPoints > 0;
  
  const isReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  
  return {
    platform: isMobile ? 'mobile' : 'desktop',
    reducedMotion: isReducedMotion,
    performanceTier: detectPerformanceTier(),
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  };
};

// Performance tier detection based on device capabilities
export const detectPerformanceTier = () => {
  // Check for low-end devices based on hardware concurrency and memory
  const hardwareConcurrency = navigator.hardwareConcurrency || 4;
  const deviceMemory = navigator.deviceMemory || 4; // In GB
  
  if (hardwareConcurrency < 4 || deviceMemory < 4) {
    return 'low';
  } else if (hardwareConcurrency < 8 || deviceMemory < 8) {
    return 'medium';
  } else {
    return 'high';
  }
};

// Unified animation timeline configuration
export const ANIMATION_TIMELINE = {
  // Phase 1: Initiation (0.0s - 0.5s)
  INITIATION: {
    desktop: {
      duration: 0.5,
      rippleRadius: 120,
      vibrationIntensity: 0.1,
      activationSound: 'soft_click.wav'
    },
    mobile: {
      duration: 0.5,
      rippleRadius: 80,
      vibrationIntensity: 0.05,
      hapticFeedback: 'lightTap'
    }
  },

  // Phase 2: Camera Engage
  CAMERA_ENGAGE: {
    desktop: {
      duration: 1.5, // 0.5s to 2.0s
      distance: 600,
      perspective: 1200,
      curve: 'cubic-bezier(0.16, 1, 0.3, 1)'
    },
    mobile: {
      duration: 1.0, // 0.5s to 1.5s
      distance: 300,
      perspective: 800,
      curve: 'cubic-bezier(0.22, 1, 0.36, 1)'
    }
  },

  // Phase 3: Dimensional Shift
  DIMENSIONAL_SHIFT: {
    desktop: {
      duration: 1.5, // 2.0s to 3.5s
      glowDuration: 1.5,
      solidificationFrequency: [1.0, 0.2],
      ascentHeight: 400,
      colorShiftDuration: 1.2,
      colorShiftStart: 2.3,
      trailLength: 300,
      trailOpacity: 0.9
    },
    mobile: {
      duration: 1.0, // 1.5s to 2.5s
      glowDuration: 1.0,
      solidificationFrequency: [1.0, 0.3],
      ascentHeight: 200,
      colorShiftDuration: 0.8,
      colorShiftStart: 1.8,
      trailLength: 200,
      trailOpacity: 0.8
    }
  },

  // Phase 4: Aurora Maxima
  AURORA_MAXIMA: {
    desktop: {
      duration: 1.0, // 3.5s to 4.5s
      wispDensity: [0, 1.0],
      wispSpeed: [1.0, 4.0],
      wispIntensity: [0, 1.0],
      flowSpeed: [1.0, 3.5],
      fogIntensity: [0, 1.0],
      fogScale: [1.0, 3.0],
      fogFallSpeed: [1.0, 2.5],
      decay: [0, 1.0],
      falloffStart: [0, 1.0]
    },
    mobile: {
      duration: 0.7, // 2.5s to 3.2s
      wispDensity: [0, 0.6],      // Reduced particle count
      wispSpeed: [1.0, 2.5],      // Slower movement
      wispIntensity: [0, 0.7],    // Lower brightness
      flowSpeed: [1.0, 2.0],      // Reduced flow
      fogIntensity: [0, 0.5],     // Less fog
      fogScale: [1.0, 1.8],       // Smaller fog scale
      fogFallSpeed: [1.0, 1.8],   // Slower falling
      decay: [0, 0.6],            // Less trail decay
      falloffStart: [0, 0.7]      // Adjusted falloff
    }
  },

  // Phase 5: Transition Out
  TRANSITION_OUT: {
    desktop: {
      duration: 0.5, // 4.5s to 5.0s
      curve: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
      fadeDuration: 0.5,
      fadeCurve: 'ease-in'
    },
    mobile: {
      duration: 0.3, // 3.2s to 3.5s
      curve: 'ease-in',
      fadeDuration: 0.3,
      fadeCurve: 'linear'
    }
  }
};

// Platform-specific component configurations
export const getPrismConfig = (platform) => ({
  glow: platform === 'desktop' 
    ? { intensity: [0, 1], duration: 3000 } 
    : { intensity: [0, 0.8], duration: 2000 },
  
  colorFrequency: platform === 'desktop'
    ? { start: 1.0, end: 0.0, curve: "ease-in-out" }
    : { start: 1.0, end: 0.2, curve: "ease-out" },
  
  height: platform === 'desktop'
    ? { value: [0, 600], duration: 4000 }
    : { value: [0, Math.min(window.innerHeight * 0.4, 300)], duration: 2500 },
  
  opacity: platform === 'desktop'
    ? { start: 1.0, end: 0.0, fadeStart: 4000 }
    : { start: 1.0, end: 0.0, fadeStart: 3000 }
});

export const getLaserConfig = (platform) => ({
  desktop: {
    segments: 20,
    width: "3px",
    glowRadius: "25px",
    trailLength: "200px",
    colorTransition: "1.2s ease-in-out"
  },
  mobile: {
    segments: 12,                    // Fewer segments
    width: "2px",                    // Thinner line
    glowRadius: "15px",              // Smaller glow
    trailLength: "100px",            // Shorter trail
    colorTransition: "0.8s ease-out"
  }
}[platform]);

export const getLogoScaleConfig = (platform, viewportWidth) => {
  if (platform === 'desktop') {
    return {
      peakScale: 6.0,
      keyframes: [
        { time: "0%", scale: 1.0 },
        { time: "50%", scale: 3.0 },
        { time: "70%", scale: 6.0 }
      ]
    };
  } else {
    // Mobile: scale relative to screen size
    const baseScale = viewportWidth < 400 ? 3.5 : 4.0;
    return {
      peakScale: baseScale,
      keyframes: [
        { time: "0%", scale: 1.0 },
        { time: "40%", scale: 2.0 },
        { time: "60%", scale: baseScale }
      ]
    };
  }
};

// Adaptive effects based on platform and performance tier
export const getAdaptiveEffects = (platform, performanceTier) => {
  const configs = {
    desktop: {
      high: { 
        particleCount: 500, 
        quality: 'high',
        layers: 5,
        parallaxEnabled: true
      },
      medium: { 
        particleCount: 250, 
        quality: 'medium',
        layers: 4,
        parallaxEnabled: true
      },
      low: { 
        particleCount: 100, 
        quality: 'low',
        layers: 2,
        parallaxEnabled: false
      }
    },
    mobile: {
      high: { 
        particleCount: 150, 
        quality: 'medium',
        layers: 3,
        parallaxEnabled: true
      },
      medium: { 
        particleCount: 75, 
        quality: 'low',
        layers: 2,
        parallaxEnabled: false
      },
      low: { 
        particleCount: 30, 
        quality: 'minimal',
        layers: 1,
        parallaxEnabled: false
      }
    }
  };
  return configs[platform][performanceTier];
};

// Mobile gesture configurations
export const getMobileGestures = () => ({
  swipeDown: {
    threshold: 100,    // pixels
    velocity: 0.5,     // pixels/ms
    trigger: "startSearchAnimation",
    haptic: "medium"
  },
  
  longPress: {
    duration: 800,     // ms
    trigger: "previewAnimation",
    haptic: "light"
  }
});

// Fallback animation configurations
export const getFallbackAnimation = (platform, reducedMotion) => {
  if (reducedMotion) {
    return {
      duration: 500,
      effects: ["fade"],
      complexity: "minimal"
    };
  }
  
  if (platform === 'mobile' && isLowEndDevice()) {
    return {
      duration: 2000,
      effects: ["logoScale", "colorTransition"],
      disable: ["particles", "fog", "3dParallax"]
    };
  }
  
  return null; // Use full animation
};

// Helper function to check if device is low-end
const isLowEndDevice = () => {
  const config = getAnimationConfig();
  return config.performanceTier === 'low';
};

// Animation trigger function
export const startSearchAnimation = (platform, options = {}) => {
  const config = {
    duration: platform === 'mobile' ? 3500 : 5000,
    intensity: options.intensity || 'full',
    trigger: options.trigger || 'auto'
  };
  
  // Platform-specific initialization
  if (platform === 'mobile') {
    // Optimize for touch
    disableMouseEventsTemporarily();
    if ('vibrate' in navigator) navigator.vibrate(10);
  }
  
  // Return animation timeline configuration
  return {
    platform,
    config,
    timeline: ANIMATION_TIMELINE
  };
};

// Helper function to temporarily disable mouse events
const disableMouseEventsTemporarily = () => {
  // Implementation would go here
};

// Performance monitoring configuration
export const PERFORMANCE_MONITOR = {
  checkFrameRate: () => {
    let frames = 0;
    let lastTime = performance.now();
    
    const check = (callback) => {
      frames++;
      const currentTime = performance.now();
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frames * 1000) / (currentTime - lastTime));
        frames = 0;
        lastTime = currentTime;
        
        callback(fps);
      }
      requestAnimationFrame((time) => check(callback));
    };
    
    return check;
  }
};

// Export default configuration object
export const COSMIC_SEARCH_PORTAL_CONFIG = {
  getAnimationConfig,
  detectPerformanceTier,
  ANIMATION_TIMELINE,
  getPrismConfig,
  getLaserConfig,
  getLogoScaleConfig,
  getAdaptiveEffects,
  getMobileGestures,
  getFallbackAnimation,
  startSearchAnimation,
  PERFORMANCE_MONITOR
};

export default COSMIC_SEARCH_PORTAL_CONFIG;