import { useEffect, useRef } from 'react';

const SimplePrism = ({ baseWidth = 5.5, glow = 1, hueShift = 0 }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Simple test with just CSS gradient to test positioning
    container.style.background = `linear-gradient(45deg, 
      rgba(255, 121, 198, 0.8) 0%, 
      rgba(0, 255, 255, 0.6) 50%, 
      rgba(255, 0, 128, 0.8) 100%)`;
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
  }, [baseWidth, glow, hueShift]);

  return <div className="w-full h-full relative" ref={containerRef} />;
};

export default SimplePrism;
