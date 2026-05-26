import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS, ANIMATION_CONFIG } from './magneticFieldConstants';

const vertexShader = `
  uniform float uTime;
  uniform float uPhase;
  uniform vec3 uCubeColors[8];
  attribute vec3 aRandom;
  attribute float aParticleType;
  varying vec3 vColor;
  varying float vAlpha;
  
  vec3 magneticField(vec3 pos, float time) {
    float r = length(pos);
    vec3 B = vec3(0.0);
    if (r > 0.01) {
      float fieldStrength = 2.0 / (r * r * r);
      B.x = 3.0 * pos.x * pos.y * fieldStrength * 0.01;
      B.y = (3.0 * pos.y * pos.y - r * r) * fieldStrength * 0.01;
      B.z = 3.0 * pos.z * pos.y * fieldStrength * 0.01;
      float turb = sin(pos.x * 2.0 + time) * 0.1;
      B += vec3(turb, sin(pos.y * 3.0 + time) * 0.05, turb);
    }
    return B;
  }

  void main() {
    float t = uTime * 0.2 + aRandom.z * 10.0;
    float p = mod(uPhase, 6.0);
    
    vec3 pos = position;
    vec3 field = magneticField(pos, t);
    pos += field * 0.5;
    
    vColor = uCubeColors[int(mod(aParticleType * 8.0, 8.0))];
    vAlpha = 0.91 + length(field) * 0.3;
    
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = 3.0 / max(0.1, -mvPosition.z);
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;
  
  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float r = length(coord);
    if (r > 0.5) discard;
    float softness = 1.0 - smoothstep(0.3, 0.5, r);
    gl_FragColor = vec4(vColor, vAlpha * pow(softness, 2.0));
  }
`;

export default function MagneticParticles({ phase }) {
  const mesh = useRef();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPhase: { value: 0 },
      uCubeColors: { value: COLORS.cubePalette.map((c) => new THREE.Color(c)) },
    }),
    []
  );

  const { positions, randoms, types } = useMemo(() => {
    const count = ANIMATION_CONFIG.particleCount;
    const pos = new Float32Array(count * 3);
    const rand = new Float32Array(count * 3);
    const type = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.random() * 3;

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      rand[i * 3] = Math.random();
      rand[i * 3 + 1] = Math.random();
      rand[i * 3 + 2] = Math.random();
      type[i] = Math.random();
    }
    return { positions: pos, randoms: rand, types: type };
  }, []);

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.material.uniforms.uTime.value = state.clock.getElapsedTime();
      mesh.current.material.uniforms.uPhase.value = phase;
    }
  });

  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geom.setAttribute('aRandom', new THREE.Float32BufferAttribute(randoms, 3));
    geom.setAttribute(
      'aParticleType',
      new THREE.Float32BufferAttribute(types, 1)
    );
    return geom;
  }, [positions, randoms, types]);

  return (
    <points ref={mesh} geometry={geometry}>
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
