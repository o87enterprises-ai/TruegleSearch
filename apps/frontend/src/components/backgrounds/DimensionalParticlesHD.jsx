import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';

const AnimatedBackground = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const particlesRef = useRef(null);
  const animationRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, isDragging: false, startX: 0, startY: 0 });
  const currentStageRef = useRef(0);

  const [currentStage, setCurrentStage] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const particleCount = 2600;

  // Initialize Three.js scene
  const initScene = useCallback(() => {
    if (!mountRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
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

    // Add lights for MeshStandardMaterial
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 50, 50);
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0x3b82f6, 1, 100);
    pointLight.position.set(0, 0, 20);
    scene.add(pointLight);

    // Create particles
    createParticles();

    // Start animation
    animate();
    console.log('🎬 DimensionalParticlesHD: Scene initialized with', particleCount, 'particles');
  }, []);

  // Create particle system with spheres
  const createParticles = () => {
    // Create sphere geometry for particles (instead of points)
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    // Color palette
    const colorPalette = [
      new THREE.Color(0x3b82f6), // Blue
      new THREE.Color(0x60a5fa), // Light blue
      new THREE.Color(0x8b5cf6), // Purple
      new THREE.Color(0xa78bfa), // Light purple
    ];

    // Initial positions with 30% larger gaps
    for (let i = 0; i < particleCount; i++) {
      // Spread particles further apart
      const spreadMultiplier = 1.3; // 30% larger gaps
      positions[i * 3] = (Math.random() - 0.5) * 2 * spreadMultiplier;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2 * spreadMultiplier;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2 * spreadMultiplier;
      
      // Random color
      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      
      // Size variation - 30% smaller on average
      sizes[i] = Math.random() * 0.21 + 0.09; // Original: 0.3 * 0.7 = 0.21
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Create sphere material with glossy surface
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.3, // More glossy
      metalness: 0.7, // Metallic shine
      transparent: true,
      opacity: 0.8, // Less opaque
    });

    // Create individual spheres instead of points
    const particles = new THREE.Group();
    
    // Create sphere geometry template
    const sphereGeometry = new THREE.SphereGeometry(0.1, 8, 6); // Low poly for performance
    
    for (let i = 0; i < particleCount; i++) {
      const sphere = new THREE.Mesh(sphereGeometry, material.clone());

      // Set position
      sphere.position.set(
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2]
      );

      // Set color
      sphere.material.color.setRGB(
        colors[i * 3],
        colors[i * 3 + 1],
        colors[i * 3 + 2]
      );

      // Set size - increased significantly for visibility
      sphere.scale.setScalar(sizes[i] * 50);
      
      particles.add(sphere);
    }
    
    sceneRef.current.add(particles);
    particlesRef.current = particles;
  };

  // Create nested spheres for stage 0 (singularity)
  const createNestedSingularity = () => {
    if (!particlesRef.current || !sceneRef.current) return;
    
    sceneRef.current.remove(particlesRef.current);
    
    const particles = new THREE.Group();
    const baseColor = new THREE.Color(0x3b82f6);
    
    // Create nested spheres
    const levels = 8;
    const spheresPerLevel = 64;
    
    for (let level = 0; level < levels; level++) {
      const radius = level * 0.05 + 0.1;
      const opacity = 1 - (level * 0.12);
      const size = 0.02 + (level * 0.005);
      
      for (let i = 0; i < spheresPerLevel; i++) {
        const phi = Math.acos(-1 + (2 * i) / spheresPerLevel);
        const theta = Math.sqrt(spheresPerLevel * Math.PI) * phi;
        
        const sphereGeometry = new THREE.SphereGeometry(size, 6, 4);
        const sphereMaterial = new THREE.MeshStandardMaterial({
          color: baseColor.clone().multiplyScalar(0.8 + level * 0.05),
          roughness: 0.2,
          metalness: 0.8,
          transparent: true,
          opacity: opacity,
        });
        
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        
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
    const time = Date.now() * 0.001;
    
    // Update zoom level
    setZoomLevel(Math.max(1, Math.min(5, 30 / cameraRef.current.position.z)));

    // Update particle colors based on zoom
    particles.children.forEach((sphere, i) => {
      const material = sphere.material;
      const baseColor = material.color;
      
      // Darken color by 10% when zoomed in
      const darknessFactor = Math.max(0.5, 1 - (zoomLevel * 0.1));
      const darkenedColor = baseColor.clone().multiplyScalar(darknessFactor);
      material.color.copy(darkenedColor);
      
      // Adjust opacity based on zoom
      material.opacity = 0.6 + (zoomLevel * 0.08);
    });

    // Stage-based animation
    const count = particles.children.length;
    
    particles.children.forEach((sphere, i) => {
      const i3 = i * 3;
      let tx, ty, tz;

      const angle = i * 0.1 + time;
      const radius = 15;

      switch (currentStageRef.current) {
        case 0: // Singularity - One particle made of many
          if (count > 100) { // If we have nested spheres
            // Just rotate slowly
            const orbitSpeed = 0.2;
            const localAngle = angle + time * orbitSpeed;
            const localRadius = 0.05 * Math.sin(time * 0.5 + i * 0.01) + 0.1;
            
            tx = Math.cos(localAngle) * localRadius;
            ty = Math.sin(localAngle) * localRadius * Math.cos(time);
            tz = Math.sin(localAngle) * localRadius * Math.sin(time);
          } else {
            // Fallback if not enough particles
            tx = 0;
            ty = 0;
            tz = 0;
          }
          break;

        case 1: // Circle (keep perfect)
          const circleRadius = 12 + Math.random() * 2;
          const theta = (i / count) * Math.PI * 2 + time * 0.5;
          tx = Math.cos(theta) * circleRadius;
          ty = Math.sin(theta) * circleRadius;
          tz = (Math.random() - 0.5) * 0.5;
          break;

        case 2: // Oblate Spheroid with ecliptic plane and central sphere
          const phi = Math.acos(-1 + (2 * i) / count);
          const sphereTheta = Math.sqrt(count * Math.PI) * phi + time * 0.3;
          const R = 12;
          
          // Create oblate shape
          tx = R * Math.cos(sphereTheta) * Math.sin(phi);
          ty = R * Math.sin(sphereTheta) * Math.sin(phi);
          tz = R * Math.cos(phi) * 0.7;
          
          // Add flat ecliptic plane effect
          if (Math.abs(tz) < 1.5) {
            // Flatten particles near the equatorial plane
            tz *= 0.3;
            // Make them slightly larger
            sphere.scale.setScalar(1.2);
          }
          
          // Add central sphere particles (1/10th of particles)
          if (i < count / 10) {
            const innerRadius = 3;
            const innerPhi = Math.acos(-1 + (2 * i) / (count / 10));
            const innerTheta = i * 0.3;
            tx = innerRadius * Math.cos(innerTheta) * Math.sin(innerPhi);
            ty = innerRadius * Math.sin(innerTheta) * Math.sin(innerPhi);
            tz = innerRadius * Math.cos(innerPhi) * 0.5;
          }
          break;

        case 3: // Toroidal field with central spheroid
          // Torus parameters - 3 times larger than spheroid
          const majorRadius = 36; // 3 * 12
          const minorRadius = 15;
          
          // Divide particles: 60% for torus, 40% for central spheroid
          if (i < count * 0.6) {
            // Toroidal field particles
            // Increase number of "strands" by 30%
            const strands = 5; // Increased from ~4
            const strand = i % strands;
            const particlesPerStrand = Math.floor(count * 0.6 / strands);
            const strandIndex = Math.floor(i / strands);
            
            const u = (strandIndex / particlesPerStrand) * Math.PI * 2 * strands + time * 0.2;
            const v = (strand / strands) * Math.PI * 2 + time * 0.5 + strand * 0.5;
            
            // Create spring-like tighter winding
            const twist = 3; // More twists
            const fieldStrength = 1 + 0.4 * Math.sin(v * twist + time);
            
            tx = (majorRadius + minorRadius * Math.cos(v) * fieldStrength) * Math.cos(u);
            ty = (majorRadius + minorRadius * Math.cos(v) * fieldStrength) * Math.sin(u);
            tz = minorRadius * Math.sin(v) * fieldStrength;
          } else {
            // Central oblate spheroid (40% of particles)
            const spheroidIndex = i - count * 0.6;
            const spheroidCount = count * 0.4;
            const spheroidPhi = Math.acos(-1 + (2 * spheroidIndex) / spheroidCount);
            const spheroidTheta = Math.sqrt(spheroidCount * Math.PI) * spheroidPhi + time * 0.4;
            const spheroidR = 12;
            
            tx = spheroidR * Math.cos(spheroidTheta) * Math.sin(spheroidPhi);
            ty = spheroidR * Math.sin(spheroidTheta) * Math.sin(spheroidPhi);
            tz = spheroidR * Math.cos(spheroidPhi) * 0.7;
            
            // Add interaction with toroidal field
            const fieldInfluence = 0.3 * Math.sin(time * 0.5 + spheroidTheta);
            tx += fieldInfluence * Math.cos(time);
            ty += fieldInfluence * Math.sin(time);
          }
          break;

        default:
          tx = sphere.position.x;
          ty = sphere.position.y;
          tz = sphere.position.z;
      }

      // Smooth interpolation
      const lerpFactor = 0.05;
      sphere.position.x += (tx - sphere.position.x) * lerpFactor;
      sphere.position.y += (ty - sphere.position.y) * lerpFactor;
      sphere.position.z += (tz - sphere.position.z) * lerpFactor;
      
      // Add subtle rotation to each sphere
      sphere.rotation.x += 0.01;
      sphere.rotation.y += 0.01;
    });

    // Mouse rotation with 30% reduced sensitivity
    if (mouseRef.current.isDragging) {
      particles.rotation.y += mouseRef.current.x * 0.007; // Reduced from 0.01
      particles.rotation.x += mouseRef.current.y * 0.007; // Reduced from 0.01
    }

    // Auto-rotate slowly
    particles.rotation.y += 0.001;
    particles.rotation.x += 0.0005;

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
  };

  const handleMouseUp = () => {
    mouseRef.current.isDragging = false;
  };

  const handleWheel = (e) => {
    if (cameraRef.current) {
      // Keep scroll sensitivity the same
      cameraRef.current.position.z += e.deltaY * 0.01;
      cameraRef.current.position.z = Math.max(10, Math.min(100, cameraRef.current.position.z));
    }
  };

  // Keyboard controls for stage changes
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key >= '1' && e.key <= '4') {
        setCurrentStage(parseInt(e.key) - 1);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Handle stage changes
  useEffect(() => {
    if (currentStage === 0) {
      createNestedSingularity();
    }
  }, [currentStage]);

  // Sync currentStage with ref for animation loop
  useEffect(() => {
    currentStageRef.current = currentStage;
  }, [currentStage]);

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

    // Auto-cycle through stages
    const interval = setInterval(() => {
      setCurrentStage(prev => (prev + 1) % 4);
    }, 8000); // Slightly longer for new complex animations

    return () => {
      clearInterval(interval);
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
    <div
      ref={mountRef}
      id="canvas-container"
      className="fixed top-0 left-0 w-full h-full z-0"
    />
  );
};

export default AnimatedBackground;