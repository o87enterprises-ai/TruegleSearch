import React, { useState, useEffect } from 'react';

const NebulaFlowBackground = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const animation = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    return () => clearTimeout(animation);
  }, []);

  const containerStyle = {
    position: 'relative',
    width: '100%',
    height: '100vh',
    background: '#222',
    overflow: 'hidden',
  };

  const nebulaStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '100vw',
    height: '100vh',
    background: 'radial-gradient(circle at center, rgba(138, 43, 226, 0.4) 0%, rgba(138, 43, 226, 0.2) 20%, rgba(75, 0, 130, 0.1) 50%, rgba(75, 0, 130, 0.05) 80%, transparent 100%)',
    filter: 'blur(2px)',
    animation: isVisible ? 'nebulaFlow 20s ease-in-out infinite' : 'none',
  };

  const particlesStyle = {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundImage: `
      radial-gradient(circle at 20% 30%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
      radial-gradient(circle at 80% 70%, rgba(255, 119, 198, 0.3) 0%, transparent 50%),
      radial-gradient(circle at 60% 50%, rgba(138, 43, 226, 0.2) 0%, transparent 50%)
    `,
    animation: 'particleFlow 15s ease-in-out infinite',
  };

  return (
    <div style={containerStyle}>
      <div style={nebulaStyle} />
      <div style={particlesStyle} />
      <style>
        {`
          @keyframes nebulaFlow {
            0% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 0.3; }
            50% { transform: translate(-50%, -50%) scale(1.2) rotate(180deg); opacity: 0.6; }
            100% { transform: translate(-50%, -50%) scale(1) rotate(360deg); opacity: 0.3; }
          }

          @keyframes particleFlow {
            0% { transform: translateY(0) scale(1); opacity: 0.3; }
            33% { transform: translateY(-20px) scale(1.1); opacity: 0.6; }
            66% { transform: translateY(20px) scale(0.9); opacity: 0.4; }
            100% { transform: translateY(0) scale(1); opacity: 0.3; }
          }

          /* Performance optimizations for mobile */
          @media (max-width: 768px) {
            div[style*="translate(-50%,-50%)"] {
              animation-duration: 30s;
            }
            div[style*="radial-gradient"] {
              animation-duration: 25s;
            }
          }

          /* Accessibility */
          @media (prefers-reduced-motion: reduce) {
            div[style*="translate(-50%,-50%)"],
            div[style*="radial-gradient"] {
              animation: none !important;
            }
          }
        `}
      </style>
    </div>
  );
};

export default NebulaFlowBackground;