import { useEffect, useRef, useCallback, useState } from 'react';

export default function WarpTunnel() {
  const canvasRef = useRef(null);
  const animationFrameId = useRef(0);
  const lastTimeRef = useRef(0);
  const streaks = useRef([]);
  const [warpFactor, setWarpFactor] = useState(0);
  const speed = useRef(0);
  const warpSpeedTarget = useRef(0);
  const tunnelActive = useRef(true);
  const [backgroundColor, setBackgroundColor] = useState('from-black via-blue-950/10 to-black');

  // Increased speed by 75% - all speeds multiplied by 1.75
  const tunnelPresets = [
    {
      colors: ['#00E5FF', '#0088FF', '#8B5CF6', '#FF00FF', '#FFFFFF'],
      speed: 0.5,
      name: 'Chill Mode',
    },
    {
      colors: ['#00E5FF', '#0088FF', '#8B5CF6', '#FF00FF', '#FFFFFF'],
      speed: 1.05,
      name: 'Slow Cruise',
    },
    {
      colors: ['#FF0080', '#FF00FF', '#8000FF', '#0080FF', '#FFFFFF'],
      speed: 1.75,
      name: 'Standard Warp',
    },
    {
      colors: ['#00FF88', '#00FFFF', '#0088FF', '#8B5CF6', '#FFFFFF'],
      speed: 2.45,
      name: 'High Speed',
    },
    {
      colors: ['#FFD700', '#FFA500', '#FF6B6B', '#FF1493', '#FFFFFF'],
      speed: 3.15,
      name: 'Hyperdrive',
    },
    {
      colors: ['#00E5FF', '#00FF00', '#FFFF00', '#FF00FF', '#FFFFFF'],
      speed: 3.85,
      name: 'Ludicrous Speed',
    },
  ];

  const [preset, setPreset] = useState(() => tunnelPresets[2]);
  const colors = preset.colors;
  const speedMultiplier = preset.speed;

  const config = {
    streakCount: 120,
    baseSpeed: 1.9 * speedMultiplier,
    maxSpeed: 26.25 * speedMultiplier,
    acceleration: 1.0,
    tunnelRadius: 250,
    fov: 800,
    minTrailLength: 150,
    maxTrailLength: 300,
    spawnInterval: 1000 / 60,
  };

  const time = useRef(0);
  const lastSpawnTime = useRef(0);

  const initStreaks = useCallback(
    (canvas) => {
      streaks.current = [];
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      const angleStep = (Math.PI * 2) / config.streakCount;

      for (let i = 0; i < config.streakCount; i++) {
        const z = Math.random() * 2000 + 500;
        const angle = i * angleStep + (Math.random() - 0.5) * 0.1;
        const radius = config.tunnelRadius * (0.4 + Math.random() * 0.6);

        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        const trailLength =
          config.minTrailLength +
          Math.random() * (config.maxTrailLength - config.minTrailLength);
        const size = 0.1 + Math.random() * 0.2;
        const color =
          colors[Math.floor(Math.random() * Math.min(4, colors.length))];
        const speedMultiplier = 0.8 + Math.random() * 0.4;
        const brightness = 0.9 + Math.random() * 0.1;

        streaks.current.push({
          id: i,
          x,
          y,
          z,
          angle,
          radius,
          color,
          size,
          speed: config.baseSpeed * speedMultiplier,
          trailLength,
          brightness,
          fadeIn: 100,
          maxFadeIn: 100,
          spawnTime: performance.now(),
          opacity: 1,
        });
      }
    },
    [config.streakCount, config.tunnelRadius, config.baseSpeed, colors]
  );

  const updateStreaks = useCallback(
    (canvas, deltaTime) => {
      const dt = Math.min(deltaTime / 16, 2);

      if (tunnelActive.current) {
        warpSpeedTarget.current = config.maxSpeed;
      } else {
        warpSpeedTarget.current = config.baseSpeed;
      }

      speed.current +=
        (warpSpeedTarget.current - speed.current) *
        config.acceleration *
        dt *
        1.5;

      const currentWarpFactor = Math.min(1, speed.current / config.maxSpeed);
      setWarpFactor(currentWarpFactor);

      const now = performance.now();
      let respawnCount = 0;

      streaks.current.forEach((streak) => {
        streak.z -= speed.current * dt * 1.5;

        if (currentWarpFactor > 0.2) {
          streak.angle += currentWarpFactor * 0.02 * dt;
        }

        streak.x = Math.cos(streak.angle) * streak.radius;
        streak.y = Math.sin(streak.angle) * streak.radius;

        if (streak.z < -100) {
          streak.z = 4000 + Math.random() * 1000;

          const angleStep = (Math.PI * 2) / config.streakCount;
          const baseAngle =
            (streak.id * angleStep + time.current * 0.001) % (Math.PI * 2);
          const angle = baseAngle + (Math.random() - 0.5) * 0.1;
          streak.angle = angle;
          streak.radius = config.tunnelRadius * (0.4 + Math.random() * 0.6);
          streak.x = Math.cos(angle) * streak.radius;
          streak.y = Math.sin(angle) * streak.radius;

          streak.fadeIn = 100;
          streak.opacity = 1;
          respawnCount++;
        }
      });

      time.current += dt;
    },
    [
      config.maxSpeed,
      config.acceleration,
      config.tunnelRadius,
      config.streakCount,
    ]
  );

  const drawStreaks = useCallback(
    (ctx, canvas, warpFactor) => {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#050510';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const sortedStreaks = [...streaks.current].sort((a, b) => b.z - a.z);

      sortedStreaks.forEach((streak) => {
        if (streak.z <= 0) return;

        const scale = config.fov / Math.max(streak.z, 1);
        const screenX = centerX + streak.x * scale;
        const screenY = centerY + streak.y * scale;

        const margin = 200;
        if (
          screenX < -margin ||
          screenX > canvas.width + margin ||
          screenY < -margin ||
          screenY > canvas.height + margin
        ) {
          return;
        }

        const trailZ = streak.z + streak.trailLength * (1 + warpFactor);
        const trailScale = config.fov / Math.max(trailZ, 1);
        const trailX = centerX + streak.x * trailScale;
        const trailY = centerY + streak.y * trailScale;

        const dx = screenX - trailX;
        const dy = screenY - trailY;
        const trailLength = Math.sqrt(dx * dx + dy * dy);

        if (trailLength < 2) return;

        const distanceBrightness = Math.max(0.3, 1 - streak.z / 3000);
        const finalBrightness =
          streak.brightness * distanceBrightness * (1 + warpFactor * 0.1);

        const size = Math.max(0.05, streak.size * (1 + warpFactor * 0.1));

        const hex = streak.color;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        const opacity = Math.min(1, finalBrightness * streak.opacity);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(trailX, trailY);
        ctx.lineTo(screenX, screenY);

        ctx.lineWidth = size;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.stroke();

        if (opacity > 0.7) {
          ctx.beginPath();
          ctx.moveTo(trailX, trailY);
          ctx.lineTo(screenX, screenY);
          ctx.lineWidth = size * 0.3;
          ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
          ctx.stroke();
        }

        if (opacity > 0.5) {
          ctx.beginPath();
          const headSize = Math.max(0.5, size * 1.5);
          ctx.arc(screenX, screenY, headSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
          ctx.fill();
        }

        ctx.restore();
      });
    },
    [config.fov]
  );

  const render = useCallback(
    (timestamp) => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const deltaTime = timestamp - (lastTimeRef.current || timestamp);
      lastTimeRef.current = timestamp;

      updateStreaks(canvas, deltaTime);
      drawStreaks(ctx, canvas, warpFactor);

      animationFrameId.current = requestAnimationFrame(render);
    },
    [warpFactor, updateStreaks, drawStreaks]
  );

  useEffect(() => {
    const startWarpSequence = () => {
      warpSpeedTarget.current = config.baseSpeed;

      setTimeout(() => {
        warpSpeedTarget.current = config.maxSpeed * 0.4;
      }, 300);

      setTimeout(() => {
        warpSpeedTarget.current = config.maxSpeed * 0.8;
      }, 800);

      setTimeout(() => {
        warpSpeedTarget.current = config.maxSpeed;
      }, 1400);
    };

    startWarpSequence();
  }, [config.baseSpeed, config.maxSpeed]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === ' ') {
        const randomPreset =
          tunnelPresets[Math.floor(Math.random() * tunnelPresets.length)];
        setPreset(randomPreset);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const backgroundColors = [
    'from-black via-blue-950/10 to-black',           // Original
    'from-red-900/20 via-purple-900/30 to-black',    // Red/Purple
    'from-orange-900/20 via-red-900/30 to-black',    // Orange/Red
    'from-yellow-900/20 via-orange-900/30 to-black', // Yellow/Orange
    'from-green-900/20 via-teal-900/30 to-black',    // Green/Teal
    'from-blue-900/20 via-indigo-900/30 to-black',   // Blue/Indigo
    'from-pink-900/20 via-purple-900/30 to-black',   // Pink/Purple
    'from-cyan-900/20 via-blue-900/30 to-black',     // Cyan/Blue
  ];

  const cycleBackgroundColor = () => {
    const currentIndex = backgroundColors.indexOf(backgroundColor);
    const nextIndex = (currentIndex + 1) % backgroundColors.length;
    setBackgroundColor(backgroundColors[nextIndex]);
  };

  const handleClick = () => {
    tunnelActive.current = !tunnelActive.current;
    if (!tunnelActive.current) {
      warpSpeedTarget.current = config.baseSpeed;
    }

    // Cycle background color on click
    cycleBackgroundColor();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStreaks(canvas);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrameId.current);
      } else {
        lastTimeRef.current = 0;
        animationFrameId.current = requestAnimationFrame(render);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    animationFrameId.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cancelAnimationFrame(animationFrameId.current);
    };
  }, [initStreaks, render]);

  return (
    <div
      className="absolute inset-0 w-full h-full overflow-hidden cursor-pointer"
      onClick={handleClick}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${backgroundColor}`} />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{
          filter: `
            contrast(${1 + warpFactor * 0.3})
            brightness(${1 + warpFactor * 0.1})
          `,
        }}
      />

      <div className="absolute bottom-8 left-8 font-mono text-sm">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="relative w-40 h-2 bg-gray-900/60 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${warpFactor * 100}%` }}
              />
            </div>
            <div className="text-cyan-300/80 tracking-widest text-sm">
              {warpFactor < 0.3
                ? 'SUBLIGHT'
                : warpFactor < 0.7
                  ? 'WARP'
                  : 'MAX WARP'}
            </div>
          </div>
          <div className="text-gray-500 text-xs">
            Click or press SPACE to{' '}
            {tunnelActive.current ? 'decelerate' : 'engage warp'}
          </div>
        </div>
      </div>

      {warpFactor > 0.7 && (
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/0.5 to-transparent"
            style={{
              animation: 'speed-lines 0.8s linear infinite',
              opacity: 0.01 + warpFactor * 0.02,
            }}
          />
        </div>
      )}

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.6)_70%,rgba(0,0,0,0.9)_100%)]" />
      </div>

      <style>{`
        @keyframes speed-lines {
          0% {
            transform: translateX(-100%) skewX(-15deg);
          }
          100% {
            transform: translateX(100%) skewX(-15deg);
          }
        }
      `}</style>
    </div>
  );
}
