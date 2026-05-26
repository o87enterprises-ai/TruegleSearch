import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export default function Starfield() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Set canvas dimensions
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Star properties
    const stars = [];
    const numStars = window.innerWidth < 768 ? 80 : 150; // Fewer stars on mobile

    // Create stars with bright, sparkly properties
    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 0.5 + 0.2, // Very small, bright points
        brightness: Math.random() * 0.5 + 0.5, // Start with high brightness
        pulseSpeed: Math.random() * 0.02 + 0.005, // Slow, subtle pulsing
        pulseDirection: Math.random() > 0.5 ? 1 : -1,
        twinkleSpeed: Math.random() * 0.03 + 0.01,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }

    // Animation loop
    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'; // Very subtle trail for twinkle effect
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      stars.forEach((star) => {
        // Update twinkle phase
        star.twinklePhase += star.twinkleSpeed;

        // Calculate twinkle effect (sinusoidal for smooth twinkling)
        const twinkle = (Math.sin(star.twinklePhase) + 1) * 0.3 + 0.7; // 0.7 to 1.3 range

        // Update pulse
        star.brightness += star.pulseSpeed * star.pulseDirection;
        if (star.brightness > 1 || star.brightness < 0.3) {
          star.pulseDirection *= -1;
          star.brightness = Math.max(0.3, Math.min(1, star.brightness));
        }

        // Draw star as a bright point with glow
        const finalBrightness = star.brightness * twinkle;

        // Create radial gradient for star glow
        const gradient = ctx.createRadialGradient(
          star.x,
          star.y,
          0,
          star.x,
          star.y,
          star.radius * 5
        );

        // White to transparent glow
        gradient.addColorStop(0, `rgba(255, 255, 255, ${finalBrightness})`);
        gradient.addColorStop(
          0.3,
          `rgba(255, 255, 255, ${finalBrightness * 0.5})`
        );
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        // Draw glow
        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(star.x, star.y, star.radius * 5, 0, Math.PI * 2);
        ctx.fill();

        // Draw bright core
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 255, 255, ${finalBrightness})`;
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();

        // Occasionally add a sparkle (random bright flash)
        if (Math.random() < 0.001) {
          const sparkleRadius = star.radius * 3;
          const sparkleGradient = ctx.createRadialGradient(
            star.x,
            star.y,
            0,
            star.x,
            star.y,
            sparkleRadius
          );
          sparkleGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
          sparkleGradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.5)');
          sparkleGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

          ctx.beginPath();
          ctx.fillStyle = sparkleGradient;
          ctx.arc(star.x, star.y, sparkleRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      className="fixed inset-0 z-0"
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </motion.div>
  );
}
