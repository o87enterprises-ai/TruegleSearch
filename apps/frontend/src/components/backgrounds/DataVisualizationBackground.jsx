import { useEffect, useRef, useState } from 'react';

export default function DataVisualizationBackground() {
  const canvasRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false }); // Disable alpha for better performance
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Matrix character set
    const chars =
      'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッンABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-*/=%"\'#&_(),.;:?!\\|{}<>[]^~';

    // Brand words for Easter eggs
    const brandWords = [
      'TRUEGLE',
      'UNBIASED',
      'TRANSPARENT',
      'SECURE',
      'TRUTH',
      'SEARCH',
      'FREE',
      'DECENTRALIZED',
      'OPEN',
      'PRIVATE',
    ];

    // Brand color palette
    const matrixColors = [
      '#00E5FF', // Bright Cyan
      '#8B5CF6', // Purple
      '#D946EF', // Magenta
      '#EC4899', // Pink
      '#0AFF6F', // Brighter Green
      '#FFAA00', // Amber
      '#FFFFFF', // White
    ];

    // Matrix rain columns
    const columns = Math.floor(canvas.width / 20);
    const drops = Array.from({ length: columns }, () => ({
      y: Math.random() * -canvas.height,
      speed: Math.random() * 2.0 + 1.0, // 150% faster
      length: Math.floor(Math.random() * 20) + 10,
      chars: [],
      nextCharChange: 0,
      color: matrixColors[Math.floor(Math.random() * matrixColors.length)],
      brightness: Math.random() * 0.7 + 0.3,
      isHighlighted: Math.random() > 0.95,
      pulse: Math.random() * Math.PI * 2,
    }));

    // Initialize column characters
    drops.forEach((drop) => {
      drop.chars = Array.from(
        { length: drop.length },
        () => chars[Math.floor(Math.random() * chars.length)]
      );
    });

    // Particles
    const particles = Array.from({ length: 200 }, () => {
      // Reduced from 300
      const z = Math.random() * 3 + 1;
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        z: z,
        size: Math.random() * 2 * z + 0.5,
        speedX: ((Math.random() - 0.5) * 0.75) / z,
        speedY: ((Math.random() - 0.5) * 0.75) / z,
        opacity: Math.random() * 0.7 + 0.3,
        color: matrixColors[Math.floor(Math.random() * matrixColors.length)],
        pulse: Math.random() * Math.PI * 2,
      };
    });

    // Data streams
    const streams = Array.from({ length: 30 }, () => {
      // Reduced from 50
      const streamLength = Math.random() * 150 + 50;
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * -streamLength,
        length: streamLength,
        speed: Math.random() * 10 + 5,
        width: Math.random() * 3 + 1,
        opacity: Math.random() * 0.4 + 0.1,
        color: matrixColors[Math.floor(Math.random() * matrixColors.length)],
        ripple: 0,
        rippleSpeed: Math.random() * 0.05 + 0.02,
      };
    });

    // Shockwaves
    const shockwaves = [];

    setInterval(() => {
      if (shockwaves.length < 2 && Math.random() > 0.8) {
        shockwaves.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          radius: 0,
          maxRadius: Math.random() * 200 + 100,
          speed: Math.random() * 20 + 10,
          color: matrixColors[Math.floor(Math.random() * matrixColors.length)],
          thickness: Math.random() * 3 + 1,
          opacity: 0.8,
        });
      }
    }, 4000);

    // Mouse interaction
    let mouseX = canvas.width / 2;
    let mouseY = canvas.height / 2;

    const handleMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    // Optimized Matrix rain
    function drawMatrixRain() {
      ctx.font = '16px monospace'; // Slightly smaller for better performance
      ctx.textAlign = 'center';

      drops.forEach((drop, i) => {
        const x = i * 20;
        const pulseEffect = Math.sin(drop.pulse) * 0.2 + 0.8;
        drop.pulse += 0.03;

        // Update characters less frequently for smoothness
        if (Math.random() > 0.97) {
          drop.chars[0] = chars[Math.floor(Math.random() * chars.length)];

          if (Math.random() > 0.998) {
            const word =
              brandWords[Math.floor(Math.random() * brandWords.length)];
            for (let j = 0; j < Math.min(word.length, drop.chars.length); j++) {
              drop.chars[j] = word[j];
            }
          }
        }

        // Draw only visible characters
        for (let j = 0; j < drop.length; j++) {
          const y = drop.y - j * 20;

          if (y < -20 || y > canvas.height + 20) continue;

          const opacity = j === 0 ? 1 : (1 - j / drop.length) * drop.brightness;

          const charColor =
            j === 0 && drop.isHighlighted ? '#FFFFFF' : drop.color;

          if (j === 0) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = charColor;
          } else {
            ctx.shadowBlur = 0;
          }

          const currentBrightness =
            j === 0 ? drop.brightness * pulseEffect : drop.brightness;

          ctx.fillStyle =
            charColor +
            Math.floor(opacity * currentBrightness * 255)
              .toString(16)
              .padStart(2, '0');
          ctx.fillText(drop.chars[j], x, y);
        }

        ctx.shadowBlur = 0;

        // Smooth movement with fractional positioning
        drop.y += drop.speed;

        // Reset when off screen
        if (drop.y > canvas.height + drop.length * 20) {
          drop.y = -drop.length * 20;
          drop.speed = Math.random() * 2.0 + 1.0;
          drop.color =
            matrixColors[Math.floor(Math.random() * matrixColors.length)];
          drop.isHighlighted = Math.random() > 0.95;
        }
      });
    }

    // Optimized particles
    function drawParticles() {
      particles.forEach((particle) => {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle =
          particle.color +
          Math.floor(particle.opacity * 255)
            .toString(16)
            .padStart(2, '0');

        ctx.shadowBlur = 10;
        ctx.shadowColor = particle.color;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Mouse influence (reduced)
        const dx = mouseX - particle.x;
        const dy = mouseY - particle.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const force = 30 / (distance + 30);

        particle.x += particle.speedX + dx * force * 0.01;
        particle.y += particle.speedY + dy * force * 0.01;

        // Wrap edges
        if (particle.x < -10) particle.x = canvas.width + 10;
        if (particle.x > canvas.width + 10) particle.x = -10;
        if (particle.y < -10) particle.y = canvas.height + 10;
        if (particle.y > canvas.height + 10) particle.y = -10;

        // Pulse
        particle.pulse += particle.pulseSpeed;
        particle.opacity = 0.5 + Math.sin(particle.pulse) * 0.2;
      });
    }

    // Optimized connections (only draw some)
    function drawConnections() {
      const connectionLimit = 100; // Limit total connections
      let connectionsDrawn = 0;

      for (
        let i = 0;
        i < particles.length && connectionsDrawn < connectionLimit;
        i++
      ) {
        const p1 = particles[i];

        for (
          let j = i + 1;
          j < particles.length && connectionsDrawn < connectionLimit;
          j++
        ) {
          const p2 = particles[j];

          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 120) {
            // Reduced distance
            const opacity = (1 - distance / 120) * 0.2;

            ctx.strokeStyle =
              p1.color +
              Math.floor(opacity * 255)
                .toString(16)
                .padStart(2, '0');
            ctx.lineWidth = 0.5;

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            connectionsDrawn++;
          }
        }
      }
    }

    // Optimized streams
    function drawDataStreams() {
      streams.forEach((stream) => {
        const gradient = ctx.createLinearGradient(
          stream.x,
          stream.y,
          stream.x,
          stream.y + stream.length
        );
        gradient.addColorStop(0, stream.color + '00');
        gradient.addColorStop(
          0.5,
          stream.color +
            Math.floor(stream.opacity * 255)
              .toString(16)
              .padStart(2, '0')
        );
        gradient.addColorStop(1, stream.color + '00');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = stream.width;

        ctx.beginPath();
        ctx.moveTo(stream.x, stream.y);
        ctx.lineTo(stream.x, stream.y + stream.length);
        ctx.stroke();

        stream.y += stream.speed;

        if (stream.y > canvas.height + stream.length) {
          stream.y = -stream.length;
          stream.x = Math.random() * canvas.width;
          stream.color =
            matrixColors[Math.floor(Math.random() * matrixColors.length)];
        }
      });
    }

    // Simplified shockwaves
    function drawShockwaves() {
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const wave = shockwaves[i];

        ctx.beginPath();
        ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
        ctx.strokeStyle =
          wave.color +
          Math.floor(wave.opacity * 255)
            .toString(16)
            .padStart(2, '0');
        ctx.lineWidth = wave.thickness;
        ctx.stroke();

        wave.radius += wave.speed;
        wave.opacity -= 0.02;

        if (wave.opacity <= 0 || wave.radius > wave.maxRadius) {
          shockwaves.splice(i, 1);
        }
      }
    }

    // Simplified scan lines
    function drawScanLines() {
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.015)';
      ctx.lineWidth = 1;

      for (let y = 0; y < canvas.height; y += 6) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }

    // Optimized animation loop with requestAnimationFrame
    let lastTime = performance.now();
    let animationFrame;

    function animate(currentTime) {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      // Target 60 FPS - skip frame if running slow
      if (deltaTime > 32) {
        // More than ~30 FPS
        animationFrame = requestAnimationFrame(animate);
        return;
      }

      // Clear with solid black (faster than gradient every frame)
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw in order
      drawScanLines();
      drawDataStreams();
      drawParticles();
      drawConnections();
      drawMatrixRain();
      drawShockwaves();

      animationFrame = requestAnimationFrame(animate);
    }

    setTimeout(() => {
      animate(performance.now());
      setIsReady(true);
    }, 100);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="fixed top-0 left-0 w-full h-full"
        style={{
          background: '#000000',
          opacity: isReady ? 1 : 0,
          transition: 'opacity 1s ease-in-out',
        }}
      />

      <div
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, transparent 30%, rgba(0, 5, 15, 0.3) 100%)',
        }}
      />
    </div>
  );
}
