import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import logoImage from '../../assets/images/truegle.png';
import logoChatImage from '../../assets/images/truegle-chat.png';

// variant 'chat' shows the "TrueGLE chat" mark (used on /chat, where the user is
// silently routed after their first landing-page query). Both are bright-on-dark
// art; mixBlendMode:screen drops the dark backdrop against the dark page.
const LOGO_VARIANTS = {
  default: { src: logoImage, alt: 'Truegle — Unbiased Search' },
  chat: { src: logoChatImage, alt: 'TrueGLE Chat' },
};

function TruegleLogo({
  size = 'large',
  animated = true,
  className = '',
  variant = 'default',
  onClick,
}) {
  const navigate = useNavigate();
  const { src, alt } = LOGO_VARIANTS[variant] || LOGO_VARIANTS.default;

  const sizes = {
    small: 'h-12 w-auto',
    medium: 'h-20 w-auto',
    large: 'h-32 w-auto',
    xlarge: 'h-48 w-auto',
    xxxlarge: 'h-64 w-auto', // Eye-catcher size for primary hero
  };

  const logoElement = (
    <img
      src={src}
      alt={alt}
      className={`${sizes[size]} ${className} object-contain cursor-pointer`}
      style={{
        mixBlendMode: 'screen',
      }}
      onClick={onClick || (() => navigate('/'))}
    />
  );

  if (animated) {
    return (
      <div
        className="inline-block animate-logo-glow cursor-pointer"
        style={{
          filter: 'drop-shadow(0 0 20px rgba(0, 229, 255, 0.3))',
        }}
        onClick={onClick || (() => navigate('/'))}
      >
        {logoElement}
        <style>{`
          @keyframes logo-glow {
            0%, 100% {
              filter: drop-shadow(0 0 20px rgba(0, 229, 255, 0.3));
            }
            50% {
              filter: drop-shadow(0 0 40px rgba(0, 229, 255, 0.6));
            }
          }
          .animate-logo-glow {
            animation: logo-glow 2s ease-in-out infinite;
          }
        `}</style>
      </div>
    );
  }

  return logoElement;
}

export default memo(TruegleLogo);
