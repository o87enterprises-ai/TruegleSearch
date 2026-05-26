import api from './api';

// Social Media API
export const socialAPI = {
  // Search social media platforms
  search: (query, options = {}) => 
    api.post('/social/search', { query, ...options }),
  
  // Get results for a specific job
  getResults: (jobId) => 
    api.get(`/social/results/${jobId}`),
  
  // Direct search (synchronous)
  directSearch: (query, options = {}) => 
    api.post('/social/direct-search', { query, ...options }),
};

// OSINT API
export const osintAPI = {
  // Find emails associated with a domain/company
  findEmails: (params) => 
    api.get('/osint/email-finder', { params }),
  
  // Verify an email address
  verifyEmail: (params) => 
    api.get('/osint/email-verifier', { params }),
  
  // Get account information
  getAccountInfo: () => 
    api.get('/osint/account-info'),
};

// Shodan API
export const shodanAPI = {
  // Lookup IP information
  lookupIP: (ip) => 
    api.get(`/shodan/ip/${ip}`),
  
  // Lookup domain information
  lookupDomain: (domain) => 
    api.get(`/shodan/domain/${domain}`),
  
  // Search Shodan database
  search: (params) => 
    api.get('/shodan/search', { params }),
  
  // Get account information
  getInfo: () => 
    api.get('/shodan/info'),
};

// PayPal API
export const paypalAPI = {
  // Create a PayPal payment
  createPayment: (data) => 
    api.post('/paypal/create-payment', data),
  
  // Execute a PayPal payment
  executePayment: (data) => 
    api.post('/paypal/execute-payment', data),
  
  // Get payment details
  getPayment: (paymentId) => 
    api.get(`/paypal/payment/${paymentId}`),
  
  // Create a subscription
  createSubscription: (data) => 
    api.post('/paypal/create-subscription', data),
  
  // Get subscription details
  getSubscription: (subscriptionId) => 
    api.get(`/paypal/subscription/${subscriptionId}`),
};

// Voice API
export const voiceAPI = {
  // Transcribe audio file
  transcribe: (audioFile) => {
    const formData = new FormData();
    formData.append('audio', audioFile);
    return api.post('/voice/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // Transcribe audio from URL
  transcribeFromURL: (data) => 
    api.post('/voice/transcribe-url', data),
  
  // Analyze audio sentiment
  analyzeSentiment: (audioFile) => {
    const formData = new FormData();
    formData.append('audio', audioFile);
    return api.post('/voice/analyze-sentiment', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // Get account information
  getAccount: () => 
    api.get('/voice/account'),
};

// Unsplash API
export const unsplashAPI = {
  // Search for photos
  searchPhotos: (params) => 
    api.get('/unsplash/search', { params }),
  
  // Get random photos
  getRandomPhotos: (params) => 
    api.get('/unsplash/random', { params }),
  
  // Get photo by ID
  getPhotoById: (id) => 
    api.get(`/unsplash/photo/${id}`),
  
  // Get photos from a collection
  getCollectionPhotos: (id, params) => 
    api.get(`/unsplash/collection/${id}`, { params }),
  
  // Get trending photos
  getTrendingPhotos: (params) => 
    api.get('/unsplash/trending', { params }),
};