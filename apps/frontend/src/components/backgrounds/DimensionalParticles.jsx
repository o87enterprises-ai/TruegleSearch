import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

/**
 * DimensionalParticles
 *
 * A 3D particle system with 4 morphing stages:
 * - Stage 0: Singularity (concentrated pulsing point) - RED
 * - Stage 1: Orbital Circle (2D ring formation) - BLUE
 * - Stage 2: Oblate Spheroid (flattened 3D sphere) - PURPLE
 * - Stage 3: Magnetic Field Toroid (3D torus with field lines) - CYAN
 *
 * Auto-cycles every 5 seconds, with manual override via:
 * - Keyboard: 1-4 keys
 * - Mouse: Drag to rotate, scroll to zoom
 *
 * Layered at z-5 between DeepSpaceBackground (z-0) and content (z-10).
 * Uses vanilla Three.js with additive blending for glow effect.
 *
 * Performance: 1500 particles (1000 on mobile), 60 FPS target.
 */
export default function DimensionalParticles() {
  // Refs for Three.js objects
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const particlesRef = useRef(null);
  const animationRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0, isDragging: false, startX: 0, startY: 0 });
  const lastInteractionRef = useRef(Date.now());
  const currentStageRef = useRef(0); // Ref to track current stage for animation loop

  // State
  const [currentStage, setCurrentStage] = useState(0);
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Color configuration for each stage
  const STAGE_COLORS = {
    singularity: { primary: 0xef4444, emissive: 0xf43f5e, opacity: 0.9 },
    circle: { primary: 0x3b82f6, emissive: 0x60a5fa, opacity: 0.85 },
    spheroid: { primary: 0xa855f7, emissive: 0xd946ef, opacity: 0.85 },
    toroid: { primary: 0x06b6d4, emissive: 0x22d3ee, opacity: 0.9 }
  };

  // Get adaptive particle count based on device - MASSIVELY INCREASED
  const getParticleCount = () => {
    const isMobile = window.innerWidth < 768;
    const isLowEnd = navigator.hardwareConcurrency <= 4;

    if (isMobile || isLowEnd) return 3000;
    return 8000; // Increased from 1500 to 8000 for dense geometric shapes
  };

  // Initialize Three.js scene
  const initScene = () => {
    if (!containerRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = null; // Transparent background
    sceneRef.current = scene;

    // Camera - position closer for larger view
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 20); // Moved much closer (was z=30, y=5)
    cameraRef.current = camera;

    // Renderer
    const isMobile = window.innerWidth < 768;
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isMobile, // Disable antialiasing on mobile for performance
      powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2x
    renderer.setClearColor(0x000000, 0); // Transparent
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create particle system
    createParticles();
  };

  // Create particle system with random Truegle colors
  const createParticles = () => {
    const particleCount = getParticleCount();
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    // Truegle colors: Purple, Green, Red
    const truegleColors = [
      new THREE.Color(0xa855f7), // Purple
      new THREE.Color(0x10b981), // Green
      new THREE.Color(0xef4444), // Red
      new THREE.Color(0x06b6d4), // Cyan (bonus)
      new THREE.Color(0xf59e0b), // Orange (bonus)
    ];

    // Initialize random positions and colors
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2;

      // Assign random color
      const randomColor = truegleColors[Math.floor(Math.random() * truegleColors.length)];
      colors[i * 3] = randomColor.r;
      colors[i * 3 + 1] = randomColor.g;
      colors[i * 3 + 2] = randomColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Material with vertex colors for random coloring
    const material = new THREE.PointsMaterial({
      size: 0.15, // Much smaller particles (was 0.8, now 0.15)
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      vertexColors: true, // Use per-particle colors
      blending: THREE.AdditiveBlending
    });

    const particles = new THREE.Points(geometry, material);
    sceneRef.current.add(particles);
    particlesRef.current = particles;
  };

  // Animation loop
  const animate = () => {
    if (!particlesRef.current || !cameraRef.current || !rendererRef.current || !sceneRef.current) return;

    const particles = particlesRef.current;
    const positions = particles.geometry.attributes.position.array;
    const count = positions.length / 3;
    const time = Date.now() * 0.001;

    // Update particle positions based on current stage
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      let x = positions[i3];
      let y = positions[i3 + 1];
      let z = positions[i3 + 2];

      // Calculate target positions based on stage
      let tx, ty, tz;
      const angle = i * 0.1 + time;

      switch (currentStageRef.current) {
        case 0: // Singularity - tight concentrated point
          const singularityRadius = 1.5 + Math.sin(time * 2) * 0.5; // Small pulsing point
          const singularityAngle1 = i * 0.1;
          const singularityAngle2 = i * 0.2;
          tx = Math.cos(singularityAngle1) * Math.sin(singularityAngle2) * singularityRadius;
          ty = Math.sin(singularityAngle1) * Math.sin(singularityAngle2) * singularityRadius;
          tz = Math.cos(singularityAngle2) * singularityRadius;
          break;

        case 1: // Orbital Circle - perfect 2D ring
          const circleRadius = 12;
          const theta = (i / count) * Math.PI * 2 + time * 0.1;
          const circleDepth = ((i * 137.5) % 360) / 360; // Golden angle distribution
          tx = Math.cos(theta) * circleRadius;
          ty = Math.sin(theta) * circleRadius;
          tz = (circleDepth - 0.5) * 0.5; // Very thin but distributed
          break;

        case 2: // Oblate Spheroid - perfect sphere with radial structure
          const phi = Math.acos(-1 + (2 * i) / count);
          const sphereTheta = Math.sqrt(count * Math.PI) * phi;
          const R = 10;
          const radialNoise = Math.sin(i * 0.5) * 0.3; // Stable noise based on particle index
          tx = (R + radialNoise) * Math.cos(sphereTheta) * Math.sin(phi);
          ty = (R + radialNoise) * Math.sin(sphereTheta) * Math.sin(phi);
          tz = (R + radialNoise) * Math.cos(phi) * 0.8; // Slightly oblate
          break;

        case 3: // Magnetic Field Toroid - clean donut shape
          const toroidU = (i / count) * Math.PI * 2;
          const toroidV = ((i * 13) / count) * Math.PI * 2; // 13 wraps around
          const majorRadius = 12;
          const minorRadius = 4;
          const fieldNoise = Math.sin(i * 0.3) * 0.3; // Stable field variation
          tx = (majorRadius + (minorRadius + fieldNoise) * Math.cos(toroidV)) * Math.cos(toroidU);
          ty = (majorRadius + (minorRadius + fieldNoise) * Math.cos(toroidV)) * Math.sin(toroidU);
          tz = (minorRadius + fieldNoise) * Math.sin(toroidV);
          break;

        default:
          tx = x;
          ty = y;
          tz = z;
      }

      // Smooth interpolation (lerp)
      const lerpFactor = 0.05;
      positions[i3] += (tx - x) * lerpFactor;
      positions[i3 + 1] += (ty - y) * lerpFactor;
      positions[i3 + 2] += (tz - z) * lerpFactor;
    }

    particles.geometry.attributes.position.needsUpdate = true;

    // Apply mouse rotation with damping
    if (mouseRef.current.isDragging || Math.abs(mouseRef.current.x) > 0.001 || Math.abs(mouseRef.current.y) > 0.001) {
      particles.rotation.y += mouseRef.current.x;
      particles.rotation.x += mouseRef.current.y;

      // Damping
      mouseRef.current.x *= 0.98;
      mouseRef.current.y *= 0.98;
    }

    // Render
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    animationRef.current = requestAnimationFrame(animate);
  };

  // Mouse event handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Only left click

    mouseRef.current.isDragging = true;
    mouseRef.current.startX = e.clientX;
    mouseRef.current.startY = e.clientY;
    lastInteractionRef.current = Date.now();
  };

  const handleMouseMove = (e) => {
    if (!mouseRef.current.isDragging) return;

    const deltaX = e.clientX - mouseRef.current.startX;
    const deltaY = e.clientY - mouseRef.current.startY;

    // Reduced sensitivity by 30% (was 0.005, now 0.0035)
    mouseRef.current.x = deltaX * 0.0035;
    mouseRef.current.y = deltaY * 0.0035;
  };

  const handleMouseUp = () => {
    mouseRef.current.isDragging = false;
  };

  const handleWheel = (e) => {
    if (!cameraRef.current) return;

    // REVERSED: scroll down (positive deltaY) = zoom in (decrease z), scroll up = zoom out (increase z)
    const delta = -e.deltaY * 0.01; // Negative to reverse direction
    cameraRef.current.position.z += delta;

    // Clamp zoom range
    cameraRef.current.position.z = Math.max(10, Math.min(50, cameraRef.current.position.z));

    lastInteractionRef.current = Date.now();
  };

  // Keyboard controls for stage changes
  const handleKeyPress = (e) => {
    console.log('⌨️ Key pressed:', e.key, 'Active element:', document.activeElement.tagName);

    // Ignore if input/textarea is focused
    if (document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA') {
      console.log('❌ Ignoring keypress - input/textarea focused');
      return;
    }

    if (e.key >= '1' && e.key <= '4') {
      const newStage = parseInt(e.key) - 1;
      console.log('✅ Setting stage to:', newStage);
      setCurrentStage(newStage);
      setIsManualOverride(true);
      lastInteractionRef.current = Date.now();
    } else {
      console.log('❌ Key not in range 1-4');
    }
  };

  // Handle window resize
  const handleResize = () => {
    if (!cameraRef.current || !rendererRef.current) return;

    cameraRef.current.aspect = window.innerWidth / window.innerHeight;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(window.innerWidth, window.innerHeight);
  };

  // Auto-cycle effect
  useEffect(() => {
    console.log('🔄 Auto-cycle useEffect running, isManualOverride:', isManualOverride);

    const interval = setInterval(() => {
      const timeSinceInteraction = Date.now() - lastInteractionRef.current;
      console.log('⏰ Interval tick - isManualOverride:', isManualOverride, 'timeSinceInteraction:', timeSinceInteraction);

      // Resume auto-cycle after 10 seconds of no interaction
      if (timeSinceInteraction > 10000 && isManualOverride) {
        console.log('✅ Resuming auto-cycle (10s passed)');
        setIsManualOverride(false);
      }

      // Auto-cycle if not manually overridden
      if (!isManualOverride) {
        setCurrentStage(prev => {
          const next = (prev + 1) % 4;
          console.log('🔄 Auto-cycling from stage', prev, 'to', next);
          return next;
        });
      } else {
        console.log('⏸️ Manual override active, not cycling');
      }
    }, 5000); // 5 second cycle time

    return () => {
      console.log('🛑 Clearing auto-cycle interval');
      clearInterval(interval);
    };
  }, [isManualOverride]);

  // Sync state with ref for animation loop
  useEffect(() => {
    currentStageRef.current = currentStage;
    const stageNames = ['Singularity', 'Circle', 'Spheroid', 'Toroid'];
    console.log('✨ Current stage:', currentStage, '-', stageNames[currentStage]);
  }, [currentStage]);

  // Hide controls after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowControls(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  // Initialize and clean up
  useEffect(() => {
    console.log('🎬 DimensionalParticles: Initializing scene and event listeners');
    initScene();
    animationRef.current = requestAnimationFrame(animate);

    // Add event listeners
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('wheel', handleWheel, { passive: true });
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyPress);
    console.log('✅ Event listeners attached, including keydown');

    return () => {
      // Cleanup
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyPress);

      // Dispose Three.js objects
      if (particlesRef.current?.geometry) {
        particlesRef.current.geometry.dispose();
      }
      if (particlesRef.current?.material) {
        particlesRef.current.material.dispose();
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (containerRef.current && rendererRef.current.domElement) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
      }

      // Clear refs
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      particlesRef.current = null;
    };
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: 'auto' }}
      />

      {/* Stage Indicator - More Prominent */}
      <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none select-none">
        <div className="bg-black/70 backdrop-blur-md border-2 border-red-500 rounded-xl px-6 py-3 text-center shadow-lg shadow-red-500/50">
          <div className="text-xs text-white/70 uppercase tracking-wider mb-1">
            Dimensional Stage {currentStage + 1}/4
          </div>
          <div className="text-xl font-bold text-red-400">
            {['Singularity', 'Circle', 'Spheroid', 'Toroid'][currentStage]}
          </div>
        </div>
      </div>

      {/* Control hints (fade out after 5s) */}
      {showControls && (
        <div
          className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-20 pointer-events-none select-none transition-opacity duration-1000"
          style={{ opacity: showControls ? 1 : 0 }}
        >
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-xs text-white/70">
            Press 1-4 to change • Drag to rotate • Scroll to zoom
          </div>
        </div>
      )}
    </>
  );
}
