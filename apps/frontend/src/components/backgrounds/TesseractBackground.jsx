import { useEffect, useRef } from 'react';

export default function TesseractBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 4D Tesseract vertices
    const vertices4D = [];
    for (let x = -1; x <= 1; x += 2) {
      for (let y = -1; y <= 1; y += 2) {
        for (let z = -1; z <= 1; z += 2) {
          for (let w = -1; w <= 1; w += 2) {
            vertices4D.push([x, y, z, w]);
          }
        }
      }
    }

    // Calculate edges (connect vertices that differ by exactly 1 coordinate)
    const edges = [];
    for (let i = 0; i < 16; i++) {
      for (let j = i + 1; j < 16; j++) {
        let diff = 0;
        for (let k = 0; k < 4; k++) {
          if (vertices4D[i][k] !== vertices4D[j][k]) diff++;
        }
        if (diff === 1) edges.push([i, j]);
      }
    }

    // Color palette (red/orange theme for biased page)
    const colors = [
      '#ef4444',
      '#f97316',
      '#eab308',
      '#22c55e',
      '#06b6d4',
      '#3b82f6',
      '#8b5cf6',
      '#ec4899',
    ];

    let time = 0;

    const project4Dto3D = (vertex, angle) => {
      const [x, y, z, w] = vertex;

      // 4D rotation
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const x1 = x * cosA - w * sinA;
      const w1 = x * sinA + w * cosA;

      const y1 = y * cosA - w1 * sinA;
      const w2 = y * sinA + w1 * cosA;

      // Perspective projection
      const distance = 3 + Math.sin(time * 0.2) * 0.5;
      const scale = 200 / (distance - w2);

      return {
        x: x1 * scale,
        y: y1 * scale,
        z: z * scale,
        depth: 1 - (w2 + 1) / 2,
      };
    };

    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      time += 0.01;

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Project all vertices
      const projected = vertices4D.map((v) => project4Dto3D(v, time));

      // Draw edges with color based on depth
      ctx.lineWidth = 2;
      edges.forEach(([start, end], i) => {
        const p1 = projected[start];
        const p2 = projected[end];

        const avgDepth = (p1.depth + p2.depth) / 2;
        const opacity = 0.3 + avgDepth * 0.7;
        const colorIdx = Math.floor((i / edges.length) * colors.length);

        ctx.strokeStyle =
          colors[colorIdx] +
          Math.floor(opacity * 255)
            .toString(16)
            .padStart(2, '0');
        ctx.beginPath();
        ctx.moveTo(centerX + p1.x, centerY + p1.y);
        ctx.lineTo(centerX + p2.x, centerY + p2.y);
        ctx.stroke();
      });

      // Draw vertices
      projected.forEach((p, i) => {
        const size = 3 + p.depth * 5;
        const opacity = 0.5 + p.depth * 0.5;
        const colorIdx = i % colors.length;

        ctx.fillStyle =
          colors[colorIdx] +
          Math.floor(opacity * 255)
            .toString(16)
            .padStart(2, '0');
        ctx.beginPath();
        ctx.arc(centerX + p.x, centerY + p.y, size, 0, Math.PI * 2);
        ctx.fill();

        // Glow effect
        const gradient = ctx.createRadialGradient(
          centerX + p.x,
          centerY + p.y,
          0,
          centerX + p.x,
          centerY + p.y,
          size * 3
        );
        gradient.addColorStop(0, colors[colorIdx] + '40');
        gradient.addColorStop(1, colors[colorIdx] + '00');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX + p.x, centerY + p.y, size * 3, 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ background: '#000000' }}
    />
  );
}
