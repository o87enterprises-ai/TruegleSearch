import { useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stars, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import MagneticParticles from './MagneticParticles';
import FieldLines from './FieldLines';
import { COLORS, ANIMATION_CONFIG } from './magneticFieldConstants';

function PhaseController({ onPhaseChange }) {
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const phase = (time * ANIMATION_CONFIG.morphSpeed) % 6.0;
    onPhaseChange(phase);
  });
  return null;
}

export default function MagneticFieldScene() {
  const [phase, setPhase] = useState(0);

  return (
    <>
      <color attach="background" args={[COLORS.background]} />
      <fog attach="fog" args={[COLORS.background, 5, 25]} />

      <ambientLight intensity={0.2} color={COLORS.primary} />
      <pointLight
        position={[10, 10, 10]}
        intensity={1.5}
        color={COLORS.primary}
        distance={30}
      />
      <pointLight
        position={[-10, -10, -10]}
        intensity={1}
        color={COLORS.secondary}
        distance={25}
      />

      <Stars radius={100} depth={50} count={3000} factor={4} fade speed={0.5} />
      <Sparkles
        count={200}
        scale={10}
        size={1}
        speed={0.3}
        opacity={0.4}
        color={COLORS.primary}
      />

      <group position={[0, 0, 0]} scale={1.5}>
        <FieldLines phase={phase} />
        <MagneticParticles phase={phase} />

        <mesh>
          <sphereGeometry args={[0.5, 64, 64]} />
          <meshBasicMaterial
            color={COLORS.primary}
            transparent
            opacity={0.39}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      <PhaseController onPhaseChange={setPhase} />
    </>
  );
}
