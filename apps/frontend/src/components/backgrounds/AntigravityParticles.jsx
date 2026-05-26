import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';

/**
 * AntigravityParticles - Interactive floating particles that respond to mouse movement
 * FIXED: Bright purple colors that are visible against dark background
 */

// BRIGHT purple spectrum - visible against dark backgrounds
const SIZE_CATEGORIES = [
  {
    name: 'tiny',
    percentage: 0.5,
    radiusMin: 0.04,
    radiusMax: 0.08,
    velocityMultiplier: 1.5,
    massMultiplier: 0.5,
    color: '#e9d5ff', // Very light purple (visible!)
  },
  {
    name: 'medium',
    percentage: 0.35,
    radiusMin: 0.1,
    radiusMax: 0.16,
    velocityMultiplier: 1.0,
    massMultiplier: 1.0,
    color: '#c084fc', // Light purple
  },
  {
    name: 'large',
    percentage: 0.15,
    radiusMin: 0.2,
    radiusMax: 0.3,
    velocityMultiplier: 0.6,
    massMultiplier: 2.0,
    color: '#a855f7', // Medium purple (still bright)
  },
];

const PHYSICS_CONFIG = {
  damping: 0.95,
  maxVelocity: 3.0,
};

function AntigravityInner({
  count = 60,
  magnetRadius = 0.42,
  ringRadius = 0.35,
  waveSpeed = 0.4,
  waveAmplitude = 0.15,
  particleSize = 0.1,
  lerpSpeed = 0.025,
  autoAnimate = true,
  rotationSpeed = 0.003,
  depthFactor = 2.5,
  pulseSpeed = 2,
  fieldStrength = 0.4,
  spacingMultiplier = 1.3,
  deadZoneRadius = 0.12,
  repulsionStrength = 0.6,
}) {
  const meshRef = useRef();
  const { viewport, size } = useThree();

  const mouse = useRef({ x: 0, y: 0 });
  const targetMouse = useRef({ x: 0, y: 0 });
  const autoAnimateTimer = useRef(null);
  const isAutoAnimating = useRef(autoAnimate);
  const autoAnimateAngle = useRef(0);

  const handleMouseMove = useCallback(
    (event) => {
      const x = (event.clientX / size.width) * 2 - 1;
      const y = -(event.clientY / size.height) * 2 + 1;
      targetMouse.current.x = x;
      targetMouse.current.y = y;
      isAutoAnimating.current = false;
      if (autoAnimateTimer.current) clearTimeout(autoAnimateTimer.current);
      autoAnimateTimer.current = setTimeout(() => {
        isAutoAnimating.current = true;
      }, 2000);
    },
    [size.width, size.height]
  );

  const handleTouchMove = useCallback(
    (event) => {
      if (event.touches.length > 0) {
        const touch = event.touches[0];
        const x = (touch.clientX / size.width) * 2 - 1;
        const y = -(touch.clientY / size.height) * 2 + 1;
        targetMouse.current.x = x;
        targetMouse.current.y = y;
        isAutoAnimating.current = false;
        if (autoAnimateTimer.current) clearTimeout(autoAnimateTimer.current);
        autoAnimateTimer.current = setTimeout(() => {
          isAutoAnimating.current = true;
        }, 2000);
      }
    },
    [size.width, size.height]
  );

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      if (autoAnimateTimer.current) clearTimeout(autoAnimateTimer.current);
    };
  }, [handleMouseMove, handleTouchMove]);

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  const {
    positions,
    scales,
    particleColors,
    velocities,
    phases,
    particleData,
  } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const particleColors = [];
    const velocities = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const particleData = [];

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const rand = Math.random();
      let category;

      if (rand < SIZE_CATEGORIES[0].percentage) {
        category = SIZE_CATEGORIES[0];
      } else if (
        rand <
        SIZE_CATEGORIES[0].percentage + SIZE_CATEGORIES[1].percentage
      ) {
        category = SIZE_CATEGORIES[1];
      } else {
        category = SIZE_CATEGORIES[2];
      }

      const particleRadius =
        category.radiusMin +
        Math.random() * (category.radiusMax - category.radiusMin);

      particleData.push({
        radius: particleRadius,
        velocityMultiplier: category.velocityMultiplier,
        mass: category.massMultiplier,
        categoryName: category.name,
      });

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const depthOffset =
        category.name === 'large'
          ? 0.8
          : category.name === 'medium'
            ? 1.0
            : 1.2;
      const r = (0.4 + Math.random() * 0.6) * spacingMultiplier * depthOffset;

      positions[i3] =
        r * Math.sin(phi) * Math.cos(theta) * viewport.width * 0.5;
      positions[i3 + 1] =
        r * Math.sin(phi) * Math.sin(theta) * viewport.height * 0.5;
      const zDepth =
        category.name === 'large'
          ? 2 + Math.random() * 2
          : category.name === 'medium'
            ? -1 + Math.random() * 2
            : -4 + Math.random() * 2;
      positions[i3 + 2] = zDepth;

      scales[i] = particleRadius / particleSize;

      // Create bright color
      const color = new THREE.Color(category.color);
      particleColors.push(color);

      const velScale = category.velocityMultiplier * 0.02;
      velocities[i3] = (Math.random() - 0.5) * velScale;
      velocities[i3 + 1] = (Math.random() - 0.5) * velScale;
      velocities[i3 + 2] = (Math.random() - 0.5) * velScale * 0.5;

      phases[i] = Math.random() * Math.PI * 2;
    }

    return {
      positions,
      scales,
      particleColors,
      velocities,
      phases,
      particleData,
    };
  }, [count, viewport, particleSize, spacingMultiplier]);

  const geometry = useMemo(
    () => new THREE.SphereGeometry(particleSize, 16, 16),
    [particleSize]
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (meshRef.current) {
      for (let i = 0; i < count; i++) {
        meshRef.current.setColorAt(i, particleColors[i]);
      }
      if (meshRef.current.instanceColor) {
        meshRef.current.instanceColor.needsUpdate = true;
      }
    }
  }, [count, particleColors]);

  useFrame((state) => {
    if (!meshRef.current) return;

    const time = state.clock.elapsedTime;
    const delta = state.clock.getDelta();

    if (isAutoAnimating.current) {
      autoAnimateAngle.current += 0.005;
      targetMouse.current.x = Math.cos(autoAnimateAngle.current) * 0.4;
      targetMouse.current.y = Math.sin(autoAnimateAngle.current) * 0.4;
    }

    const deltaX = targetMouse.current.x - mouse.current.x;
    const deltaY = targetMouse.current.y - mouse.current.y;
    const distanceToTarget = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const easedLerp =
      lerpSpeed * easeOutCubic(Math.min(distanceToTarget * 2, 1));
    mouse.current.x += deltaX * easedLerp;
    mouse.current.y += deltaY * easedLerp;

    const mouseWorldX = mouse.current.x * viewport.width * 0.5;
    const mouseWorldY = mouse.current.y * viewport.height * 0.5;
    const effectiveRadius = magnetRadius * viewport.width;
    const deadZone = deadZoneRadius * viewport.width;
    const minParticleDistance = 0.4;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const pData = particleData[i];
      const velMultiplier = pData.velocityMultiplier;
      const massMultiplier = pData.mass;

      let x = positions[i3];
      let y = positions[i3 + 1];
      let z = positions[i3 + 2];

      const dampingFactor =
        PHYSICS_CONFIG.damping + (massMultiplier - 1) * 0.02;
      velocities[i3] *= Math.min(dampingFactor, 0.98);
      velocities[i3 + 1] *= Math.min(dampingFactor, 0.98);
      velocities[i3 + 2] *= Math.min(dampingFactor, 0.98);

      const dx = x - mouseWorldX;
      const dy = y - mouseWorldY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const myRadius = pData.radius;
      for (let j = 0; j < count; j++) {
        if (i === j) continue;
        const j3 = j * 3;
        const px = positions[j3];
        const py = positions[j3 + 1];
        const otherRadius = particleData[j].radius;
        const pdx = x - px;
        const pdy = y - py;
        const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
        const combinedMinDist =
          (myRadius + otherRadius) * 3 + minParticleDistance * 0.5;

        if (pDist < combinedMinDist && pDist > 0.01) {
          const repelForce =
            (((combinedMinDist - pDist) / combinedMinDist) *
              repulsionStrength *
              0.1) /
            massMultiplier;
          velocities[i3] += (pdx / pDist) * repelForce;
          velocities[i3 + 1] += (pdy / pDist) * repelForce;
        }
      }

      if (distance < effectiveRadius && distance > deadZone) {
        const normalizedDist =
          (distance - deadZone) / (effectiveRadius - deadZone);
        const force = ((1 - normalizedDist) * fieldStrength) / massMultiplier;
        const orbitSpeedMod = waveSpeed * velMultiplier;
        const angle = Math.atan2(dy, dx) + time * orbitSpeedMod + phases[i];
        const orbitRadius = Math.max(
          deadZone * 1.5,
          ringRadius *
            viewport.width *
            (0.5 + Math.sin(time * pulseSpeed + phases[i]) * waveAmplitude)
        );
        const targetX = mouseWorldX + Math.cos(angle) * orbitRadius;
        const targetY = mouseWorldY + Math.sin(angle) * orbitRadius;
        velocities[i3] += (targetX - x) * force * 0.02 * velMultiplier;
        velocities[i3 + 1] += (targetY - y) * force * 0.02 * velMultiplier;
        const targetZ = (1 - normalizedDist) * depthFactor * 0.5;
        z += (targetZ - z) * lerpSpeed * 0.5;
      } else if (distance <= deadZone) {
        const pushForce =
          (((deadZone - distance) / deadZone) * 0.3 * velMultiplier) /
          massMultiplier;
        if (distance > 0.01) {
          velocities[i3] += (dx / distance) * pushForce;
          velocities[i3 + 1] += (dy / distance) * pushForce;
        }
      } else {
        const floatIntensity = 0.002 * velMultiplier;
        velocities[i3] +=
          Math.sin(time * 0.5 * velMultiplier + phases[i]) * floatIntensity;
        velocities[i3 + 1] +=
          Math.cos(time * 0.5 * velMultiplier + phases[i]) * floatIntensity;
        const baseZ =
          pData.categoryName === 'large'
            ? 2
            : pData.categoryName === 'medium'
              ? 0
              : -2;
        z += ((baseZ - z) * lerpSpeed * 0.3) / massMultiplier;
      }

      const maxVel = PHYSICS_CONFIG.maxVelocity * 0.1 * velMultiplier;
      const vel = Math.sqrt(velocities[i3] ** 2 + velocities[i3 + 1] ** 2);
      if (vel > maxVel) {
        const scale = maxVel / vel;
        velocities[i3] *= scale;
        velocities[i3 + 1] *= scale;
      }

      x += velocities[i3];
      y += velocities[i3 + 1];
      z += velocities[i3 + 2];

      const boundX = viewport.width * 0.6;
      const boundY = viewport.height * 0.6;
      if (x > boundX) x = -boundX;
      if (x < -boundX) x = boundX;
      if (y > boundY) y = -boundY;
      if (y < -boundY) y = boundY;

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      const pulseFreq = pulseSpeed / massMultiplier;
      const pulseAmount =
        pData.categoryName === 'large'
          ? 0.15
          : pData.categoryName === 'medium'
            ? 0.2
            : 0.3;
      const pulseScale =
        1 + Math.sin(time * pulseFreq + phases[i]) * pulseAmount;
      const finalScale = scales[i] * pulseScale;

      dummy.position.set(x, y, z);
      const rotSpeed = rotationSpeed / massMultiplier;
      dummy.rotation.set(
        time * rotSpeed + phases[i],
        time * rotSpeed * 0.7 + phases[i],
        time * rotSpeed * 0.5 + phases[i]
      );
      dummy.scale.setScalar(finalScale);
      dummy.updateMatrix();

      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, count]}
      frustumCulled={false}
    >
      <meshBasicMaterial
        color="#8B5CF6"
        transparent
        opacity={0.95}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

export default function AntigravityParticles({
  count = 60,
  magnetRadius = 0.42,
  particleSize = 0.1,
  fieldStrength = 0.4,
  spacingMultiplier = 1.3,
  deadZoneRadius = 0.12,
  repulsionStrength = 0.6,
  className = '',
  style = {},
  ...props
}) {
  return (
    <div
      className={`absolute inset-0 ${className}`}
      style={{ pointerEvents: 'none', ...style }}
    >
      <Canvas
        camera={{ position: [0, 0, 20], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        style={{ background: 'transparent' }}
      >
        <AntigravityInner
          count={count}
          magnetRadius={magnetRadius}
          particleSize={particleSize}
          fieldStrength={fieldStrength}
          spacingMultiplier={spacingMultiplier}
          deadZoneRadius={deadZoneRadius}
          repulsionStrength={repulsionStrength}
          {...props}
        />
      </Canvas>
    </div>
  );
}
