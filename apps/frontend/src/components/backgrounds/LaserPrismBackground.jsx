import React, { useState, useEffect, useRef } from 'react';

const LaserPrismBackground = () => {
  const canvasRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    let animationFrame;
    const particles = [];
    const prismBeams = [];

    // Initialize prism beams
    for (let i = 0; i < 6; i++) {
      prismBeams.push({
        angle: (Math.PI * 2 * i) / 6,
        length: 200 + Math.random() * 100,
        width: 2 + Math.random() * 3,
        color: `hsl(${280 + i * 20}, 70%, 60%)`,
        opacity: 0.3 + Math.random() * 0.4,
        speed: 0.001 + Math.random() * 0.002,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    // Initialize particles
    for (let i = 0; i < 100; i++) {
      particles.push({
        x: Math.random() * dimensions.width,
        y: Math.random() * dimensions.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: 1 + Math.random() * 2,
        color: `hsl(${260 + Math.random() * 60}, 70%, 60%)`,
        life: 1,
        decay: 0.001 + Math.random() * 0.002,
      });
    }

    const animate = () => {
      ctx.fillStyle = 'rgba(10, 10, 20, 0.1)';
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // Draw laser prism beams
      const centerX = dimensions.width / 2;
      const centerY = dimensions.height / 2;
      const time = Date.now() * 0.001;

      prismBeams.forEach((beam, index) => {
        const pulse = Math.sin(time * beam.speed + beam.pulsePhase) * 0.3 + 0.7;
        const mouseInfluence =
          Math.sin(
            Math.atan2(mousePos.y - centerY, mousePos.x - centerX) - beam.angle
          ) *
            0.5 +
          0.5;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(beam.angle + time * 0.0005);

        // Create gradient for laser beam
        const gradient = ctx.createLinearGradient(0, 0, beam.length * pulse, 0);
        gradient.addColorStop(0, `hsla(${280 + index * 20}, 70%, 60%, 0)`);
        gradient.addColorStop(
          0.5,
          `hsla(${280 + index * 20}, 70%, 60%, ${beam.opacity * pulse * mouseInfluence})`
        );
        gradient.addColorStop(1, `hsla(${280 + index * 20}, 70%, 60%, 0)`);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = beam.width * pulse;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(beam.length * pulse, 0);
        ctx.stroke();

        // Add glow effect
        ctx.shadowBlur = 20 * pulse * mouseInfluence;
        ctx.shadowColor = `hsl(${280 + index * 20}, 70%, 60%)`;
        ctx.stroke();

        ctx.restore();
      });

      // Draw and update particles
      particles.forEach((particle, index) => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= particle.decay;

        // Wrap around edges
        if (particle.x < 0) particle.x = dimensions.width;
        if (particle.x > dimensions.width) particle.x = 0;
        if (particle.y < 0) particle.y = dimensions.height;
        if (particle.y > dimensions.height) particle.y = 0;

        // Reset dead particles
        if (particle.life <= 0) {
          particle.x = Math.random() * dimensions.width;
          particle.y = Math.random() * dimensions.height;
          particle.life = 1;
        }

        // Draw particle
        ctx.save();
        ctx.globalAlpha = particle.life;
        ctx.fillStyle = particle.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = particle.color;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      // Draw central prism
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(time * 0.0002);

      const prismGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 50);
      prismGradient.addColorStop(0, 'hsla(280, 70%, 80%, 0.8)');
      prismGradient.addColorStop(0.5, 'hsla(260, 70%, 60%, 0.4)');
      prismGradient.addColorStop(1, 'hsla(240, 70%, 40%, 0.1)');

      ctx.fillStyle = prismGradient;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6;
        const x = Math.cos(angle) * 30;
        const y = Math.sin(angle) * 30;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [dimensions, mousePos]);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{
          background:
            'radial-gradient(circle at center, #0a0a14 0%, #000000 100%)',
        }}
      />
    </div>
  );
};

export default LaserPrismBackground;
