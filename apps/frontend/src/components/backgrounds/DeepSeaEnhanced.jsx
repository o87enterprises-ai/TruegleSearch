import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export default function DeepSeaEnhanced() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Jellyfish particles
    class JellyfishParticle {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 60 + 20;
        this.speedY = Math.random() * 0.3 + 0.1;
        this.speedX = (Math.random() - 0.5) * 0.2;
        this.opacity = Math.random() * 0.3 + 0.1;
        this.pulseSpeed = Math.random() * 0.02 + 0.01;
        this.pulseOffset = Math.random() * Math.PI * 2;
        this.color = ['#00aaff', '#0088ff', '#00ffff', '#0066ff'][
          Math.floor(Math.random() * 4)
        ];
      }

      update(time) {
        this.y += this.speedY;
        this.x += this.speedX + Math.sin(time * 0.001 + this.pulseOffset) * 0.3;

        if (this.y > canvas.height + this.size) {
          this.reset();
          this.y = -this.size;
        }
      }

      draw(time) {
        const pulse =
          Math.sin(time * this.pulseSpeed + this.pulseOffset) * 0.5 + 0.5;
        const currentOpacity = this.opacity * (pulse * 0.5 + 0.5);

        // Outer glow
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(
          this.x,
          this.y,
          0,
          this.x,
          this.y,
          this.size * 1.5
        );
        gradient.addColorStop(
          0,
          `${this.color}${Math.floor(currentOpacity * 80)
            .toString(16)
            .padStart(2, '0')}`
        );
        gradient.addColorStop(
          0.5,
          `${this.color}${Math.floor(currentOpacity * 40)
            .toString(16)
            .padStart(2, '0')}`
        );
        gradient.addColorStop(1, `${this.color}00`);
        ctx.fillStyle = gradient;
        ctx.arc(this.x, this.y, this.size * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Inner core
        ctx.beginPath();
        const coreGradient = ctx.createRadialGradient(
          this.x,
          this.y,
          0,
          this.x,
          this.y,
          this.size * 0.5
        );
        coreGradient.addColorStop(
          0,
          `${this.color}${Math.floor(currentOpacity * 255)
            .toString(16)
            .padStart(2, '0')}`
        );
        coreGradient.addColorStop(1, `${this.color}00`);
        ctx.fillStyle = coreGradient;
        ctx.arc(this.x, this.y, this.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Light rays
    class LightRay {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.width = Math.random() * 100 + 50;
        this.opacity = Math.random() * 0.1 + 0.05;
        this.speed = Math.random() * 0.1 + 0.05;
      }

      draw(time) {
        const offset = Math.sin(time * 0.0005 + this.x) * 20;
        ctx.save();
        ctx.translate(this.x + offset, 0);
        ctx.rotate(Math.PI / 12);

        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, `rgba(0, 170, 255, ${this.opacity})`);
        gradient.addColorStop(0.5, `rgba(0, 136, 255, ${this.opacity * 0.5})`);
        gradient.addColorStop(1, 'rgba(0, 136, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(-this.width / 2, 0, this.width, canvas.height);
        ctx.restore();
      }
    }

    // Marine snow particles
    const particles = [];
    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speedY: Math.random() * 0.5 + 0.2,
        speedX: (Math.random() - 0.5) * 0.1,
        opacity: Math.random() * 0.6 + 0.2,
      });
    }

    const jellyfish = [];
    for (let i = 0; i < 12; i++) {
      jellyfish.push(new JellyfishParticle());
    }

    const lightRays = [];
    for (let i = 0; i < 5; i++) {
      lightRays.push(new LightRay());
    }

    let animationId;
    const startTime = Date.now();

    function animate() {
      const time = Date.now() - startTime;

      // Clear with dark blue gradient
      const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGradient.addColorStop(0, '#000510');
      bgGradient.addColorStop(0.5, '#001030');
      bgGradient.addColorStop(1, '#000510');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw light rays
      lightRays.forEach((ray) => ray.draw(time));

      // Draw and update jellyfish
      jellyfish.forEach((jf) => {
        jf.update(time);
        jf.draw(time);
      });

      // Draw marine snow
      particles.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX;

        if (p.y > canvas.height) p.y = -5;
        if (p.x > canvas.width) p.x = 0;
        if (p.x < 0) p.x = canvas.width;

        ctx.fillStyle = `rgba(136, 204, 255, ${p.opacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    }

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Pause the draw loop while the tab is hidden. Must reassign the same
    // `animationId` the cleanup cancels, or the cleanup would cancel a stale id.
    let pausedByVisibility = false;
    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationId);
        pausedByVisibility = true;
      } else if (pausedByVisibility) {
        pausedByVisibility = false;
        animationId = requestAnimationFrame(animate);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ background: '#000010' }}
      />

      {/* Additional CSS depth effects */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Animated caustics effect */}
        <motion.div
          className="absolute inset-0 opacity-10"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(0, 170, 255, 0.3) 0%, transparent 50%)',
          }}
          animate={{
            opacity: [0.05, 0.15, 0.05],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Bottom depth fade */}
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
      </div>
    </>
  );
}
