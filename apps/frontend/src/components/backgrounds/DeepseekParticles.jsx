import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';

const AnimatedBackground = ({ enableMouseMovement = false }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const particlesRef = useRef(null);
  const wireframeRef = useRef(null);
  const centralDiscRef = useRef(null);
  const centralPlaneRef = useRef(null);
  const magneticTubesRef = useRef(null);
  const poleIndicatorsRef = useRef(null);
  const animationRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, isDragging: false, startX: 0, startY: 0, normalizedX: 0, normalizedY: 0, isInteractingWithTorus: false });
  const raycasterRef = useRef(new THREE.Raycaster());
  const currentStageRef = useRef(0);

  // Locked to stage 2 (Perfect Sphere) — stage switching removed for the purple page.
  const [currentStage] = useState(2);
  const [prevStage, setPrevStage] = useState(0);
  const [stageJustChanged, setStageJustChanged] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoveredTube, setHoveredTube] = useState(null);
  const particleCount = 2600;

  // Initialize Three.js scene
  const initScene = useCallback(() => {
    if (!mountRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 30;
    cameraRef.current = camera;

    // Renderer with enhanced settings
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add subtle fog
    scene.fog = new THREE.Fog(0x0a0a1a, 30, 100);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Add directional light for glossy effect
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Create particles
    createParticles();

    // Start animation
    animate();
    console.log('🎬 DeepseekParticles: Scene initialized with', particleCount, 'particles');
  }, []);

  // Create particle system with spheres
  const createParticles = () => {
    if (!sceneRef.current) {
      console.warn('sceneRef not initialized, skipping createParticles');
      return;
    }
    
    // Create sphere geometry for particles
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    // Color palette - Purple, Red, Yellow
    const colorPalette = [
      new THREE.Color(0x8b5cf6), // Purple
      new THREE.Color(0xff0000), // Red
      new THREE.Color(0xffff00), // Yellow
    ];

    // Initial positions with 30% larger gaps
    for (let i = 0; i < particleCount; i++) {
      const spreadMultiplier = 1.3;
      positions[i * 3] = (Math.random() - 0.5) * 2 * spreadMultiplier;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2 * spreadMultiplier;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2 * spreadMultiplier;
      
      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      
      sizes[i] = Math.random() * 0.21 + 0.09;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Create sphere material with glossy surface
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.3,
      metalness: 0.7,
      transparent: true,
      opacity: 0.8,
    });

    // Create individual spheres
    const particles = new THREE.Group();
    const sphereGeometry = new THREE.SphereGeometry(0.1, 8, 6);
    
    for (let i = 0; i < particleCount; i++) {
      const sphere = new THREE.Mesh(sphereGeometry, material.clone());
      
      sphere.position.set(
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2]
      );
      
      sphere.material.color.setRGB(
        colors[i * 3],
        colors[i * 3 + 1],
        colors[i * 3 + 2]
      );
      
      sphere.scale.setScalar(sizes[i] * 10);
      particles.add(sphere);
    }
    
    sceneRef.current.add(particles);
    particlesRef.current = particles;

    // Create wireframe for sphere (stage 2) - 75% smaller diameter
    const wireframeGeometry = new THREE.SphereGeometry(0.375, 32, 24);
    const wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    const wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
    wireframe.visible = false;
    sceneRef.current.add(wireframe);
    wireframeRef.current = wireframe;

    // Create central disc for sphere (stage 2) - 75% smaller diameter
    const discGeometry = new THREE.CircleGeometry(0.375, 32);
    const discMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.2,
    });
    const centralDisc = new THREE.Mesh(discGeometry, discMaterial);
    centralDisc.rotation.x = Math.PI / 2; // Rotate to be horizontal
    centralDisc.visible = false;
    sceneRef.current.add(centralDisc);
    centralDiscRef.current = centralDisc;

    // Create magnetic field equatorial plane (for stage 3)
    const ringGeometry = new THREE.TorusGeometry(3.5, 1.2, 64);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x4a90e2,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.08,
      wireframe: true,
      wireframeLinewidth: 2
    });
    const centralPlane = new THREE.Mesh(ringGeometry, planeMaterial);
    centralPlane.rotation.x = Math.PI / 2; // Horizontal ring (equatorial)
    centralPlane.visible = false; // Hidden by default
    sceneRef.current.add(centralPlane);
    centralPlaneRef.current = centralPlane;

    // Add magnetic pole indicators
    const poleGeometry = new THREE.ConeGeometry(0.5, 2, 8);
    const northPoleMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4444,
      transparent: true,
      opacity: 0.3,
    });
    const southPoleMaterial = new THREE.MeshBasicMaterial({
      color: 0x4444ff,
      transparent: true,
      opacity: 0.3,
    });

    const northPole = new THREE.Mesh(poleGeometry, northPoleMaterial);
    northPole.position.set(0, 3, 0);
    northPole.rotation.x = Math.PI;
    const southPole = new THREE.Mesh(poleGeometry, southPoleMaterial);
    southPole.position.set(0, -3, 0);

  const poleIndicators = new THREE.Group();
    poleIndicators.add(northPole);
    poleIndicators.add(southPole);
    poleIndicators.visible = false;
    sceneRef.current.add(poleIndicators);
    poleIndicatorsRef.current = poleIndicators;
  };

  // Create solid magnetic field tubes - Purple torus with mouse interaction
  const createMagneticFieldTubes = () => {
    if (!sceneRef.current) return;

    const tubeGroup = new THREE.Group();

    // Create purple solid torus (donut structure)
    const torusGeometry = new THREE.TorusGeometry(10, 3.5, 32, 64);
    const torusMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x8b5cf6, // Purple
      transparent: true,
      opacity: 0.5,
      roughness: 0.3,
      metalness: 0.5,
      side: THREE.DoubleSide
    });

    const torus = new THREE.Mesh(torusGeometry, torusMaterial);
    torus.userData = { id: 'purple-torus', name: 'Purple Torus', isInteractable: true };
    torus.rotation.x = Math.PI / 2; // Rotate to lay flat initially
    tubeGroup.add(torus);

    tubeGroup.visible = false;
    sceneRef.current.add(tubeGroup);
    magneticTubesRef.current = tubeGroup;
  };

  // Update stage change handler - magnetic tubes only visible in stage 3
  useEffect(() => {
    if (magneticTubesRef.current) {
      magneticTubesRef.current.visible = (currentStage === 3);
      console.log(`📐 Magnetic tubes visible: ${magneticTubesRef.current.visible}`);
    }
  }, [currentStage, particleCount]);

  // Add to cleanup effect when magnetic tubes are removed
  useEffect(() => {
    return () => {
      if (magneticTubesRef.current && sceneRef.current) {
        sceneRef.current.remove(magneticTubesRef.current);
      }
    };
  }, []);

  // Add to stage change handler - magnetic tubes disabled
  useEffect(() => {
    // Magnetic tubes disabled - green tubular structure removed
  }, [currentStage]);

  // Create nested spheres for stage 0 (singularity)
  const createNestedSingularity = () => {
    if (!particlesRef.current || !sceneRef.current) return;

    sceneRef.current.remove(particlesRef.current);
    wireframeRef.current.visible = false;
    centralDiscRef.current.visible = false;

    const particles = new THREE.Group();

    // Color palette for nested singularity - Purple, Red, Yellow
    const singularityColors = [
      new THREE.Color(0x8b5cf6), // Purple
      new THREE.Color(0xff0000), // Red
      new THREE.Color(0xffff00), // Yellow
    ];

    // Create nested spheres - one particle made of many smaller spheres
    const levels = 10;
    const spheresPerLevel = 128;
    const totalSpheres = levels * spheresPerLevel;

    for (let level = 0; level < levels; level++) {
      const radius = level * 0.04 + 0.05;
      const opacity = 1 - (level * 0.09);
      const size = 0.015 + (level * 0.004);

      for (let i = 0; i < spheresPerLevel; i++) {
        const phi = Math.acos(-1 + (2 * i) / spheresPerLevel);
        const theta = Math.sqrt(spheresPerLevel * Math.PI) * phi;

        const sphereGeometry = new THREE.SphereGeometry(size, 6, 4);

        // Assign random color from palette
        const colorIndex = Math.floor(Math.random() * singularityColors.length);
        const sphereColor = singularityColors[colorIndex].clone().multiplyScalar(0.7 + level * 0.03);

        const sphereMaterial = new THREE.MeshStandardMaterial({
          color: sphereColor,
          roughness: 0.2,
          metalness: 0.8,
          transparent: true,
          opacity: opacity,
        });

        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

        // Position on nested sphere surface
        sphere.position.set(
          radius * Math.cos(theta) * Math.sin(phi),
          radius * Math.sin(theta) * Math.sin(phi),
          radius * Math.cos(phi)
        );

        particles.add(sphere);
      }
    }

    sceneRef.current.add(particles);
    particlesRef.current = particles;
  };

  // Animation loop
  function animate() {
    if (!particlesRef.current || !cameraRef.current || !rendererRef.current) return;

    const particles = particlesRef.current;
    const time = Date.now() * 0.00035; // 65% slower than original (0.001 * 0.35)

    // Debug: Log every 60 frames (≈1 second)
    if (rendererRef.current.info.render.frame % 60 === 0) {
      console.log(`🎬 Frame ${rendererRef.current.info.render.frame} | Stage: ${currentStageRef.current} | Particles: ${particles.children.length} | Camera Z: ${cameraRef.current.position.z.toFixed(2)}`);
    }
    
    // Update zoom level
    setZoomLevel(Math.max(1, Math.min(5, 30 / cameraRef.current.position.z)));

    // Update particle colors and appearance based on zoom
    particles.children.forEach((sphere) => {
      const material = sphere.material;
      const baseColor = material.color;
      
      // Darken color by 10% when zoomed in
      const darknessFactor = Math.max(0.5, 1 - (zoomLevel * 0.1));
      const darkenedColor = baseColor.clone().multiplyScalar(darknessFactor);
      material.color.copy(darkenedColor);
      
      // Adjust opacity and gloss based on zoom
      material.opacity = 0.6 + (zoomLevel * 0.08);
      material.roughness = 0.3 + (zoomLevel * 0.1);
    });

    // Stage-based animation
    const count = particles.children.length;
    
    // Update wireframe and disc visibility
    if (wireframeRef.current && centralDiscRef.current) {
      wireframeRef.current.visible = (currentStageRef.current === 2);
      centralDiscRef.current.visible = (currentStageRef.current === 2);

      if (currentStageRef.current === 2) {
        wireframeRef.current.rotation.y += 0.001;
        centralDiscRef.current.rotation.y += 0.001;
      }
    }

    particles.children.forEach((sphere, i) => {
      let tx, ty, tz;

      // Define color palette for all stages - Purple, Red, Yellow
      const colors = [
        new THREE.Color(0x8b5cf6), // Purple
        new THREE.Color(0xff0000), // Red
        new THREE.Color(0xffff00), // Yellow
      ];

      const angle = i * 0.1 + time;
      const radius = 15;

      switch (currentStageRef.current) {
        case 0: // Singularity - Nested sphere structure
          console.log('✨ Executing: Singularity animation');
          // Assign random color from palette
          const colorIndex0 = Math.floor(Math.random() * colors.length);
          sphere.material.color.copy(colors[colorIndex0]);

          if (count > 100) {
            // Each sphere in the nested structure rotates slowly
            const localAngle = angle * 0.5 + time * 0.3;
            const localRadius = 0.1 * Math.sin(time * 0.07 + i * 0.01) + 0.2;

            // Spherical coordinates for nested structure
            const phi = Math.acos(-1 + (2 * (i % 128)) / 128);
            const theta = Math.sqrt(128 * Math.PI) * phi;

            tx = localRadius * Math.cos(theta + time) * Math.sin(phi);
            ty = localRadius * Math.sin(theta + time) * Math.sin(phi);
            tz = localRadius * Math.cos(phi);
          } else {
            tx = 0;
            ty = 0;
            tz = 0;
          }

          if (i === 0) {
            console.log(`📍 Sample positions (0-Singularity):`, {
              p0: { x: tx.toFixed(3), y: ty.toFixed(3), z: tz.toFixed(3) },
              p1: { x: particles.children[1]?.position.x.toFixed(3), y: particles.children[1]?.position.y.toFixed(3), z: particles.children[1]?.position.z.toFixed(3) },
              p5: { x: particles.children[5]?.position.x.toFixed(3), y: particles.children[5]?.position.y.toFixed(3), z: particles.children[5]?.position.z.toFixed(3) }
            });
          }
          break;

        case 1: // Circle (perfect as before)
          console.log('✨ Executing: Circle animation');
          // Assign random color from palette
          const colorIndex1 = Math.floor(Math.random() * colors.length);
          sphere.material.color.copy(colors[colorIndex1]);

          const circleRadius = 12;
          const theta = (i / count) * Math.PI * 2 + time * 0.25; // 50% slower
          tx = Math.cos(theta) * circleRadius;
          ty = Math.sin(theta) * circleRadius;
          tz = (Math.random() - 0.5) * 0.5;

          if (i === 0) {
            console.log(`📍 Sample positions (1-Circle):`, {
              p0: { x: tx.toFixed(3), y: ty.toFixed(3), z: tz.toFixed(3) },
              p1: { x: particles.children[1]?.position.x.toFixed(3), y: particles.children[1]?.position.y.toFixed(3), z: particles.children[1]?.position.z.toFixed(3) },
              p5: { x: particles.children[5]?.position.x.toFixed(3), y: particles.children[5]?.position.y.toFixed(3), z: particles.children[5]?.position.z.toFixed(3) }
            });
          }
          break;

        case 2: // Perfect Sphere with radius 1.5, wireframe, and central disc - 50% smaller diameter, 50% more particles on disc
          console.log('✨ Executing: Perfect Sphere animation');
          // Assign random color from palette
          const colorIndex2 = Math.floor(Math.random() * colors.length);
          sphere.material.color.copy(colors[colorIndex2]);

          // Perfect sphere equation: x² + y² + z² = 0.140625 (radius = 0.375, 75% smaller circumference)
          const sphereRadius = 0.375;
          const phi = Math.acos(-1 + (2 * i) / count);
          const sphereTheta = Math.sqrt(count * Math.PI) * phi + time * 0.3;

          tx = sphereRadius * Math.cos(sphereTheta) * Math.sin(phi);
          ty = sphereRadius * Math.sin(sphereTheta) * Math.sin(phi);
          tz = sphereRadius * Math.cos(phi);

          // Add some particles to the central disc (22.5% of particles - 50% thicker band)
          if (i < count * 0.225) {
            const discRadius = 0.375 * Math.random();
            const discAngle = Math.random() * Math.PI * 2;
            tx = discRadius * Math.cos(discAngle);
            ty = discRadius * Math.sin(discAngle);
            tz = 0;
          }

          if (i === 0) {
            console.log(`📍 Sample positions (2-Sphere):`, {
              p0: { x: tx.toFixed(3), y: ty.toFixed(3), z: tz.toFixed(3) },
              p1: { x: particles.children[1]?.position.x.toFixed(3), y: particles.children[1]?.position.y.toFixed(3), z: particles.children[1]?.position.z.toFixed(3) },
              p5: { x: particles.children[5]?.position.x.toFixed(3), y: particles.children[5]?.position.y.toFixed(3), z: particles.children[5]?.position.z.toFixed(3) }
            });
          }
          break;

        case 3: // SOLID PURPLE TORUS - Interactive donut structure
          console.log('✨ Executing: Solid Purple Torus animation');

          // First, create solid torus if it doesn't exist
          if (!magneticTubesRef.current && sceneRef.current) {
            createMagneticFieldTubes();
          }

          // Make sure torus is visible
          if (magneticTubesRef.current) {
            magneticTubesRef.current.visible = true;

            if (!mouseRef.current.isDragging) {
              magneticTubesRef.current.rotation.x += 0.0000005; // 90% slower
              magneticTubesRef.current.rotation.y += 0.0000008; // 90% slower
              magneticTubesRef.current.rotation.z += 0.0000006; // 90% slower
            }
          }

          // Divide particles: 30% for central sphere, 70% distributed along tubes
          if (i < count * 0.2) {
            // Central sphere - CORE (Earth)
            const sphereRadius = 2;
            const phi = Math.acos(-1 + (2 * i) / (count * 0.2));
            const sphereTheta = Math.sqrt(count * 0.2 * Math.PI) * phi + time * 0.08;

            tx = sphereRadius * Math.cos(sphereTheta) * Math.sin(phi);
            ty = sphereRadius * Math.sin(sphereTheta) * Math.sin(phi);
            tz = sphereRadius * Math.cos(phi);

            // Individual colors for central sphere particles
            const colorPalette = [
              new THREE.Color(0x8b5cf6), // Purple
              new THREE.Color(0xff0000), // Red
              new THREE.Color(0xffff00), // Yellow
            ];
            const colorIndex = i % colorPalette.length;
            sphere.material.color.copy(colorPalette[colorIndex]);
            sphere.material.emissive.copy(colorPalette[colorIndex]);
            sphere.material.emissiveIntensity = 0.2;

          } else {
            // Particles distributed along magnetic field tubes
            const tubeParticleIndex = i - count * 0.2;
            const tubeParticleCount = count * 0.8;

            // Parameters for magnetic field tubes
            const majorRadius = 14;
            const tubeRadius = 2.5;

            // Slow majestic movement
            const tubeAngle = (tubeParticleIndex / tubeParticleCount) * Math.PI * 2 + time * 0.03;
            const u = tubeAngle;

            // Get tube parameters
            let fieldX, fieldY, fieldZ;

            fieldX = majorRadius * tubeRadius * Math.cos(tubeAngle) * Math.cos(u);
            fieldY = (majorRadius + tubeRadius * Math.sin(tubeAngle)) * 0.6;
            fieldZ = (majorRadius + tubeRadius * Math.cos(tubeAngle)) * Math.sin(u);

            const particleColor = new THREE.Color(0x8b5cf6);

            // Pulsing effect based on position
            const pulseStrength = 0.5 + 0.3 * Math.sin(time * 0.05 + tubeParticleIndex * 2);
            sphere.material.color.lerpColors(
              particleColor.clone().multiplyScalar(0.7),
              particleColor,
              pulseStrength
            );

            sphere.material.emissive = new THREE.Color(0x8b5cf6);
            sphere.material.emissiveIntensity = 0.3 * pulseStrength;

            // Make magnetic field particles translucent
            sphere.material.transparent = true;
            sphere.material.opacity = 0.6 + 0.2 * pulseStrength;

            // Particle size
            const size = 1.8 + pulseStrength * 1.2;
            sphere.scale.setScalar(size);
          }

          if (i === 0) {
            console.log(`🌍 Earth Magnetic Field - Central Core`);
          }
          break;

        case 4: { // Particle Field - Randomly sized and colored particles around entire structure
          console.log('✨ Executing: Particle Field animation');

          // Create a spherical distribution of particles with random sizes and colors
          const case4FieldRadius = 25 + Math.sin(time * 0.5 + i * 0.01) * 5;
          const case4Phi = Math.acos(-1 + (2 * i) / count);
          const case4Theta = Math.sqrt(count * Math.PI) * case4Phi + time * 0.1;

          // Position on sphere surface
          tx = case4FieldRadius * Math.cos(case4Theta + time * 0.05) * Math.sin(case4Phi);
          ty = case4FieldRadius * Math.sin(case4Theta + time * 0.05) * Math.sin(case4Phi);
          tz = case4FieldRadius * Math.cos(case4Phi);

          // Random size variation
          const case4RandomSize = 0.5 + Math.random() * 2;
          sphere.scale.setScalar(case4RandomSize);

          // Random color from neon palette
          const case4ColorIndex = Math.floor(Math.random() * colors.length);
          sphere.material.color.copy(colors[case4ColorIndex]);
          sphere.material.emissive.copy(colors[case4ColorIndex]);
          sphere.material.emissiveIntensity = 0.3 + Math.sin(time * 2 + i * 0.1) * 0.2;

          if (i === 0) {
            console.log(`📍 Sample positions (4-Particle Field):`, {
              p0: { x: tx.toFixed(3), y: ty.toFixed(3), z: tz.toFixed(3) },
              p1: { x: particles.children[1]?.position.x.toFixed(3), y: particles.children[1]?.position.y.toFixed(3), z: particles.children[1]?.position.z.toFixed(3) },
              p5: { x: particles.children[5]?.position.x.toFixed(3), y: particles.children[5]?.position.y.toFixed(3), z: particles.children[5]?.position.z.toFixed(3) }
            });
          }
          break;
        }

        default:
          tx = sphere.position.x;
          ty = sphere.position.y;
          tz = sphere.position.z;
      }

      // Smooth interpolation - use immediate positioning if stage just changed
      if (stageJustChanged) {
        // Immediate position update when stage changes
        sphere.position.x = tx;
        sphere.position.y = ty;
        sphere.position.z = tz;
      } else {
        // Smooth interpolation for ongoing animation
        const lerpFactor = 0.02;
        sphere.position.x += (tx - sphere.position.x) * lerpFactor;
        sphere.position.y += (ty - sphere.position.y) * lerpFactor;
        sphere.position.z += (tz - sphere.position.z) * lerpFactor;
      }

      // Add subtle rotation to each sphere
      sphere.rotation.x += 0.0035;
      sphere.rotation.y += 0.0035;
    });

    // Mouse rotation - either by dragging or by movement if enabled
    if (mouseRef.current.isDragging || enableMouseMovement) {
      particles.rotation.y += mouseRef.current.x * 0.0084;
      particles.rotation.x += mouseRef.current.y * 0.0084;

      if (wireframeRef.current.visible) {
        wireframeRef.current.rotation.y += mouseRef.current.x * 0.0084;
        wireframeRef.current.rotation.x += mouseRef.current.y * 0.0084;
      }

      // Enhanced mouse interaction for purple torus (20% more sensitive)
      if (magneticTubesRef.current && magneticTubesRef.current.visible && mouseRef.current.isInteractingWithTorus) {
        magneticTubesRef.current.rotation.y += mouseRef.current.x * 0.024;
        magneticTubesRef.current.rotation.x += mouseRef.current.y * 0.024;
      }
    }

    // Mouse movement-based rotation when enabled (parallax effect)
    if (enableMouseMovement && !mouseRef.current.isDragging) {
      const targetRotationX = -(mouseRef.current.normalizedY * 0.312);
      const targetRotationY = (mouseRef.current.normalizedX * 0.312);
      particles.rotation.x += (targetRotationX - particles.rotation.x) * 0.02;
      particles.rotation.y += (targetRotationY - particles.rotation.y) * 0.02;

      if (wireframeRef.current.visible) {
        wireframeRef.current.rotation.x += (targetRotationX - wireframeRef.current.rotation.x) * 0.02;
        wireframeRef.current.rotation.y += (targetRotationY - wireframeRef.current.rotation.y) * 0.02;
      }
    }

    // Auto-rotate slowly
    particles.rotation.y += 0.001;
    particles.rotation.x += 0.0005;

    // Raycasting for torus interaction (only in stage 3)
    if ((currentStageRef.current === 3 || currentStageRef.current === 4) && magneticTubesRef.current) {
      raycasterRef.current.setFromCamera(
        new THREE.Vector2(mouseRef.current.normalizedX, mouseRef.current.normalizedY),
        cameraRef.current
      );

      const intersects = raycasterRef.current.intersectObjects(
        magneticTubesRef.current.children.filter(child => child.userData && child.userData.isInteractable)
      );

      if (intersects.length > 0) {
        const torus = intersects[0].object;
        if (!mouseRef.current.isInteractingWithTorus) {
          mouseRef.current.isInteractingWithTorus = true;
          setHoveredTube(torus.userData.name);
          console.log(`🔍 Interacting with: ${torus.userData.name}`);
        }
      } else {
        if (mouseRef.current.isInteractingWithTorus) {
          mouseRef.current.isInteractingWithTorus = false;
          setHoveredTube(null);
          console.log(`🔍 Stopped interacting with torus`);
        }
      }
    }

    // Render
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    animationRef.current = requestAnimationFrame(animate);
  };

  // Mouse event handlers
  const handleMouseDown = (e) => {
    mouseRef.current.isDragging = true;
    mouseRef.current.startX = e.clientX;
    mouseRef.current.startY = e.clientY;
  };

  const handleMouseMove = (e) => {
    if (mouseRef.current.isDragging) {
      mouseRef.current.x = (e.clientX - mouseRef.current.startX) * 0.01;
      mouseRef.current.y = (e.clientY - mouseRef.current.startY) * 0.01;
    }
    mouseRef.current.normalizedX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseRef.current.normalizedY = -(e.clientY / window.innerHeight) * 2 + 1;
  };

  const handleMouseUp = () => {
    mouseRef.current.isDragging = false;
  };

  const handleWheel = (e) => {
    if (cameraRef.current) {
      const sensitivity = 0.03;
      cameraRef.current.position.z -= e.deltaY * sensitivity;
      // Extreme zoom: 0.5 (very close) to 500 (very far)
      cameraRef.current.position.z = Math.max(0.5, Math.min(500, cameraRef.current.position.z));
      console.log(`🔍 Zoom: ${cameraRef.current.position.z.toFixed(2)}`);
    }
  };

  // Handle stage changes
  useEffect(() => {
    console.log(`🎯 STAGE CHANGE: ${prevStage} → ${currentStage}`);
    console.log(`🔍 Particles count before: ${particlesRef.current?.children.length || 0}`);

    // Sync ref with state
    currentStageRef.current = currentStage;

    // Set the stageJustChanged flag to true when stage changes
    setStageJustChanged(true);

    // For stage 0, create the nested singularity
    if (currentStage === 0) {
      console.log('✨ Creating nested singularity structure...');
      createNestedSingularity();
    }
    // For other stages, ensure we have the basic particles structure
    else {
      console.log('✨ Creating basic particle structure...');
      // Recreate particles when transitioning from stage 0 to any other stage
      // Also recreate when transitioning between stages 1, 2, 3 to ensure proper shape
      if (!particlesRef.current ||
          particlesRef.current.children.length !== particleCount) {
        // Remove the current particles if they exist
        if (particlesRef.current && sceneRef.current) {
          sceneRef.current.remove(particlesRef.current);
        }
        // Create the basic particles structure
        createParticles();
      }
      console.log(`🔍 Particles count after: ${particlesRef.current?.children.length || 0}`);
    }

    // Update wireframe, disc, plane, and pole indicators visibility based on stage
    if (wireframeRef.current && centralDiscRef.current) {
      wireframeRef.current.visible = (currentStage === 2);
      centralDiscRef.current.visible = (currentStage === 2);
      console.log(`👁️ Wireframe visible: ${wireframeRef.current.visible}`);
    }
    // Hide/show central plane - only visible in stage 3 (Helical Torus)
    if (centralPlaneRef.current) {
      centralPlaneRef.current.visible = (currentStage === 3);
      console.log(`📐 Central plane visible: ${centralPlaneRef.current.visible}`);
    }
    // Hide/show pole indicators - only visible in stage 3 (Magnetic Field)
    if (poleIndicatorsRef.current) {
      poleIndicatorsRef.current.visible = (currentStage === 3);
      console.log(`🧲 Pole indicators visible: ${poleIndicatorsRef.current.visible}`);
    }
  }, [currentStage, particleCount]);

  // Effect to track stage changes and reset the flag after a short delay
  useEffect(() => {
    if (stageJustChanged) {
      // Reset the flag after a short delay to allow for immediate position setting
      const timer = setTimeout(() => {
        setStageJustChanged(false);
      }, 100); // 100ms should be enough for the positions to be set

      return () => clearTimeout(timer);
    }
  }, [stageJustChanged]);

  // Initialize and clean up
  useEffect(() => {
    initScene();

    // Add event listeners
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('wheel', handleWheel);

    // Handle resize
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    // Pause the render loop while the tab is hidden — 2600 particles of
    // per-frame trig is pure waste on a backgrounded page.
    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      } else if (!animationRef.current) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);

      if (mountRef.current && rendererRef.current?.domElement) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, [initScene]);

  return (
    <>
      <div
        ref={mountRef}
        id="canvas-container"
        className="fixed top-0 left-0 w-full h-full z-0"
      />
    </>
  );
};

export default AnimatedBackground;