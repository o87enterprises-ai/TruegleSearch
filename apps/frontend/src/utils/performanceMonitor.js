/**
 * Performance Monitoring and Adaptive Effects System
 * Implements adaptive performance adjustments based on device capabilities and real-time metrics
 */

// Performance monitoring utilities
export class PerformanceMonitor {
  constructor() {
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fps = 60;
    this.lowFPSThreshold = 30;
    this.highFPSThreshold = 50;
    this.isLowPerformance = false;
    this.adjustmentCallback = null;
  }

  // Start monitoring frame rate
  startMonitoring() {
    const checkFrameRate = () => {
      this.frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - this.lastTime >= 1000) {
        this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
        this.frameCount = 0;
        this.lastTime = currentTime;
        
        // Determine if performance is low based on FPS
        this.isLowPerformance = this.fps < this.lowFPSThreshold;
        
        // Call adjustment callback if registered
        if (this.adjustmentCallback) {
          this.adjustmentCallback(this.fps, this.isLowPerformance);
        }
      }
      
      requestAnimationFrame(checkFrameRate);
    };
    
    checkFrameRate();
  }

  // Register a callback for performance adjustments
  registerAdjustmentCallback(callback) {
    this.adjustmentCallback = callback;
  }

  // Get current performance metrics
  getMetrics() {
    return {
      fps: this.fps,
      isLowPerformance: this.isLowPerformance,
      performanceTier: this.getPerformanceTier()
    };
  }

  // Determine performance tier based on FPS
  getPerformanceTier() {
    if (this.fps < this.lowFPSThreshold) return 'low';
    if (this.fps < this.highFPSThreshold) return 'medium';
    return 'high';
  }
}

// Adaptive effects based on performance tier
export const getAdaptiveEffectsByPerformance = (performanceTier) => {
  const effects = {
    particleCount: 100,
    quality: 'low',
    layers: 1,
    parallaxEnabled: false,
    fogResolution: 256,
    animationComplexity: 'minimal'
  };

  switch (performanceTier) {
    case 'high':
      effects.particleCount = 500;
      effects.quality = 'high';
      effects.layers = 5;
      effects.parallaxEnabled = true;
      effects.fogResolution = 512;
      effects.animationComplexity = 'full';
      break;
    case 'medium':
      effects.particleCount = 250;
      effects.quality = 'medium';
      effects.layers = 3;
      effects.parallaxEnabled = true;
      effects.fogResolution = 384;
      effects.animationComplexity = 'moderate';
      break;
    case 'low':
    default:
      effects.particleCount = 100;
      effects.quality = 'low';
      effects.layers = 1;
      effects.parallaxEnabled = false;
      effects.fogResolution = 256;
      effects.animationComplexity = 'minimal';
      break;
  }

  return effects;
};

// Performance-based animation quality adjustment
export const adjustAnimationQuality = (currentQuality, performanceMetrics) => {
  const { fps, performanceTier } = performanceMetrics;
  
  if (fps < 30) {
    // Severe performance issues - reduce to minimal
    return {
      ...getAdaptiveEffectsByPerformance('low'),
      durationMultiplier: 1.2, // Slow down animations to save resources
      disableShadows: true,
      disableReflections: true
    };
  } else if (fps < 50) {
    // Moderate performance issues - reduce complexity
    return {
      ...getAdaptiveEffectsByPerformance(performanceTier),
      durationMultiplier: 1.1,
      disableShadows: false,
      disableReflections: true
    };
  } else {
    // Good performance - allow full effects
    return {
      ...getAdaptiveEffectsByPerformance(performanceTier),
      durationMultiplier: 1.0,
      disableShadows: false,
      disableReflections: false
    };
  }
};

// Device memory and hardware concurrency based optimization
export const getDeviceBasedOptimization = () => {
  const hardwareConcurrency = navigator.hardwareConcurrency || 4;
  const deviceMemory = navigator.deviceMemory || 4; // In GB

  // Determine device tier based on hardware specs
  let deviceTier = 'low';
  if (hardwareConcurrency >= 8 && deviceMemory >= 8) {
    deviceTier = 'high';
  } else if (hardwareConcurrency >= 4 && deviceMemory >= 4) {
    deviceTier = 'medium';
  }

  return {
    deviceTier,
    hardwareConcurrency,
    deviceMemory,
    isLowEndDevice: deviceTier === 'low',
    isHighEndDevice: deviceTier === 'high'
  };
};

// Battery level based optimization (if available)
export const getBatteryBasedOptimization = async () => {
  if ('getBattery' in navigator) {
    try {
      const battery = await navigator.getBattery();
      return {
        batteryLevel: battery.level * 100,
        isCharging: battery.charging,
        shouldReduceAnimations: battery.level < 0.2 && !battery.charging
      };
    } catch (e) {
      console.warn('Could not access battery information:', e);
      return {
        batteryLevel: 100,
        isCharging: true,
        shouldReduceAnimations: false
      };
    }
  }
  
  return {
    batteryLevel: 100,
    isCharging: true,
    shouldReduceAnimations: false
  };
};

// Network quality based optimization
export const getNetworkBasedOptimization = () => {
  if ('connection' in navigator) {
    const connection = navigator.connection;
    const downlink = connection.downlink || 10; // MB/s
    const effectiveType = connection.effectiveType || '4g';

    let networkQuality = 'good';
    if (effectiveType === 'slow-2g' || effectiveType === '2g' || downlink < 1) {
      networkQuality = 'poor';
    } else if (effectiveType === '3g' || downlink < 2) {
      networkQuality = 'moderate';
    }

    return {
      networkQuality,
      downlink,
      effectiveType,
      shouldReduceAssets: networkQuality !== 'good'
    };
  }

  return {
    networkQuality: 'unknown',
    downlink: 10,
    effectiveType: '4g',
    shouldReduceAssets: false
  };
};

// Combined optimization profile
export const getOptimizationProfile = async () => {
  const deviceOpt = getDeviceBasedOptimization();
  const batteryOpt = await getBatteryBasedOptimization();
  const networkOpt = getNetworkBasedOptimization();
  
  // Determine overall optimization level based on all factors
  const factors = [
    deviceOpt.isLowEndDevice ? 1 : 0,
    batteryOpt.shouldReduceAnimations ? 1 : 0,
    networkOpt.shouldReduceAssets ? 1 : 0
  ];
  
  const optimizationScore = factors.reduce((sum, val) => sum + val, 0);
  
  let optimizationLevel = 'aggressive';
  if (optimizationScore === 0) {
    optimizationLevel = 'minimal'; // High-end device with good battery and network
  } else if (optimizationScore === 1) {
    optimizationLevel = 'moderate'; // One constraint
  } else {
    optimizationLevel = 'aggressive'; // Multiple constraints
  }
  
  return {
    deviceOpt,
    batteryOpt,
    networkOpt,
    optimizationLevel,
    shouldOptimize: optimizationScore > 0
  };
};

// Apply optimizations to animation parameters
export const applyOptimizations = (originalParams, optimizationProfile) => {
  const { optimizationLevel, deviceOpt } = optimizationProfile;
  
  // Create a copy of the original parameters
  const optimizedParams = { ...originalParams };
  
  switch (optimizationLevel) {
    case 'aggressive':
      // Maximum optimization
      optimizedParams.particleCount = Math.max(20, Math.floor(originalParams.particleCount * 0.3));
      optimizedParams.quality = 'low';
      optimizedParams.layers = Math.max(1, Math.floor(originalParams.layers * 0.4));
      optimizedParams.parallaxEnabled = false;
      optimizedParams.durationMultiplier = 1.3;
      optimizedParams.fogResolution = 128;
      optimizedParams.animationComplexity = 'minimal';
      break;
      
    case 'moderate':
      // Moderate optimization
      optimizedParams.particleCount = Math.max(50, Math.floor(originalParams.particleCount * 0.6));
      optimizedParams.quality = deviceOpt.deviceTier === 'high' ? 'medium' : 'low';
      optimizedParams.layers = Math.max(2, Math.floor(originalParams.layers * 0.7));
      optimizedParams.parallaxEnabled = deviceOpt.deviceTier !== 'low';
      optimizedParams.durationMultiplier = 1.1;
      optimizedParams.fogResolution = deviceOpt.deviceTier === 'high' ? 256 : 192;
      optimizedParams.animationComplexity = 'basic';
      break;
      
    case 'minimal':
    default:
      // Minimal optimization
      optimizedParams.particleCount = originalParams.particleCount;
      optimizedParams.quality = originalParams.quality;
      optimizedParams.layers = originalParams.layers;
      optimizedParams.parallaxEnabled = originalParams.parallaxEnabled;
      optimizedParams.durationMultiplier = originalParams.durationMultiplier || 1.0;
      optimizedParams.fogResolution = originalParams.fogResolution;
      optimizedParams.animationComplexity = originalParams.animationComplexity;
      break;
  }
  
  return optimizedParams;
};

// Performance-aware animation controller
export class AnimationController {
  constructor() {
    this.performanceMonitor = new PerformanceMonitor();
    this.optimizationProfile = null;
    this.isInitialized = false;
  }

  async initialize() {
    // Get optimization profile
    this.optimizationProfile = await getOptimizationProfile();
    
    // Start performance monitoring
    this.performanceMonitor.startMonitoring();
    
    // Register adjustment callback
    this.performanceMonitor.registerAdjustmentCallback((fps, isLowPerformance) => {
      this.handlePerformanceChange(fps, isLowPerformance);
    });
    
    this.isInitialized = true;
  }

  handlePerformanceChange(fps, isLowPerformance) {
    // Adjust animations based on performance
    if (isLowPerformance) {
      console.warn(`Performance warning: FPS dropped to ${fps}. Consider reducing animation complexity.`);
      // Could trigger animation quality reduction here
    }
  }

  getOptimizedParams(originalParams) {
    if (!this.isInitialized || !this.optimizationProfile) {
      return originalParams;
    }
    
    return applyOptimizations(originalParams, this.optimizationProfile);
  }

  getPerformanceMetrics() {
    return this.performanceMonitor.getMetrics();
  }
}

// Singleton instance
export const animationController = new AnimationController();

// Initialize the controller
animationController.initialize().catch(console.error);

export default animationController;