/**
 * Unsplash Service - Stock Photo Integration
 *
 * Free tier: 50 requests per hour
 * Use for image search results and visual content
 */
const axios = require('axios');
const config = require('../config/env');

class UnsplashService {
  constructor() {
    this.accessKey = config.searchApis.unsplash.accessKey;
    this.baseUrl = 'https://api.unsplash.com';

    // Rate limiting (50 requests/hour)
    this.requestCount = 0;
    this.resetTime = Date.now() + 3600000; // 1 hour from now
  }

  /**
   * Search for photos
   */
  async searchPhotos(query, options = {}) {
    if (!this.accessKey) {
      throw new Error('Unsplash API key not configured');
    }

    this.checkRateLimit();

    const {
      page = 1,
      perPage = 10,
      orientation = null, // 'landscape', 'portrait', 'squarish'
      color = null,
    } = options;

    try {
      const response = await axios.get(`${this.baseUrl}/search/photos`, {
        headers: {
          'Authorization': `Client-ID ${this.accessKey}`,
        },
        params: {
          query,
          page,
          per_page: perPage,
          orientation,
          color,
        },
        timeout: 10000,
      });

      this.requestCount++;

      return this.formatResults(response.data);
    } catch (error) {
      console.error('Unsplash API error:', error.response?.data || error.message);

      if (error.response?.status === 401) {
        throw new Error('Invalid Unsplash API key');
      }
      if (error.response?.status === 403) {
        throw new Error('Unsplash rate limit exceeded (50/hour)');
      }

      throw new Error(`Unsplash service unavailable: ${error.message}`);
    }
  }

  /**
   * Get a random photo
   */
  async getRandomPhoto(options = {}) {
    if (!this.accessKey) {
      throw new Error('Unsplash API key not configured');
    }

    this.checkRateLimit();

    const {
      query = null,
      orientation = null,
      count = 1,
    } = options;

    try {
      const response = await axios.get(`${this.baseUrl}/photos/random`, {
        headers: {
          'Authorization': `Client-ID ${this.accessKey}`,
        },
        params: {
          query,
          orientation,
          count,
        },
        timeout: 10000,
      });

      this.requestCount++;

      if (Array.isArray(response.data)) {
        return response.data.map(photo => this.formatPhoto(photo));
      } else {
        return this.formatPhoto(response.data);
      }
    } catch (error) {
      console.error('Unsplash random photo error:', error.response?.data || error.message);
      throw new Error('Failed to get random photo');
    }
  }

  /**
   * Get photo by ID
   */
  async getPhotoById(photoId) {
    if (!this.accessKey) {
      throw new Error('Unsplash API key not configured');
    }

    this.checkRateLimit();

    try {
      const response = await axios.get(`${this.baseUrl}/photos/${photoId}`, {
        headers: {
          'Authorization': `Client-ID ${this.accessKey}`,
        },
        timeout: 10000,
      });

      this.requestCount++;

      return this.formatPhoto(response.data);
    } catch (error) {
      console.error('Unsplash get photo error:', error.response?.data || error.message);
      throw new Error('Failed to get photo');
    }
  }

  /**
   * Track photo download (required by Unsplash guidelines)
   */
  async trackDownload(photoId) {
    if (!this.accessKey) {
      return;
    }

    try {
      await axios.get(`${this.baseUrl}/photos/${photoId}/download`, {
        headers: {
          'Authorization': `Client-ID ${this.accessKey}`,
        },
        timeout: 5000,
      });
    } catch (error) {
      console.error('Unsplash track download error:', error.message);
    }
  }

  /**
   * Format search results
   */
  formatResults(data) {
    return {
      total: data.total,
      totalPages: data.total_pages,
      results: data.results.map(photo => this.formatPhoto(photo)),
    };
  }

  /**
   * Format individual photo
   */
  formatPhoto(photo) {
    return {
      id: photo.id,
      url: photo.urls.regular,
      thumbnail: photo.urls.thumb,
      fullSize: photo.urls.full,
      width: photo.width,
      height: photo.height,
      description: photo.description || photo.alt_description,
      photographer: {
        name: photo.user.name,
        username: photo.user.username,
        profileUrl: photo.user.links.html,
      },
      downloadUrl: photo.links.download,
      unsplashUrl: photo.links.html,
      color: photo.color,
      likes: photo.likes,
      createdAt: photo.created_at,
    };
  }

  /**
   * Check rate limit
   */
  checkRateLimit() {
    const now = Date.now();

    // Reset counter if hour has passed
    if (now >= this.resetTime) {
      this.requestCount = 0;
      this.resetTime = now + 3600000;
    }

    // Warn if approaching limit
    if (this.requestCount >= 45) {
      console.warn(`⚠️  Unsplash: ${this.requestCount}/50 requests used this hour`);
    }

    // Block if limit reached
    if (this.requestCount >= 50) {
      const minutesUntilReset = Math.ceil((this.resetTime - now) / 60000);
      throw new Error(`Unsplash rate limit reached. Resets in ${minutesUntilReset} minutes.`);
    }
  }

  /**
   * Get remaining requests
   */
  getRemainingRequests() {
    const now = Date.now();

    if (now >= this.resetTime) {
      this.requestCount = 0;
      this.resetTime = now + 3600000;
    }

    return {
      remaining: 50 - this.requestCount,
      resetTime: new Date(this.resetTime),
    };
  }

  /**
   * Check service health
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseUrl}/photos/random`, {
        headers: { 'Authorization': `Client-ID ${this.accessKey}` },
        timeout: 5000,
      });
      return {
        healthy: true,
        rateLimit: this.getRemainingRequests(),
      };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }
}

module.exports = new UnsplashService();
