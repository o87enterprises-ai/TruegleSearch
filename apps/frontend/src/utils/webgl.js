/**
 * Can this device draw WebGL at all?
 *
 * WHY THIS EXISTS. Every map surface here needs WebGL — MapLibre (the standard
 * map), Globe3D and AzimuthalFlat all do. On a device that cannot give one,
 * MapLibre does not throw something React can catch: its Map constructor calls
 * _setupPainter, the context request fails, and it logs
 *
 *   Failed to create WebGL context: WebGL creation failed:
 *     * tryANGLE (FEATURE_FAILURE_EGL_NO_CONFIG)
 *     * Exhausted GL driver options. (FEATURE_FAILURE_WEBGL_EXHAUSTED_DRIVERS)
 *
 * over and over while the user looks at an empty rectangle. WebGLErrorBoundary
 * wrapped only the two 3D views and promised to "switch to the standard map" —
 * which is MapLibre, which needs the very thing that just failed.
 *
 * So the question has to be asked BEFORE anything mounts, and answered once.
 */

// Asked once per page load. Creating throwaway contexts is not free, and on a
// device that is already out of GL resources it is the opposite of free.
let cached = null;
let reason = '';

/** Why WebGL is unavailable, when it is. Empty string when it works. */
export function webglFailureReason() {
  return reason;
}

/**
 * True when a WebGL context can actually be created.
 *
 * `webglcontextcreationerror` carries the driver's own explanation, which is
 * the only actionable part — "hardware acceleration is off" and "this GPU is
 * blocklisted" are different problems with different fixes, and neither is
 * visible from the fact that getContext returned null.
 */
export function hasWebGL() {
  if (cached !== null) return cached;

  try {
    const canvas = document.createElement('canvas');
    canvas.addEventListener('webglcontextcreationerror', (e) => {
      reason = e.statusMessage || 'the graphics driver refused a WebGL context';
    }, { once: true });

    // webgl2 first, then the two older spellings. A device can refuse the
    // newer context and still serve the older one.
    const gl = canvas.getContext('webgl2')
      || canvas.getContext('webgl')
      || canvas.getContext('experimental-webgl');

    cached = Boolean(gl);
    if (!cached && !reason) reason = 'this browser or device has WebGL disabled';

    // Hand the context straight back. Holding it costs one of the small number
    // a browser will grant, and the map is about to ask for its own.
    if (gl) {
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    }
  } catch (error) {
    cached = false;
    reason = error?.message || 'WebGL could not be initialised';
  }

  return cached;
}

/** Tests only — forget the cached answer. */
export function resetWebGLProbe() {
  cached = null;
  reason = '';
}
