import axios from 'axios';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export async function checkBackendHealth() {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/health`, {
      timeout: 5000
    });
    return {
      isHealthy: response.status === 200,
      data: response.data,
      error: null
    };
  } catch (error) {
    return {
      isHealthy: false,
      data: null,
      error: error.message
    };
  }
}

export async function checkRadarHealth() {
  try {
    const response = await axios.get(`${BACKEND_URL}/api/radar/health`, {
      timeout: 5000
    });
    return {
      isHealthy: response.status === 200,
      data: response.data,
      error: null
    };
  } catch (error) {
    return {
      isHealthy: false,
      data: null,
      error: error.message
    };
  }
}

export async function checkAllServices() {
  const [backendHealth, radarHealth] = await Promise.allSettled([
    checkBackendHealth(),
    checkRadarHealth()
  ]);

  return {
    backend: backendHealth.status === 'fulfilled' ? backendHealth.value : { isHealthy: false, error: backendHealth.reason },
    radar: radarHealth.status === 'fulfilled' ? radarHealth.value : { isHealthy: false, error: radarHealth.reason }
  };
}

export function isServiceHealthy(healthResult) {
  return healthResult.isHealthy === true;
}
