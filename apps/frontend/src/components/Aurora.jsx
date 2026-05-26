import { Renderer, Program, Mesh, Color, Triangle } from 'ogl';
import { useEffect, useRef } from 'react';

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
  const vec4 C = vec4(
      0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
      0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
      ), 
      0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

#define COLOR_RAMP(colors, factor, finalColor) {              \
  int index = 0;                                            \
  for (int i = 0; i < 2; i++) {                               \
     ColorStop currentColor = colors[i];                    \
     bool isInBetween = currentColor.position <= factor;    \
     index = int(mix(float(index), float(i), float(isInBetween))); \
  }                                                         \
  ColorStop currentColor = colors[index];                   \
  ColorStop nextColor = colors[index + 1];                  \
  float range = nextColor.position - currentColor.position; \
  float lerpFactor = (factor - currentColor.position) / range; \
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  
  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);
  
  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);
  
  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;
  
  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);
  
  vec3 auroraColor = intensity * rampColor;
  
  fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
}
`;

export default function Aurora(props) {
  const {
    colorStops = ['#5227FF', '#7cff67', '#5227FF'],
    amplitude = 1.0,
    blend = 0.5,
  } = props;
  const propsRef = useRef(props);
  propsRef.current = props;

  const ctnDom = useRef(null);
  const resizeRef = useRef();
  const handleContextLostRef = useRef();
  const handleContextRestoredRef = useRef();
  const resizeTimeoutRef = useRef();
  const lastSizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    console.log("[Aurora] Component mounted, starting initialization");
    const ctn = ctnDom.current;
    if (!ctn) {
      console.error("[Aurora] Container element not found");
      return;
    }

    let renderer;
    let gl;
    let program;
    let mesh;
    let geometry;
    let animateId;
    let resizeObserver;

    try {
      console.log("[Aurora] Creating OGL renderer");
      renderer = new Renderer({
        alpha: true,
        premultipliedAlpha: true,
        antialias: true,
      });
      gl = renderer.gl;
      console.log("[Aurora] WebGL context created successfully:", !!gl);

      if (!gl) {
        console.error("[Aurora] Failed to create WebGL context");
        return;
      }

      // Check for WebGL context loss immediately after creation
      if (gl.isContextLost()) {
        console.error("[Aurora] WebGL context is lost immediately after creation");
        return;
      }

      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.canvas.style.backgroundColor = 'transparent';

      // Improved resize function with debouncing
      const performResize = () => {
        if (!ctn || !renderer) return;
        const width = ctn.offsetWidth;
        const height = ctn.offsetHeight;
        
        // Check if size actually changed
        if (width === lastSizeRef.current.width && height === lastSizeRef.current.height) {
          return;
        }
        
        lastSizeRef.current = { width, height };
        
        // Don't resize to 0 dimensions
        if (width < 1 || height < 1) {
          console.log("[Aurora] Skipping resize - container too small:", width, "x", height);
          return;
        }
        
        console.log("[Aurora] Resizing to:", width, "x", height);
        renderer.setSize(width, height);
        if (program) {
          program.uniforms.uResolution.value = [width, height];
        }
      };

      // Debounced resize function
      resizeRef.current = () => {
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }
        resizeTimeoutRef.current = setTimeout(performResize, 100);
      };

      // Use ResizeObserver instead of window resize
      resizeObserver = new ResizeObserver(resizeRef.current);
      resizeObserver.observe(ctn);

      geometry = new Triangle(gl);
      if (geometry.attributes.uv) {
        delete geometry.attributes.uv;
      }

      const colorStopsArray = colorStops.map((hex) => {
        const c = new Color(hex);
        return [c.r, c.g, c.b];
      });

      console.log("[Aurora] Creating shader program");
      program = new Program(gl, {
        vertex: VERT,
        fragment: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uAmplitude: { value: amplitude },
          uColorStops: { value: colorStopsArray },
          uResolution: { value: [ctn.offsetWidth, ctn.offsetHeight] },
          uBlend: { value: blend },
        },
      });

      console.log("[Aurora] Creating mesh and appending canvas");
      mesh = new Mesh(gl, { geometry, program });
      
      // Clear container and append canvas
      while (ctn.firstChild) {
        ctn.removeChild(ctn.firstChild);
      }
      
      gl.canvas.style.position = 'absolute';
      gl.canvas.style.top = '0';
      gl.canvas.style.left = '0';
      gl.canvas.style.width = '100%';
      gl.canvas.style.height = '100%';
      gl.canvas.style.display = 'block';
      gl.canvas.style.zIndex = '1';
      
      ctn.appendChild(gl.canvas);

      const update = (t) => {
        if (!renderer || !mesh) {
          console.log("[Aurora] Renderer or mesh not available, stopping animation");
          return;
        }

        animateId = requestAnimationFrame(update);
        const { time = t * 0.01, speed = 1.0 } = propsRef.current;
        program.uniforms.uTime.value = time * speed * 0.1;
        program.uniforms.uAmplitude.value = propsRef.current.amplitude ?? 1.0;
        program.uniforms.uBlend.value = propsRef.current.blend ?? blend;
        const stops = propsRef.current.colorStops ?? colorStops;
        program.uniforms.uColorStops.value = stops.map((hex) => {
          const c = new Color(hex);
          return [c.r, c.g, c.b];
        });
        renderer.render({ scene: mesh });
      };
      
      console.log("[Aurora] Starting animation loop");
      animateId = requestAnimationFrame(update);

      // Initial resize
      performResize();

      // Define context loss handlers
      handleContextLostRef.current = (e) => {
        e.preventDefault();
        console.warn('WebGL context lost for Aurora component');
      };

      handleContextRestoredRef.current = () => {
        console.log('WebGL context restored for Aurora component');
        // Reinitialize after context restoration
        performResize();
      };

      gl.canvas.addEventListener(
        'webglcontextlost',
        handleContextLostRef.current,
        false
      );
      gl.canvas.addEventListener(
        'webglcontextrestored',
        handleContextRestoredRef.current,
        false
      );
    } catch (error) {
      console.error('Error initializing Aurora component:', error);
      return;
    }

    return () => {
      console.log("[Aurora] Cleaning up component");
      if (animateId) {
        cancelAnimationFrame(animateId);
      }
      
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      
      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      if (ctn && gl && gl.canvas && ctn.contains(gl.canvas)) {
        ctn.removeChild(gl.canvas);
      }

      // Clean up WebGL resources properly
      if (gl) {
        // Remove event listeners
        if (handleContextLostRef.current) {
          gl.canvas.removeEventListener(
            'webglcontextlost',
            handleContextLostRef.current
          );
        }
        if (handleContextRestoredRef.current) {
          gl.canvas.removeEventListener(
            'webglcontextrestored',
            handleContextRestoredRef.current
          );
        }
      }
      
      // Reset last size
      lastSizeRef.current = { width: 0, height: 0 };
    };
  }, [amplitude]);

  return <div ref={ctnDom} className="w-full h-full" />;
}
