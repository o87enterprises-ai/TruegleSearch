import { useRef, useEffect, useContext } from 'react';
import { Geometry, Program, Mesh, Camera, Transform } from 'ogl';
import { useWebGLContext } from './WebGLContextManager';
import './Particles.css';

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
  const webglContext = useWebGLContext();

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

  const vertexShader = `
    attribute vec3 position;
    attribute vec3 color;
    attribute float size;
    
    uniform float uTime;
    uniform float uSpeed;
    uniform float uAlpha;
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

  const fragmentShader = `
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

  useEffect(() => {
    if (
      !containerRef.current ||
      !webglContext.renderer ||
      !webglContext.programs
    )
      return;

    const { renderer, programs } = webglContext;

    const camera = new Camera(renderer.gl, {
      fov: 75,
      aspect: window.innerWidth / window.innerHeight,
      near: 0.1,
      far: 1000,
    });
    camera.position.z = cameraDistance;

    const scene = new Transform();

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
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: speed },
        uAlpha: { value: alphaParticles ? 0.6 : 1.0 },
        uProjectionMatrix: { value: camera.projectionMatrix },
        uViewMatrix: { value: camera.viewMatrix },
        uModelMatrix: { value: scene.worldMatrix },
      },
      transparent: alphaParticles,
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

    programs.set('particles', { program, mesh, geometry, scene, camera });

    const animate = (t) => {
      const particles = programs.get('particles');
      if (!particles) return;

      particles.program.uniforms.uTime.value = t * 0.001;

      if (!disableRotation) {
        scene.rotation.y += 0.001;
        scene.rotation.x += 0.0005;
      }

      particles.program.uniforms.uViewMatrix.value = camera.viewMatrix;
      particles.program.uniforms.uModelMatrix.value = scene.worldMatrix;

      renderer.render({ scene, camera });
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);

    return () => {
      if (programs.has('particles')) {
        programs.delete('particles');
      }
    };
  }, [
    particleCount,
    particleSpread,
    speed,
    particleColors,
    alphaParticles,
    particleBaseSize,
    sizeRandomness,
    cameraDistance,
    disableRotation,
    webglContext.renderer,
    webglContext.programs,
    vertexShader,
    fragmentShader,
  ]);

  return <div ref={containerRef} className="particles-container" />;
};

export default Particles;
