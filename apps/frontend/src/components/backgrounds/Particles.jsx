import { useRef, useEffect, memo } from 'react';
import { Renderer, Geometry, Program, Mesh, Camera, Transform } from 'ogl';
import './Particles.css';

// Shaders defined outside component to prevent recreation on each render
const VERTEX_SHADER = `
  attribute vec3 position;
  attribute vec3 color;
  attribute float size;

  uniform float uTime;
  uniform float uSpeed;
  uniform mat4 uProjectionMatrix;
  uniform mat4 uViewMatrix;
  uniform mat4 uModelMatrix;

  varying vec3 vColor;
  varying float vSize;

  void main() {
    vColor = color;
    vSize = size;

    vec3 pos = position;

    float time = uTime * uSpeed * 0.001;
    pos.x += sin(time + position.y) * 0.1;
    pos.y += cos(time + position.x) * 0.1;
    pos.z += sin(time * 0.7 + position.z) * 0.05;

    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(pos, 1.0);
    gl_PointSize = size * (1.0 + sin(time * 2.0 + length(position)) * 0.2);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  uniform float uAlpha;
  varying vec3 vColor;
  varying float vSize;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);

    if (dist > 0.5) {
      discard;
    }

    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
    alpha = pow(alpha, 2.0);

    gl_FragColor = vec4(vColor, alpha * uAlpha);
  }
`;

// Helper function outside component
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16) / 255,
        parseInt(result[2], 16) / 255,
        parseInt(result[3], 16) / 255,
      ]
    : [1, 1, 1];
};

const Particles = ({
  particleCount = 150,
  particleSpread = 10,
  speed = 0.5,
  particleColors = ['#9333EA', '#00E5FF', '#F97316', '#10B981'],
  alphaParticles = true,
  particleBaseSize = 80,
  sizeRandomness = 0.5,
  cameraDistance = 5,
  disableRotation = false,
}) => {
  const containerRef = useRef();
  const rendererRef = useRef();
  const sceneRef = useRef();
  const animationRef = useRef();
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // Prevent re-initialization
    if (!containerRef.current || isInitializedRef.current) return;
    isInitializedRef.current = true;

    const renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
      preserveDrawingBuffer: true,
    });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.gl.clearColor(0, 0, 0, 0);
    renderer.gl.enable(renderer.gl.BLEND);
    renderer.gl.blendFunc(
      renderer.gl.SRC_ALPHA,
      renderer.gl.ONE_MINUS_SRC_ALPHA
    );

    containerRef.current.appendChild(renderer.gl.canvas);
    rendererRef.current = renderer;

    const camera = new Camera(renderer.gl, {
      fov: 75,
      aspect: window.innerWidth / window.innerHeight,
      near: 0.1,
      far: 1000,
    });
    camera.position.z = cameraDistance;

    const scene = new Transform();
    sceneRef.current = scene;

    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * particleSpread;
      positions[i3 + 1] = (Math.random() - 0.5) * particleSpread;
      positions[i3 + 2] = (Math.random() - 0.5) * particleSpread;

      const color = hexToRgb(particleColors[i % particleColors.length]);
      colors[i3] = color[0];
      colors[i3 + 1] = color[1];
      colors[i3 + 2] = color[2];

      sizes[i] =
        particleBaseSize * (1 + (Math.random() - 0.5) * sizeRandomness);
    }

    const geometry = new Geometry(renderer.gl, {
      position: { size: 3, data: positions },
      color: { size: 3, data: colors },
      size: { size: 1, data: sizes },
    });

    const program = new Program(renderer.gl, {
      vertex: VERTEX_SHADER,
      fragment: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: speed },
        uAlpha: { value: alphaParticles ? 0.6 : 1.0 },
        uProjectionMatrix: { value: camera.projectionMatrix },
        uViewMatrix: { value: camera.viewMatrix },
        uModelMatrix: { value: scene.worldMatrix },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blend: true,
      blendFunc: {
        src: renderer.gl.SRC_ALPHA,
        dst: renderer.gl.ONE_MINUS_SRC_ALPHA,
      },
    });

    const mesh = new Mesh(renderer.gl, { geometry, program });
    mesh.setParent(scene);
    mesh.drawMode = renderer.gl.POINTS;

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };

    window.addEventListener('resize', handleResize);

    const animate = (t) => {
      program.uniforms.uTime.value = t * 0.001;

      if (!disableRotation) {
        scene.rotation.y += 0.001;
        scene.rotation.x += 0.0005;
      }

      program.uniforms.uViewMatrix.value = camera.viewMatrix;
      program.uniforms.uModelMatrix.value = scene.worldMatrix;

      renderer.render({ scene, camera });
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', handleResize);

      if (renderer.gl && renderer.gl.canvas) {
        renderer.gl.canvas.remove();
        const loseContext = renderer.gl.getExtension('WEBGL_lose_context');
        if (loseContext) {
          try {
            loseContext.loseContext();
          } catch (e) {
            // Silently handle context loss
          }
        }
      }
    };
  }, []); // Empty deps - only run once on mount

  return <div ref={containerRef} className="particles-container" />;
};

export default memo(Particles);
