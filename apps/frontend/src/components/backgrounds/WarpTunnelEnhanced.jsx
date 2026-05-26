import { useEffect, useRef } from 'react';

export default function WarpTunnelEnhanced() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Warp stars with speed lines
    class WarpStar {
      constructor() {
        this.reset();
      }

      reset() {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 5;
        this.x = centerX + Math.cos(angle) * distance;
        this.y = centerY + Math.sin(angle) * distance;
        this.z = Math.random() * 2000 + 1000;
        this.prevX = this.x;
        this.prevY = this.y;
        this.speed = 3 + Math.random() * 4;
        this.color = `hsl(${190 + Math.random() * 60}, 70%, ${60 + Math.random() * 30}%)`;
        this.size = 0.5 + Math.random() * 1.5;
      }

      update(mouseX, mouseY) {
        this.prevX = this.x;
        this.prevY = this.y;

        // Move toward viewer
        this.z -= this.speed;

        if (this.z <= 1) {
          this.reset();
        }

        // Project 3D to 2D with mouse parallax
        const scale = 1000 / this.z;
        this.x = centerX + (this.x - centerX) * scale + mouseX * 0.02;
        this.y = centerY + (this.y - centerY) * scale + mouseY * 0.02;
        this.size = (1 - this.z / 2000) * 2;
      }

      draw() {
        // Star glow
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(
          this.x,
          this.y,
          0,
          this.x,
          this.y,
          this.size * 3
        );
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
        ctx.fill();

        // Speed trail
        ctx.beginPath();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.size * 0.5;
        ctx.moveTo(this.prevX, this.prevY);
        ctx.lineTo(this.x, this.y);
        ctx.stroke();

        // Core
        ctx.beginPath();
        ctx.fillStyle = '#ffffff';
        ctx.arc(this.x, this.y, this.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Nebula clouds
    class Nebula {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = 100 + Math.random() * 200;
        this.color = ['#6a0dad', '#0055ff', '#ff0055'][
          Math.floor(Math.random() * 3)
        ];
        this.opacity = 0.05 + Math.random() * 0.1;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.001;
      }

      update() {
        this.rotation += this.rotationSpeed;
      }

      draw(time) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
        gradient.addColorStop(
          0,
          `${this.color}${Math.floor(this.opacity * 255)
            .toString(16)
            .padStart(2, '0')}`
        );
        gradient.addColorStop(
          0.5,
          `${this.color}${Math.floor(this.opacity * 128)
            .toString(16)
            .padStart(2, '0')}`
        );
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(-this.size, -this.size, this.size * 2, this.size * 2);
        ctx.restore();
      }
    }

    // Space dust
    const dust = [];
    for (let i = 0; i < 500; i++) {
      dust.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 1.5,
        speed: Math.random() * 0.2,
        opacity: Math.random() * 0.5 + 0.2,
      });
    }

    const stars = [];
    for (let i = 0; i < 3000; i++) {
      stars.push(new WarpStar());
    }

    const nebulae = [];
    for (let i = 0; i < 3; i++) {
      nebulae.push(new Nebula());
    }

    let mouseX = 0;
    let mouseY = 0;
    let animationId;
    const startTime = Date.now();

    const handleMouseMove = (e) => {
      mouseX = (e.clientX - centerX) / 20;
      mouseY = (e.clientY - centerY) / 20;
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    function animate() {
      const time = (Date.now() - startTime) * 0.001;

      // Clear with deep space gradient
      const bgGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        canvas.width
      );
      bgGradient.addColorStop(0, '#000510');
      bgGradient.addColorStop(0.5, '#000820');
      bgGradient.addColorStop(1, '#000010');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw nebulae
      nebulae.forEach((nebula) => {
        nebula.update();
        nebula.draw(time);
      });

      // Draw and update dust
      dust.forEach((d) => {
        d.y += d.speed;
        if (d.y > canvas.height) d.y = 0;

        ctx.fillStyle = `rgba(136, 170, 255, ${d.opacity})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw and update warp stars
      stars.forEach((star) => {
        star.update(mouseX, mouseY);
        star.draw();
      });

      // Tunnel rings effect
      for (let i = 0; i < 20; i++) {
        const ringZ = (time * 50 + i * 100) % 1000;
        const scale = 1000 / ringZ;
        const ringSize = 50 * scale;
        const alpha = Math.max(0, 1 - ringZ / 1000);

        ctx.beginPath();
        ctx.strokeStyle = `rgba(0, 170, 255, ${alpha * 0.3})`;
        ctx.lineWidth = 2 * scale;
        ctx.arc(centerX, centerY, ringSize, 0, Math.PI * 2);
        ctx.stroke();
      }

      animationId = requestAnimationFrame(animate);
    }

    animate();

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ background: '#000010' }}
    />
  );
}
