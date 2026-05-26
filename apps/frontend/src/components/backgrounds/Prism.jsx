import React, { useRef, useEffect } from 'react';

const Prism = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const draw = () => {
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw gradient background
      const gradient = ctx.createLinearGradient(
        0,
        0,
        canvas.width,
        canvas.height
      );
      gradient.addColorStop(0, '#0a0a0a');
      gradient.addColorStop(1, '#1a1a2e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw prism shapes
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const size = Math.min(canvas.width, canvas.height) * 0.3;

      // Draw triangle (prism face)
      ctx.fillStyle = 'rgba(100, 100, 255, 0.1)';
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - size);
      ctx.lineTo(centerX + size * 0.866, centerY + size * 0.5);
      ctx.lineTo(centerX - size * 0.866, centerY + size * 0.5);
      ctx.closePath();
      ctx.fill();

      // Draw light reflections
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        const angle = (i * Math.PI) / 3;
        ctx.lineTo(
          centerX + Math.cos(angle) * size * 1.5,
          centerY + Math.sin(angle) * size * 1.5
        );
        ctx.stroke();
      }
    };

    draw();
    window.addEventListener('resize', draw);

    return () => window.removeEventListener('resize', draw);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
      }}
    />
  );
};

export default Prism;
