import axios from 'axios';

// Use relative /api path so Vite's dev-server proxy forwards to the backend.
// This works for localhost, local-network IPs, ngrok, and any other external host.
// For production, set VITE_BACKEND_URL to the deployed backend URL.
const getBaseURL = () => {
  const explicitBackend = import.meta.env.VITE_BACKEND_URL;
  if (explicitBackend && explicitBackend !== 'http://localhost:3001') {
    return `${explicitBackend}/api`;
  }
  return '/api';
};

const getAxiosInstance = () =>
  axios.create({
    baseURL: getBaseURL(),
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
    },
  });

const api = getAxiosInstance();

// Request interceptor - add JWT token to authenticated requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('truegle_token');
    if (token && !token.startsWith('guest_')) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If we get a 401, the token is invalid/expired
    if (error.response?.status === 401) {
      // Don't clear auth for login/register attempts
      const isAuthEndpoint = error.config?.url?.includes('/auth/login') ||
                            error.config?.url?.includes('/auth/register');
      if (!isAuthEndpoint) {
        console.warn('[API] Session expired, clearing auth state');
        // Token is invalid - clear it (but don't redirect, let the app handle it)
        localStorage.removeItem('truegle_token');
        localStorage.removeItem('truegle_user');
        localStorage.removeItem('truegle_remember_me');
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  getCurrentUser: () => api.get('/auth/me'),
};

// Search API
const searchAPI = {
  // POST /api/search - perform search with query and filters
  search: (query, options = {}) =>
    api.post('/search', { query, filters: options }),
  // GET /api/search/sources - get available search sources
  getSources: () => api.get('/search/sources'),
  // GET /api/search/health - check search service health
  getHealth: () => api.get('/search/health'),
  // History and trending endpoints (if available)
  getHistory: (limit = 20) => api.get('/search/history', { params: { limit } }),
  getTrending: (timeframe = '24h') =>
    api.get('/search/trending', { params: { timeframe } }),
  analyzeQuery: (query) => api.get('/search/analyze', { params: { q: query } }),
};

// Subscription API
const subscriptionAPI = {
  createCheckout: (tier) => api.post('/subscription/checkout', { tier }),
  getPortal: () => api.get('/subscription/portal'),
  getStatus: () => api.get('/subscription/status'),
};

// Ads API
const adsAPI = {
  getAds: (perspective, query) =>
    api.get('/ads', { params: { perspective, query } }),
  trackImpression: (adId, perspective) =>
    api.post('/ads/impression', { adId, perspective }),
  trackClick: (adId, perspective) =>
    api.post('/ads/click', { adId, perspective }),
};

// Tokens API
const tokensAPI = {
  getBalance: () => api.get('/tokens/balance'),
  getUsage: () => api.get('/tokens/usage'),
  checkAccess: (featureName) => api.post('/tokens/check-access', { featureName }),
  spend: (featureName) => api.post('/tokens/spend', { featureName }),
  earnFromAd: (adId, durationSeconds) => api.post('/tokens/earn/ad', { adId, durationSeconds }),
  earnFromGame: (levelCompleted) => api.post('/tokens/earn/game', { levelCompleted }),
  getHistory: (limit = 20) => api.get('/tokens/history', { params: { limit } }),
  getConfig: () => api.get('/tokens/config'),
};

// AI API
const aiAPI = {
  chat: (message, options = {}) =>
    api.post('/ai/chat', {
      message,
      context: options.context || 'general',
      options
    }),
  analyzeContent: (content, queryContext, options = {}) =>
    api.post('/ai/analyze-content', {
      content,
      queryContext,
      context: options.context || 'general',
      options
    }),
  getHealth: () => api.get('/ai/health'),

  // Prompt Management (Admin only)
  prompts: {
    list: (filters = {}) => api.get('/prompts/prompts', { params: filters }),
    get: (id) => api.get(`/prompts/prompts/${id}`),
    create: (data) => api.post('/prompts/prompts', data),
    update: (id, data) => api.put(`/prompts/prompts/${id}`, data),
    delete: (id) => api.delete(`/prompts/prompts/${id}`),
    getHistory: (id) => api.get(`/prompts/prompts/${id}/history`),
    rollback: (id, historyId) => api.post(`/prompts/prompts/${id}/rollback`, { history_id: historyId }),
    getVariables: (id) => api.get(`/prompts/prompts/${id}/variables`),
    addVariable: (id, data) => api.post(`/prompts/prompts/${id}/variables`, data),
  },

  // Provider Management (Admin only)
  providers: {
    list: () => api.get('/prompts/providers'),
    update: (id, data) => api.put(`/prompts/providers/${id}`, data),
  },

  // Cache Management (Admin only)
  cache: {
    stats: () => api.get('/prompts/cache/stats'),
    clear: () => api.post('/prompts/cache/clear'),
  },

  // Get available contexts
  getContexts: () => api.get('/prompts/contexts'),
};

// Shopping API
const shoppingAPI = {
  search: (query, options = {}) => api.post('/shopping/search', { query, filters: options }),
  compare: (productName, options = {}) => api.post('/shopping/compare', { productName, filters: options }),
  getStats: () => api.get('/shopping/stats'),
  getHealth: () => api.get('/shopping/health'),
};

// Export all API service modules
export {
  authAPI,
  searchAPI,
  subscriptionAPI,
  adsAPI,
  tokensAPI,
  aiAPI,
  shoppingAPI,
};

export default api;
