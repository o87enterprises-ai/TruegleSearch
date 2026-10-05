// Search API Configuration
// Add your API keys here for real search functionality

// Import environment variables
import env from './env';

export const SEARCH_CONFIG = {
  // Google Custom Search
  google: {
    apiKey: env.googleApiKey,
    searchEngineId: env.googleSearchEngineId,
    shoppingEngineId: env.googleShoppingEngineId,
  },

  // Bing Search API
  bing: {
    apiKey: env.bingApiKey,
  },

  // SerpAPI (aggregates multiple search engines)
  serpApi: {
    apiKey: env.serpApiKey,
  },

  // News API
  newsApi: {
    apiKey: env.newsApiKey,
  },

  // Mediastack News API
  mediastack: {
    apiKey: env.mediastackApiKey,
  },

  // YouTube Data API
  youtube: {
    apiKey: env.youtubeApiKey,
  },

  // Twitter API v2
  twitter: {
    bearerToken: env.twitterBearerToken,
  },
};

// API Rate Limits (requests per minute)
export const RATE_LIMITS = {
  google: 100,
  bing: 1000,
  newsApi: 500,
  youtube: 100,
  serpApi: 100,
  twitter: 300,
};

// Bias detection configuration
export const BIAS_SOURCES = {
  left: [
    'cnn.com',
    'msnbc.com',
    'nytimes.com',
    'washingtonpost.com',
    'huffpost.com',
    'theguardian.com',
    'slate.com',
    'vox.com',
    'salon.com',
    'thedailybeast.com',
    'motherjones.com',
    'thenation.com',
  ],

  right: [
    'foxnews.com',
    'breitbart.com',
    'dailywire.com',
    'nypost.com',
    'wsj.com',
    'nationalreview.com',
    'theblaze.com',
    'townhall.com',
    'redstate.com',
    'thefederalist.com',
    'dailycaller.com',
    'oann.com',
  ],

  center: [
    'bbc.com',
    'reuters.com',
    'apnews.com',
    'npr.org',
    'pbs.org',
    'c-span.org',
    'axios.com',
    'politico.com',
    'thehill.com',
    'usatoday.com',
  ],

  unbiased: [
    'reuters.com',
    'apnews.com',
    'npr.org',
    'pbs.org',
    'c-span.org',
    'factcheck.org',
    'snopes.com',
    'politifact.com',
    'allsides.com',
  ],

  conspiracy: [
    'infowars.com',
    'zerohedge.com',
    'naturalnews.com',
    'globalresearch.ca',
    'beforeitsnews.com',
    'davidicke.com',
    'veteranstoday.com',
    'rumormillnews.com',
  ],
};

// Category detection keywords
export const CATEGORY_KEYWORDS = {
  news: ['news', 'article', 'report', 'breaking', 'politics', 'world'],
  video: ['video', 'watch', 'youtube', 'vimeo', 'documentary', 'film'],
  social: [
    'social',
    'reddit',
    'twitter',
    'facebook',
    'discussion',
    'community',
  ],
  shopping: [
    'buy',
    'shop',
    'store',
    'product',
    'price',
    'deal',
    'amazon',
    'ebay',
  ],
  music: ['music', 'song', 'album', 'artist', 'spotify', 'soundcloud', 'audio'],
  reels: ['shorts', 'reels', 'tiktok', 'viral', 'trending'],
};
