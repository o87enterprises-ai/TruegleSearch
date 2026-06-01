import { useEffect, useState, useRef } from 'react';
import { motion, useSpring } from 'framer-motion';

export default function CursorGlow() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [targetColor, setTargetColor] = useState({ r: 0, g: 229, b: 255 });
  const [targetSize, setTargetSize] = useState(350);
  const [targetIntensity, setTargetIntensity] = useState(0.15);

  // Smooth spring animations for color values
  const colorR = useSpring(0, { stiffness: 50, damping: 25 });
  const colorG = useSpring(229, { stiffness: 50, damping: 25 });
  const colorB = useSpring(255, { stiffness: 50, damping: 25 });
  const glowSize = useSpring(350, { stiffness: 40, damping: 30 });
  const glowIntensity = useSpring(0.15, { stiffness: 45, damping: 28 });

  const [currentColor, setCurrentColor] = useState({ r: 0, g: 229, b: 255 });
  const [currentSize, setCurrentSize] = useState(350);
  const [currentIntensity, setCurrentIntensity] = useState(0.15);

  // Track previous element type for sustained pulse
  const prevElementRef = useRef(null);
  const pulseTimeoutRef = useRef(null);
  // Refs so the mousemove handler always reads current values without being a dep
  const currentIntensityRef = useRef(0.15);
  const targetIntensityRef = useRef(0.15);

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });

      const element = document.elementFromPoint(e.clientX, e.clientY);

      let elementType = 'backdrop';

      if (element) {
        const isOnIcon = element.closest('[data-feature-icon]');
        const isOnCard = element.closest('[data-feature-card]');

        if (isOnIcon) {
          elementType = 'icon';
        } else if (isOnCard) {
          elementType = 'card';
        }
      }

      // Detect transition and create sustained pulse
      if (prevElementRef.current !== elementType) {
        // Clear any existing pulse timeout
        if (pulseTimeoutRef.current) {
          clearTimeout(pulseTimeoutRef.current);
        }

        // Create sustained pulse effect during transition
        if (
          prevElementRef.current === 'backdrop' &&
          elementType !== 'backdrop'
        ) {
          // Entering an element - pulse up
          const midIntensity =
            (targetIntensityRef.current + getIntensityForType(elementType)) / 2;
          glowIntensity.set(midIntensity * 1.3); // Boost during transition

          // Slowly settle to target
          pulseTimeoutRef.current = setTimeout(() => {
            glowIntensity.set(getIntensityForType(elementType));
          }, 400);
        } else if (
          prevElementRef.current !== 'backdrop' &&
          elementType === 'backdrop'
        ) {
          // Leaving element - sustained fade
          glowIntensity.set(currentIntensityRef.current * 0.8); // Keep some energy

          // Slowly dissipate back to backdrop
          pulseTimeoutRef.current = setTimeout(() => {
            glowIntensity.set(0.15);
          }, 600);
        } else {
          // Transitioning between elements - blend pulse
          glowIntensity.set(
            ((currentIntensityRef.current + getIntensityForType(elementType)) / 2) * 1.2
          );

          pulseTimeoutRef.current = setTimeout(() => {
            glowIntensity.set(getIntensityForType(elementType));
          }, 350);
        }

        prevElementRef.current = elementType;
      }

      // Set target values based on element type
      switch (elementType) {
        case 'icon':
          setTargetColor({ r: 255, g: 80, b: 80 }); // Red-orange
          setTargetSize(450);
          setTargetIntensity(0.4);
          break;
        case 'card':
          setTargetColor({ r: 180, g: 100, b: 255 }); // Purple
          setTargetSize(550);
          setTargetIntensity(0.3);
          break;
        default:
          setTargetColor({ r: 0, g: 255, b: 200 }); // Greenish-cyan
          setTargetSize(350); // Smaller default radius
          setTargetIntensity(0.15); // Lower default intensity
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (pulseTimeoutRef.current) {
        clearTimeout(pulseTimeoutRef.current);
      }
    };
  }, []);

  // Helper function
  const getIntensityForType = (type) => {
    switch (type) {
      case 'icon':
        return 0.4;
      case 'card':
        return 0.3;
      default:
        return 0.15;
    }
  };

  // Smoothly update spring values
  useEffect(() => {
    colorR.set(targetColor.r);
    colorG.set(targetColor.g);
    colorB.set(targetColor.b);
    glowSize.set(targetSize);
    targetIntensityRef.current = targetIntensity;

    if (!pulseTimeoutRef.current) {
      glowIntensity.set(targetIntensity);
    }
  }, [targetColor, targetSize, targetIntensity]);

  // Subscribe to spring values
  useEffect(() => {
    const unsubscribeR = colorR.on('change', (v) =>
      setCurrentColor((prev) => ({ ...prev, r: v }))
    );
    const unsubscribeG = colorG.on('change', (v) =>
      setCurrentColor((prev) => ({ ...prev, g: v }))
    );
    const unsubscribeB = colorB.on('change', (v) =>
      setCurrentColor((prev) => ({ ...prev, b: v }))
    );
    const unsubscribeSize = glowSize.on('change', (v) => setCurrentSize(v));
    const unsubscribeIntensity = glowIntensity.on('change', (v) => {
      currentIntensityRef.current = v;
      setCurrentIntensity(v);
    });

    return () => {
      unsubscribeR();
      unsubscribeG();
      unsubscribeB();
      unsubscribeSize();
      unsubscribeIntensity();
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-30"
      style={{
        background: `radial-gradient(${currentSize}px circle at ${mousePosition.x}px ${mousePosition.y}px, 
          rgba(${Math.round(currentColor.r)}, ${Math.round(currentColor.g)}, ${Math.round(currentColor.b)}, ${currentIntensity * 1.4}) 0%, 
          rgba(${Math.round(currentColor.r)}, ${Math.round(currentColor.g)}, ${Math.round(currentColor.b)}, ${currentIntensity * 1.0}) 15%, 
          rgba(${Math.round(currentColor.r)}, ${Math.round(currentColor.g)}, ${Math.round(currentColor.b)}, ${currentIntensity * 0.7}) 30%, 
          rgba(${Math.round(currentColor.r)}, ${Math.round(currentColor.g)}, ${Math.round(currentColor.b)}, ${currentIntensity * 0.5}) 45%, 
          rgba(${Math.round(currentColor.r)}, ${Math.round(currentColor.g)}, ${Math.round(currentColor.b)}, ${currentIntensity * 0.3}) 60%, 
          rgba(${Math.round(currentColor.r)}, ${Math.round(currentColor.g)}, ${Math.round(currentColor.b)}, ${currentIntensity * 0.15}) 75%, 
          rgba(${Math.round(currentColor.r)}, ${Math.round(currentColor.g)}, ${Math.round(currentColor.b)}, ${currentIntensity * 0.05}) 85%, 
          transparent 95%)`,
      }}
    />
  );
}
