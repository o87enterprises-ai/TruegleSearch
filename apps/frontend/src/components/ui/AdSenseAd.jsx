import { useEffect, useRef, useState } from 'react';

/**
 * Google AdSense Ad Component
 * Displays real Google AdSense ads when configured, or placeholder in development
 */
const AdSenseAd = ({
  adClient = 'ca-pub-9542137900411519',
  adSlot = '8883172859',
  adFormat = 'auto',
  fullWidthResponsive = true,
  style = {},
  className = '',
  placeholder = null,
}) => {
  const adRef = useRef(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);

  useEffect(() => {
    // Check if we're in production
    const isProduction = import.meta.env.PROD || window.location.hostname === 'truegle.info';

    // Only load AdSense in production
    if (!isProduction) {
      console.log('AdSense: Development mode - showing placeholder');
      return;
    }

    // Load the AdSense script if not already loaded
    const loadAdSenseScript = () => {
      if (document.querySelector('script[src*="pagead2.googlesyndication.com"]')) {
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`;
        script.async = true;
        script.crossOrigin = 'anonymous';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    const initAd = async () => {
      try {
        await loadAdSenseScript();

        // Push ad to AdSense
        if (adRef.current && window.adsbygoogle) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          setAdLoaded(true);
        }
      } catch (error) {
        console.error('AdSense loading error:', error);
        setAdError(true);
      }
    };

    initAd();
  }, [adClient]);

  // In development, show a placeholder
  const isProduction = import.meta.env.PROD || (typeof window !== 'undefined' && window.location.hostname === 'truegle.info');

  if (!isProduction) {
    // Show custom placeholder or default placeholder
    if (placeholder) {
      return placeholder;
    }

    return (
      <div
        className={`bg-gradient-to-br from-yellow-400/20 to-orange-400/20 border-2 border-yellow-400/40 rounded-2xl p-4 ${className}`}
        style={style}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-yellow-300/70 mb-1">Sponsored (Dev Mode)</div>
            <div className="text-sm font-semibold text-white">
              Ad Space - Live in Production
            </div>
            <div className="text-xs text-white/70">
              AdSense Publisher ID: {adClient}
            </div>
          </div>
          <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-sm font-semibold">
            Ad Preview
          </div>
        </div>
      </div>
    );
  }

  // Production: Show real AdSense ad
  if (adError) {
    return null; // Don't show anything if ad fails to load
  }

  return (
    <div className={className} style={style}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{
          display: 'block',
          ...style,
        }}
        data-ad-client={adClient}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={fullWidthResponsive ? 'true' : 'false'}
      />
    </div>
  );
};

/**
 * Cycling Ad Banner that rotates through multiple ad configurations
 */
export const CyclingAdBanner = ({
  ads = [],
  interval = 30000, // 30 seconds between cycles
  className = '',
  style = {},
}) => {
  const [currentAdIndex, setCurrentAdIndex] = useState(0);

  useEffect(() => {
    if (ads.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentAdIndex((prev) => (prev + 1) % ads.length);
    }, interval);

    return () => clearInterval(timer);
  }, [ads.length, interval]);

  if (ads.length === 0) {
    return <AdSenseAd className={className} style={style} />;
  }

  const currentAd = ads[currentAdIndex];

  return (
    <div className={className} style={style}>
      <AdSenseAd
        adSlot={currentAd.adSlot || '8883172859'}
        adFormat={currentAd.adFormat || 'auto'}
        placeholder={currentAd.placeholder}
      />
    </div>
  );
};

/**
 * Placeholder ad banner for sponsored content
 */
export const SponsoredBanner = ({
  title,
  description,
  ctaText = 'Learn More',
  ctaAction,
  variant = 'yellow',
  className = '',
}) => {
  const variantStyles = {
    yellow: 'from-[#FFEB3B]/30 to-[#FFC107]/30 border-yellow-400/60 shadow-yellow-400/40',
    blue: 'from-blue-500/30 to-cyan-500/30 border-blue-400/60 shadow-blue-400/40',
    purple: 'from-purple-500/30 to-pink-500/30 border-purple-400/60 shadow-purple-400/40',
    green: 'from-emerald-500/30 to-green-500/30 border-emerald-400/60 shadow-emerald-400/40',
  };

  const buttonStyles = {
    yellow: 'from-orange-500 to-red-500 shadow-orange-500/25',
    blue: 'from-blue-500 to-cyan-500 shadow-blue-500/25',
    purple: 'from-purple-500 to-pink-500 shadow-purple-500/25',
    green: 'from-emerald-500 to-green-500 shadow-emerald-500/25',
  };

  return (
    <div
      className={`p-4 rounded-2xl bg-gradient-to-br ${variantStyles[variant]} backdrop-blur-xl border-2 shadow-lg cursor-pointer transition-all duration-300 hover:scale-[1.02] ${className}`}
      onClick={ctaAction}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-yellow-200 mb-1">Sponsored</div>
          <div className="text-sm font-semibold text-white">{title}</div>
          {description && (
            <div className="text-xs text-white/90">{description}</div>
          )}
        </div>
        {ctaText && (
          <button
            className={`px-6 py-2 rounded-xl bg-gradient-to-r ${buttonStyles[variant]} text-white text-sm font-semibold whitespace-nowrap hover:opacity-90 transition-all shadow-lg`}
            onClick={(e) => {
              e.stopPropagation();
              ctaAction?.();
            }}
          >
            {ctaText}
          </button>
        )}
      </div>
    </div>
  );
};

export default AdSenseAd;
