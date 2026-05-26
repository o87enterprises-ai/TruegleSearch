import { useState, useEffect, useCallback } from 'react';
import { checkBackendHealth, checkRadarHealth, isServiceHealthy } from '../utils/healthCheck';

export function useHealthCheck() {
  const [health, setHealth] = useState({
    backend: { isHealthy: null, isLoading: true },
    radar: { isHealthy: null, isLoading: true }
  });
  const [lastChecked, setLastChecked] = useState(null);

  const performHealthCheck = useCallback(async () => {
    try {
      const [backendResult, radarResult] = await Promise.allSettled([
        checkBackendHealth(),
        checkRadarHealth()
      ]);

      setHealth({
        backend: {
          isHealthy: backendResult.status === 'fulfilled' && isServiceHealthy(backendResult.value),
          isLoading: false,
          error: backendResult.status === 'fulfilled' ? backendResult.value.error : backendResult.reason?.message
        },
        radar: {
          isHealthy: radarResult.status === 'fulfilled' && isServiceHealthy(radarResult.value),
          isLoading: false,
          error: radarResult.status === 'fulfilled' ? radarResult.value.error : radarResult.reason?.message
        }
      });

      setLastChecked(new Date());
    } catch (error) {
      setHealth(prev => ({
        ...prev,
        backend: { ...prev.backend, isLoading: false, error: error.message },
        radar: { ...prev.radar, isLoading: false, error: error.message }
      }));
    }
  }, []);

  useEffect(() => {
    performHealthCheck();

    const interval = setInterval(performHealthCheck, 60000);

    return () => clearInterval(interval);
  }, [performHealthCheck]);

  return {
    health,
    isBackendHealthy: health.backend.isHealthy === true,
    isRadarHealthy: health.radar.isHealthy === true,
    isAnyServiceUnhealthy: health.backend.isHealthy === false || health.radar.isHealthy === false,
    lastChecked,
    refresh: performHealthCheck
  };
}
