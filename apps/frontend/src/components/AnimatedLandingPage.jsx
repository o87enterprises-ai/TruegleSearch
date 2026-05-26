import { useState, useEffect, useRef } from 'react';
import LaserFlow from '../LaserFlow/LaserFlow';
import SimplePrism from '../SimplePrism';

const AnimatedLandingPage = ({ onSearch }) => {
  const [animationPhase, setAnimationPhase] = useState('initial');
  const [laserSizing, setLaserSizing] = useState(0);
  const [prismBaseWidth, setPrismBaseWidth] = useState(0);
  const [prismGlow, setPrismGlow] = useState(0);
  const [hueShift, setHueShift] = useState(1);
  const [uiOpacity, setUiOpacity] = useState(0);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const animationStartTime = useRef(Date.now());

  // Animation sequence controller
  useEffect(() => {
    const animateSequence = () => {
      const elapsed = (Date.now() - animationStartTime.current) / 1000; // Convert to seconds

      // Phase 1: Logo only (0-1s)
      if (elapsed < 1) {
        setAnimationPhase('logo');
      }
      // Phase 2: Laser animation (1-3s)
      else if (elapsed < 3) {
        setAnimationPhase('laser');
        const progress = (elapsed - 1) / 2; // 0 to 1 over 2 seconds
        setLaserSizing(progress * 5); // 0 to 5
      }
      // Phase 3: UI elements fade in (3-4s)
      else if (elapsed < 4) {
        setAnimationPhase('ui-fade');
        const progress = (elapsed - 3) / 1; // 0 to 1 over 1 second
        setUiOpacity(progress);
      }
      // Phase 4: Prism animation starts (4-6s)
      else if (elapsed < 6) {
        setAnimationPhase('prism');
        const progress = (elapsed - 4) / 2; // 0 to 1 over 2 seconds
        setPrismBaseWidth(progress * 25); // 0 to 25 (much larger for 70-80% screen)
        setPrismGlow(progress * 5.5); // 0 to 5.5 (stronger initial glow)
      }
      // Phase 5: Continuous animations
      else {
        setAnimationPhase('complete');
        // Slower continuous hue shift animation
        const hueProgress = ((elapsed - 6) % 15) / 15; // 0 to 1 every 15 seconds
        setHueShift(hueProgress * Math.PI * 2); // Full spectrum rotation

        // Add brightness fluctuation
        const brightnessFluctuation = Math.sin(elapsed * 0.3) * 0.3 + 0.7; // 0.4 to 1.0
        setPrismGlow(brightnessFluctuation * 3.75); // Fluctuating brightness
      }

      requestAnimationFrame(animateSequence);
    };

    const frameId = requestAnimationFrame(animateSequence);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  const features = [
    {
      title: 'Unbiased Results',
      description: 'No hidden agendas or algorithmic manipulation',
    },
    {
      title: 'Multiple Perspectives',
      description: 'See all sides of every story with clear categorization',
    },
    {
      title: 'Privacy First',
      description: 'No tracking, no cookies, no data collection',
    },
  ];

  return (
    <div
      className="relative w-full h-screen bg-black overflow-hidden"
      ref={containerRef}
    >
      {/* Laser Flow Background - Always present but animated */}
      <LaserFlow
        verticalSizing={laserSizing}
        horizontalSizing={0.5}
        intensity={0.8}
        speed={0.3}
        className="absolute inset-0 z-10"
        color="#FF79C6"
      />

      {/* Prism Background - Animated in later */}
      {(animationPhase === 'prism' || animationPhase === 'complete') && (
        <SimplePrism
          baseWidth={prismBaseWidth}
          glow={prismGlow}
          hueShift={hueShift}
          className="absolute inset-0 z-20"
        />
      )}

      {/* Logo - Barely visible at start, reflects lighting */}
      <div
        className="absolute inset-0 flex items-center justify-center z-30 transition-all duration-1000"
        style={{
          opacity: animationPhase === 'logo' ? 0.1 : Math.min(0.3, uiOpacity),
          filter: `brightness(${animationPhase === 'logo' ? 0.2 : 0.8})`,
        }}
      >
        <div className="text-center">
          <div className="text-6xl md:text-8xl font-bold mb-4">
            <span className="text-blue-600">T</span>
            <span className="text-red-500">r</span>
            <span className="text-yellow-500">u</span>
            <span className="text-blue-600">e</span>
            <span className="text-green-500">g</span>
            <span className="text-red-500">l</span>
            <span className="text-purple-600">e</span>
          </div>
        </div>
      </div>

      {/* Main UI Content - Fades in after laser */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center px-4 z-40 transition-opacity duration-1000"
        style={{ opacity: uiOpacity }}
      >
        {/* Main Logo with proper visibility */}
        <div className="text-center mb-12">
          <div className="text-6xl md:text-8xl font-bold mb-4">
            <span className="text-blue-600">T</span>
            <span className="text-red-500">r</span>
            <span className="text-yellow-500">u</span>
            <span className="text-blue-600">e</span>
            <span className="text-green-500">g</span>
            <span className="text-red-500">l</span>
            <span className="text-purple-600">e</span>
          </div>
          <p className="text-xl text-gray-200 mb-2">Search Without Bias</p>
          <p className="text-sm text-gray-400">
            Unbiased • Transparent • Private
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="w-full max-w-2xl mb-8">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for unbiased information..."
              className="w-full px-6 py-4 pl-14 pr-14 text-lg text-gray-900 border border-gray-300 rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:shadow-xl transition-shadow"
            />
            <svg
              className="absolute left-5 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={24}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              width="24"
              height="24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <button
              type="submit"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
            >
              <svg
                size={20}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                width="20"
                height="20"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>
          </div>
        </form>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3 mb-12">
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors">
            Truegle Search
          </button>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors">
            I'm Feeling Unbiased
          </button>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl">
          {features.map((feature, index) => (
            <div
              key={index}
              className="text-center p-6 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-center mb-4">
                <svg
                  className="text-blue-600"
                  size={32}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  width="32"
                  height="32"
                >
                  {index === 0 && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  )}
                  {index === 1 && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  )}
                  {index === 2 && (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  )}
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2 text-gray-900">
                {feature.title}
              </h3>
              <p className="text-gray-600 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnimatedLandingPage;
