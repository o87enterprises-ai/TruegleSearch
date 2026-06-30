import { useMemo } from 'react';
import './LandingBackground.css';
import ErrorBoundary from './ui/ErrorBoundary';
import BackgroundAnimation from './BackgroundAnimation';
import { prefersReducedMotion, isLowPerformanceDevice } from './FallbackAnimations';

/**
 * Conservative WebGL capability probe. Returns false on any failure so we never
 * mount the heavy Prism/Aurora/Laser layer on a device that can't run it (which
 * was the source of the old "repeated crash loops").
 */
function hasWebGL() {
  try {
    if (!window.WebGLRenderingContext) return false;
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch {
    return false;
  }
}

/**
 * Landing page background.
 *
 * Layer 1 (always on): a pure-CSS animated aurora + starfield. No WebGL, GPU-
 * friendly (transform/opacity only), so it animates in every browser and can
 * never crash — the background is never static.
 *
 * Layer 2 (capable devices only): the rich WebGL BackgroundAnimation, gated on
 * a WebGL probe + reduced-motion + low-power checks and wrapped in an error
 * boundary whose fallback is null — so any WebGL failure silently drops back to
 * the CSS layer instead of crash-looping or showing an error box.
 */
export default function LandingBackground() {
  const richEnabled = useMemo(
    () => hasWebGL() && !prefersReducedMotion() && !isLowPerformanceDevice(),
    []
  );

  return (
    <>
      <div className="tg-bg" aria-hidden="true">
        <div className="tg-bg__aurora" />
        <div className="tg-bg__stars" />
        <div className="tg-bg__sheen" />
      </div>

      {richEnabled && (
        <ErrorBoundary fallback={() => null}>
          <BackgroundAnimation />
        </ErrorBoundary>
      )}
    </>
  );
}
