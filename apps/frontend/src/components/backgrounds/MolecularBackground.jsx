import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function MolecularBackground() {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const animationFrameRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Truegle Color Spectrum (matching logo gradient)
    const TruegleSpectrum = [
      0xff0000, // Red
      0xff6b00, // Orange
      0xffd700, // Yellow
      0x00ff00, // Green
      0x00e5ff, // Cyan
      0x8b5cf6, // Purple
    ];

    // --- SCENE SETUP ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0e);
    // Increased fog to fade background elements (Clean Design Fix)
    scene.fog = new THREE.FogExp2(0x020204, 0.012);

    // --- CAMERA ---
    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );
    camera.position.set(0, 0, 90);

    // --- RENDERER ---
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5; // Slightly reduced exposure

    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- LIGHTING (Softened) ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const light1 = new THREE.PointLight(0xffffff, 200); // Reduced intensity
    light1.position.set(40, 60, 60);
    scene.add(light1);

    const light2 = new THREE.PointLight(0xffaaee, 160); // Reduced intensity
    light2.position.set(-60, -40, 20);
    scene.add(light2);

    const light3 = new THREE.PointLight(0x00ffff, 140); // Reduced intensity
    light3.position.set(0, 80, -40);
    scene.add(light3);

    // --- GENERATION CONFIG (Reduced Density) ---
    const gridSize = 22;
    const spacing = 7;
    const density = 0.05; // Reduced from 0.30 to clean up visual noise

    // --- MATERIALS ---
    const atomMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.2, // Slightly rougher for softer look
      metalness: 0.1,
      transmission: 0.5,
      thickness: 4.0,
      ior: 1.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.2,
      attenuationDistance: 10,
      attenuationColor: new THREE.Color(0xffffff),
    });

    const bondMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444, // Darker base
      roughness: 0.5,
      metalness: 0.6,
      emissive: new THREE.Color(0x000000),
    });

    // Pulsing bonds shader - Reduced intensity
    const bondUniforms = { uTime: { value: 0 } };

    bondMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = bondUniforms.uTime;

      shader.vertexShader = `
        varying vec3 vInstancePos;
        ${shader.vertexShader}
      `.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vInstancePos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        `
      );

      shader.fragmentShader = `
        uniform float uTime;
        varying vec3 vInstancePos;
        ${shader.fragmentShader}
      `.replace(
        '#include <emissivemap_fragment>',
        `
        #include <emissivemap_fragment>
        float wave = sin(vInstancePos.x * 0.15 + vInstancePos.y * 0.1 + uTime * 2.0);
        float pulse = smoothstep(0.9, 1.0, wave);
        vec3 glowColor = vec3(0.0, 0.7, 0.9); 
        // Reduced glow multiplier from 3.0 to 1.2 for subtle effect
        totalEmissiveRadiance += glowColor * pulse * 2.5;
        `
      );
    };

    // --- GEOMETRY ---
    const sphereGeo = new THREE.SphereGeometry(1.4, 32, 32);
    const bondGeo = new THREE.CylinderGeometry(0.15, 0.15, 1, 8); // Thinner bonds
    bondGeo.rotateX(Math.PI / 2);

    // --- INSTANCING SETUP ---
    const maxAtoms = Math.pow(gridSize, 3);
    const maxBonds = maxAtoms * 4;

    const atomMesh = new THREE.InstancedMesh(sphereGeo, atomMaterial, maxAtoms);
    const bondMesh = new THREE.InstancedMesh(bondGeo, bondMaterial, maxBonds);

    const dummy = new THREE.Object3D();

    let atomCount = 0;
    let bondCount = 0;

    const gridMap = new Map();

    // Spectrum color mapping
    const getSpectrumColor = (x, y, z) => {
      const normalizedX = (x / gridSize) * 1.2;
      const normalizedY = (y / gridSize) * 0.3;

      let t = (normalizedX + normalizedY) % 1.0;
      if (t < 0) t += 1;

      const spectrumLen = TruegleSpectrum.length;
      const floatIndex = t * (spectrumLen - 1);
      const index1 = Math.floor(floatIndex);
      const index2 = Math.min(spectrumLen - 1, index1 + 1);
      const mix = floatIndex - index1;

      const c1 = new THREE.Color(TruegleSpectrum[index1]);
      const c2 = new THREE.Color(TruegleSpectrum[index2]);

      return c1.lerp(c2, mix).multiplyScalar(1.5); // Reduced brightness multiplier
    };

    // --- LATTICE GENERATION ---
    const offset = (gridSize * spacing) / 2;

    for (let x = 0; x < gridSize; x++) {
      for (let y = 0; y < gridSize; y++) {
        for (let z = 0; z < gridSize; z++) {
          const wave = Math.sin(x * 0.4) + Math.cos(y * 0.4);
          const probability = density + wave * 0.05;

          if (Math.random() > probability) continue;

          const jX = (Math.random() - 0.5) * spacing * 0.5;
          const jY = (Math.random() - 0.5) * spacing * 0.5;
          const jZ = (Math.random() - 0.5) * spacing * 0.5;

          const posX = x * spacing - offset + jX;
          const posY = y * spacing - offset + jY;
          const posZ = z * spacing - offset + jZ;

          dummy.position.set(posX, posY, posZ);

          const scale = 0.5 + Math.random() * 0.6;
          dummy.scale.setScalar(scale);
          dummy.updateMatrix();

          atomMesh.setMatrixAt(atomCount, dummy.matrix);

          const atomColor = getSpectrumColor(x, y, z);
          atomMesh.setColorAt(atomCount, atomColor);

          gridMap.set(`${x},${y},${z}`, {
            pos: new THREE.Vector3(posX, posY, posZ),
          });

          atomCount++;
        }
      }
    }

    // --- BOND GENERATION ---
    gridMap.forEach((data, key) => {
      const [sx, sy, sz] = key.split(',').map(Number);

      const neighbors = [
        [sx + 1, sy, sz],
        [sx, sy + 1, sz],
        [sx, sy, sz + 1],
        [sx + 1, sy + 1, sz],
      ];

      neighbors.forEach(([nx, ny, nz]) => {
        const nKey = `${nx},${ny},${nz}`;
        if (gridMap.has(nKey)) {
          const nData = gridMap.get(nKey);
          const dist = data.pos.distanceTo(nData.pos);

          if (dist < spacing * 1.8) {
            const start = data.pos;
            const end = nData.pos;

            dummy.position.copy(start).lerp(end, 0.5);
            dummy.lookAt(end);
            dummy.scale.set(1, 1, dist);
            dummy.updateMatrix();

            if (bondCount < maxBonds) {
              bondMesh.setMatrixAt(bondCount, dummy.matrix);
              bondCount++;
            }
          }
        }
      });
    });

    atomMesh.count = atomCount;
    atomMesh.instanceMatrix.needsUpdate = true;
    if (atomMesh.instanceColor) atomMesh.instanceColor.needsUpdate = true;

    bondMesh.count = bondCount;
    bondMesh.instanceMatrix.needsUpdate = true;

    // --- PARTICLE FIELD (Reduced) ---
    const particleCount = 200; // Reduced to ~33%
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const pColor = new THREE.Color();

    for (let i = 0; i < particleCount; i++) {
      const spread = gridSize * spacing * 1.2;
      const x = (Math.random() - 0.5) * spread;
      const y = (Math.random() - 0.5) * spread;
      const z = (Math.random() - 0.5) * spread;

      particlePositions[i * 3] = x;
      particlePositions[i * 3 + 1] = y;
      particlePositions[i * 3 + 2] = z;

      const colorHex =
        TruegleSpectrum[Math.floor(Math.random() * TruegleSpectrum.length)];
      pColor.setHex(colorHex);
      particleColors[i * 3] = pColor.r;
      particleColors[i * 3 + 1] = pColor.g;
      particleColors[i * 3 + 2] = pColor.b;
    }

    particleGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(particlePositions, 3)
    );
    particleGeo.setAttribute(
      'color',
      new THREE.BufferAttribute(particleColors, 3)
    );

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.6, // Visible particles
      vertexColors: true,
      transparent: true,
      opacity: 0.6, // Brighter particles
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });

    const particleSystem = new THREE.Points(particleGeo, particleMaterial);

    const pivot = new THREE.Group();
    pivot.add(atomMesh);
    pivot.add(bondMesh);
    scene.add(pivot);
    scene.add(particleSystem);

    // --- ANIMATION ---
    const clock = new THREE.Clock();

    const animate = () => {
      const time = clock.getElapsedTime();

      bondUniforms.uTime.value = time;

      // Slower rotation for less distraction
      pivot.rotation.y = time * 0.02;
      pivot.rotation.x = Math.sin(time * 0.1) * 0.03;

      particleSystem.rotation.y = -time * 0.005;

      camera.position.z = 90 + Math.sin(time * 0.15) * 5;

      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!camera || !renderer) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
      if (
        containerRef.current &&
        rendererRef.current &&
        rendererRef.current.domElement.parentNode === containerRef.current
      ) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      renderer.dispose();
      atomMaterial.dispose();
      bondMaterial.dispose();
      particleMaterial.dispose();
      sphereGeo.dispose();
      bondGeo.dispose();
      particleGeo.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 min-h-screen w-full z-0 bg-black"
    />
  );
}
