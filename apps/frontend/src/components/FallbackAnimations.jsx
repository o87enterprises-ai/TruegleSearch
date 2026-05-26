/**
 * Fallback Animation Components
 * JSX components for fallback animations (separated from utility functions to avoid parsing errors)
 */

import React from 'react';

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

// Simple fallback animation components
export const FadeAnimation = ({ children, duration = 500, delay = 0 }) => {
  const style = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;
  
  return (
    <div 
      style={{
        opacity: 0,
        animation: `fadeIn ${duration}ms ease-out ${delay}ms forwards`
      }}
    >
      <style>{style}</style>
      {children}
    </div>
  );
};

export const SlideAnimation = ({ children, direction = 'up', duration = 500, delay = 0 }) => {
  const translateValue = {
    up: 'translateY(20px)',
    down: 'translateY(-20px)',
    left: 'translateX(20px)',
    right: 'translateX(-20px)'
  }[direction] || 'translateY(20px)';
  
  const style = `
    @keyframes slideIn {
      from { 
        opacity: 0;
        transform: ${translateValue};
      }
      to { 
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  
  return (
    <div 
      style={{
        opacity: 0,
        transform: translateValue,
        animation: `slideIn ${duration}ms ease-out ${delay}ms forwards`
      }}
    >
      <style>{style}</style>
      {children}
    </div>
  );
};

// Fallback background animation for reduced motion/performance
export const FallbackBackground = ({ children, colorStops = ['#8B5CF6', '#06B6D4', '#EC4899'] }) => {
  const prefersReduced = prefersReducedMotion();
  
  const gradientStyle = {
    background: `linear-gradient(45deg, ${colorStops.join(', ')})`,
    backgroundSize: '400% 400%',
    animation: prefersReduced ? 'none' : 'gradientShift 8s ease infinite'
  };
  
  const style = prefersReduced ? '' : `
    @keyframes gradientShift {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
  `;
  
  return (
    <div style={gradientStyle}>
      {style && <style>{style}</style>}
      {children}
    </div>
  );
};

// Fallback animation for the cosmic portal effect
export const CosmicPortalFallback = ({ isActive, platform = 'desktop' }) => {
  const settings = getAnimationSettings();
  
  if (settings.type === 'minimal') {
    // For minimal settings, just show a static background
    const style = `
      .cosmic-portal-fallback {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #000;
      }
      
      .stars {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-image: 
          radial-gradient(2px 2px at 20px 30px, #eee, transparent),
          radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.8), transparent),
          radial-gradient(1px 1px at 90px 40px, #fff, transparent),
          radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.6), transparent),
          radial-gradient(2px 2px at 160px 30px, #ddd, transparent);
        background-repeat: repeat;
        background-size: 200px 100px;
        animation: none;
      }
    `;
    
    return (
      <div className="cosmic-portal-fallback static">
        <style>{style}</style>
        <div className="stars"></div>
      </div>
    );
  }
  
  // For reduced motion but not minimal, show a simpler animation
  const style = `
    .cosmic-portal-fallback {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #000;
      opacity: ${settings.type === 'reduced' ? 0.3 : 0.7};
    }
    
    .stars {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: 
        radial-gradient(2px 2px at 20px 30px, #eee, transparent),
        radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.8), transparent),
        radial-gradient(1px 1px at 90px 40px, #fff, transparent),
        radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.6), transparent),
        radial-gradient(2px 2px at 160px 30px, #ddd, transparent);
      background-repeat: repeat;
      background-size: 200px 100px;
      animation: twinkle ${platform === 'desktop' ? '3s' : '4s'} ease-in-out infinite alternate;
    }
    
    .portal-glow {
      position: absolute;
      top: 50%;
      left: 50%;
      width: ${platform === 'desktop' ? '100px' : '70px'};
      height: ${platform === 'desktop' ? '100px' : '70px'};
      border-radius: 50%;
      background: radial-gradient(circle, rgba(139,92,246,0.8), transparent 70%);
      transform: translate(-50%, -50%);
      opacity: 0;
      animation: ${isActive ? 'portalPulse 2s ease-in-out infinite' : 'none'};
    }
    
    @keyframes twinkle {
      0% { opacity: 0.3; }
      100% { opacity: 0.8; }
    }
    
    @keyframes portalPulse {
      0% { 
        opacity: 0.3;
        transform: translate(-50%, -50%) scale(0.8);
      }
      50% { 
        opacity: 0.8;
        transform: translate(-50%, -50%) scale(1.2);
      }
      100% { 
        opacity: 0.3;
        transform: translate(-50%, -50%) scale(0.8);
      }
    }
  `;
  
  return (
    <div className={`cosmic-portal-fallback ${isActive ? 'active' : ''}`}>
      <style>{style}</style>
      <div className="stars"></div>
      <div className="portal-glow"></div>
    </div>
  );
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

// Higher-order component for adding fallback behavior
export const withFallbackAnimation = (WrappedComponent, animationType = 'default') => {
  return (props) => {
    const shouldUseFallback = fallbackController.shouldUseFallback();
    
    if (shouldUseFallback) {
      const fallbackProps = fallbackController.getAnimationProps(animationType);
      
      // Use a simpler version of the component
      const style = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `;
      
      return (
        <div className="fallback-wrapper" style={{ opacity: 0, animation: `fadeIn ${fallbackProps.duration}ms ease-out forwards` }}>
          <style>{style}</style>
          <WrappedComponent {...props} isFallback={true} fallbackProps={fallbackProps} />
        </div>
      );
    }
    
    // Use the original component
    return <WrappedComponent {...props} />;
  };
};

export default fallbackController;