
import React, { useRef, useEffect, useState } from 'react';

interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
  opacity: number;
  color: string;
  speedModifier: number;
}

interface TunnelBeam {
  angle: number;
  z: number;
  length: number;
  color: string;
  width: number;
}

interface MouseParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
  life: number;
  maxLife: number;
}

interface GridLine {
  angle: number;
  z: number;
  radius: number;
}

const TRUEGLE_COLORS = ['#ff0033', '#9d00ff', '#00d4ff', '#39ff14', '#ffaa00'];
const COLOR_MODES = [
  { name: 'All Red', colors: ['#ff0033', '#ff0044', '#ee0022', '#dd0011', '#cc0000', '#ff1144'] },
  { name: 'Red Purple Yellow', colors: ['#ff0033', '#9d00ff', '#ffaa00', '#ff0044', '#aa00dd', '#ffbb11'] },
  { name: 'Red Purple Blue', colors: ['#ff0033', '#9d00ff', '#00d4ff', '#ff0044', '#aa00dd', '#11bbff'] },
  { name: 'Red Purple Green', colors: ['#ff0033', '#9d00ff', '#39ff14', '#ff0044', '#aa00dd', '#44ff22'] },
  { name: 'Red Green Yellow', colors: ['#ff0033', '#39ff14', '#ffaa00', '#ff0044', '#44ff22', '#ffbb11'] },
];

export const WarpSpeedBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(65); // Always in hyperspace mode
  const targetSpeedRef = useRef(65);
  const baseSpeedRef = useRef(65);
  const speedBoostRef = useRef(0);
  const colorModeRef = useRef(0);
  const requestRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  const starsRef = useRef<Star[]>([]);
  const tunnelBeamsRef = useRef<TunnelBeam[]>([]);
  const mouseParticlesRef = useRef<MouseParticle[]>([]);
  const gridLinesRef = useRef<GridLine[]>([]);

  // State for showing color mode indicator
  const [showModeIndicator, setShowModeIndicator] = useState(false);
  const [currentModeName, setCurrentModeName] = useState(COLOR_MODES[0].name);
  const indicatorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const initSpace = (width: number, height: number) => {
    // High-density stars for continuous streaks
    const stars: Star[] = [];
    const count = 3000;
    for (let i = 0; i < count; i++) {
      const z = Math.random() * 2000;
      stars.push({
        x: (Math.random() - 0.5) * width * 5,
        y: (Math.random() - 0.5) * height * 5,
        z: z,
        size: Math.random() * 0.6 + 0.15,
        opacity: Math.random() * 0.5 + 0.5,
        color: COLOR_MODES[0].colors[Math.floor(Math.random() * COLOR_MODES[0].colors.length)],
        speedModifier: Math.random() * 0.5 + 0.75,
      });
    }
    starsRef.current = stars;

    // Background structural beams
    const beams: TunnelBeam[] = [];
    for (let i = 0; i < 40; i++) {
      beams.push({
        angle: Math.random() * Math.PI * 2,
        z: Math.random() * 1000,
        length: Math.random() * 600 + 400,
        color: TRUEGLE_COLORS[Math.floor(Math.random() * TRUEGLE_COLORS.length)],
        width: Math.random() * 10 + 2,
      });
    }
    tunnelBeamsRef.current = beams;

    // Initialize geometric tunnel grid
    const gridLines: GridLine[] = [];
    // Circular grid lines at different depths
    for (let i = 0; i < 12; i++) {
      gridLines.push({
        angle: (i / 12) * Math.PI * 2,
        z: 0,
        radius: 200,
      });
    }
    // Depth rings
    for (let i = 0; i < 8; i++) {
      gridLines.push({
        angle: 0,
        z: i * 250,
        radius: 300,
      });
    }
    gridLinesRef.current = gridLines;
  };

  const drawCoreGlow = (ctx: CanvasRenderingContext2D, cx: number, cy: number, speed: number, time: number, colorMode: number) => {
    const glowSize = (80 + speed * 4) * 0.25;
    const intensity = Math.min(0.9, speed / 30) * 0.15;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Enhanced red glow for mode 0 (All Red)
    if (colorMode === 0) {
      const pulseIntensity = Math.sin(time * 0.002) * 0.3 + 0.7; // Breathing pulse
      const glowMultiplier = 3.5; // Much larger glow for red mode

      // Outer red aura with pulsing
      const outerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowSize * glowMultiplier * 1.5);
      outerGrad.addColorStop(0, `rgba(255, 0, 51, ${intensity * 0.6 * pulseIntensity})`);
      outerGrad.addColorStop(0.3, `rgba(220, 0, 40, ${intensity * 0.4 * pulseIntensity})`);
      outerGrad.addColorStop(0.6, `rgba(180, 0, 30, ${intensity * 0.2 * pulseIntensity})`);
      outerGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowSize * glowMultiplier * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Middle red glow layer
      const midGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowSize * glowMultiplier);
      midGrad.addColorStop(0, `rgba(255, 50, 80, ${intensity * 1.2 * pulseIntensity})`);
      midGrad.addColorStop(0.4, `rgba(255, 20, 60, ${intensity * 0.8 * pulseIntensity})`);
      midGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = midGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowSize * glowMultiplier, 0, Math.PI * 2);
      ctx.fill();

      // Bright white-red core
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowSize * 1.2);
      coreGrad.addColorStop(0, `rgba(255, 200, 210, ${intensity * 2.5 * pulseIntensity})`);
      coreGrad.addColorStop(0.3, `rgba(255, 100, 120, ${intensity * 1.5 * pulseIntensity})`);
      coreGrad.addColorStop(0.7, `rgba(255, 0, 51, ${intensity * 0.5 * pulseIntensity})`);
      coreGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowSize * 1.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Default blue glow for other modes
      const outerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowSize * 2.5);
      outerGrad.addColorStop(0, `rgba(150, 200, 255, ${intensity * 0.3})`);
      outerGrad.addColorStop(0.4, `rgba(100, 150, 200, ${intensity * 0.15})`);
      outerGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowSize * 2.5, 0, Math.PI * 2);
      ctx.fill();

      const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowSize * 0.8);
      innerGrad.addColorStop(0, `rgba(255, 255, 255, ${intensity * 1.5})`);
      innerGrad.addColorStop(0.3, `rgba(200, 240, 255, ${intensity * 0.6})`);
      innerGrad.addColorStop(0.6, `rgba(150, 200, 255, ${intensity * 0.2})`);
      innerGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowSize * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  const drawTunnelGrid = (ctx: CanvasRenderingContext2D, cx: number, cy: number, speed: number, time: number, colorMode: number) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const fov = 400;
    const gridColor = colorMode === 0 ? 'rgba(255, 0, 51, 0.15)' : 'rgba(0, 212, 255, 0.1)';

    // Draw radial lines from center
    gridLinesRef.current.forEach((line, index) => {
      if (index < 12) {
        // Radial spokes
        const angle = line.angle + time * 0.0001;
        const innerRadius = 50;
        const outerRadius = 800;

        ctx.beginPath();
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.moveTo(cx + Math.cos(angle) * innerRadius, cy + Math.sin(angle) * innerRadius);
        ctx.lineTo(cx + Math.cos(angle) * outerRadius, cy + Math.sin(angle) * outerRadius);
        ctx.stroke();
      }
    });

    // Draw depth rings with 3D perspective
    for (let i = 0; i < 8; i++) {
      const z = (i * 250 - (time * speed * 0.1) % 2000 + 2000) % 2000;
      const scale = fov / (fov + z);
      const radius = 300 * scale;
      const opacity = (1 - z / 2000) * 0.2;

      if (opacity > 0) {
        ctx.beginPath();
        ctx.strokeStyle = colorMode === 0
          ? `rgba(255, 0, 51, ${opacity})`
          : `rgba(0, 212, 255, ${opacity})`;
        ctx.lineWidth = 1.5 * scale;
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  const drawMouseParticles = (ctx: CanvasRenderingContext2D) => {
    ctx.save();

    mouseParticlesRef.current = mouseParticlesRef.current.filter(particle => {
      // Update particle
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vx *= 0.98; // Friction
      particle.vy *= 0.98;
      particle.life++;
      particle.opacity = 1 - (particle.life / particle.maxLife);

      // Draw particle with glow
      if (particle.opacity > 0) {
        ctx.globalAlpha = particle.opacity;
        ctx.fillStyle = particle.color;
        ctx.shadowColor = particle.color;
        ctx.shadowBlur = 15;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();

        // Extra sparkle
        ctx.shadowBlur = 25;
        ctx.globalAlpha = particle.opacity * 0.5;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      return particle.life < particle.maxLife;
    });

    ctx.restore();
  };

  const animate = (t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    timeRef.current = t;
    const { width, height } = canvas;
    const cx = width / 2;
    const cy = height / 2;

    // Pulse/breathing effect - sinusoidal speed variation
    const breathingPulse = Math.sin(t * 0.001) * 8 + 8; // Oscillates between 0 and 16

    // Speed boost decay
    speedBoostRef.current *= 0.95; // Gradually reduce boost

    // Warp physics with pulse effect
    const baseSpeed = baseSpeedRef.current + breathingPulse + speedBoostRef.current;
    targetSpeedRef.current += (baseSpeed - targetSpeedRef.current) * 0.05;
    speedRef.current += (targetSpeedRef.current - speedRef.current) * 0.1;
    const currentSpeed = speedRef.current;

    // Motion blur effect for continuous warp
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, width, height);

    // Draw Geometric Tunnel Grid
    drawTunnelGrid(ctx, cx, cy, currentSpeed, t, colorModeRef.current);

    // Draw Core Glow with enhanced red effects
    drawCoreGlow(ctx, cx, cy, currentSpeed, t, colorModeRef.current);

    const fov = 400;
    const colors = COLOR_MODES[colorModeRef.current].colors;

    // Rendering hyperspace streaks - keep perfectly straight
    starsRef.current.forEach(star => {
      const streakZLength = 350;
      const prevZ = star.z + streakZLength;

      star.z -= currentSpeed * star.speedModifier;

      if (star.z <= 0) {
        star.z = 2000;
        star.x = (Math.random() - 0.5) * width * 6;
        star.y = (Math.random() - 0.5) * height * 6;
        star.color = colors[Math.floor(Math.random() * colors.length)];
      }

      const scale = fov / (fov + star.z);
      const prevScale = fov / (fov + prevZ);

      // Calculate positions, keeping lines radial from center
      const px = star.x * scale + cx;
      const py = star.y * scale + cy;
      const p_px = star.x * prevScale + cx;
      const p_py = star.y * prevScale + cy;

      const opacity = star.opacity * (1 - star.z / 2000);

      // Draw single streak line
      ctx.beginPath();
      ctx.lineWidth = star.size * scale * 2.5;

      const grad = ctx.createLinearGradient(p_px, p_py, px, py);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.3, star.color);
      grad.addColorStop(1, star.color);

      ctx.strokeStyle = grad;
      ctx.globalAlpha = opacity;
      ctx.moveTo(p_px, p_py);
      ctx.lineTo(px, py);
      ctx.stroke();

      // Extra bright core for fast-moving stars (single line, no duplication)
      if (star.speedModifier > 1.3) {
        ctx.beginPath();
        ctx.lineWidth = star.size * scale * 0.5;
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = opacity * 0.4;
        ctx.moveTo(p_px, p_py);
        ctx.lineTo(px, py);
        ctx.stroke();
      }
    });

    // Reset global alpha before drawing particles
    ctx.globalAlpha = 1.0;

    // Draw Mouse Trail Particles
    drawMouseParticles(ctx);

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initSpace(canvas.width, canvas.height);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      // Calculate mouse velocity
      const dx = mouseRef.current.x - lastMousePosRef.current.x;
      const dy = mouseRef.current.y - lastMousePosRef.current.y;
      const velocity = Math.sqrt(dx * dx + dy * dy);

      // Only create particles if mouse is moving
      if (velocity > 2) {
        const colors = COLOR_MODES[colorModeRef.current].colors;

        // Create 2-3 particles per frame when moving
        for (let i = 0; i < 2; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 2 + 1;

          mouseParticlesRef.current.push({
            x: mouseRef.current.x,
            y: mouseRef.current.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 3 + 1,
            opacity: 1,
            color: colors[Math.floor(Math.random() * colors.length)],
            life: 0,
            maxLife: Math.random() * 30 + 30,
          });
        }
      }

      lastMousePosRef.current = { ...mouseRef.current };
    };

    const handleClick = () => {
      // Trigger speed boost effect
      speedBoostRef.current = 40; // Add 40 to speed temporarily

      // Create particle burst at click location
      const colors = COLOR_MODES[colorModeRef.current].colors;
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        const speed = Math.random() * 5 + 3;

        mouseParticlesRef.current.push({
          x: mouseRef.current.x,
          y: mouseRef.current.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 4 + 2,
          opacity: 1,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 0,
          maxLife: Math.random() * 40 + 40,
        });
      }

      // Cycle through color modes
      colorModeRef.current = (colorModeRef.current + 1) % COLOR_MODES.length;

      // Update all existing stars to new color scheme
      const newColors = COLOR_MODES[colorModeRef.current].colors;
      starsRef.current.forEach(star => {
        star.color = newColors[Math.floor(Math.random() * newColors.length)];
      });

      // Show color mode indicator
      setCurrentModeName(COLOR_MODES[colorModeRef.current].name);
      setShowModeIndicator(true);

      // Clear existing timeout
      if (indicatorTimeoutRef.current) {
        clearTimeout(indicatorTimeoutRef.current);
      }

      // Hide indicator after 2 seconds
      indicatorTimeoutRef.current = setTimeout(() => {
        setShowModeIndicator(false);
      }, 2000);
    };

    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);

    handleResize();
    requestRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (indicatorTimeoutRef.current) clearTimeout(indicatorTimeoutRef.current);
    };
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="block w-full h-full cursor-pointer" />

      {/* Film Grain Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />

      {/* Color Mode Indicator */}
      {showModeIndicator && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="bg-black/80 backdrop-blur-xl border border-white/20 rounded-xl px-6 py-3 shadow-2xl animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {COLOR_MODES[colorModeRef.current].colors.slice(0, 3).map((color, i) => (
                  <div
                    key={i}
                    className="w-3 h-3 rounded-full shadow-lg"
                    style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
                  />
                ))}
              </div>
              <div className="text-white font-semibold text-sm tracking-wide">
                {currentModeName}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
