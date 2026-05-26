import React, { memo, useRef, useEffect, useState, useCallback } from 'react';
import { Renderer, Program, Mesh, Triangle } from 'ogl';

const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uSpeed;

varying vec2 vUv;

// Noise function for laser flow
float noise(vec2 p) {
  return sin(p.x * 10.0 + uTime) * sin(p.y * 10.0 - uTime * 0.8);
}

// Laser beam generation
float laser(vec2 p, vec2 pos, float width) {
  float dist = distance(p, pos);
  return 1.0 - smoothstep(0.0, width, dist);
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  p.x *= uResolution.x / uResolution.y;
  
  // Animated laser beams
  float beams = 0.0;
  
  // Primary beam
  vec2 beam1Pos = vec2(sin(uTime * uSpeed) * 0.5, cos(uTime * uSpeed * 0.7) * 0.5);
  beams += laser(p, beam1Pos, 0.02);
  
  // Secondary beams
  vec2 beam2Pos = vec2(cos(uTime * uSpeed * 1.3) * 0.6, sin(uTime * uSpeed * 0.9) * 0.6);
  beams += laser(p, beam2Pos, 0.015) * 0.7;
  
  vec2 beam3Pos = vec2(sin(uTime * uSpeed * 0.6) * 0.4, cos(uTime * uSpeed * 1.1) * 0.4);
  beams += laser(p, beam3Pos, 0.025) * 0.5;
  
  // Flow field distortion
  vec2 flow = vec2(noise(p + uTime * uSpeed), noise(p - uTime * uSpeed * 0.5)) * 0.1;
  p += flow;
  
  // Color mixing with noise
  float intensity = beams * uIntensity;
  vec3 color = uColor * intensity;
  
  // Add glow effect
  float glow = beams * 2.0;
  color += uColor * glow * 0.3;
  
  // Fade edges
  float vignette = 1.0 - length(vUv - 0.5) * 1.2;
  color *= vignette;
  
  gl_FragColor = vec4(color, intensity);
}
`;

interface LaserFlowProps {
  className?: string;
  color?: string;
  intensity?: number;
  speed?: number;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

const LaserFlow: React.FC<LaserFlowProps> = memo(
  ({
    className = '',
    color = '#FF79C6',
    intensity = 1.0,
    speed = 0.5,
    onReady,
    onError,
  }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<Renderer | null>(null);
    const animationRef = useRef<number>(0);
    const [status, setStatus] = useState<
      'idle' | 'loading' | 'ready' | 'error'
    >('idle');
    const [error, setError] = useState<string>('');

    const hexToRgb = useCallback((hex: string): [number, number, number] => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? [
            parseInt(result[1], 16) / 255,
            parseInt(result[2], 16) / 255,
            parseInt(result[3], 16) / 255,
          ]
        : [1, 0.5, 0.8];
    }, []);

    const initWebGL = useCallback(async () => {
      const container = containerRef.current;
      if (!container) {
        throw new Error('Container element not found');
      }

      try {
        setStatus('loading');
        setError('');

        // Create renderer
        const renderer = new Renderer({
          depth: false,
          antialias: false,
          alpha: true,
          premultipliedAlpha: false,
        });

        rendererRef.current = renderer;
        container.appendChild(renderer.gl.canvas);

        // Handle resize
        const handleResize = () => {
          const width = container.clientWidth;
          const height = container.clientHeight;
          renderer.setSize(width, height);
        };

        handleResize();
        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(container);

        // Create geometry
        const geometry = new Triangle();

        // Create program with shaders
        const program = new Program(renderer.gl, {
          vertex: vertexShader,
          fragment: fragmentShader,
          uniforms: {
            uTime: { value: 0 },
            uResolution: {
              value: [container.clientWidth, container.clientHeight],
            },
            uColor: { value: hexToRgb(color) },
            uIntensity: { value: intensity },
            uSpeed: { value: speed },
          },
          transparent: true,
          cullFace: null,
        });

        // Create mesh
        const mesh = new Mesh(renderer.gl, { geometry, program });

        // Animation loop
        let frame = 0;
        const animate = () => {
          frame++;
          program.uniforms.uTime.value = frame * 0.01;

          renderer.render({ scene: mesh });
          animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        // Update status
        setStatus('ready');
        onReady?.();

        // Return cleanup function
        return () => {
          resizeObserver.disconnect();
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
          }
          if (container.contains(renderer.gl.canvas)) {
            container.removeChild(renderer.gl.canvas);
          }
          renderer.gl.getExtension('WEBGL_lose_context')?.loseContext();
        };
      } catch (error) {
        const err =
          error instanceof Error
            ? error
            : new Error('WebGL initialization failed');
        setError(err.message);
        setStatus('error');
        onError?.(err);
        throw err;
      }
    }, [color, intensity, speed, hexToRgb, onReady, onError]);

    // Initialize on mount
    useEffect(() => {
      let cleanup: (() => void) | undefined;

      initWebGL()
        .then((cleanupFn) => {
          cleanup = cleanupFn;
        })
        .catch((error) => {
          console.error('LaserFlow initialization failed:', error);
        });

      return () => {
        if (cleanup) {
          cleanup();
        }
      };
    }, [initWebGL]);

    // Note: Uniform updates on prop changes would require storing program as a ref
    // For now, the initial values are used and updates require remounting

    if (status === 'error') {
      return (
        <div
          className={`flex items-center justify-center bg-gray-900 ${className}`}
          role="img"
          aria-label="Laser flow animation error"
        >
          <div className="text-center p-4">
            <span className="text-red-500 text-xl">⚠️</span>
            <p className="text-white text-sm mt-2">Animation failed: {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className={`absolute inset-0 w-full h-full ${className}`}
        style={{
          opacity: status === 'loading' ? 0.5 : 1,
          transition: 'opacity 0.3s ease',
        }}
        role="img"
        aria-label="Laser flow background animation"
      />
    );
  }
);

LaserFlow.displayName = 'LaserFlow';

export default LaserFlow;
