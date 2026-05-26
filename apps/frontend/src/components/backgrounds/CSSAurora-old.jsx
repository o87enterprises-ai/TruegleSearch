import { useEffect, useRef } from 'react';

/**
 * CSSAurora - CSS-based aurora effect to eliminate WebGL conflicts
 * Uses CSS animations and gradients instead of WebGL
 * Maintains visual aesthetic with zero resource competition
 */
export default function CSSAurora({
  colorStops = ['#8B5CF6', '#06B6D4', '#EC4899'], // Purple, cyan, pink
  intensity = 0.6,
  amplitude = 1.0,
  speed = 0.2,
  className = '',
  style = {},
}) {
  const containerRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create aurora layers using CSS gradients and animations
    const auroraLayer = document.createElement('div');
    auroraLayer.className = 'aurora-layer';

    // Helper function to convert hex to rgba
    const hexToRgba = (hex, alpha) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // Style for aurora layer
    auroraLayer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      opacity: ${intensity};
      will-change: transform, opacity;
      transform: translateZ(0);
      background: linear-gradient(
        135deg,
        transparent 0%,
        ${hexToRgba(colorStops[0], 0.15)} 20%,
        ${hexToRgba(colorStops[1], 0.2)} 40%,
        ${hexToRgba(colorStops[2], 0.1)} 60%,
        transparent 80%
      );
      filter: blur(40px) brightness(1.2);
      animation: auroraWave ${10 / speed}s ease-in-out infinite;
      transform: scaleY(0.8) scaleX(1.2);
    `;

    // Create wave effect layers
    const waveLayer1 = document.createElement('div');
    const waveLayer2 = document.createElement('div');

    waveLayer1.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(
        ellipse at 30% 20%,
        ${colorStops[0]}20 0%,
        transparent 50%
      );
      filter: blur(60px);
      opacity: 0.3;
      animation: auroraMove1 ${15 / speed}s ease-in-out infinite;
      transform: scaleY(1.2);
    `;

    waveLayer2.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(
        ellipse at 70% 30%,
        ${colorStops[1]}15 0%,
        transparent 50%
      );
      filter: blur(80px);
      opacity: 0.2;
      animation: auroraMove2 ${20 / speed}s ease-in-out infinite;
      transform: scaleY(1.5);
    `;

    // Add CSS animations dynamically
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      @keyframes auroraWave {
        0%, 100% {
          opacity: 0;
          transform: translateY(20px) scaleY(0.6);
        }
        50% {
          opacity: ${intensity};
          transform: translateY(0px) scaleY(1.0);
        }
      }

      @keyframes auroraMove1 {
        0%, 100% {
          transform: translateX(0px) translateY(10px) scaleY(1.1);
          opacity: 0.2;
        }
        33% {
          transform: translateX(30px) translateY(-5px) scaleY(1.3);
          opacity: 0.4;
        }
        66% {
          transform: translateX(-20px) translateY(15px) scaleY(0.9);
          opacity: 0.3;
        }
      }

      @keyframes auroraMove2 {
        0%, 100% {
          transform: translateX(0px) translateY(-10px) scaleY(1.2);
          opacity: 0.15;
        }
        25% {
          transform: translateX(-25px) translateY(5px) scaleY(1.4);
          opacity: 0.35;
        }
        50% {
          transform: translateX(20px) translateY(-15px) scaleY(1.0);
          opacity: 0.25;
        }
        75% {
          transform: translateX(15px) translateY(8px) scaleY(1.1);
          opacity: 0.2;
        }
      }

      .aurora-layer {
        mix-blend-mode: screen;
      }
    `;

    document.head.appendChild(styleSheet);
    auroraLayer.appendChild(waveLayer1);
    auroraLayer.appendChild(waveLayer2);
    container.appendChild(auroraLayer);

    // Store references for cleanup
    container.__auroraElements = [styleSheet, auroraLayer];

    // Handle prop changes
    const updateIntensity = (newIntensity) => {
      if (auroraLayer) {
        auroraLayer.style.setProperty('--aurora-intensity', newIntensity);
        auroraLayer.style.opacity = newIntensity;
      }
    };

    animationRef.current = { updateIntensity };

    return () => {
      // Cleanup
      if (container.__auroraElements) {
        container.__auroraElements.forEach((el) => {
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        });
      }
      delete container.__auroraElements;
    };
  }, []);

  // Update intensity when prop changes
  useEffect(() => {
    if (animationRef.current) {
      animationRef.current.updateIntensity(intensity);
    }
  }, [intensity]);

  return (
    <div
      ref={containerRef}
      className={`css-aurora-container ${className}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        opacity: intensity,
        transition: 'opacity 0.3s ease-out',
        ...style,
      }}
    />
  );
}
