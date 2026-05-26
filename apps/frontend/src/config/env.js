// Environment variables configuration for Vite
// SECURITY: API keys must NOT be exposed in the frontend bundle.
// All API calls should route through the backend at /api/*
// These values are intentionally empty — the backend holds the real keys.

const env = {
  // Google Custom Search — routed through backend /api/search
  googleApiKey: '',
  googleSearchEngineId: import.meta.env.VITE_GOOGLE_SEARCH_ENGINE_ID || '',
  googleShoppingEngineId: import.meta.env.VITE_GOOGLE_SHOPPING_ENGINE_ID || '',

  // All other API keys removed from frontend — use backend proxy routes
  bingApiKey: '',
  serpApiKey: '',
  newsApiKey: '',
  mediastackApiKey: '',
  youtubeApiKey: '',
  twitterBearerToken: '',
};

export default env;
