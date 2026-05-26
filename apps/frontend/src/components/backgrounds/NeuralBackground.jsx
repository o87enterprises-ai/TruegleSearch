import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';

export default function NeuralBackground() {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const animationFrameRef = useRef(null);
  const particlesRef = useRef([]);
  const sceneRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // --- ENHANCED CONFIGURATION ---
    const colors = {
      cyan: new THREE.Color(0x00e5ff),
      purple: new THREE.Color(0x8b5cf6),
      magenta: new THREE.Color(0xd946ef),
      bg: new THREE.Color(0x03030a),
    };

    const PARTICLE_COUNT = 400;
    const CONNECTION_DISTANCE = 120;
    const MAX_CONNECTIONS = 6;

    // --- SCENE SETUP ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = colors.bg;
    scene.fog = new THREE.FogExp2(colors.bg, 0.0015);

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      1,
      2000
    );
    camera.position.z = 350;
    camera.position.y = 50;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- LIGHTING ENHANCEMENTS ---
    const ambientLight = new THREE.AmbientLight(0x3300aa, 0.3);
    scene.add(ambientLight);

    const pointLights = [];
    for (let i = 0; i < 3; i++) {
      const light = new THREE.PointLight(colors.cyan, 0.8, 300);
      light.position.set(
        (Math.random() - 0.5) * 600,
        (Math.random() - 0.5) * 600,
        (Math.random() - 0.5) * 600
      );
      scene.add(light);
      pointLights.push(light);
    }

    // --- BIOLOGICAL STRUCTURE GENERATION ---
    const noise = new SimplexNoise();
    const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
    const particleSizes = new Float32Array(PARTICLE_COUNT);
    const particleRandoms = new Float32Array(PARTICLE_COUNT);
    const particlesData = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const baseRadius = 300;

      const noiseValue =
        noise.noise3d(
          Math.sin(theta) * 0.5,
          Math.cos(phi) * 0.5,
          Math.random()
        ) * 40;

      const radius = baseRadius + noiseValue;

      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta) * 0.8;
      const z = radius * Math.cos(phi) * 0.6;

      particlePositions[i * 3] = x;
      particlePositions[i * 3 + 1] = y;
      particlePositions[i * 3 + 2] = z;

      particleSizes[i] = 1.5 + Math.random() * 2.5;
      particleRandoms[i] = Math.random();

      particlesData.push({
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.15,
          (Math.random() - 0.5) * 0.15,
          (Math.random() - 0.5) * 0.15
        ),
        originalPos: new THREE.Vector3(x, y, z),
        noiseOffset: new THREE.Vector3(
          Math.random() * 100,
          Math.random() * 100,
          Math.random() * 100
        ),
        speed: 0.5 + Math.random() * 1.5,
      });
    }

    particlesRef.current = particlesData;

    // --- NEURON PARTICLES ---
    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(particlePositions, 3)
    );
    particlesGeometry.setAttribute(
      'size',
      new THREE.BufferAttribute(particleSizes, 1)
    );
    particlesGeometry.setAttribute(
      'aRandom',
      new THREE.BufferAttribute(particleRandoms, 1)
    );

    const particlesMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: colors.cyan },
        uColor2: { value: colors.purple },
        uMagenta: { value: colors.magenta },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uFogColor: { value: colors.bg },
        uFogNear: { value: 100 },
        uFogFar: { value: 1000 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uPixelRatio;
        attribute float size;
        attribute float aRandom;
        varying vec3 vColor;
        varying float vAlpha;
        varying float vPulse;
        varying float vDepth;

        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uMagenta;

        void main() {
          float displacement = sin(uTime * 0.5 + aRandom * 10.0) * 0.3;
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vDepth = -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;

          gl_PointSize = (size * 6.0 * uPixelRatio) * (300.0 / -mvPosition.z);
          gl_PointSize *= (1.0 + displacement * 0.3);

          float pulse1 = sin(uTime * 2.0 + aRandom * 10.0) * 0.5 + 0.5;
          float pulse2 = sin(uTime * 3.5 + aRandom * 20.0) * 0.3 + 0.7;
          vPulse = pulse1 * pulse2;
          
          float colorMix = (sin(position.y * 0.01 + uTime * 0.5) * 0.5 + 0.5);
          vec3 baseColor = mix(uColor2, uMagenta, colorMix);
          vColor = mix(baseColor, uColor1, vPulse);
          
          vAlpha = 0.8 + vPulse * 0.4;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        varying float vPulse;
        varying float vDepth;
        
        uniform vec3 uFogColor;
        uniform float uFogNear;
        uniform float uFogFar;

        void main() {
          vec2 coord = gl_PointCoord - vec2(0.5);
          float r = length(coord);
          if (r > 0.5) discard;
          
          vec3 normal = vec3(coord, sqrt(1.0 - dot(coord, coord)));
          float diffuse = max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0);
          float specular = pow(diffuse, 32.0) * 0.5;
          
          float innerGlow = smoothstep(0.5, 0.0, r);
          float outerGlow = smoothstep(0.5, 0.8, r);
          
          vec3 finalColor = vColor * (diffuse * 0.8 + 0.2) + specular * vec3(1.0);
          float alpha = vAlpha * (innerGlow + outerGlow * 0.3);
          
          float fogFactor = smoothstep(uFogNear, uFogFar, vDepth);
          finalColor = mix(finalColor, uFogColor, fogFactor);
          
          gl_FragColor = vec4(finalColor, alpha * (1.0 - fogFactor));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const particleSystem = new THREE.Points(
      particlesGeometry,
      particlesMaterial
    );
    scene.add(particleSystem);

    // --- SYNAPTIC CONNECTIONS ---
    const linePositions = [];
    const lineWidths = new Float32Array(10000);
    const linePulseOffsets = [];
    let connectionCount = 0;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      let connections = 0;
      const p1 = new THREE.Vector3(
        particlePositions[i * 3],
        particlePositions[i * 3 + 1],
        particlePositions[i * 3 + 2]
      );

      for (let j = i + 1; j < PARTICLE_COUNT; j++) {
        if (connections >= MAX_CONNECTIONS) break;

        const p2 = new THREE.Vector3(
          particlePositions[j * 3],
          particlePositions[j * 3 + 1],
          particlePositions[j * 3 + 2]
        );

        const dist = p1.distanceTo(p2);
        const distFactor = 1.0 - dist / CONNECTION_DISTANCE;

        if (dist < CONNECTION_DISTANCE) {
          if (Math.random() < distFactor * 0.7) {
            linePositions.push(p1.x, p1.y, p1.z);
            linePositions.push(p2.x, p2.y, p2.z);

            const width = 0.3 + distFactor * 1.5;
            lineWidths[connectionCount * 2] = width;
            lineWidths[connectionCount * 2 + 1] = width;

            const pulseSpeed = 2.0 + Math.random() * 3.0;
            const pulseOffset = Math.random() * 100.0;
            linePulseOffsets.push(pulseSpeed, pulseOffset);
            linePulseOffsets.push(pulseSpeed, pulseOffset);

            connections++;
            connectionCount++;
          }
        }
      }
    }

    const linesGeometry = new THREE.BufferGeometry();
    linesGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(linePositions, 3)
    );
    linesGeometry.setAttribute(
      'lineWidth',
      new THREE.Float32BufferAttribute(lineWidths, 1)
    );
    linesGeometry.setAttribute(
      'aPulseParams',
      new THREE.Float32BufferAttribute(linePulseOffsets, 2)
    );

    const linesMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorBase: { value: colors.purple },
        uColorPulse: { value: colors.cyan },
        uFogColor: { value: colors.bg },
        uFogNear: { value: 150 },
        uFogFar: { value: 800 },
      },
      vertexShader: `
        attribute float lineWidth;
        attribute vec2 aPulseParams;
        varying float vPulsePos;
        varying float vLineWidth;
        varying float vDepth;
        varying vec2 vPulseParams;
        
        void main() {
          vLineWidth = lineWidth;
          vPulseParams = aPulseParams;
          
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vDepth = -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
          
          vPulsePos = position.x * 0.02 + position.y * 0.02 + position.z * 0.02;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColorBase;
        uniform vec3 uColorPulse;
        uniform vec3 uFogColor;
        uniform float uFogNear;
        uniform float uFogFar;
        
        varying float vPulsePos;
        varying float vLineWidth;
        varying float vDepth;
        varying vec2 vPulseParams;

        void main() {
          float pulseSpeed = vPulseParams.x;
          float pulseOffset = vPulseParams.y;
          
          float pulse1 = fract(vPulsePos * 0.5 + uTime * pulseSpeed * 0.5 + pulseOffset);
          float pulse2 = fract(vPulsePos * 0.3 + uTime * pulseSpeed * 0.8 + pulseOffset * 1.3);
          
          float pulseIntensity1 = smoothstep(0.95, 1.0, pulse1) * 2.0;
          float pulseIntensity2 = smoothstep(0.9, 1.0, pulse2);
          
          float pulse = max(pulseIntensity1, pulseIntensity2 * 0.7);
          
          float baseGlow = 0.1 + sin(vPulsePos * 2.0 + uTime * 0.5) * 0.05;
          
          float noise = sin(vPulsePos * 20.0 + uTime * 5.0) * 0.1;
          float finalWidth = vLineWidth * (1.0 + noise * pulse);
          
          float lineEdge = abs(gl_PointCoord.y - 0.5) * 2.0;
          float alpha = smoothstep(finalWidth, 0.0, lineEdge);
          
          vec3 baseColor = mix(uColorBase * 0.3, uColorBase, baseGlow);
          vec3 pulseColor = uColorPulse * pulse;
          vec3 finalColor = baseColor + pulseColor;
          
          finalColor += vec3(pulseIntensity1 * 0.5);
          
          float fogFactor = smoothstep(uFogNear, uFogFar, vDepth);
          finalColor = mix(finalColor, uFogColor, fogFactor);
          
          gl_FragColor = vec4(finalColor, alpha * (1.0 - fogFactor) * (0.15 + pulse * 0.85));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const linesMesh = new THREE.LineSegments(linesGeometry, linesMaterial);
    scene.add(linesMesh);

    // --- CAMERA ANIMATION ---
    let cameraAngle = 0;
    const cameraRadius = 350;
    const cameraTarget = new THREE.Vector3(0, 0, 0);

    // --- ANIMATION LOOP ---
    const clock = new THREE.Clock();

    const animate = () => {
      const time = clock.getElapsedTime();
      const delta = clock.getDelta();

      particlesMaterial.uniforms.uTime.value = time;
      linesMaterial.uniforms.uTime.value = time;

      cameraAngle += delta * 0.05;
      camera.position.x = Math.sin(cameraAngle) * cameraRadius;
      camera.position.z = Math.cos(cameraAngle * 0.7) * cameraRadius;
      camera.position.y =
        Math.sin(cameraAngle * 0.3) * 80 + 30 + Math.sin(time * 0.5) * 0.5;

      camera.lookAt(cameraTarget);

      pointLights.forEach((light, i) => {
        light.position.x = Math.sin(time * 0.3 + i) * 400;
        light.position.y = Math.cos(time * 0.4 + i) * 400;
        light.position.z = Math.sin(time * 0.5 + i) * 400;
        light.intensity = 0.5 + Math.sin(time * 2 + i) * 0.3;
      });

      const positions = particleSystem.geometry.attributes.position.array;
      particlesRef.current.forEach((particle, i) => {
        const noiseX =
          noise.noise3d(
            particle.noiseOffset.x + time * particle.speed,
            particle.noiseOffset.y,
            particle.noiseOffset.z
          ) * 10;

        const noiseY =
          noise.noise3d(
            particle.noiseOffset.x,
            particle.noiseOffset.y + time * particle.speed,
            particle.noiseOffset.z
          ) * 10;

        const noiseZ =
          noise.noise3d(
            particle.noiseOffset.x,
            particle.noiseOffset.y,
            particle.noiseOffset.z + time * particle.speed
          ) * 10;

        positions[i * 3] = particle.originalPos.x + noiseX;
        positions[i * 3 + 1] = particle.originalPos.y + noiseY;
        positions[i * 3 + 2] = particle.originalPos.z + noiseZ;
      });

      particleSystem.geometry.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);

      const pixelRatio = Math.min(window.devicePixelRatio, 2);
      renderer.setPixelRatio(pixelRatio);
      particlesMaterial.uniforms.uPixelRatio.value = pixelRatio;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (containerRef.current && rendererRef.current?.domElement) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }

      [renderer, scene].forEach((obj) => {
        if (obj?.dispose) obj.dispose();
      });

      [
        particlesGeometry,
        linesGeometry,
        particlesMaterial,
        linesMaterial,
      ].forEach((resource) => {
        if (resource?.dispose) resource.dispose();
      });
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0 bg-black overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            'radial-gradient(circle at 20% 50%, rgba(56, 189, 248, 0.15) 0%, transparent 50%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(circle at 80% 50%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, rgba(5, 5, 16, 0.9) 80%)',
        }}
      />
    </div>
  );
}
