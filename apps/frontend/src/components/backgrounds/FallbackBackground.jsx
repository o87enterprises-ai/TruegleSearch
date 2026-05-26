import { useState, useEffect } from 'react';
import './FallbackBackground.css';

const FallbackBackground = () => {
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="fallback-background">
      <div 
        className="animated-gradient"
        style={{
          background: `radial-gradient(
            circle at ${mousePosition.x}% ${mousePosition.y}%,
            rgba(147, 51, 234, 0.4) 0%,
            rgba(0, 229, 255, 0.3) 30%,
            rgba(249, 115, 22, 0.2) 60%,
            rgba(16, 185, 129, 0.1) 90%,
            transparent 100%
          )`,
        }}
      />
      <div className="twinkling-stars">
        {Array.from({ length: 100 }).map((_, i) => (
          <div
            key={i}
            className="star"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${1 + Math.random() * 3}s`,
              opacity: 0.1 + Math.random() * 0.4,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default FallbackBackground;
