import { useEffect, useRef } from 'react';

export default function AtomicOrbitals() {
  const canvasRef = useRef(null);
  const animationIdRef = useRef(null);

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

    // MASSIVE central core
    const core = {
      x: width / 2,
      y: height / 2,
      radius: 80,
      pulsePhase: 0,
    };

    class OrbitalParticle {
      constructor(orbitRadius, speed, color, offset = 0, tiltAngle = 0) {
        this.orbitRadius = orbitRadius;
        this.speed = speed;
        this.angle = offset;
        this.color = color;
        this.size = Math.random() * 6 + 5; // BIGGER particles
        this.opacity = Math.random() * 0.3 + 0.7; // MORE OPAQUE
        this.tilt = tiltAngle;
        this.trail = [];
        this.maxTrailLength = 40; // LONGER trails
      }

      update() {
        this.angle += this.speed;

        // Enhanced 3D calculation
        const x = core.x + Math.cos(this.angle) * this.orbitRadius;
        const y =
          core.y +
          Math.sin(this.angle) * this.orbitRadius * Math.cos(this.tilt);
        const z = Math.sin(this.angle) * this.orbitRadius * Math.sin(this.tilt);

        this.trail.unshift({ x, y, z });
        if (this.trail.length > this.maxTrailLength) {
          this.trail.pop();
        }

        return { x, y, z };
      }

      draw(pos) {
        // MUCH BRIGHTER trail
        this.trail.forEach((point, i) => {
          const trailOpacity =
            (1 - i / this.maxTrailLength) * this.opacity * 0.8;
          const trailSize = this.size * (1 - (i / this.maxTrailLength) * 0.5);

          // Outer glow
          const glowGradient = ctx.createRadialGradient(
            point.x,
            point.y,
            0,
            point.x,
            point.y,
            trailSize * 3
          );
          glowGradient.addColorStop(0, this.color + 'FF');
          glowGradient.addColorStop(0.5, this.color + '88');
          glowGradient.addColorStop(1, this.color + '00');

          ctx.fillStyle = glowGradient;
          ctx.globalAlpha = trailOpacity;
          ctx.beginPath();
          ctx.arc(point.x, point.y, trailSize * 3, 0, Math.PI * 2);
          ctx.fill();

          // Core
          ctx.fillStyle = this.color;
          ctx.globalAlpha = trailOpacity;
          ctx.beginPath();
          ctx.arc(point.x, point.y, trailSize, 0, Math.PI * 2);
          ctx.fill();
        });

        // MASSIVE particle glow
        const mainGlow = ctx.createRadialGradient(
          pos.x,
          pos.y,
          0,
          pos.x,
          pos.y,
          this.size * 6
        );
        mainGlow.addColorStop(0, '#FFFFFF');
        mainGlow.addColorStop(0.2, this.color);
        mainGlow.addColorStop(0.5, this.color + 'AA');
        mainGlow.addColorStop(1, this.color + '00');

        ctx.fillStyle = mainGlow;
        ctx.globalAlpha = this.opacity;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, this.size * 6, 0, Math.PI * 2);
        ctx.fill();

        // Bright white core
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, this.size * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Colored outer ring
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, this.size * 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // BIGGER orbits, MORE particles, STRONGER colors
    const orbits = [
      {
        radius: 180,
        speed: 0.025,
        color: '#00E5FF',
        count: 8,
        tilt: Math.PI / 6,
      }, // Cyan
      {
        radius: 260,
        speed: -0.02,
        color: '#FF00FF',
        count: 10,
        tilt: Math.PI / 4,
      }, // Magenta
      {
        radius: 340,
        speed: 0.015,
        color: '#8B5CF6',
        count: 12,
        tilt: -Math.PI / 5,
      }, // Purple
      {
        radius: 420,
        speed: -0.012,
        color: '#FF0000',
        count: 14,
        tilt: Math.PI / 3,
      }, // Red
      {
        radius: 500,
        speed: 0.01,
        color: '#FFD700',
        count: 16,
        tilt: -Math.PI / 4,
      }, // Yellow
      {
        radius: 580,
        speed: -0.008,
        color: '#FF6B00',
        count: 18,
        tilt: Math.PI / 7,
      }, // Orange
    ];

    const particles = [];
    orbits.forEach((orbit) => {
      for (let i = 0; i < orbit.count; i++) {
        const offset = (Math.PI * 2 * i) / orbit.count;
        particles.push(
          new OrbitalParticle(
            orbit.radius,
            orbit.speed,
            orbit.color,
            offset,
            orbit.tilt
          )
        );
      }
    });

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      // MASSIVE pulsing core
      core.pulsePhase += 0.04;
      const pulseSize = core.radius + Math.sin(core.pulsePhase) * 20;

      // Huge outer glow
      const outerGlow = ctx.createRadialGradient(
        core.x,
        core.y,
        0,
        core.x,
        core.y,
        pulseSize * 5
      );
      outerGlow.addColorStop(0, '#FF6B00FF');
      outerGlow.addColorStop(0.2, '#FF6B00CC');
      outerGlow.addColorStop(0.4, '#FF6B0066');
      outerGlow.addColorStop(0.7, '#FF6B0033');
      outerGlow.addColorStop(1, '#FF6B0000');

      ctx.fillStyle = outerGlow;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(core.x, core.y, pulseSize * 5, 0, Math.PI * 2);
      ctx.fill();

      // Middle glow
      const middleGlow = ctx.createRadialGradient(
        core.x,
        core.y,
        0,
        core.x,
        core.y,
        pulseSize * 2
      );
      middleGlow.addColorStop(0, '#FFFFFF');
      middleGlow.addColorStop(0.3, '#FFD700');
      middleGlow.addColorStop(0.6, '#FF6B00');
      middleGlow.addColorStop(1, '#FF0000');

      ctx.fillStyle = middleGlow;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(core.x, core.y, pulseSize * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Core
      const coreGradient = ctx.createRadialGradient(
        core.x,
        core.y,
        0,
        core.x,
        core.y,
        pulseSize
      );
      coreGradient.addColorStop(0, '#FFFFFF');
      coreGradient.addColorStop(0.5, '#FFD700');
      coreGradient.addColorStop(1, '#FF6B00');

      ctx.fillStyle = coreGradient;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(core.x, core.y, pulseSize, 0, Math.PI * 2);
      ctx.fill();

      // BRIGHT center point
      ctx.fillStyle = '#FFFFFF';
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(core.x, core.y, pulseSize * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Draw VISIBLE orbital rings
      ctx.globalAlpha = 0.15; // MORE VISIBLE
      ctx.lineWidth = 2;
      orbits.forEach((orbit) => {
        ctx.strokeStyle = orbit.color;
        ctx.beginPath();
        ctx.ellipse(
          core.x,
          core.y,
          orbit.radius,
          orbit.radius * Math.cos(orbit.tilt),
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
      });

      // Sort and draw particles
      const particleData = particles.map((p) => {
        const pos = p.update();
        return { particle: p, pos, z: pos.z };
      });
      particleData.sort((a, b) => a.z - b.z);

      particleData.forEach(({ particle, pos }) => {
        particle.draw(pos);
      });

      // BRIGHTER connection lines
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < particleData.length; i++) {
        for (let j = i + 1; j < particleData.length; j++) {
          const p1 = particleData[i].pos;
          const p2 = particleData[j].pos;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 200) {
            const gradient = ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
            gradient.addColorStop(0, particleData[i].particle.color);
            gradient.addColorStop(1, particleData[j].particle.color);

            ctx.strokeStyle = gradient;
            ctx.globalAlpha = (1 - dist / 200) * 0.4;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      animationIdRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
  );
}
