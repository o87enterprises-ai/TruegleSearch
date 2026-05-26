import { useRef, useEffect, useContext } from 'react';
import { Geometry, Program, Mesh } from 'ogl';
import { useWebGLContext } from './WebGLContextManager';
import './Iridescence.css';

const Iridescence = ({
  color = [0.58, 0.2, 0.92],
  speed = 0.5,
  amplitude = 0.1,
  mouseReact = false,
}) => {
  const containerRef = useRef();

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

  const webglContext = useWebGLContext();

  useEffect(() => {
    if (
      !containerRef.current ||
      !webglContext.renderer ||
      !webglContext.programs
    )
      return;

    const { renderer, programs } = webglContext;

    // Create geometry
    const geometry = new Geometry(renderer.gl, {
      position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
      uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) },
    });

    // Create program
    const program = new Program(renderer.gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
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

    // Create mesh
    const mesh = new Mesh(renderer.gl, { geometry, program });

    // Store in context
    programs.set('iridescence', { program, mesh, geometry });

    let mouseX = 0.5,
      mouseY = 0.5;

    const handleMouseMove = (e) => {
      if (!mouseReact) return;
      mouseX = e.clientX / window.innerWidth;
      mouseY = 1.0 - e.clientY / window.innerHeight;
    };

    const handleResize = () => {
      // Resolution is handled by context manager
    };

    if (mouseReact) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    const animate = (t) => {
      const iridescence = programs.get('iridescence');
      if (!iridescence) return;

      iridescence.program.uniforms.uTime.value = t * 0.001;
      iridescence.program.uniforms.uMouse.value = [mouseX, mouseY];

      renderer.render({ scene: iridescence.mesh });
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);

    return () => {
      if (mouseReact) {
        window.removeEventListener('mousemove', handleMouseMove);
      }

      // Cleanup handled by context manager
      if (programs.has('iridescence')) {
        programs.delete('iridescence');
      }
    };
  }, [
    color,
    speed,
    amplitude,
    mouseReact,
    webglContext.renderer,
    webglContext.programs,
    vertexShader,
    fragmentShader,
  ]);

  return <div ref={containerRef} className="iridescence-container" />;
};

export default Iridescence;
