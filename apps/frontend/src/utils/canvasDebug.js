// Canvas Debug Utility
export const canvasDebug = {
  logStatus: () => {
    const canvases = document.querySelectorAll('canvas');
    console.log('=== CANVAS DEBUG ===');
    console.log(`Total canvases: ${canvases.length}`);
    
    canvases.forEach((canvas, i) => {
      const style = window.getComputedStyle(canvas);
      console.log(`Canvas ${i}:`);
      console.log(`  Size: ${canvas.width}x${canvas.height}`);
      console.log(`  Visible: ${style.display !== 'none' && style.visibility !== 'hidden'}`);
      console.log(`  Opacity: ${style.opacity}`);
      console.log(`  Position: ${style.position}`);
      console.log(`  Parent: ${canvas.parentElement?.tagName}`);
      console.log(`  Has WebGL: ${!!canvas.getContext('webgl') || !!canvas.getContext('experimental-webgl')}`);
    });
    
    // Check if any canvas is from Three.js or OGL
    const threeCanvases = Array.from(canvases).filter(canvas => {
      return canvas.className.includes('three') || 
             canvas.parentElement?.className?.includes('three') ||
             canvas.style.cssText.includes('three');
    });
    
    console.log(`Three.js/OGL canvases: ${threeCanvases.length}`);
    
    return canvases.length;
  },
  
  monitor: (interval = 2000) => {
    console.log('Starting canvas monitoring...');
    const intervalId = setInterval(() => {
      canvasDebug.logStatus();
    }, interval);
    
    return () => clearInterval(intervalId);
  }
};
