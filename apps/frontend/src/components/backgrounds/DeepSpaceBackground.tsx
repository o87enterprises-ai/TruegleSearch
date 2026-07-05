
import React, { useRef, useEffect, useState } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  color: string;
  twinkleSpeed: number;
  twinklePhase: number;
  depth: number; // Static depth for parallax (0-1)
}

interface Galaxy {
  x: number;
  y: number;
  size: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  opacity: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
  trail: { x: number; y: number; opacity: number }[];
  life: number;
  maxLife: number;
}

const TRUEGLE_COLORS = ['#ff0033', '#9d00ff', '#00d4ff', '#39ff14', '#ffaa00'];
const BLUE_COLORS = ['#00d4ff', '#4da6ff', '#66b3ff', '#80bfff', '#ffffff'];

export const DeepSpaceBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);

  const starsRef = useRef<Star[]>([]);
  const galaxiesRef = useRef<Galaxy[]>([]);
  const shootingStarsRef = useRef<ShootingStar[]>([]);
  const timeRef = useRef<number>(0);

  const initSpace = (width: number, height: number) => {
    const stars: Star[] = [];
    for (let i = 0; i < 800; i++) {
      // 40% chance for blue accent, 20% chance for other colors, 40% white
      let starColor = '#ffffff';
      const colorRoll = Math.random();
      if (colorRoll > 0.6) {
        // 40% chance: blue accents
        starColor = BLUE_COLORS[Math.floor(Math.random() * BLUE_COLORS.length)];
      } else if (colorRoll > 0.4) {
        // 20% chance: other Truegle colors
        starColor = TRUEGLE_COLORS[Math.floor(Math.random() * TRUEGLE_COLORS.length)];
      }

      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.8 + 0.2,
        color: starColor,
        twinkleSpeed: Math.random() * 0.05 + 0.01,
        twinklePhase: Math.random() * Math.PI * 2,
        depth: Math.random(), // 0 = far, 1 = near
      });
    }
    starsRef.current = stars;

    const galaxies: Galaxy[] = [];
    for (let i = 0; i < 6; i++) {
      galaxies.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 150 + 50,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.0001,
        color: TRUEGLE_COLORS[Math.floor(Math.random() * TRUEGLE_COLORS.length)],
        opacity: Math.random() * 0.03 + 0.02,
      });
    }
    galaxiesRef.current = galaxies;
  };

  const drawGalacticPlane = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(0.1); // Slight tilt
    
    const grad = ctx.createLinearGradient(0, -height * 0.1, 0, height * 0.1);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.5, 'rgba(100, 50, 150, 0.02)'); // Reduced from 0.08
    grad.addColorStop(1, 'transparent');
    
    ctx.fillStyle = grad;
    ctx.fillRect(-width, -height * 0.1, width * 2, height * 0.2);
    
    // Add some faint "dust" clouds to the plane
    for(let i = 0; i < 5; i++) {
      const x = Math.sin(time * 0.0001 + i) * width * 0.5;
      const cloudGrad = ctx.createRadialGradient(x, 0, 0, x, 0, width * 0.3);
      cloudGrad.addColorStop(0, `rgba(0, 212, 255, ${0.008 * Math.sin(time * 0.0005 + i)})`); // Reduced from 0.03
      cloudGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = cloudGrad;
      ctx.fillRect(-width, -height * 0.1, width * 2, height * 0.2);
    }
    
    ctx.restore();
  };

  const drawCosmicCore = (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
    const cx = width / 2;
    const cy = height / 2;
    const size = 60;
    
    ctx.save();
    ctx.translate(cx, cy);
    
    // Subtle tilt to the accretion disk
    ctx.rotate(-0.2);

    // 1. Accretion Disk (Very faint glow)
    const diskRotation = time * 0.001;
    
    ctx.save();
    ctx.scale(2.5, 0.4);
    ctx.rotate(diskRotation);
    
    const diskGrad = ctx.createRadialGradient(0, 0, size * 0.2, 0, 0, size * 4);
    diskGrad.addColorStop(0, 'rgba(255, 200, 50, 0.1)'); // Reduced from 0.4
    diskGrad.addColorStop(0.2, 'rgba(255, 100, 0, 0.05)'); // Reduced from 0.2
    diskGrad.addColorStop(0.5, 'rgba(150, 0, 255, 0.02)'); // Reduced from 0.1
    diskGrad.addColorStop(1, 'transparent');
    
    ctx.fillStyle = diskGrad;
    ctx.beginPath();
    ctx.arc(0, 0, size * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Vertical Light Beams (Extremely Subtle)
    ctx.save();
    const beamOpacity = 0.015; // Reduced from 0.06
    const beamGrad = ctx.createLinearGradient(0, -height, 0, height);
    beamGrad.addColorStop(0, 'transparent');
    beamGrad.addColorStop(0.4, `rgba(0, 212, 255, ${beamOpacity})`);
    beamGrad.addColorStop(0.5, `rgba(255, 255, 255, ${beamOpacity * 2})`);
    beamGrad.addColorStop(0.6, `rgba(157, 0, 255, ${beamOpacity})`);
    beamGrad.addColorStop(1, 'transparent');
    
    ctx.fillStyle = beamGrad;
    ctx.fillRect(-12, -height, 24, height * 2);
    ctx.restore();

    // 3. Central Glow (Portal) - Soft and faint
    const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.8);
    coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.12)'); // Reduced from 0.5
    coreGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2);
    ctx.fill();

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

    // Reset alpha and clear background to prevent streaking
    ctx.globalAlpha = 1.0;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#010103';
    ctx.fillRect(0, 0, width, height);

    // Galactic Plane (Background Layer)
    drawGalacticPlane(ctx, width, height, t);

    // Distant Galaxies
    galaxiesRef.current.forEach(g => {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.rotation + t * g.rotationSpeed);
      ctx.globalAlpha = g.opacity;
      ctx.globalCompositeOperation = 'screen';
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, g.size);
      grad.addColorStop(0, g.color);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.scale(2, 0.7);
      ctx.beginPath();
      ctx.arc(0, 0, g.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Central Cosmic Core
    drawCosmicCore(ctx, width, height, t);

    // Twinkling Stars
    starsRef.current.forEach(star => {
      // Twinkling effect
      const twinkle = Math.sin(t * star.twinkleSpeed + star.twinklePhase) * 0.25 + 0.75;
      const opacity = star.opacity * twinkle;

      // Save context state before each star to prevent cross-frame contamination
      ctx.save();

      ctx.fillStyle = star.color;
      ctx.globalAlpha = opacity;

      // Size varies slightly with depth
      const renderSize = star.size * (0.5 + star.depth * 0.5);

      ctx.beginPath();
      ctx.arc(star.x, star.y, renderSize, 0, Math.PI * 2);
      ctx.fill();

      // Restore context state
      ctx.restore();
    });

    // Update and render shooting stars
    shootingStarsRef.current = shootingStarsRef.current.filter(star => {
      // Update position
      star.x += star.vx;
      star.y += star.vy;
      star.life++;

      // Add to trail
      star.trail.push({ x: star.x, y: star.y, opacity: star.opacity });
      if (star.trail.length > 15) {
        star.trail.shift();
      }

      // Fade out as life progresses
      star.opacity = 1 - (star.life / star.maxLife);

      // Draw trail
      ctx.save();
      star.trail.forEach((point, index) => {
        const trailOpacity = (index / star.trail.length) * star.opacity;
        ctx.globalAlpha = trailOpacity;
        ctx.fillStyle = star.color;
        const trailSize = star.size * (index / star.trail.length);
        ctx.beginPath();
        ctx.arc(point.x, point.y, trailSize, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // Draw the star itself
      ctx.save();
      ctx.globalAlpha = star.opacity;
      ctx.fillStyle = star.color;
      ctx.shadowColor = star.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Keep alive if life < maxLife
      return star.life < star.maxLife;
    });

    // Reset global alpha
    ctx.globalAlpha = 1.0;

    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Override global pixelated rendering to prevent streaks on high-DPI displays
    canvas.style.setProperty('image-rendering', 'auto', 'important');
    canvas.style.setProperty('-webkit-image-rendering', 'auto', 'important');

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      initSpace(canvas.width, canvas.height);
    };

    const handleClick = (e: MouseEvent) => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * dpr;
      const y = (e.clientY - rect.top) * dpr;

      // Create 2-4 shooting stars from click point
      const numStars = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < numStars; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 5;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;

        // Alternate between blue and white colors
        const isBlue = Math.random() > 0.5;
        const color = isBlue
          ? BLUE_COLORS[Math.floor(Math.random() * (BLUE_COLORS.length - 1))]
          : '#ffffff';

        shootingStarsRef.current.push({
          x,
          y,
          vx,
          vy,
          size: Math.random() * 2 + 2,
          opacity: 1,
          color,
          trail: [],
          life: 0,
          maxLife: Math.random() * 40 + 60,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    canvas.addEventListener('click', handleClick);
    handleResize();

    requestRef.current = requestAnimationFrame(animate);

    // Pause the draw loop while the tab is hidden so a backgrounded page does
    // zero canvas work and resuming doesn't burst.
    const handleVisibility = () => {
      if (document.hidden) {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      } else if (!requestRef.current) {
        requestRef.current = requestAnimationFrame(animate);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('click', handleClick);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 block w-full h-full"
      style={{
        willChange: 'auto',
        transform: 'none',
        imageRendering: 'auto',
        cursor: 'crosshair',
      }}
    />
  );
};
