import { useEffect, useState } from 'react';

/**
 * useDeviceTier
 *
 * Detects the device's graphics/performance capability so heavy animated
 * backgrounds can be downgraded on low-end hardware (or when the user has
 * requested reduced motion).
 *
 * Returns an object:
 *   tier            'low' | 'medium' | 'high'
 *   reducedMotion   boolean — user prefers reduced motion
 *   webglAvailable  boolean — WebGL context could be created
 *   isMobile        boolean — coarse pointer / small viewport
 *   allowHeavyAnimations  boolean — convenience flag; false on low tier,
 *                   reduced-motion, no-webgl, OR any mobile device. Phones
 *                   never get the heavy WebGL/particle backgrounds — even a
 *                   mid-tier phone burns battery and jank on 800+-particle
 *                   rAF loops (real-user mobile lag report, 2026-07-05).
 */
export function useDeviceTier() {
  const [state, setState] = useState({
    tier: 'high',
    reducedMotion: false,
    webglAvailable: true,
    isMobile: false,
    allowHeavyAnimations: true,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // WebGL availability
    let webglAvailable = false;
    try {
      const canvas = document.createElement('canvas');
      webglAvailable = !!(
        canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      );
    } catch {
      webglAvailable = false;
    }

    // Reduced motion preference
    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;

    // Coarse mobile / small-screen detection
    const isMobile =
      window.matchMedia?.('(pointer: coarse)').matches ||
      window.innerWidth < 768;

    // CPU cores + device memory → coarse tier
    const cores = navigator.hardwareConcurrency || 4;
    const memory = navigator.deviceMemory || 4; // GB (Chrome only)

    let tier = 'high';
    if (!webglAvailable || cores <= 2 || memory <= 2) {
      tier = 'low';
    } else if (cores <= 4 || memory <= 4 || isMobile) {
      tier = 'medium';
    }

    const allowHeavyAnimations =
      tier !== 'low' && webglAvailable && !reducedMotion && !isMobile;

    setState({ tier, reducedMotion, webglAvailable, isMobile, allowHeavyAnimations });
  }, []);

  return state;
}

export default useDeviceTier;
