import ThreeJsAtomic from './ThreeJsAtomic';
import AntigravityParticles from './AntigravityParticles';

// Truegle color palette for antigravity particles
const TRUEGLE_COLORS = [
  '#00E5FF', // Cyan
  '#9333EA', // Purple
  '#10B981', // Green
  '#3B82F6', // Blue
  '#EC4899', // Pink (subtle)
];

export default function SpaceTimeBackground({
  variant = 'atomic',
  interactive = true,
  showAntigravity = true,
}) {
  if (variant === 'atomic') {
    return (
      <div className="fixed inset-0 bg-black" style={{ zIndex: -10 }}>
        {/* Base atomic background */}
        <ThreeJsAtomic />

        {/* Antigravity particles layer - mouse interactive */}
        {showAntigravity && (
          <div
            className="fixed inset-0"
            style={{
              zIndex: 5,
              pointerEvents: interactive ? 'auto' : 'none',
            }}
          >
            <AntigravityParticles
              count={120}
              colors={TRUEGLE_COLORS}
              magnetRadius={0.35}
              particleSize={0.05}
              glowIntensity={0.9}
              waveSpeed={0.4}
              particleShape="sphere"
              fieldStrength={1.0}
              lerpSpeed={0.05}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black" style={{ zIndex: -10 }}>
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black" />

      {/* Antigravity particles for non-atomic variant too */}
      {showAntigravity && (
        <div
          className="fixed inset-0"
          style={{
            zIndex: 5,
            pointerEvents: interactive ? 'auto' : 'none',
          }}
        >
          <AntigravityParticles
            count={80}
            colors={TRUEGLE_COLORS}
            magnetRadius={0.4}
            particleSize={0.06}
            glowIntensity={1.0}
          />
        </div>
      )}
    </div>
  );
}
