import { useEffect, useRef } from 'react';

export default function ParticleField({
  density = 50,
  speed = 0.5,
  colors = ['#00E5FF', '#8B5CF6', '#FF6B00'],
  interactive = true,
}) {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const mouse = useRef({ x: 0, y: 0 });
  const animationId = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resizeCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    class Particle {
      constructor() {
        this.reset();
        this.y = Math.random() * height;
      }

      reset() {
        this.x = Math.random() * width;
        this.y = -10;
        this.vx = (Math.random() - 0.5) * speed;
        this.vy = Math.random() * speed + 0.5;
        this.size = Math.random() * 2 + 1;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.opacity = Math.random() * 0.5 + 0.3;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        if (interactive) {
          const dx = mouse.current.x - this.x;
          const dy = mouse.current.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 100) {
            const force = (100 - dist) / 100;
            this.x -= dx * force * 0.03;
            this.y -= dy * force * 0.03;
          }
        }

        if (this.y > height + 10) this.reset();
        if (this.x < -10) this.x = width + 10;
        if (this.x > width + 10) this.x = -10;
      }

      draw() {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = this.opacity;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    particles.current = Array.from({ length: density }, () => new Particle());

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      particles.current.forEach((particle) => {
        particle.update();
        particle.draw();
      });

      particles.current.forEach((p1, i) => {
        particles.current.slice(i + 1).forEach((p2) => {
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 100) {
            ctx.strokeStyle = p1.color;
            ctx.globalAlpha = (1 - dist / 100) * 0.15;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        });
      });

      ctx.globalAlpha = 1;
      animationId.current = requestAnimationFrame(animate);
    };

    animate();

    const handleMouseMove = (e) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };

    if (interactive) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationId.current) {
        cancelAnimationFrame(animationId.current);
      }
    };
  }, [density, speed, colors, interactive]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ opacity: 0.6 }}
    />
  );
}
