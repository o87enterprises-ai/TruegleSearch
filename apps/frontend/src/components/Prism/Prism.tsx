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
uniform float uRotation;
uniform vec3 uLightColor;
uniform float uRefractiveIndex;

varying vec2 vUv;

// Ray marching constants
const MAX_STEPS = 80;
const MAX_DIST = 2.0;
const HIT_EPSILON = 0.001;

// Rotation matrix for prism
mat2 rotate2D(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

// SDF for triangular prism
float prismSDF(vec2 p, float size) {
  // Equilateral triangle centered at origin
  p = abs(p);
  vec2 a = normalize(vec2(1.0, 1.732)); // 60-degree angle
  float d1 = dot(p, a) - size;
  float d2 = p.x - size * 0.5;
  return max(d1, d2);
}

// Refraction calculation
vec3 refractPrism(vec3 viewDir, vec3 normal, float n1, float n2) {
  float ratio = n1 / n2;
  float cosTheta1 = -dot(viewDir, normal);
  float sinTheta1Sq = 1.0 - cosTheta1 * cosTheta1;
  float sinTheta2Sq = ratio * ratio * sinTheta1Sq;
  
  // Total internal reflection check
  if (sinTheta2Sq > 1.0) {
    // Total internal reflection
    return reflect(viewDir, normal);
  }
  
  float cosTheta2 = sqrt(1.0 - sinTheta2Sq);
  return ratio * viewDir + (ratio * cosTheta1 - cosTheta2) * normal;
}

// Calculate surface normal
vec2 getNormal(vec2 p, float size) {
  vec2 eps = vec2(0.001, 0.0);
  float d = prismSDF(p, size);
  vec2 n = vec2(
    d - prismSDF(p - eps.xy, size),
    d - prismSDF(p - eps.yx, size)
  );
  return normalize(n);
}

// Ray marching for prism
float rayMarch(vec2 ro, vec2 rd, float size, out vec2 hitPos, out vec2 hitNormal) {
  float t = 0.0;
  
  for(int i = 0; i < MAX_STEPS; i++) {
    vec2 pos = ro + rd * t;
    float d = prismSDF(pos, size);
    
    if(d < HIT_EPSILON) {
      hitPos = pos;
      hitNormal = getNormal(pos, size);
      return t;
    }
    
    if(t > MAX_DIST) break;
    t += d;
  }
  
  return -1.0;
}

// Caustic pattern generation
float causticPattern(vec2 p, float time) {
  vec2 rotated = rotate2D(time * 0.5) * p;
  
  float caustic = 0.0;
  float lines = 6.0;
  
  for(float i = 0.0; i < lines; i++) {
    float angle = (i / lines) * 3.14159 * 2.0;
    vec2 lineDir = vec2(cos(angle), sin(angle));
    float lineDist = abs(dot(rotated, lineDir));
    
    float intensity = exp(-lineDist * 20.0) * sin(lineDist * 100.0 - time * 2.0);
    caustic += max(0.0, intensity);
  }
  
  return caustic;
}

void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  p.x *= uResolution.x / uResolution.y;
  
  // Apply rotation
  p = rotate2D(uRotation) * p;
  
  vec3 col = vec3(0.0);
  float prismSize = 0.3;
  
  // Camera setup
  vec2 ro = vec2(0.0, -1.0); // Ray origin
  vec2 rd = normalize(p - ro); // Ray direction
  
  // Ray march to find prism intersection
  vec2 hitPos, hitNormal;
  float t = rayMarch(ro, rd, prismSize, hitPos, hitNormal);
  
  if(t > 0.0) {
    // Calculate refraction
    vec3 viewDir3D = normalize(vec3(rd, 0.0));
    vec3 normal3D = normalize(vec3(hitNormal, 0.0));
    
    // Air to prism refraction
    vec3 refracted1 = refractPrism(viewDir3D, normal3D, 1.0, uRefractiveIndex);
    
    // Calculate dispersion (chromatic aberration)
    vec3 dispersion = vec3(0.98, 1.0, 1.02); // Different indices for RGB
    vec3 refractedR = refractPrism(viewDir3D, normal3D, 1.0, uRefractiveIndex * dispersion.r);
    vec3 refractedG = refractPrism(viewDir3D, normal3D, 1.0, uRefractiveIndex * dispersion.g);
    vec3 refractedB = refractPrism(viewDir3D, normal3D, 1.0, uRefractiveIndex * dispersion.b);
    
    // Surface color with fresnel effect
    float fresnel = pow(1.0 + dot(viewDir3D, normal3D), 2.0);
    vec3 surfaceColor = mix(uColor, uLightColor, fresnel * 0.5);
    
    // Add caustic pattern
    float caustic = causticPattern(hitPos, uTime);
    surfaceColor += uLightColor * caustic * 0.3;
    
    // Combine refracted colors with dispersion
    col.r = surfaceColor.r * (1.0 + length(refractedR.xy) * 0.1);
    col.g = surfaceColor.g * (1.0 + length(refractedG.xy) * 0.1);
    col.b = surfaceColor.b * (1.0 + length(refractedB.xy) * 0.1);
    
    // Edge glow
    float edge = 1.0 - smoothstep(0.0, 0.05, prismSDF(hitPos, prismSize));
    col += uLightColor * edge * 0.5;
    
  } else {
    // Background with subtle light effects
    float bgGradient = 1.0 - length(p) * 0.3;
    col = uColor * bgGradient * 0.1;
    
    // Add ambient light rays
    float lightRays = causticPattern(p * 0.5, uTime * 0.3);
    col += uLightColor * lightRays * 0.05;
  }
  
  // Apply intensity and vignette
  col *= uIntensity;
  float vignette = 1.0 - smoothstep(0.8, 1.5, length(vUv - 0.5));
  col *= vignette;
  
  gl_FragColor = vec4(col, 1.0);
}
`;

interface PrismProps {
  className?: string;
  color?: string;
  lightColor?: string;
  intensity?: number;
  rotation?: number;
  refractiveIndex?: number;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

const Prism: React.FC<PrismProps> = memo(
  ({
    className = '',
    color = '#FF79C6',
    lightColor = '#00FFFF',
    intensity = 1.0,
    rotation = 0.0,
    refractiveIndex = 1.5,
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
          antialias: true,
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
            uLightColor: { value: hexToRgb(lightColor) },
            uIntensity: { value: intensity },
            uRotation: { value: rotation },
            uRefractiveIndex: { value: refractiveIndex },
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
    }, [
      color,
      lightColor,
      intensity,
      rotation,
      refractiveIndex,
      hexToRgb,
      onReady,
      onError,
    ]);

    // Initialize on mount
    useEffect(() => {
      let cleanup: (() => void) | undefined;

      initWebGL()
        .then((cleanupFn) => {
          cleanup = cleanupFn;
        })
        .catch((error) => {
          console.error('Prism initialization failed:', error);
        });

      return () => {
        if (cleanup) {
          cleanup();
        }
      };
    }, [initWebGL]);

    // Update uniforms on prop changes
    useEffect(() => {
      if (status === 'ready' && rendererRef.current) {
        const renderer = rendererRef.current;
        const program = renderer.scene?.program || renderer.gl.program;

        if (program && program.uniforms) {
          if (program.uniforms.uColor) {
            program.uniforms.uColor.value = hexToRgb(color);
          }
          if (program.uniforms.uLightColor) {
            program.uniforms.uLightColor.value = hexToRgb(lightColor);
          }
          if (program.uniforms.uIntensity) {
            program.uniforms.uIntensity.value = intensity;
          }
          if (program.uniforms.uRotation) {
            program.uniforms.uRotation.value = rotation;
          }
          if (program.uniforms.uRefractiveIndex) {
            program.uniforms.uRefractiveIndex.value = refractiveIndex;
          }
        }
      }
    }, [
      color,
      lightColor,
      intensity,
      rotation,
      refractiveIndex,
      hexToRgb,
      status,
    ]);

    if (status === 'error') {
      return (
        <div
          className={`flex items-center justify-center bg-gray-900 ${className}`}
          role="img"
          aria-label="Prism refraction animation error"
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
        aria-label="Prism refraction animation"
      />
    );
  }
);

Prism.displayName = 'Prism';

export default Prism;
