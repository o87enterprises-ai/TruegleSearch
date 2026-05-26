import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

// Star icon for the highlight
const Star = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path 
      d="M12 2l3.09 6.26L22 9l-10-12.5-10-12.5L12 2z" 
      fill="rgba(255,255,255,0.9)"
      stroke="rgba(255,255,255,0.3)"
      strokeWidth="1.5"
    />
  </svg>
);

/**
 * BubbleAnimation - Creates rising bubble effect for ocean/OSINT page
 * Features:
 * - Cluster of bubbles with light blue outline
 * - Rising from bottom to top of page
 * - Quick rising movement
 * - Light blue glow effect
 */
export default function BubbleAnimation() {
  const canvasRef = useRef(null);
  const bubblesRef = useRef([]);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    // Create initial cluster of bubbles
    const createBubbles = () => {
      const bubbles = [];
      const bubbleCount = 20; // Optimal for visual effect without performance impact

      for (let i = 0; i < bubbleCount; i++) {
        bubbles.push({
          x: Math.random() * canvas.width,
          y: canvas.height + Math.random() * 200, // Start below screen
          radius: Math.random() * 20 + 5, // 5-25px radius
          speed: Math.random() * 2 + 1, // 1-3px per frame (fast rising)
          wobble: Math.random() * Math.PI * 2, // random starting wobble
          wobbleSpeed: Math.random() * 0.05 + 0.02, // gentle horizontal sway
          opacity: Math.random() * 0.3 + 0.1, // 10-40% opacity
          hue: 180 + Math.random() * 40, // Light blue to cyan range (180-220)
        });
      }

      return bubbles;
    };

    bubblesRef.current = createBubbles();

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      bubblesRef.current.forEach((bubble) => {
        // Update position
        bubble.y -= bubble.speed;
        bubble.wobble += bubble.wobbleSpeed;
        const wobbleX = bubble.x + Math.sin(bubble.wobble) * 2;

        // Reset bubble when it goes off top of screen
        if (bubble.y + bubble.radius < 0) {
          bubble.y = canvas.height + 50;
          bubble.x = Math.random() * canvas.width;
          bubble.radius = Math.random() * 20 + 5;
          bubble.speed = Math.random() * 2 + 1;
        }

        // Draw bubble shadow/outline
        ctx.beginPath();
        ctx.arc(wobbleX, bubble.y, bubble.radius, 0, Math.PI * 2);

        // Light blue outline effect
        const gradient = ctx.createRadialGradient(
          wobbleX - bubble.radius * 0.3,
          bubble.y - bubble.radius * 0.3,
          0,
          wobbleX,
          bubble.y,
          bubble.radius
        );

        gradient.addColorStop(0, `hsla(${bubble.hue}, 100%, 80%, 0.2)`);
        gradient.addColorStop(0.5, `hsla(${bubble.hue}, 100%, 70%, 0.1)`);
        gradient.addColorStop(1, `hsla(${bubble.hue}, 100%, 60%, 0)`);

        ctx.fillStyle = gradient;
        ctx.fill();

        // Light blue outline
        ctx.strokeStyle = `hsla(${bubble.hue}, 80%, 85%, ${bubble.opacity})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Add highlight (reflection)
        ctx.beginPath();
        ctx.arc(
          wobbleX - bubble.radius * 0.3,
          bubble.y - bubble.radius * 0.3,
          bubble.radius * 0.2,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = `rgba(255, 255, 255, ${bubble.opacity * 0.8})`;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <motion.canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ mixBlendMode: 'screen' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 0.6 }}
      transition={{ duration: 1 }}
    />
  );
}