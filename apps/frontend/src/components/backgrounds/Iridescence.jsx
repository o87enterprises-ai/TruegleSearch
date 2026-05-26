import { useRef, useEffect, memo } from 'react';
import { Renderer, Geometry, Program, Mesh } from 'ogl';
import './Iridescence.css';

// Shaders defined outside component to prevent recreation on each render
const VERTEX_SHADER = `
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  uniform float uTime;
  uniform vec3 uColor;
  uniform float uSpeed;
  uniform float uAmplitude;
  uniform vec2 uResolution;
  uniform vec2 uMouse;
  uniform bool uMouseReact;

  varying vec2 vUv;

  vec3 hsl2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
  }

  float noise(vec2 p) {
    return sin(p.x * 10.0) * sin(p.y * 10.0);
  }

  void main() {
    vec2 uv = vUv;
    vec2 mouse = uMouseReact ? uMouse : vec2(0.5);

    float wave1 = sin(uv.x * 10.0 + uTime * uSpeed) * uAmplitude;
    float wave2 = cos(uv.y * 8.0 + uTime * uSpeed * 0.7) * uAmplitude;
    float wave3 = sin((uv.x + uv.y) * 6.0 + uTime * uSpeed * 1.3) * uAmplitude;

    float combinedWave = wave1 + wave2 + wave3;

    float mouseInfluence = uMouseReact ?
      1.0 - distance(uv, mouse) * 2.0 : 0.0;
    mouseInfluence = max(0.0, mouseInfluence);

    float hue = combinedWave + mouseInfluence * 0.2;
    vec3 iridescentColor = hsl2rgb(vec3(hue, 0.8, 0.5));

    vec3 finalColor = mix(uColor, iridescentColor, 0.6);
    finalColor *= 0.8 + 0.2 * sin(uTime * uSpeed);

    float alpha = 0.8 + 0.2 * combinedWave;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

const Iridescence = ({
  color = [0.58, 0.2, 0.92],
  speed = 0.5,
  amplitude = 0.1,
  mouseReact = false,
}) => {
  const containerRef = useRef();
  const rendererRef = useRef();
  const animationRef = useRef();
  const isInitializedRef = useRef(false);

  console.log('[Iridescence] Component rendering');

  useEffect(() => {
    // Prevent re-initialization
    if (!containerRef.current) {
      console.log('[Iridescence] No container ref');
      return;
    }
    if (isInitializedRef.current) {
      console.log('[Iridescence] Already initialized, skipping');
      return;
    }
    isInitializedRef.current = true;
    console.log('[Iridescence] Initializing WebGL...');

    const renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
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
    console.log('[Iridescence] Canvas appended, size:', window.innerWidth, 'x', window.innerHeight);

    // Create Geometry with screen-space triangle
    const geometry = new Geometry(renderer.gl, {
      position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
      uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) },
    });

    const program = new Program(renderer.gl, {
      vertex: VERTEX_SHADER,
      fragment: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: color },
        uSpeed: { value: speed },
        uAmplitude: { value: amplitude },
        uResolution: { value: [window.innerWidth, window.innerHeight] },
        uMouse: { value: [0.5, 0.5] },
        uMouseReact: { value: mouseReact },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });

    const mesh = new Mesh(renderer.gl, { geometry, program });

    let mouseX = 0.5,
      mouseY = 0.5;

    const handleMouseMove = (e) => {
      if (!mouseReact) return;
      mouseX = e.clientX / window.innerWidth;
      mouseY = 1.0 - e.clientY / window.innerHeight;
    };

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      program.uniforms.uResolution.value = [
        window.innerWidth,
        window.innerHeight,
      ];
    };

    if (mouseReact) {
      window.addEventListener('mousemove', handleMouseMove);
    }
    window.addEventListener('resize', handleResize);

    const animate = (t) => {
      program.uniforms.uTime.value = t * 0.001;
      program.uniforms.uMouse.value = [mouseX, mouseY];

      renderer.render({ scene: mesh });
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    console.log('[Iridescence] Animation started');

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (mouseReact) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
      window.removeEventListener('resize', handleResize);

      // Proper WebGL context cleanup
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

  return <div ref={containerRef} className="iridescence-container" />;
};

export default memo(Iridescence);
