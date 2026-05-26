import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import './BackgroundAnimation.css';
import LaserFlow from './LaserFlow';
import Prism from './Prism';
import Aurora from './Aurora';

// Global flag to prevent multiple instances (for debugging)
let globalAnimationRunning = false;

const BackgroundAnimation = ({ showTransition = false }) => {
  const location = useLocation();
  const [animationPhase, setAnimationPhase] = useState(0); // 0: idle, 1: laser, 2: prism, 3: aurora
  const hasAnimationStartedRef = useRef(false); // Track if animation has already started

  // Use refs to store current values instead of state to avoid re-renders
  const laserParamsRef = useRef({
    verticalSizing: 5, // Updated from spec
    horizontalSizing: 1.6, // Updated from spec
    wispDensity: 5, // Updated from spec
    wispSpeed: 15, // Updated from spec
    wispIntensity: 10.3, // Updated from spec
    flowSpeed: 0.35, // Updated from spec
    flowStrength: 0.28, // Updated from spec
    fogIntensity: 1, // Updated from spec
    fogScale: 0.16, // Updated from spec
    decay: 1.33, // Updated from spec
    falloffStart: 2.37, // Updated from spec
    fogFallSpeed: 0.52, // Updated from spec
    color: '#FF79C6', // Updated from spec
    mouseTiltStrength: 0.01, // Default
  });

  const prismParamsRef = useRef({
    animationType: 'rotate',
    timeScale: 0.3,
    height: 2.3, // Updated from spec
    baseWidth: 3.8, // Updated from spec
    scale: window.innerWidth > 768 ? 1.3 : 1, // 30% larger in desktop mode (screen width > 768px)
    hueShift: -1.0, // Initial value for fluctuating hue shift (midpoint of -3.0 to 1.0 range)
    colorFrequency: 1.25, // Initial value for fluctuating color frequency (midpoint of 0.5-2.0 range)
    noise: 0, // Updated from spec
    glow: 1, // Updated from spec
    bloom: 0.5, // Start with more bloom
  });

  const auroraParamsRef = useRef({
    colorStops: ['#8B5CF6', '#06B6D4', '#EC4899'],
    blend: 0.5, // Start with more blend
    amplitude: 0.5, // Start with more amplitude
    speed: 0.2,
  });

  const animationRef = useRef(null);
  const startTimeRef = useRef(null);
  const isMountedRef = useRef(false); // Track if component is mounted

  // Animation sequence parameters (50% faster)
  const ANIMATION_CONFIG = {
    INITIAL_DELAY: 0.25, // 50% of 0.5
    LASER_DURATION: 1.5, // 50% of 3.0 - Time for laser to reach full height
    PRISM_DURATION: 1.25, // 50% of 2.5 - Time for prism to fully materialize
    AURORA_DURATION: 1.5, // 50% of 3.0 - Time for aurora to fully appear
    PRISM_DELAY: 1.25, // 50% of 2.5 - Delay before prism starts after laser
    AURORA_DELAY: 2.5, // 50% of 5.0 - Delay before aurora starts after laser
  };

  // Store animation phase in a ref to avoid triggering re-renders
  const animationPhaseRef = useRef(0);

  useEffect(() => {
    // Only run on LandingPage - prevent background animations on other pages
    if (location.pathname !== '/') {
      console.log("[BackgroundAnimation] Not on LandingPage, skipping animation");
      return;
    }

    // Set mounted flag
    isMountedRef.current = true;

    // Prevent multiple animation instances from starting globally
    if (globalAnimationRunning) {
      console.log("[BackgroundAnimation] Global animation already running, skipping initialization");
      return;
    }

    // Prevent multiple animation instances from starting locally
    if (hasAnimationStartedRef.current) {
      console.log("[BackgroundAnimation] Animation already started, skipping initialization");
      return;
    }

    hasAnimationStartedRef.current = true;
    globalAnimationRunning = true;
    console.log("[BackgroundAnimation] Starting animation sequence");
    startTimeRef.current = performance.now();

    // Handle window resize to adjust scale based on screen size
    const handleResize = () => {
      // Update the scale parameter based on current window width
      if (animationPhaseRef.current >= 2) { // Only update if prism is active
        prismParamsRef.current = {
          ...prismParamsRef.current,
          scale: window.innerWidth > 768 ? 1.3 : 1, // 30% larger in desktop mode
        };
      }
    };

    window.addEventListener('resize', handleResize);

    const animate = (timestamp) => {
      if (!isMountedRef.current || !globalAnimationRunning) {
        console.log("[BackgroundAnimation] Component unmounted or global stopped, stopping animation");
        return;
      }

      if (!startTimeRef.current) return;

      const elapsed = (timestamp - startTimeRef.current) / 1000; // Convert to seconds

      // Check if animation has completed (reached final phase)
      if (animationPhaseRef.current >= 3) {
        // Animation is complete, stop the animation loop
        return;
      }

      // Calculate animation progress for each element
      const laserProgress = Math.min(
        1,
        Math.max(
          0,
          (elapsed - ANIMATION_CONFIG.INITIAL_DELAY) /
            ANIMATION_CONFIG.LASER_DURATION
        )
      );

      const prismProgress = Math.min(
        1,
        Math.max(
          0,
          (elapsed - ANIMATION_CONFIG.PRISM_DELAY) /
            ANIMATION_CONFIG.PRISM_DURATION
        )
      );

      const auroraProgress = Math.min(
        1,
        Math.max(
          0,
          (elapsed - ANIMATION_CONFIG.AURORA_DELAY) /
            ANIMATION_CONFIG.AURORA_DURATION
        )
      );

      // Log progress for debugging
      if (laserProgress > 0.95) console.log("[BackgroundAnimation] Laser ready to show");
      if (prismProgress > 0.95) console.log("[BackgroundAnimation] Prism ready to show");
      if (auroraProgress > 0.95) console.log("[BackgroundAnimation] Aurora ready to show");

      // Update phases in ref to avoid re-renders - only update state when phase actually changes
      let newPhase = animationPhaseRef.current;
      if (laserProgress > 0 && animationPhaseRef.current < 1) {
        console.log("[BackgroundAnimation] Setting animation phase to 1 (Laser)");
        newPhase = 1;
        animationPhaseRef.current = 1;
        setAnimationPhase(1); // Only update state when phase changes
      }
      if (prismProgress > 0 && animationPhaseRef.current < 2) {
        console.log("[BackgroundAnimation] Setting animation phase to 2 (Prism)");
        newPhase = 2;
        animationPhaseRef.current = 2;
        setAnimationPhase(2); // Only update state when phase changes
      }
      if (auroraProgress > 0 && animationPhaseRef.current < 3) {
        console.log("[BackgroundAnimation] Setting animation phase to 3 (Aurora)");
        newPhase = 3;
        animationPhaseRef.current = 3;
        setAnimationPhase(3); // Only update state when phase changes
      }

      // Update laser parameters based on progress using refs
      laserParamsRef.current = {
        ...laserParamsRef.current,
        verticalSizing: 5 + laserProgress * 1.0, // Grow from 5 to 6 based on new starting point
        horizontalSizing: 1.6 + laserProgress * 0.4, // Grow from 1.6 to 2 based on new starting point
        glow: 0.5 + laserProgress * 0.4, // Increase glow
      };

      // Calculate fluctuating color frequency based on elapsed time
      // Using a sine wave to oscillate between min and max values (e.g., 0.5 to 2.0)
      const minColorFreq = 0.5;
      const maxColorFreq = 2.0;
      const colorFreqRange = (maxColorFreq - minColorFreq) / 2;
      const colorFreqMid = minColorFreq + colorFreqRange;
      const colorFrequency = colorFreqMid + colorFreqRange * Math.sin(elapsed * 0.69); // Slow oscillation, increased by 15% then another 20%

      // Calculate fluctuating hue shift based on elapsed time
      // Using a sine wave to oscillate between min and max values (e.g., -3.0 to 1.0)
      const minHueShift = -3.0;
      const maxHueShift = 1.0;
      const hueShiftRange = (maxHueShift - minHueShift) / 2;
      const hueShiftMid = minHueShift + hueShiftRange;
      const hueShift = hueShiftMid + hueShiftRange * Math.sin(elapsed * 0.414); // Slow oscillation, increased by 15% then another 20%

      // Update prism parameters based on progress using refs
      prismParamsRef.current = {
        ...prismParamsRef.current,
        height: 2.3 + prismProgress * 0.7, // Grow from 2.3 to 3.0 based on new starting point
        baseWidth: 3.8 + prismProgress * 1.2, // Grow from 3.8 to 5.0 based on new starting point
        scale: window.innerWidth > 768 ? 1.3 : 1, // Maintain 30% larger scale in desktop mode
        colorFrequency: colorFrequency, // Fluctuating color frequency
        hueShift: hueShift, // Fluctuating hue shift
        glow: 1 + prismProgress * 0.0, // Keep glow at 1 throughout animation
        bloom: 0.5 + prismProgress * 1.1, // Increase bloom
      };

      // Update aurora parameters based on progress using refs
      auroraParamsRef.current = {
        ...auroraParamsRef.current,
        blend: 0.5 + auroraProgress * 0.5, // Increase blend
        amplitude: 0.5 + auroraProgress * 0.9, // Increase amplitude
      };

      // Only continue animation if we haven't reached the final phase yet
      if (animationPhaseRef.current < 3) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        console.log("[BackgroundAnimation] Animation sequence completed, stopping animation loop");
        // Don't set globalAnimationRunning to false here - let it persist
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      console.log("[BackgroundAnimation] Cleaning up animation");
      isMountedRef.current = false;

      // Immediately cancel animation loop
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      // Remove resize event listener
      window.removeEventListener('resize', handleResize);

      // Immediately reset global flag on unmount or route change to prevent animations from continuing on other pages
      globalAnimationRunning = false;
    };
  }, [location.pathname]); // Include location.pathname to respond to route changes

  // Render the LetterGlitch component for page transitions if showTransition is true
  if (showTransition) {
    return (
      <div style={{ width: '100%', height: '100vh', position: 'relative', background: 'black' }}>
        <div style={{ width: '1080px', height: '1080px', position: 'relative', margin: '0 auto' }}>
          {/* Placeholder for LetterGlitch component */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            fontSize: '4rem',
            fontWeight: 'bold',
            color: 'white',
            textShadow: '0 0 10px #8466db, 0 0 20px #61bf92, 0 0 30px #b97874',
            animation: 'glitch 1s infinite'
          }}>
            TRANSITION
          </div>
          <style>{`
            @keyframes glitch {
              0% { transform: translate(0); }
              20% { transform: translate(-3px, 3px); }
              40% { transform: translate(-3px, -3px); }
              60% { transform: translate(3px, 3px); }
              80% { transform: translate(3px, -3px); }
              100% { transform: translate(0); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  return (
    <div className="background-animation-container">
      {/* Black initial background */}
      <div className="absolute inset-0 bg-black" />

      {/* Laser Flow - starts immediately */}
      <div
        className="laser-container"
        style={{
          opacity: animationPhase >= 1 ? 1 : 0,
          transition: 'opacity 0.5s ease-out',
        }}
      >
        <LaserFlow
          verticalBeamOffset={-0.5}
          horizontalBeamOffset={0}
          verticalSizing={laserParamsRef.current.verticalSizing}
          horizontalSizing={laserParamsRef.current.horizontalSizing}
          wispDensity={laserParamsRef.current.wispDensity}
          wispSpeed={laserParamsRef.current.wispSpeed}
          wispIntensity={laserParamsRef.current.wispIntensity}
          flowSpeed={laserParamsRef.current.flowSpeed}
          flowStrength={laserParamsRef.current.flowStrength}
          fogIntensity={laserParamsRef.current.fogIntensity}
          fogScale={laserParamsRef.current.fogScale}
          decay={laserParamsRef.current.decay}
          falloffStart={laserParamsRef.current.falloffStart}
          fogFallSpeed={laserParamsRef.current.fogFallSpeed}
          color={laserParamsRef.current.color}
          mouseTiltStrength={laserParamsRef.current.mouseTiltStrength}
        />
      </div>

      {/* Prism - starts after laser */}
      <div
        className="prism-container"
        style={{
          opacity: animationPhase >= 2 ? 1 : 0,
          transition: 'opacity 0.5s ease-out',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '100%',
          height: '100%',
          margin: 0,
        }}
      >
        <Prism
          animationType={prismParamsRef.current.animationType}
          timeScale={prismParamsRef.current.timeScale}
          height={prismParamsRef.current.height}
          baseWidth={prismParamsRef.current.baseWidth}
          scale={prismParamsRef.current.scale}
          hueShift={prismParamsRef.current.hueShift}
          colorFrequency={prismParamsRef.current.colorFrequency}
          noise={prismParamsRef.current.noise}
          glow={prismParamsRef.current.glow}
          bloom={prismParamsRef.current.bloom}
          transparent={true}
        />
      </div>

      {/* Aurora Background - appears as sky from start, intensifies at phase 3 */}
      <div
        className="aurora-container"
        style={{
          opacity: animationPhase >= 3 ? 1 : 0.3, // Visible from start with subtle effect, intensifies at phase 3
          transition: 'opacity 1.3s ease-out', // 30% slower fade-in (1.0s * 1.3 = 1.3s)
          position: 'absolute',
          top: 0, // At the top of screen
          left: 0,
          width: '100%',
          height: '34.5%', // Only upper 34.5% like sky (20% more than current 28.75%)
        }}
      >
        <Aurora
          colorStops={auroraParamsRef.current.colorStops}
          blend={auroraParamsRef.current.blend}
          amplitude={auroraParamsRef.current.amplitude}
          speed={auroraParamsRef.current.speed}
        />
      </div>

      {/* Logo Area - appears after all animations complete */}
      <div
        className="logo-area"
        style={{
          opacity: animationPhase >= 3 ? 1 : 0,
          transition: 'opacity 1s ease-out 1s',
        }}
      >
        {/* Logo will be placed here after animations complete */}
      </div>
    </div>
  );
};

export default BackgroundAnimation;
