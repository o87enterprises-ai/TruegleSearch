import { useRef, useEffect, useCallback } from 'react';

/**
 * Optimized WebGL animation hook for performance-critical components
 */
export const useWebGLAnimation = (
  animationCallback: (time: number) => void,
  isActive: boolean = true,
  targetFPS: number = 60
) => {
  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const frameIntervalRef = useRef<number>(1000 / targetFPS);
  const isRunningRef = useRef<boolean>(false);

  const animate = useCallback(
    (currentTime: number) => {
      if (!isRunningRef.current) return;

      // Throttle to target FPS
      if (currentTime - lastTimeRef.current >= frameIntervalRef.current) {
        animationCallback(currentTime * 0.001); // Convert to seconds
        lastTimeRef.current = currentTime;
      }

      animationRef.current = requestAnimationFrame(animate);
    },
    [animationCallback]
  );

  const start = useCallback(() => {
    if (!isRunningRef.current) {
      isRunningRef.current = true;
      lastTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(animate);
    }
  }, [animate]);

  const stop = useCallback(() => {
    isRunningRef.current = false;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = 0;
    }
  }, []);

  // Auto start/stop based on active state
  useEffect(() => {
    if (isActive) {
      start();
    } else {
      stop();
    }

    return stop;
  }, [isActive, start, stop]);

  // Update target FPS
  useEffect(() => {
    frameIntervalRef.current = 1000 / targetFPS;
  }, [targetFPS]);

  // Cleanup on unmount
  useEffect(() => {
    return stop;
  }, [stop]);

  return { start, stop, isRunning: () => isRunningRef.current };
};

/**
 * Intersection Observer hook for performance optimization
 */
export const useOffscreenSuspend = (
  ref: React.RefObject<HTMLElement>,
  onVisibilityChange: (isVisible: boolean) => void
) => {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        onVisibilityChange(entry.isIntersecting);
      },
      {
        threshold: 0.1,
        rootMargin: 'var(--ds-space-6)', /* 48px (closest to 50px) */
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref, onVisibilityChange]);
};

/**
 * Memory monitoring hook for WebGL components
 */
export const useMemoryMonitor = () => {
  const memoryRef = useRef<{
    initialMemory?: number;
    currentMemory?: number;
    maxMemory?: number;
    sampleCount: number;
  }>({
    sampleCount: 0,
  });

  const measureMemory = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const currentMemory = memory.usedJSHeapSize;

      if (!memoryRef.current.initialMemory) {
        memoryRef.current.initialMemory = currentMemory;
      }

      memoryRef.current.currentMemory = currentMemory;
      memoryRef.current.maxMemory = Math.max(
        memoryRef.current.maxMemory || 0,
        currentMemory
      );
      memoryRef.current.sampleCount++;

      return {
        current: currentMemory,
        initial: memoryRef.current.initialMemory,
        max: memoryRef.current.maxMemory,
        delta: memoryRef.current.initialMemory
          ? currentMemory - memoryRef.current.initialMemory
          : 0,
      };
    }

    return null;
  }, []);

  const reset = useCallback(() => {
    memoryRef.current = { sampleCount: 0 };
  }, []);

  return { measureMemory, reset };
};

/**
 * Performance profiler hook for components
 */
export const usePerformanceProfiler = (componentName: string) => {
  const startTimeRef = useRef<number>(0);
  const renderCountRef = useRef<number>(0);

  const startProfile = useCallback(() => {
    startTimeRef.current = performance.now();
  }, []);

  const endProfile = useCallback(() => {
    const duration = performance.now() - startTimeRef.current;
    renderCountRef.current++;

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[${componentName}] Render #${renderCountRef.current}: ${duration.toFixed(2)}ms`
      );
    }

    return duration;
  }, [componentName]);

  const getRenderCount = useCallback(() => renderCountRef.current, []);

  return { startProfile, endProfile, getRenderCount };
};

/**
 * Optimized resize observer hook
 */
export const useResizeObserver = (
  ref: React.RefObject<HTMLElement>,
  onResize: (entry: ResizeObserverEntry) => void,
  debounceMs: number = 100
) => {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let timeoutId: NodeJS.Timeout;

    const debouncedCallback = (entries: ResizeObserverEntry[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        onResize(entries[0]);
      }, debounceMs);
    };

    const observer = new ResizeObserver(debouncedCallback);
    observer.observe(element);

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [ref, onResize, debounceMs]);
};
