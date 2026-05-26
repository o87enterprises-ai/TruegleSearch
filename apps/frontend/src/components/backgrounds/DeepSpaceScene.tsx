import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  Stars,
  Float,
  Instance,
  Instances,
  Sparkles,
  Billboard,
  Text,
} from '@react-three/drei';
import * as THREE from 'three';
import { MathUtils } from 'three';

// --- Enhanced Warp Stars with Speed Lines ---

const WarpStars = ({ count = 4000 }) => {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { viewport, clock } = useThree();
  const [attractor, setAttractor] = useState({ x: 0, y: 0 });

  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < count; i++) {
      const distance = 50 + Math.random() * 200;
      const angle = Math.random() * Math.PI * 2;
      const spread = Math.random() * 20;

      temp.push({
        id: i,
        distance,
        angle,
        spread,
        speed: 0.5 + Math.random() * 1.5,
        color: new THREE.Color().setHSL(
          0.6 + Math.random() * 0.2,
          0.7,
          0.7 + Math.random() * 0.3
        ),
        size: 0.5 + Math.random() * 1.5,
      });
    }
    return temp;
  }, [count]);

  useFrame((state) => {
    if (!mesh.current) return;

    const time = state.clock.elapsedTime;
    const mouseX = (state.mouse.x * viewport.width) / 3;
    const mouseY = (state.mouse.y * viewport.height) / 3;

    setAttractor({ x: mouseX, y: mouseY });

    const dummy = new THREE.Object3D();

    particles.forEach((particle, i) => {
      // Calculate position based on distance and angle
      let progress = (time * particle.speed * 0.1) % 1;

      // Warp effect: stars move toward camera
      const z = -200 + progress * 300;

      // Apply attractor effect (black hole/gravity well)
      const angle = particle.angle + time * 0.01;
      const baseX = Math.cos(angle) * particle.spread;
      const baseY = Math.sin(angle) * particle.spread;

      const distanceFromAttractor = Math.sqrt(
        Math.pow(baseX - attractor.x, 2) + Math.pow(baseY - attractor.y, 2)
      );

      const attractorStrength = Math.min(30 / distanceFromAttractor, 2);

      const x = baseX + (attractor.x - baseX) * 0.01 * attractorStrength;
      const y = baseY + (attractor.y - baseY) * 0.01 * attractorStrength;

      // Stretch based on speed (warp effect)
      const stretchFactor = Math.max(1, particle.speed * (1 - progress) * 3);

      dummy.position.set(x, y, z);
      dummy.scale.set(
        particle.size,
        particle.size,
        particle.size * stretchFactor
      );
      dummy.updateMatrix();

      mesh.current.setMatrixAt(i, dummy.matrix);

      // Update color based on speed and position
      const colorIntensity = 0.5 + (1 - progress) * 0.5;
      mesh.current.setColorAt(
        i,
        particle.color.clone().multiplyScalar(colorIntensity)
      );
    });

    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) {
      mesh.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, count]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          transparent
          opacity={0.8}
        />
      </instancedMesh>
    </>
  );
};

// --- Nebula Cloud System ---

const NebulaCloud = ({ position, color, size, speed = 0.1 }: any) => {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.y += speed * 0.01;
      mesh.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.1;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
      <mesh ref={mesh} position={position} scale={[size, size * 0.3, size]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>
      <pointLight
        position={position}
        color={color}
        intensity={0.3}
        distance={size * 10}
        decay={2}
      />
    </Float>
  );
};

// --- Warp Tunnel Effect ---

const WarpTunnel = () => {
  const tunnelRef = useRef<THREE.Mesh>(null);
  const ringCount = 40;
  const rings: any[] = [];

  useFrame((state) => {
    if (tunnelRef.current) {
      tunnelRef.current.rotation.z += 0.002;

      // Move rings backward
      rings.forEach((ring, i) => {
        if (ring.ref.current) {
          ring.ref.current.position.z += ring.speed;
          if (ring.ref.current.position.z > 10) {
            ring.ref.current.position.z = -100;
          }
        }
      });
    }
  });

  return (
    <group>
      {/* Central glow */}
      <mesh position={[0, 0, -50]}>
        <cylinderGeometry args={[0.1, 3, 100, 8, 100, true]} />
        <meshBasicMaterial
          color="#0066ff"
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Moving rings */}
      {Array.from({ length: ringCount }).map((_, i) => {
        const ringRef = React.createRef<THREE.Mesh>();
        const speed = 0.5 + Math.random() * 0.5;
        const ring = {
          ref: ringRef,
          speed,
          scale: 0.5 + Math.random() * 1.5,
          color: new THREE.Color().setHSL(0.6 + Math.random() * 0.2, 1, 0.7),
        };
        rings.push(ring);

        return (
          <mesh
            key={i}
            ref={ringRef}
            position={[0, 0, -100 + i * 5]}
            rotation={[Math.PI / 2, 0, Math.random() * Math.PI * 2]}
          >
            <torusGeometry args={[ring.scale * 3, 0.1, 8, 32]} />
            <meshBasicMaterial
              color={ring.color}
              transparent
              opacity={0.3}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        );
      })}
    </group>
  );
};

// --- Space Dust Particles ---

const SpaceDust = ({ count = 1000 }) => {
  const points = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const array = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      array[i * 3] = (Math.random() - 0.5) * 100;
      array[i * 3 + 1] = (Math.random() - 0.5) * 100;
      array[i * 3 + 2] = (Math.random() - 0.5) * 100;
    }
    return array;
  }, [count]);

  useFrame((state) => {
    if (points.current) {
      points.current.rotation.x += 0.0001;
      points.current.rotation.y += 0.0002;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.1}
        color="#88aaff"
        transparent
        opacity={0.3}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

// --- Cinematic Camera Rig ---

const CinematicCamera = () => {
  const { camera } = useThree();
  const target = new THREE.Vector3();
  const currentLookAt = new THREE.Vector3(0, 0, -50);
  const smoothFactor = 0.05;

  useFrame(({ mouse, clock }) => {
    // Parallax movement
    const parallaxX = mouse.x * 4;
    const parallaxY = mouse.y * 2;
    const bob = Math.sin(clock.elapsedTime * 0.5) * 0.2;

    target.set(
      camera.position.x + (parallaxX - camera.position.x) * smoothFactor,
      camera.position.y + (parallaxY + bob - camera.position.y) * smoothFactor,
      camera.position.z
    );

    camera.position.lerp(target, smoothFactor);

    // Look ahead with slight delay
    currentLookAt.lerp(
      new THREE.Vector3(parallaxX * 0.1, parallaxY * 0.1 + bob, -50),
      smoothFactor
    );
    camera.lookAt(currentLookAt);

    // Subtle roll based on horizontal movement
    camera.rotation.z = MathUtils.lerp(
      camera.rotation.z,
      -mouse.x * 0.05,
      smoothFactor
    );
  });

  return null;
};

// --- Distance Indicators ---

const DistanceIndicator = () => {
  return (
    <Billboard>
      <Text
        position={[0, -3, -10]}
        fontSize={0.3}
        color="#44aaff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {`WARP SPEED: ${(Math.random() * 9.9 + 0.1).toFixed(1)}`}
      </Text>
    </Billboard>
  );
};

// --- Main Scene ---

export const DeepSpaceScene: React.FC = () => {
  const [performanceMode, setPerformanceMode] = useState(false);

  // Auto-detect performance mode
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const lowPerformance = navigator.hardwareConcurrency < 4;
    setPerformanceMode(isMobile || lowPerformance);
  }, []);

  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 75 }}
      dpr={Math.min(window.devicePixelRatio, performanceMode ? 1 : 2)}
      performance={{ min: 0.7 }}
      gl={{
        antialias: !performanceMode,
        alpha: false,
        powerPreference: 'high-performance',
      }}
    >
      {/* Scene Setup */}
      <color attach="background" args={['#000010']} />
      <fog attach="fog" args={['#000020', 10, 200]} />

      {/* Optimized Lighting */}
      <ambientLight intensity={0.1} color="#001133" />
      <pointLight position={[10, 10, 10]} intensity={0.5} color="#0055ff" />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color="#a020f0" />

      {/* Performance-adjusted elements */}
      <React.Suspense fallback={null}>
        {/* Static Background Stars */}
        <Stars
          radius={150}
          depth={60}
          count={performanceMode ? 2000 : 5000}
          factor={4}
          saturation={0}
          fade
          speed={0.5}
        />

        {/* Warp Stars */}
        <WarpStars count={performanceMode ? 2000 : 4000} />

        {/* Space Dust */}
        <SpaceDust count={performanceMode ? 500 : 1000} />

        {/* Warp Tunnel */}
        {!performanceMode && <WarpTunnel />}

        {/* Nebulae */}
        <NebulaCloud
          position={[-20, 5, -40]}
          color="#6a0dad"
          size={15}
          speed={0.05}
        />
        <NebulaCloud
          position={[25, -10, -60]}
          color="#0055ff"
          size={20}
          speed={0.08}
        />
        <NebulaCloud
          position={[0, 15, -30]}
          color="#ff0055"
          size={12}
          speed={0.03}
        />

        {/* Sparkle Effects */}
        <Sparkles
          count={performanceMode ? 30 : 100}
          scale={20}
          size={performanceMode ? 2 : 3}
          speed={0.4}
          opacity={0.4}
          color="#44ffaa"
          noise={1}
        />

        {/* UI Elements */}
        {!performanceMode && <DistanceIndicator />}
      </React.Suspense>

      {/* Camera Control */}
      <CinematicCamera />
    </Canvas>
  );
};
