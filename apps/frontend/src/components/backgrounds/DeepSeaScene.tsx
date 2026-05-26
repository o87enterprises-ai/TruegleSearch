import React, { useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Sparkles,
  Float,
  Stars,
  Trail,
  Environment,
  Text,
} from '@react-three/drei';
import * as THREE from 'three';
import { MathUtils } from 'three';

// --- Optimized Shaders (simplified for better performance) ---

const jellyfishVertexShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vPulse;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    // Simplified pulsing - only affects top portion
    vec3 pos = position;
    float pulse = sin(uTime * 1.5) * 0.5 + 0.5;
    vPulse = pulse;
    
    // Gentle vertical movement
    pos.y += sin(uTime * 0.5 + pos.x) * 0.05;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const jellyfishFragmentShader = `
  uniform float uTime;
  uniform vec3 uColorBase;
  uniform vec3 uColorGlow;
  
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vPulse;

  void main() {
    // Fresnel effect
    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
    
    // Pulsing glow
    float pulseGlow = vPulse * 0.3 + 0.7;
    
    // Combined color
    vec3 color = mix(uColorBase, uColorGlow, fresnel * pulseGlow);
    
    // Varying opacity
    float alpha = 0.08 + fresnel * 0.4 + pulseGlow * 0.2;
    
    gl_FragColor = vec4(color, alpha);
  }
`;

// --- Components ---

const Jellyfish = React.memo(
  ({
    position,
    scale = 1,
  }: {
    position: [number, number, number];
    scale?: number;
  }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const tentaclesRef = useRef<THREE.Group>(null);
    const lightRef = useRef<THREE.PointLight>(null);

    const uniforms = useMemo(
      () => ({
        uTime: { value: 0 },
        uColorBase: { value: new THREE.Color('#001144') },
        uColorGlow: { value: new THREE.Color('#00aaff') },
      }),
      []
    );

    useFrame((state) => {
      const time = state.clock.elapsedTime;

      if (materialRef.current) {
        materialRef.current.uniforms.uTime.value = time;
      }

      // Jellyfish movement
      if (meshRef.current) {
        meshRef.current.rotation.y = Math.sin(time * 0.1) * 0.1;
        meshRef.current.position.y = Math.sin(time * 0.3) * 0.1;
      }

      // Tentacle animation
      if (tentaclesRef.current) {
        tentaclesRef.current.children.forEach((child, i) => {
          child.rotation.x = Math.sin(time * 2 + i * 0.5) * 0.15;
        });
      }

      // Pulsing light
      if (lightRef.current) {
        lightRef.current.intensity = 1.5 + Math.sin(time * 1.5) * 1;
      }
    });

    return (
      <group position={position} scale={scale}>
        <Float speed={1} rotationIntensity={0.1} floatIntensity={0.3}>
          {/* Main Bell */}
          <mesh ref={meshRef}>
            <icosahedronGeometry args={[1.3, 2]} />{' '}
            {/* Fewer polygons for performance */}
            <shaderMaterial
              ref={materialRef}
              vertexShader={jellyfishVertexShader}
              fragmentShader={jellyfishFragmentShader}
              transparent
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* Inner Glow */}
          <mesh position={[0, -0.2, 0]}>
            <sphereGeometry args={[0.4, 16, 16]} />
            <meshBasicMaterial
              color="#0066ff"
              transparent
              opacity={0.4}
              blending={THREE.AdditiveBlending}
            />
          </mesh>

          {/* Tentacles */}
          <group ref={tentaclesRef} position={[0, -1, 0]}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Tentacle key={i} index={i} />
            ))}
          </group>

          {/* Glow Light */}
          <pointLight
            ref={lightRef}
            color="#0088ff"
            distance={8}
            decay={2}
            intensity={1}
          />
        </Float>
      </group>
    );
  }
);

Jellyfish.displayName = 'Jellyfish';

const Tentacle = React.memo(({ index }: { index: number }) => {
  const curve = useMemo(() => {
    const points = [];
    for (let i = 0; i <= 10; i++) {
      points.push(
        new THREE.Vector3(
          Math.sin(i * 0.3) * 0.1,
          -i * 0.5,
          Math.cos(i * 0.3) * 0.1
        )
      );
    }
    return new THREE.CatmullRomCurve3(points);
  }, []);

  const tubeRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (tubeRef.current) {
      const time = clock.elapsedTime;
      tubeRef.current.rotation.x = Math.sin(time * 1.5 + index) * 0.1;
      tubeRef.current.rotation.z = Math.cos(time * 1.2 + index) * 0.1;
    }
  });

  return (
    <Trail
      width={0.8}
      length={3}
      color={new THREE.Color('#3300ff')}
      attenuation={(t) => t * t}
    >
      <mesh ref={tubeRef}>
        <tubeGeometry args={[curve, 20, 0.03, 8, false]} />
        <meshBasicMaterial
          color="#4400ff"
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </Trail>
  );
});

Tentacle.displayName = 'Tentacle';

const MarineSnow = React.memo(() => {
  const count = 1500; // Reduced count for performance
  const pointsRef = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const array = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      array[i * 3] = (Math.random() - 0.5) * 40;
      array[i * 3 + 1] = (Math.random() - 0.5) * 40;
      array[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    return array;
  }, []);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0.001;
      pointsRef.current.position.y =
        Math.sin(state.clock.elapsedTime * 0.2) * 0.2;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#88ccff"
        transparent
        opacity={0.4}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
});

MarineSnow.displayName = 'MarineSnow';

const CameraController = () => {
  const { camera } = useThree();

  useFrame(({ mouse }) => {
    // Smooth camera follow
    camera.position.x += (mouse.x * 3 - camera.position.x) * 0.02;
    camera.position.y += (mouse.y * 2 - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);
  });

  return null;
};

// Performance: Only render stars outside jellyfish area
const BackgroundStars = () => {
  return (
    <Stars
      radius={100}
      depth={50}
      count={2000}
      factor={4}
      saturation={0}
      fade
      speed={0.5}
    />
  );
};

const DepthIndicator = () => {
  return (
    <Text
      position={[-8, 4, -5]}
      fontSize={0.5}
      color="#0066ff"
      anchorX="left"
      anchorY="middle"
    >
      Depth: 3,000m
    </Text>
  );
};

// --- Main Scene ---

export const DeepSeaScene: React.FC = () => {
  const jellyfishPositions = useMemo(
    () => [
      [0, 0, 0] as [number, number, number],
      [-6, 3, -6] as [number, number, number],
      [5, -4, -8] as [number, number, number],
      [3, 5, -12] as [number, number, number],
    ],
    []
  );

  return (
    <Canvas
      camera={{ position: [0, 0, 15], fov: 50 }}
      dpr={Math.min(window.devicePixelRatio, 2)} // Cap DPR for mobile
      performance={{ min: 0.5 }} // Maintain 50% FPS minimum
    >
      {/* Scene Setup */}
      <color attach="background" args={['#000010']} />
      <fog attach="fog" args={['#000020', 20, 50]} />

      {/* Optimized Lighting */}
      <ambientLight intensity={0.1} color="#001133" />
      <directionalLight
        position={[10, 10, 5]}
        intensity={0.3}
        color="#0044aa"
        castShadow={false}
      />

      {/* Performance: Only render what's visible */}
      <React.Suspense fallback={null}>
        <BackgroundStars />
        <MarineSnow />

        {jellyfishPositions.map((pos, i) => (
          <Jellyfish
            key={i}
            position={pos}
            scale={i === 0 ? 1.2 : 0.7 + Math.random() * 0.3}
          />
        ))}

        {/* Subtle particles for ambience */}
        <Sparkles
          count={50}
          scale={15}
          size={2}
          speed={0.3}
          opacity={0.3}
          color="#44ffaa"
        />
      </React.Suspense>

      <CameraController />
    </Canvas>
  );
};
