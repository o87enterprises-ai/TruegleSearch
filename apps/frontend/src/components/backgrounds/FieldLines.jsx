import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS, ANIMATION_CONFIG, PHYSICS } from './magneticFieldConstants';

export default function FieldLines({ phase }) {
  const groupRef = useRef();

  const fieldLines = useMemo(() => {
    const lines = [];
    const count = ANIMATION_CONFIG.fieldLineCount;
    const R = PHYSICS.magneticStrength;

    for (let i = 0; i < count; i++) {
      const points = [];
      const phi = (i / count) * Math.PI * 2;

      for (let j = 0; j <= 128; j++) {
        const t = (j / 128) * Math.PI * 2;
        const theta = t;
        const r = R * Math.pow(Math.sin(theta), 2);
        const noise = Math.sin(theta * 3 + phi) * 0.2;

        const x = (r + noise) * Math.sin(theta) * Math.cos(phi + t * 0.2);
        const y = (r + noise * 0.5) * Math.cos(theta);
        const z = (r + noise) * Math.sin(theta) * Math.sin(phi + t * 0.2);

        const turbulence = Math.sin(t * 5 + phi) * PHYSICS.turbulence;

        points.push(
          new THREE.Vector3(
            x + turbulence * Math.cos(phi),
            y + turbulence * Math.sin(phi),
            z + turbulence * Math.sin(phi * 2)
          )
        );
      }

      lines.push({
        points,
        color: COLORS.cubePalette[i % COLORS.cubePalette.length],
      });
    }

    return lines;
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.02;
      groupRef.current.rotation.x =
        Math.sin(state.clock.getElapsedTime() * 0.01) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {fieldLines.map((line, i) => (
        <Line
          key={i}
          points={line.points}
          color={line.color}
          lineWidth={1}
          transparent
          opacity={0.195}
        />
      ))}
    </group>
  );
}
