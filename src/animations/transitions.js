import { detectPerformanceTier } from '../utils/performance';

/**
 * Combined Desktop & Mobile Animation System for "Cosmic Search Portal"
 */

// Platform detection
const getPlatform = () => {
  const isMobile = window.innerWidth <= 768 || 
                   'ontouchstart' in window ||
                   navigator.maxTouchPoints > 0;
  
  const isReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  
  return {
    platform: isMobile ? 'mobile' : 'desktop',
    reducedMotion: isReducedMotion,
    performanceTier: detectPerformanceTier()
  };
};

// Animation configuration based on platform
const getAnimationConfig = (platform) => {
  const baseConfig = {
    desktop: {
      totalDuration: 5000, // 5s
      cameraDolly: 800,
      layers: 5,
      particleCount: 100,
      logoPeakScale: 6.0,
      prismHeight: 600,
      touchGestures: false
    },
    mobile: {
      totalDuration: 3500, // 3.5s
      cameraDolly: 400,
      layers: 3,
      particleCount: 40, // 40% of desktop
      logoPeakScale: 4.0,
      prismHeight: 300,
      touchGestures: true
    }
  };

  return baseConfig[platform];
};

// Prism animation configuration
const prismAnimation = {
  getConfig: (platform) => {
    const config = getAnimationConfig(platform);
    return {
      glow: { 
        intensity: platform === 'desktop' ? "0 → 1" : "0 → 0.8", 
        duration: platform === 'desktop' ? "3s" : "2s" 
      },
      colorFrequency: platform === 'desktop' ?
        { start: 1.0, end: 0.0, curve: "ease-in-out" } :
        { start: 1.0, end: 0.2, curve: "ease-out" },
      height: platform === 'desktop' ?
        { value: `0px → ${config.prismHeight}px`, duration: "4s" } :
        { value: `0px → ${(window.innerHeight * 0.4)}px`, duration: "2.5s" },
      opacity: platform === 'desktop' ?
        { start: 1.0, end: 0.0, fadeStart: "4.0s" } :
        { start: 1.0, end: 0.0, fadeStart: "3.0s" }
    };
  }
};

// Laser flow system configuration
const laserConfig = {
  getConfig: (platform) => {
    return platform === 'desktop' ? {
      segments: 20,
      width: "3px",
      glowRadius: "25px",
      trailLength: "200px",
      colorTransition: "1.2s ease-in-out"
    } : {
      segments: 12,                    // Fewer segments
      width: "2px",                    // Thinner line
      glowRadius: "15px",              // Smaller glow
      trailLength: "100px",            // Shorter trail
      colorTransition: "0.8s ease-out"
    };
  }
};

// Logo scaling configuration
const logoAnimation = {
  calculateScale: (platform, viewportWidth) => {
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
  }
};

// Aurora properties based on platform
const getAuroraProperties = (platform) => {
  if (platform === 'desktop') {
    return {
      wispDensity: [0, 1.0],
      wispSpeed: [1.0, 4.0],
      wispIntensity: [0, 1.0],
      flowSpeed: [1.0, 3.5],
      fogIntensity: [0, 1.0],
      fogScale: [1.0, 3.0],
      fogFallSpeed: [1.0, 2.5],
      decay: [0, 1.0],
      falloffStart: [0, 1.0]
    };
  } else {
    // Mobile-optimized values (60-80% of desktop)
    return {
      wispDensity: [0, 0.6],      // Reduced particle count
      wispSpeed: [1.0, 2.5],      // Slower movement
      wispIntensity: [0, 0.7],    // Lower brightness
      flowSpeed: [1.0, 2.0],      // Reduced flow
      fogIntensity: [0, 0.5],     // Less fog
      fogScale: [1.0, 1.8],       // Smaller fog scale
      fogFallSpeed: [1.0, 1.8],   // Slower falling
      decay: [0, 0.6],            // Less trail decay
      falloffStart: [0, 0.7]      // Adjusted falloff
    };
  }
};

// Mobile gesture support
const mobileGestures = {
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
};

// Fallback system for reduced motion or low-end devices
const getFallbackAnimation = (platform, reducedMotion) => {
  if (reducedMotion) {
    return {
      duration: "0.5s",
      effects: ["fade"],
      complexity: "minimal"
    };
  }
  
  if (platform === 'mobile' && isLowEndDevice()) {
    return {
      duration: "2.0s",
      effects: ["logoScale", "colorTransition"],
      disable: ["particles", "fog", "3dParallax"]
    };
  }
  
  return null; // Use full animation
};

// Helper function to detect low-end devices
const isLowEndDevice = () => {
  // Simple heuristic based on device memory and hardware concurrency
  const deviceMemory = navigator.deviceMemory || 4; // Default to 4GB if not available
  const hardwareConcurrency = navigator.hardwareConcurrency || 4; // Default to 4 cores
  
  return deviceMemory < 4 || hardwareConcurrency < 4;
};

// Main animation timeline
class PyramidElevationTimeline {
  constructor(options = {}) {
    this.options = options;
    this.platformInfo = getPlatform();
    this.config = getAnimationConfig(this.platformInfo.platform);
    this.isCancelled = false;
  }

  async start() {
    const { platform, reducedMotion } = this.platformInfo;
    
    // Check for fallback conditions
    const fallback = getFallbackAnimation(platform, reducedMotion);
    if (fallback) {
      this.runFallbackAnimation(fallback);
      return;
    }

    // Initialize platform-specific settings
    if (platform === 'mobile') {
      this.disableMouseEventsTemporarily();
      if ('vibrate' in navigator) navigator.vibrate(10);
    }

    // Phase 1: Initiation (0.0s - 0.5s)
    await this.phaseInitiation();

    // Phase 2: Camera Engage (Desktop: 0.5s-2.0s, Mobile: 0.5s-1.5s)
    await this.phaseCameraEngage();

    // Phase 3: Dimensional Shift (Desktop: 2.0s-3.5s, Mobile: 1.5s-2.5s)
    await this.phaseDimensionalShift();

    // Phase 4: Aurora Maxima (Desktop: 3.5s-4.5s, Mobile: 2.5s-3.2s)
    await this.phaseAuroraMaxima();

    // Phase 5: Transition Out (Desktop: 4.5s-5.0s, Mobile: 3.2s-3.5s)
    await this.phaseTransitionOut();

    // Cleanup and transition to search results
    this.onComplete();
  }

  async phaseInitiation() {
    const { platform } = this.platformInfo;
    const duration = platform === 'desktop' ? 500 : 500; // 0.5s for both
    
    // Apply initiation effects
    this.applyRippleEffect(platform);
    this.applyVibrationEffect(platform);
    this.activateSearchBarGlow();
    this.beginUIElementPulse();
    
    // Wait for duration
    await this.delay(duration);
  }

  async phaseCameraEngage() {
    const { platform } = this.platformInfo;
    const duration = platform === 'desktop' ? 1500 : 1000; // 1.5s desktop, 1.0s mobile
    
    // Apply camera dolly effect
    this.applyCameraDolly(platform);
    
    // Apply parallax layers
    this.applyParallaxLayers(platform);
    
    // Scale logo
    this.scaleLogo(platform);
    
    // Wait for duration
    await this.delay(duration);
  }

  async phaseDimensionalShift() {
    const { platform } = this.platformInfo;
    const duration = platform === 'desktop' ? 1500 : 1000; // 1.5s desktop, 1.0s mobile
    
    // Activate prism
    this.activatePrism(platform);
    
    // Apply laser transition
    this.applyLaserTransition(platform);
    
    // Wait for duration
    await this.delay(duration);
  }

  async phaseAuroraMaxima() {
    const { platform } = this.platformInfo;
    const duration = platform === 'desktop' ? 1000 : 700; // 1.0s desktop, 0.7s mobile
    
    // Apply aurora effects
    this.applyAuroraEffects(platform);
    
    // Apply performance optimizations for mobile
    if (platform === 'mobile') {
      this.applyMobilePerformanceOptimizations();
    }
    
    // Wait for duration
    await this.delay(duration);
  }

  async phaseTransitionOut() {
    const { platform } = this.platformInfo;
    const duration = platform === 'desktop' ? 500 : 300; // 0.5s desktop, 0.3s mobile
    
    // Apply logo exit animation
    this.applyLogoExit(platform);
    
    // Apply fade to black
    this.applyFadeToBlack(platform);
    
    // Apply prism exit
    this.applyPrismExit(platform);
    
    // Wait for duration
    await this.delay(duration);
  }

  // Individual animation methods
  applyRippleEffect(platform) {
    const radius = platform === 'desktop' ? '120px' : '80px';
    // Add ripple effect to search bar
    const rippleElement = document.querySelector('.search-ripple');
    if (rippleElement) {
      rippleElement.style.width = radius;
      rippleElement.style.height = radius;
      rippleElement.classList.add('active');
    }
  }

  applyVibrationEffect(platform) {
    const intensity = platform === 'desktop' ? 0.1 : 0.05;
    if (platform === 'mobile' && 'vibrate' in navigator) {
      navigator.vibrate(intensity * 100); // Convert to milliseconds
    }
  }

  activateSearchBarGlow() {
    const searchBar = document.querySelector('.search-bar');
    if (searchBar) {
      searchBar.classList.add('glowing');
    }
  }

  beginUIElementPulse() {
    const uiElements = document.querySelectorAll('.ui-element');
    uiElements.forEach(el => el.classList.add('pulsing'));
  }

  applyCameraDolly(platform) {
    const distance = platform === 'desktop' ? '600px' : '300px';
    const perspective = platform === 'desktop' ? '1200px' : '800px';
    
    const container = document.querySelector('.animation-container') || document.body;
    container.style.perspective = perspective;
    container.style.transform = `translateZ(-${distance})`;
  }

  applyParallaxLayers(platform) {
    const layers = platform === 'desktop' ? 5 : 3;
    const layerElements = document.querySelectorAll('.parallax-layer');
    
    layerElements.forEach((layer, index) => {
      if (index < layers) {
        const factor = platform === 'desktop' 
          ? [1.3, 0.8, 0.6, 0.4, 0.2][index] 
          : [1.2, 0.9, 0.7][index];
          
        layer.style.transform = `translateZ(${factor * -100}px)`;
        layer.style.opacity = platform === 'desktop' ? 0.2 : 0.1;
      }
    });
  }

  scaleLogo(platform) {
    const logo = document.querySelector('.logo');
    if (logo) {
      const scale = platform === 'desktop' ? 2.5 : 2.0;
      logo.style.transform = `scale(${scale})`;
    }
  }

  activatePrism(platform) {
    const config = getAnimationConfig(platform);
    const prism = document.querySelector('.prism-effect');
    
    if (prism) {
      // Apply glow effect
      prism.style.opacity = platform === 'desktop' ? '0.8' : '0.7';
      prism.style.height = `${config.prismHeight}px`;
      
      // Apply solidification effect
      prism.style.background = `linear-gradient(45deg, 
        rgba(59, 130, 246, ${platform === 'desktop' ? 0.2 : 0.3}), 
        rgba(251, 191, 36, ${platform === 'desktop' ? 0.8 : 0.7}))`;
    }
  }

  applyLaserTransition(platform) {
    const laser = document.querySelector('.laser-effect');
    if (laser) {
      // Apply color shift
      laser.style.background = `linear-gradient(to right, #3B82F6, #FBBF24)`;
      
      // Apply trail effect
      const duration = platform === 'desktop' ? '1.2s' : '0.8s';
      laser.style.transition = `all ${duration} ease-out`;
      laser.style.width = platform === 'desktop' ? '300%' : '200%';
      laser.style.opacity = platform === 'mobile' ? '0.8' : '0.9';
    }
  }

  applyAuroraEffects(platform) {
    const aurora = document.querySelector('.aurora-effect');
    if (aurora) {
      const properties = getAuroraProperties(platform);
      
      // Apply aurora properties
      aurora.style.setProperty('--wisp-density', properties.wispDensity[1]);
      aurora.style.setProperty('--wisp-speed', properties.wispSpeed[1]);
      aurora.style.setProperty('--wisp-intensity', properties.wispIntensity[1]);
      aurora.style.setProperty('--flow-speed', properties.flowSpeed[1]);
      aurora.style.setProperty('--fog-intensity', properties.fogIntensity[1]);
      aurora.style.setProperty('--fog-scale', properties.fogScale[1]);
      aurora.style.setProperty('--fog-fall-speed', properties.fogFallSpeed[1]);
      aurora.style.setProperty('--decay', properties.decay[1]);
      aurora.style.setProperty('--falloff-start', properties.falloffStart[1]);
      
      aurora.classList.add('active');
    }
  }

  applyMobilePerformanceOptimizations() {
    // Apply performance optimizations for mobile
    document.body.classList.add('mobile-performance-mode');
  }

  applyLogoExit(platform) {
    const logo = document.querySelector('.logo');
    if (logo) {
      const descent = platform === 'desktop' ? '800px' : '400px';
      logo.style.transform += ` translateY(${descent})`;
      logo.style.opacity = '0';
    }
  }

  applyFadeToBlack(platform) {
    const fadeOverlay = document.querySelector('.fade-overlay') || this.createFadeOverlay();
    const duration = platform === 'desktop' ? '0.5s' : '0.3s';
    
    fadeOverlay.style.transition = `opacity ${duration} ease-in`;
    fadeOverlay.style.opacity = '1';
  }

  applyPrismExit(platform) {
    const prism = document.querySelector('.prism-effect');
    if (prism) {
      const exitTime = platform === 'desktop' ? 4500 : 3200; // Time when exit starts
      
      setTimeout(() => {
        prism.style.opacity = '0';
        prism.style.visibility = 'hidden';
      }, exitTime);
    }
  }

  createFadeOverlay() {
    let fadeOverlay = document.querySelector('.fade-overlay');
    if (!fadeOverlay) {
      fadeOverlay = document.createElement('div');
      fadeOverlay.className = 'fade-overlay';
      fadeOverlay.style.position = 'fixed';
      fadeOverlay.style.top = '0';
      fadeOverlay.style.left = '0';
      fadeOverlay.style.width = '100%';
      fadeOverlay.style.height = '100%';
      fadeOverlay.style.backgroundColor = 'black';
      fadeOverlay.style.zIndex = '9999';
      fadeOverlay.style.opacity = '0';
      fadeOverlay.style.pointerEvents = 'none';
      
      document.body.appendChild(fadeOverlay);
    }
    return fadeOverlay;
  }

  disableMouseEventsTemporarily() {
    document.body.style.pointerEvents = 'none';
    setTimeout(() => {
      document.body.style.pointerEvents = 'auto';
    }, this.config.totalDuration);
  }

  runFallbackAnimation(fallback) {
    // Simple fade animation for reduced motion or low-end devices
    const elements = document.querySelectorAll('.animation-element');
    elements.forEach(el => {
      el.style.transition = `opacity ${fallback.duration} ease`;
      el.style.opacity = '0';
    });
  }

  onComplete() {
    const { platform } = this.platformInfo;
    if (platform === 'mobile') {
      this.restoreTouchEvents();
    }
    
    // Trigger search results page
    this.showSearchResults();
  }

  restoreTouchEvents() {
    document.body.style.pointerEvents = 'auto';
  }

  showSearchResults() {
    // Placeholder for transitioning to search results
    console.log('Transitioning to search results...');
  }

  delay(ms) {
    return new Promise(resolve => {
      if (!this.isCancelled) {
        setTimeout(resolve, ms);
      } else {
        resolve();
      }
    });
  }

  cancel() {
    this.isCancelled = true;
  }
}

// Export the main animation function
export const startPyramidElevationAnimation = (options = {}) => {
  const timeline = new PyramidElevationTimeline(options);
  return timeline.start();
};

// Export platform detection for other modules
export { getPlatform, getAnimationConfig };