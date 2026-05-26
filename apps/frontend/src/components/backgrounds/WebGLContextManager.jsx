import { useRef, useEffect, createContext, useContext } from 'react';
import { Renderer, Transform } from 'ogl';

// Create shared WebGL context
const WebGLContext = createContext(null);

export const useWebGLContext = () => useContext(WebGLContext);

export const WebGLContextProvider = ({ children }) => {
  const contextValueRef = useRef({
    renderer: null,
    programs: new Map(),
    isInitialized: false,
  });

  useEffect(() => {
    console.log('🔄 Initializing WebGL Context...');
    
    let renderer = null;
    let animationFrameId = null;

    const initContext = () => {
      try {
        // Create renderer with conservative settings
        renderer = new Renderer({
          alpha: true,
          premultipliedAlpha: false,
          antialias: true,
          powerPreference: 'default',
          preserveDrawingBuffer: false,
          failIfMajorPerformanceCaveat: false,
        });

        const gl = renderer.gl;
        
        // Set clear color to transparent
        gl.clearColor(0, 0, 0, 0);
        
        // Set initial size
        renderer.setSize(window.innerWidth, window.innerHeight);

        contextValueRef.current = {
          renderer,
          programs: new Map(),
          isInitialized: true,
          gl,
        };

        // Position canvas properly
        if (gl.canvas) {
          gl.canvas.style.position = 'fixed';
          gl.canvas.style.top = '0';
          gl.canvas.style.left = '0';
          gl.canvas.style.width = '100%';
          gl.canvas.style.height = '100%';
          gl.canvas.style.zIndex = '-1';
          gl.canvas.style.pointerEvents = 'none';
          
          // Add to body if not already there
          if (!document.body.contains(gl.canvas)) {
            document.body.appendChild(gl.canvas);
          }
        }

        console.log('✅ WebGL Context initialized successfully');
        return renderer;
      } catch (error) {
        console.error('❌ WebGL Context initialization failed:', error);
        return null;
      }
    };

    renderer = initContext();
    if (!renderer) return;

    // Create a default transform for uModelMatrix
    const defaultTransform = new Transform();

    // Animation loop
    const animate = () => {
      if (renderer && contextValueRef.current.isInitialized) {
        try {
          // Clear the canvas
          renderer.gl.clear(renderer.gl.COLOR_BUFFER_BIT);
          
          // Update and render all programs
          contextValueRef.current.programs.forEach((data) => {
            if (data && data.mesh && data.program) {
              // Update time uniform if it exists
              if (data.program.uniforms && data.program.uniforms.uTime) {
                data.program.uniforms.uTime.value = performance.now() * 0.001;
              }
              
              // Ensure uModelMatrix is set
              if (data.program.uniforms && data.program.uniforms.uModelMatrix) {
                data.program.uniforms.uModelMatrix.value = defaultTransform.matrix;
              }
              
              // Render the mesh
              renderer.render({ scene: data.mesh });
            }
          });
        } catch (error) {
          console.warn('Error in animation loop:', error);
        }
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    // Start animation loop
    animationFrameId = requestAnimationFrame(animate);

    // Handle resize
    const handleResize = () => {
      if (renderer && contextValueRef.current.isInitialized) {
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      console.log('🧹 Cleaning up WebGL Context...');
      
      // Stop animation loop
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      // Remove resize listener
      window.removeEventListener('resize', handleResize);
      
      // Clear programs
      contextValueRef.current.programs.clear();
      
      // Mark as not initialized
      contextValueRef.current.isInitialized = false;
      
      console.log('✅ WebGL Context cleanup complete');
    };
  }, []);

  return (
    <WebGLContext.Provider value={contextValueRef.current}>
      {children}
    </WebGLContext.Provider>
  );
};

// Utility function to ensure uModelMatrix is set
export const ensureUniforms = (program, uniforms = {}) => {
  if (!program.uniforms.uModelMatrix) {
    program.uniforms.uModelMatrix = { value: new Transform().matrix };
  }
  return program;
};

// Utility function for components to register for cleanup
export const registerWebGLProgram = (id, cleanupData, context) => {
  if (!context || !context.programs) {
    console.warn('Invalid WebGL context provided to registerWebGLProgram');
    return null;
  }

  context.programs.set(id, cleanupData);
  console.log(`✅ Registered WebGL program: ${id}`);

  // Return unregister function
  return () => {
    if (context.programs.has(id)) {
      context.programs.delete(id);
      console.log(`🗑️  Unregistered WebGL program: ${id}`);
    }
  };
};
