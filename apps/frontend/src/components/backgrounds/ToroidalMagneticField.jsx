import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Line,
  Sphere,
  Torus,
  Points,
  Trail,
  OrbitControls,
} from '@react-three/drei';
import * as THREE from 'three';

const THEME = {
  colors: {
    primary: '#00d2ff',
    secondary: '#ff0055',
    background: '#050505',
    surface: 'rgba(20, 20, 30, 0.6)',
    surfaceBorder: 'rgba(255, 255, 255, 0.1)',
    cubePalette: [
      '#ef4444',
      '#f97316',
      '#eab308',
      '#22c55e',
      '#06b6d4',
      '#3b82f6',
      '#8b5cf6',
      '#ec4899',
    ],
  },
};

// Magnetic Field Lines System
const MagneticFieldLines = ({ phase, progress, scale = 1 }) => {
  const linesRef = useRef();
  const particlesRef = useRef();
  const time = useRef(0);

  const fieldLines = useMemo(() => {
    const lines = [];
    const majorRadius = 3 * scale;
    const minorRadius = 1 * scale;
    const linesCount = 32;

    for (let i = 0; i < linesCount; i++) {
      const points = [];
      const phi = (i / linesCount) * Math.PI * 2;

      for (let j = 0; j <= 100; j++) {
        const theta = (j / 100) * Math.PI * 2;

        const twist = Math.sin(theta * 5 + phi * 2) * 0.3;
        const x =
          (majorRadius + minorRadius * Math.cos(theta)) * Math.cos(phi + twist);
        const y = minorRadius * Math.sin(theta) * 1.2;
        const z =
          (majorRadius + minorRadius * Math.cos(theta)) * Math.sin(phi + twist);

        points.push(new THREE.Vector3(x, y, z));
      }

      lines.push({
        points,
        color: THEME.colors.cubePalette[i % THEME.colors.cubePalette.length],
        opacity: 0.3 + Math.random() * 0.3,
      });
    }

    return lines;
  }, [scale]);

  useFrame((state) => {
    time.current += 0.005;

    if (linesRef.current) {
      linesRef.current.children.forEach((line, i) => {
        line.material.opacity = 0.1 + 0.2 * Math.sin(time.current + i * 0.3);
      });
    }

    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        const lineIndex = Math.floor(i / 3) % fieldLines.length;
        const points = fieldLines[lineIndex].points;
        const progress = (time.current * 0.3 + i * 0.001) % 1;
        const pointIndex = Math.floor(progress * points.length);
        const point = points[pointIndex];

        positions[i] = point.x;
        positions[i + 1] = point.y;
        positions[i + 2] = point.z;
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  const getFieldOpacity = () => {
    switch (phase) {
      case 'circle':
        return progress * 0.3;
      case 'sphere':
        return 0.5;
      case 'torus':
        return 1;
      default:
        return 0;
    }
  };

  const fieldOpacity = getFieldOpacity();

  return (
    <group>
      <group ref={linesRef}>
        {fieldLines.map((line, i) => (
          <Line
            key={i}
            points={line.points}
            color={line.color}
            transparent
            opacity={fieldOpacity * line.opacity}
            lineWidth={1}
          />
        ))}
      </group>

      {fieldOpacity > 0.1 && (
        <points ref={particlesRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={128}
              array={new Float32Array(128 * 3)}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial
            size={0.03}
            sizeAttenuation
            transparent
            opacity={fieldOpacity}
            color={THEME.colors.primary}
          />
        </points>
      )}
    </group>
  );
};

// Morphing Shape System
const MorphingShape = ({ phase, progress }) => {
  const meshRef = useRef();
  const glowRef = useRef();
  const time = useRef(0);

  useFrame((state) => {
    time.current += 0.01;

    if (meshRef.current) {
      const pulse = 1 + 0.05 * Math.sin(time.current);
      meshRef.current.scale.setScalar(pulse);
      meshRef.current.rotation.y = time.current * 0.1;
      meshRef.current.rotation.x = time.current * 0.05;
    }

    if (glowRef.current) {
      glowRef.current.rotation.y = -time.current * 0.08;
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhysicalMaterial
          color={THEME.colors.primary}
          transparent
          opacity={0.7}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      <mesh ref={glowRef}>
        <sphereGeometry args={[1.3, 32, 32]} />
        <meshBasicMaterial
          color={THEME.colors.primary}
          transparent
          opacity={0.1}
          side={THREE.BackSide}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshBasicMaterial
          color={THEME.colors.secondary}
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};

// Ambient Space Particles
const SpaceParticles = ({ count = 2000 }) => {
  const particlesRef = useRef();
  const time = useRef(0);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const primaryColor = new THREE.Color(THEME.colors.primary);
    const secondaryColor = new THREE.Color(THEME.colors.secondary);

    for (let i = 0; i < count; i++) {
      const radius = 20 + Math.random() * 30;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      const distanceFactor = Math.random();
      const color = primaryColor.clone().lerp(secondaryColor, distanceFactor);

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    return { positions, colors };
  }, [count]);

  useFrame(() => {
    time.current += 0.001;

    if (particlesRef.current) {
      particlesRef.current.rotation.y = time.current * 0.05;
    }
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={particles.colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.02}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

// Main Component
export const ToroidalMagneticField = () => {
  const [phase, setPhase] = useState('point');
  const [progress, setProgress] = useState(0);
  const time = useRef(0);

  const phases = [
    'point',
    'circle',
    'sphere',
    'torus',
    'sphere',
    'circle',
    'point',
  ];

  console.log('Animation tick:', phase, progress);
  useFrame((state) => {
    time.current += 0.005;

    const phaseDuration = 4;
    const totalDuration = phaseDuration * phases.length;
    const currentTime = time.current % totalDuration;
    const phaseIndex = Math.floor(currentTime / phaseDuration);
    const phaseProgress = (currentTime % phaseDuration) / phaseDuration;

    setPhase(phases[phaseIndex]);
    setProgress(phaseProgress);
  });

  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(0, 3, 8);
    camera.lookAt(0, 0, 0);
  }, [camera]);

  return (
    <group>
      <SpaceParticles />
      <MagneticFieldLines phase={phase} progress={progress} scale={1.5} />
      <MorphingShape phase={phase} progress={progress} />

      <ambientLight intensity={0.3} color={THEME.colors.primary} />
      <pointLight
        position={[5, 5, 5]}
        intensity={0.5}
        color={THEME.colors.primary}
        distance={20}
      />
      <pointLight
        position={[-5, -5, -5]}
        intensity={0.3}
        color={THEME.colors.secondary}
        distance={15}
      />
    </group>
  );
};

export const ToroidalScene = () => (
  <>
    <color attach="background" args={[THEME.colors.background]} />
    <ToroidalMagneticField />
  </>
);
