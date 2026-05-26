import LaserFlow from './LaserFlow';
import Prism from './Prism';

const BackgroundAnimation = ({
  children,
  type = 'laser',
  className = '',
  // LaserFlow props
  laserColor = '#9333EA',
  fogIntensity = 0.35,
  wispIntensity = 3.0,
  flowSpeed = 0.25,
  verticalBeamOffset = 0.0,
  horizontalBeamOffset = 0.1,
  // Prism props
  prismAnimationType = 'rotate',
  prismTimeScale = 0.5,
  prismHeight = 3.5,
  prismBaseWidth = 5.5,
  prismScale = 3.6,
  prismHueShift = 0,
  prismColorFrequency = 1,
  prismNoise = 0.3,
  prismGlow = 0.8,
  prismBloom = 1,
}) => {
  return (
    <div className={`relative min-h-screen ${className}`}>
      {/* Background container - fixed to viewport */}
      <div
        className="fixed inset-0 z-0"
        style={{ width: '100vw', height: '100vh' }}
      >
        {type === 'laser' && (
          <div className="w-full h-full">
            <LaserFlow
              color={laserColor}
              fogIntensity={fogIntensity}
              wispIntensity={wispIntensity}
              flowSpeed={flowSpeed}
              verticalBeamOffset={verticalBeamOffset}
              horizontalBeamOffset={horizontalBeamOffset}
            />
          </div>
        )}

        {type === 'prism' && (
          <div className="w-full h-full">
            <Prism
              animationType={prismAnimationType}
              timeScale={prismTimeScale}
              height={prismHeight}
              baseWidth={prismBaseWidth}
              scale={prismScale}
              hueShift={prismHueShift}
              colorFrequency={prismColorFrequency}
              noise={prismNoise}
              glow={prismGlow}
              bloom={prismBloom}
              transparent={true}
            />
          </div>
        )}

        {type === 'combined' && (
          <>
            {/* Prism layer */}
            <div className="absolute inset-0 w-full h-full">
              <Prism
                animationType={prismAnimationType}
                timeScale={prismTimeScale * 0.6}
                height={prismHeight}
                baseWidth={prismBaseWidth}
                scale={prismScale}
                hueShift={prismHueShift}
                colorFrequency={prismColorFrequency * 0.8}
                noise={prismNoise * 0.7}
                glow={prismGlow * 0.5}
                bloom={prismBloom}
                transparent={true}
              />
            </div>
            {/* Laser layer with blend mode */}
            <div
              className="absolute inset-0 w-full h-full"
              style={{ mixBlendMode: 'screen' }}
            >
              <LaserFlow
                color={laserColor}
                fogIntensity={fogIntensity * 0.7}
                wispIntensity={wispIntensity * 0.7}
                flowSpeed={flowSpeed}
                verticalBeamOffset={verticalBeamOffset}
                horizontalBeamOffset={horizontalBeamOffset}
              />
            </div>
          </>
        )}
      </div>

      {/* Content container */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default BackgroundAnimation;
