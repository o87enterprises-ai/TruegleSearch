/**
 * Weather Service - Integrates OpenWeather API for weather data
 */
const axios = require('axios');
const config = require('../config/env');

class WeatherService {
  constructor() {
    this.apiKey = config.searchApis.weather.apiKey;
    this.apiKey2 = config.searchApis.weather.apiKey2;
    this.baseUrl = 'https://api.openweathermap.org/data/2.5';

    // Key rotation for load balancing
    this.useSecondKey = false;
  }

  /**
   * Get current weather for a location
   */
  async getCurrentWeather(location) {
    try {
      const apiKey = this.useSecondKey ? this.apiKey2 : this.apiKey;

      const params = {
        q: location,
        appid: apiKey,
        units: 'metric', // metric for Celsius, imperial for Fahrenheit
      };

      const response = await axios.get(`${this.baseUrl}/weather`, { params });
      return this.formatWeatherData(response.data);
    } catch (error) {
      console.error('Weather API error:', error.response?.data || error.message);

      // Try backup key
      if (!this.useSecondKey && this.apiKey2) {
        this.useSecondKey = true;
        return this.getCurrentWeather(location);
      }

      throw new Error('Weather service unavailable');
    }
  }

  /**
   * Get weather forecast (5 days)
   */
  async getForecast(location) {
    try {
      const apiKey = this.useSecondKey ? this.apiKey2 : this.apiKey;

      const params = {
        q: location,
        appid: apiKey,
        units: 'metric',
        cnt: 5, // 5 days forecast
      };

      const response = await axios.get(`${this.baseUrl}/forecast`, { params });
      return this.formatForecastData(response.data);
    } catch (error) {
      console.error('Weather forecast error:', error.response?.data || error.message);

      if (!this.useSecondKey && this.apiKey2) {
        this.useSecondKey = true;
        return this.getForecast(location);
      }

      throw new Error('Weather forecast unavailable');
    }
  }

  /**
   * Format weather data for frontend
   */
  formatWeatherData(data) {
    return {
      location: `${data.name}, ${data.sys.country}`,
      temperature: Math.round(data.main.temp),
      feelsLike: Math.round(data.main.feels_like),
      description: data.weather[0].description,
      icon: data.weather[0].icon,
      humidity: data.main.humidity,
      windSpeed: data.wind.speed,
      timestamp: new Date(data.dt * 1000).toISOString(),
    };
  }

  /**
   * Format forecast data for frontend
   */
  formatForecastData(data) {
    return data.list.map(item => ({
      date: new Date(item.dt * 1000).toISOString().split('T')[0],
      temperature: Math.round(item.main.temp),
      description: item.weather[0].description,
      icon: item.weather[0].icon,
      humidity: item.main.humidity,
    }));
  }
}

module.exports = new WeatherService();
