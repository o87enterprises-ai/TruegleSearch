import { useEffect, useRef } from 'react';
import { Renderer, Geometry, Program, Mesh } from 'ogl';

const TestWebGL = () => {
  const containerRef = useRef();
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    console.log('TestWebGL: Initializing...');
    
    const renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
    });
    
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    
    // Simple geometry (fullscreen triangle)
    const geometry = new Geometry(gl, {
      position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
      uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) },
    });

    // Simple shader
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
      varying vec2 vUv;
      
      void main() {
        vec2 uv = vUv;
        float r = sin(uTime + uv.x * 2.0) * 0.5 + 0.5;
        float g = cos(uTime + uv.y * 2.0) * 0.5 + 0.5;
        float b = sin(uTime * 0.5 + uv.x + uv.y) * 0.5 + 0.5;
        
        gl_FragColor = vec4(r, g, b, 0.5);
      }
    `;

    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
      },
      transparent: true,
    });

    const mesh = new Mesh(gl, { geometry, program });
    containerRef.current.appendChild(gl.canvas);

    // Animation loop
    let animationFrameId;
    const animate = (t) => {
      program.uniforms.uTime.value = t * 0.001;
      renderer.render({ scene: mesh });
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    // Handle resize
    const handleResize = () => {
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      console.log('TestWebGL: Cleaning up...');
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (containerRef.current && containerRef.current.contains(gl.canvas)) {
        containerRef.current.removeChild(gl.canvas);
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        zIndex: -1,
        pointerEvents: 'none'
      }} 
    />
  );
};

export default TestWebGL;
