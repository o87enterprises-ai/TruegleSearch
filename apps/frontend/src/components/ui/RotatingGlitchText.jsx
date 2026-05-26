import { useState, useEffect } from 'react';
import GlitchText from './GlitchText';

const RotatingGlitchText = ({ 
  rotatingWords = [], 
  rotationInterval = 2000,
  speed = 1,
  enableShadows = true,
  enableOnHover = false,
  className = '',
  style = {},
  colorScheme = ['#a855f7', '#22c55e', '#ef4444'] // Default: purple, green, red
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex(prevIndex => (prevIndex + 1) % rotatingWords.length);
    }, rotationInterval);

    return () => clearInterval(interval);
  }, [rotatingWords, rotationInterval]);

  return (
    <div className={className} style={style}>
      <GlitchText
        speed={speed}
        enableShadows={enableShadows}
        enableOnHover={enableOnHover}
        textColor="#ffffff"
        glitchColors={colorScheme}
        className="custom-class font-semibold text-center"
        style={{
          fontSize: '300%', // 300% larger
          textShadow: `0 0 10px ${colorScheme[currentIndex % colorScheme.length]}BB`
        }}
      >
        {rotatingWords[currentIndex]}
      </GlitchText>
    </div>
  );
};

export default RotatingGlitchText;