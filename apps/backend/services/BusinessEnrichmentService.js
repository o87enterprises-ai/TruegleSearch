/**
 * Business Enrichment Service
 *
 * Aggregates location contact data from multiple public sources:
 * - TomTom Places API (phone, website)
 * - Brave Search (email, hours, additional data)
 *
 * Extracts contact information using pattern matching and returns
 * enriched business data for display in LocationDetailsPanel.
 */

const TomTomService = require('./TomTomService');
const RadarService = require('./RadarService');
// Brave Search is optional - only load if configured
let BraveSearchService = null;
try {
  BraveSearchService = require('./BraveSearchService');
} catch (error) {
  console.warn('BraveSearchService not available:', error.message);
}

class BusinessEnrichmentService {
  /**
   * Enrich location with contact data from multiple sources
   * @param {string} name - Business/location name
   * @param {string} address - Full address
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {string} category - Location category (RESTAURANT, HOTEL, etc.)
   * @returns {Promise<Object>} Enriched location data
   */
  async enrichLocation(name, address, lat, lng, category) {
    const enrichedData = {
      name,
      address,
      lat,
      lng,
      category,
      phone: null,
      email: null,
      website: null,
      hours: null,
      rating: null,
      reviewCount: 0,
      priceRange: null, // $, $$, $$$, $$$$
      isOpen: null,
      distance: null,
      enriched: false,
      sources: []
    };

    try {
      // Step 1: Try TomTom Places Search for phone and website
      const tomtomData = await this.getTomTomData(name, lat, lng);
      if (tomtomData) {
        if (tomtomData.phone) {
          enrichedData.phone = tomtomData.phone;
          enrichedData.sources.push('tomtom');
        }
        if (tomtomData.website) {
          enrichedData.website = tomtomData.website;
          if (!enrichedData.sources.includes('tomtom')) {
            enrichedData.sources.push('tomtom');
          }
        }
      }

      // Step 2: Try Radar for ratings, price range, and rich place data
      const radarData = await this.getRadarData(name, lat, lng);
      if (radarData) {
        if (radarData.rating) {
          enrichedData.rating = radarData.rating;
          enrichedData.sources.push('radar');
        }
        if (radarData.reviewCount) {
          enrichedData.reviewCount = radarData.reviewCount;
          if (!enrichedData.sources.includes('radar')) {
            enrichedData.sources.push('radar');
          }
        }
        if (radarData.priceRange) {
          enrichedData.priceRange = radarData.priceRange;
          if (!enrichedData.sources.includes('radar')) {
            enrichedData.sources.push('radar');
          }
        }
        if (radarData.hours && !enrichedData.hours) {
          enrichedData.hours = radarData.hours;
          if (!enrichedData.sources.includes('radar')) {
            enrichedData.sources.push('radar');
          }
        }
      }

      // Step 3: Try Brave Search for additional data (email, hours, missing fields)
      const braveData = await this.getBraveSearchData(name, address);
      if (braveData) {
        if (braveData.email && !enrichedData.email) {
          enrichedData.email = braveData.email;
          enrichedData.sources.push('brave_search');
        }
        if (braveData.hours && !enrichedData.hours) {
          enrichedData.hours = braveData.hours;
          if (!enrichedData.sources.includes('brave_search')) {
            enrichedData.sources.push('brave_search');
          }
        }
        if (braveData.phone && !enrichedData.phone) {
          enrichedData.phone = braveData.phone;
          if (!enrichedData.sources.includes('brave_search')) {
            enrichedData.sources.push('brave_search');
          }
        }
        if (braveData.website && !enrichedData.website) {
          enrichedData.website = braveData.website;
          if (!enrichedData.sources.includes('brave_search')) {
            enrichedData.sources.push('brave_search');
          }
        }
      }

      // Calculate open/closed status if we have hours
      if (enrichedData.hours) {
        enrichedData.isOpen = this.calculateIsOpen(enrichedData.hours);
      }

      // Mark as enriched if we got any additional data
      enrichedData.enriched = enrichedData.sources.length > 0;

      return enrichedData;
    } catch (error) {
      console.error('Business enrichment error:', error);
      // Return basic data on error
      return enrichedData;
    }
  }

  /**
   * Get data from TomTom Places API
   * @private
   */
  async getTomTomData(name, lat, lng) {
    try {
      const searchOptions = {
        lat,
        lon: lng,
        radius: 100, // Search within 100m radius
        limit: 1
      };

      const results = await TomTomService.searchPlaces(name, searchOptions);

      if (results && results.length > 0) {
        const place = results[0];
        return {
          phone: place.phone || null,
          website: place.url || place.website || null
        };
      }

      return null;
    } catch (error) {
      console.error('TomTom enrichment error:', error);
      return null;
    }
  }

  /**
   * Get data from Brave Search
   * @private
   */
  async getBraveSearchData(name, address) {
    // Skip if BraveSearchService is not available
    if (!BraveSearchService) {
      return null;
    }

    try {
      const searchQuery = `${name} ${address} contact phone email`;
      const results = await BraveSearchService.webSearch(searchQuery, {
        count: 5
      });

      if (!results || !results.results || results.results.length === 0) {
        return null;
      }

      // Extract contact information from search results
      const email = this.extractEmail(results.results);
      const phone = this.extractPhone(results.results);
      const hours = this.extractHours(results.results);
      const website = this.extractWebsite(results.results, name);

      return {
        email,
        phone,
        hours,
        website
      };
    } catch (error) {
      console.error('Brave Search enrichment error:', error);
      return null;
    }
  }

  /**
   * Get data from Radar Places API
   * @private
   */
  async getRadarData(name, lat, lng) {
    try {
      const searchOptions = {
        near: { latitude: lat, longitude: lng },
        options: {
          query: name,
          radius: 100, // Search within 100m
          limit: 1
        }
      };

      const results = await RadarService.searchPlaces(searchOptions);

      if (results && results.length > 0) {
        const place = results[0];

        // Extract price range if available (convert to $ symbols)
        let priceRange = null;
        if (place.price_level !== undefined && place.price_level !== null) {
          priceRange = '$'.repeat(Math.max(1, Math.min(4, place.price_level)));
        }

        // Extract operating hours
        let hours = null;
        if (place.hours) {
          hours = this.formatRadarHours(place.hours);
        }

        return {
          rating: place.rating || place.user_rating || null,
          reviewCount: place.review_count || place.user_ratings_total || 0,
          priceRange,
          hours
        };
      }

      return null;
    } catch (error) {
      console.error('Radar enrichment error:', error);
      return null;
    }
  }

  /**
   * Format Radar API hours into readable string
   * @private
   */
  formatRadarHours(hours) {
    try {
      if (typeof hours === 'string') {
        return hours;
      }

      if (typeof hours === 'object' && hours.periods) {
        // Format as "Mon-Fri: 9AM-5PM, Sat-Sun: 10AM-4PM"
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const formatted = days.map(day => {
          const period = hours.periods?.find(p => p.day?.toLowerCase() === day);
          if (period && period.open && period.close) {
            return `${day.substr(0, 3)}: ${period.open}-${period.close}`;
          }
          return null;
        }).filter(Boolean).join(', ');

        return formatted || null;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate if business is currently open based on hours
   * @private
   */
  calculateIsOpen(hoursString) {
    try {
      if (!hoursString) return null;

      const now = new Date();
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDay = dayNames[now.getDay()];
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Simple pattern matching for "Mon-Fri: 9AM-5PM" format
      const dayPattern = new RegExp(`${currentDay.substr(0, 3)}[^:]*:\\s*([0-9]{1,2})[:]?([0-9]{0,2})\\s*(am|pm)?\\s*-\\s*([0-9]{1,2})[:]?([0-9]{0,2})\\s*(am|pm)?`, 'i');
      const match = hoursString.toLowerCase().match(dayPattern);

      if (match) {
        let openHour = parseInt(match[1]);
        const openMinute = match[2] ? parseInt(match[2]) : 0;
        const openPeriod = match[3];
        let closeHour = parseInt(match[4]);
        const closeMinute = match[5] ? parseInt(match[5]) : 0;
        const closePeriod = match[6];

        // Convert to 24-hour format
        if (openPeriod === 'pm' && openHour !== 12) openHour += 12;
        if (openPeriod === 'am' && openHour === 12) openHour = 0;
        if (closePeriod === 'pm' && closeHour !== 12) closeHour += 12;
        if (closePeriod === 'am' && closeHour === 12) closeHour = 0;

        const currentTime = currentHour * 60 + currentMinute;
        const openTime = openHour * 60 + openMinute;
        const closeTime = closeHour * 60 + closeMinute;

        return currentTime >= openTime && currentTime <= closeTime;
      }

      // If we can't parse, return null (unknown status)
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract email from search results
   * @private
   */
  extractEmail(searchResults) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

    for (const result of searchResults) {
      const text = `${result.title} ${result.description || result.snippet || ''}`;
      const emails = text.match(emailRegex);

      if (emails && emails.length > 0) {
        // Filter out common non-business emails
        const validEmail = emails.find(email =>
          !email.includes('example.com') &&
          !email.includes('test.com') &&
          !email.includes('noreply') &&
          !email.includes('no-reply')
        );

        if (validEmail) {
          return validEmail;
        }
      }
    }

    return null;
  }

  /**
   * Extract phone number from search results
   * @private
   */
  extractPhone(searchResults) {
    // US phone number patterns
    const phoneRegexes = [
      /\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})/g,
      /\+1[-. ]?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})/g,
      /1[-. ]?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})/g
    ];

    for (const result of searchResults) {
      const text = `${result.title} ${result.description || result.snippet || ''}`;

      for (const regex of phoneRegexes) {
        const matches = text.match(regex);
        if (matches && matches.length > 0) {
          // Return first valid phone number
          return this.formatPhoneNumber(matches[0]);
        }
      }
    }

    return null;
  }

  /**
   * Format phone number to standard format
   * @private
   */
  formatPhoneNumber(phone) {
    // Extract just digits
    const digits = phone.replace(/\D/g, '');

    // Handle 11-digit numbers (starting with 1)
    if (digits.length === 11 && digits.startsWith('1')) {
      const areaCode = digits.substr(1, 3);
      const prefix = digits.substr(4, 3);
      const lineNumber = digits.substr(7, 4);
      return `+1-${areaCode}-${prefix}-${lineNumber}`;
    }

    // Handle 10-digit numbers
    if (digits.length === 10) {
      const areaCode = digits.substr(0, 3);
      const prefix = digits.substr(3, 3);
      const lineNumber = digits.substr(6, 4);
      return `+1-${areaCode}-${prefix}-${lineNumber}`;
    }

    // Return original if can't format
    return phone;
  }

  /**
   * Extract business hours from search results
   * @private
   */
  extractHours(searchResults) {
    const hourPatterns = [
      /hours?:?\s*([^\.]{10,80})/i,
      /open:?\s*([^\.]{10,80})/i,
      /(mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday|sun|sunday)[^\.]{5,60}(am|pm)/i
    ];

    for (const result of searchResults) {
      const text = `${result.title} ${result.description || result.snippet || ''}`;

      for (const pattern of hourPatterns) {
        const match = text.match(pattern);
        if (match) {
          // Clean up the matched hours string
          let hours = match[1] || match[0];
          hours = hours.replace(/\s+/g, ' ').trim();

          // Limit length
          if (hours.length > 100) {
            hours = hours.substring(0, 100) + '...';
          }

          return hours;
        }
      }
    }

    return null;
  }

  /**
   * Extract official website from search results
   * @private
   */
  extractWebsite(searchResults, businessName) {
    // Prioritize results that match the business name
    const normalizedName = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const result of searchResults) {
      if (result.url) {
        const domain = this.extractDomain(result.url);
        const normalizedDomain = domain.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Check if domain contains business name
        if (normalizedDomain.includes(normalizedName) || normalizedName.includes(normalizedDomain)) {
          return result.url;
        }
      }
    }

    // Fallback: return first result URL
    if (searchResults.length > 0 && searchResults[0].url) {
      return searchResults[0].url;
    }

    return null;
  }

  /**
   * Extract domain from URL
   * @private
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch (error) {
      return url;
    }
  }

  /**
   * Health check for service dependencies
   */
  async healthCheck() {
    try {
      const tomtomHealth = await TomTomService.healthCheck();
      const services = {
        tomtom: tomtomHealth
      };

      let allHealthy = tomtomHealth.healthy;

      if (BraveSearchService) {
        const braveHealth = await BraveSearchService.healthCheck();
        services.brave = braveHealth;
        allHealthy = allHealthy && braveHealth.healthy;
      } else {
        services.brave = { healthy: false, message: 'Not configured' };
      }

      return {
        healthy: allHealthy,
        services
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }
}

module.exports = new BusinessEnrichmentService();
