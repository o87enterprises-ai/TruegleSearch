/**
 * Fallback Animation System
 * Provides alternative animations for reduced motion and poor performance scenarios
 */

// Check if user prefers reduced motion
export const prefersReducedMotion = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Check if device has limited performance
export const isLowPerformanceDevice = () => {
  const hardwareConcurrency = navigator.hardwareConcurrency || 4;
  const deviceMemory = navigator.deviceMemory || 4; // In GB

  return hardwareConcurrency < 4 || deviceMemory < 4;
};

// Get appropriate animation settings based on user preferences and device capabilities
export const getAnimationSettings = () => {
  const reducedMotion = prefersReducedMotion();
  const lowPerformance = isLowPerformanceDevice();
  
  if (reducedMotion && lowPerformance) {
    return {
      type: 'minimal',
      duration: 300,
      effects: ['fade'],
      disable: ['transform', 'filter', 'animation'],
      complexity: 'minimal',
      fps: 30
    };
  } else if (reducedMotion) {
    return {
      type: 'reduced',
      duration: 500,
      effects: ['fade', 'simple-transform'],
      disable: ['complex-animation', 'filter'],
      complexity: 'low',
      fps: 60
    };
  } else if (lowPerformance) {
    return {
      type: 'performance-optimized',
      duration: 1000,
      effects: ['fade', 'transform'],
      disable: ['complex-filter', 'heavy-animation'],
      complexity: 'medium',
      fps: 30
    };
  } else {
    return {
      type: 'full',
      duration: 1000,
      effects: ['fade', 'transform', 'filter', 'animation'],
      disable: [],
      complexity: 'high',
      fps: 60
    };
  }
};

// Note: JSX components have been removed from this utility file to avoid parsing errors.
// These would need to be in a separate .jsx file if needed.

// Fallback animation settings
export const getAnimationSettings = () => {
  const reducedMotion = prefersReducedMotion();
  const lowPerformance = isLowPerformanceDevice();

  if (reducedMotion && lowPerformance) {
    return {
      type: 'minimal',
      duration: 300,
      effects: ['fade'],
      disable: ['transform', 'filter', 'animation'],
      complexity: 'minimal',
      fps: 30
    };
  } else if (reducedMotion) {
    return {
      type: 'reduced',
      duration: 500,
      effects: ['fade', 'simple-transform'],
      disable: ['complex-animation', 'filter'],
      complexity: 'low',
      fps: 60
    };
  } else if (lowPerformance) {
    return {
      type: 'performance-optimized',
      duration: 1000,
      effects: ['fade', 'transform'],
      disable: ['complex-filter', 'heavy-animation'],
      complexity: 'medium',
      fps: 30
    };
  } else {
    return {
      type: 'full',
      duration: 1000,
      effects: ['fade', 'transform', 'filter', 'animation'],
      disable: [],
      complexity: 'high',
      fps: 60
    };
  }
};

// Fallback animation controller
export class FallbackAnimationController {
  constructor() {
    this.settings = getAnimationSettings();
    this.isActive = false;
  }

  shouldUseFallback() {
    return this.settings.type !== 'full';
  }

  getAnimationProps(componentType) {
    switch (componentType) {
      case 'background':
        return {
          duration: this.settings.duration,
          effects: this.settings.effects,
          disabledFeatures: this.settings.disable
        };
      case 'transition':
        return {
          duration: this.settings.duration * 0.6, // Faster transitions for fallback
          easing: 'ease-out'
        };
      case 'interactive':
        return {
          duration: this.settings.duration * 0.8,
          easing: 'ease-in-out',
          feedback: 'subtle'
        };
      default:
        return {
          duration: this.settings.duration,
          easing: 'ease-out'
        };
    }
  }

  activate() {
    this.isActive = true;
  }

  deactivate() {
    this.isActive = false;
  }
}

// Singleton fallback controller
export const fallbackController = new FallbackAnimationController();

export default fallbackController;