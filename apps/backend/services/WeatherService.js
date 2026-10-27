/**
 * Weather Service - Integrates OpenWeather API for weather data
 */
const axios = require('axios');
const config = require('../config/env');
const { createTtlCache } = require('../utils/ttlCache');

// Weather barely changes in ten minutes; this also keeps repeat searches off the free quota.
const cache = createTtlCache({ ttlMs: 10 * 60 * 1000, max: 500 });
const WMO = { 0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain', 71: 'light snow', 73: 'snow', 75: 'heavy snow', 80: 'rain showers', 81: 'rain showers', 82: 'heavy showers', 95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail' };

class WeatherService {
  constructor() {
    this.apiKey = config.searchApis.weather.apiKey;
    this.apiKey2 = config.searchApis.weather.apiKey2;
    this.baseUrl = 'https://api.openweathermap.org/data/2.5';
  }

  /**
   * `location` is a place name ("Paris") or { lat, lon }. Coordinates skip the
   * name lookup entirely, which is what failed with "city not found".
   */
  _params(location) {
    if (location && typeof location === 'object' && Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lon ?? location.lng))) {
      return { lat: Number(location.lat), lon: Number(location.lon ?? location.lng) };
    }
    return { q: String(location || '').trim() };
  }

  /** OpenWeather call. Only a quota/auth failure moves to the second key; "city not found" (404) does not. */
  async _openWeather(path, location, extra = {}) {
    const keys = [this.apiKey, this.apiKey2].filter(Boolean);
    let lastErr;
    for (const appid of keys) {
      try {
        const { data } = await axios.get(`${this.baseUrl}/${path}`, {
          params: { ...this._params(location), appid, units: 'metric', ...extra },
          timeout: 6000,
        });
        return data;
      } catch (err) {
        lastErr = err;
        if (err.response?.status === 404) break;
      }
    }
    throw lastErr || new Error('No OpenWeather key');
  }

  /** Keyless fallback (Open-Meteo): geocode the name if needed, then fetch. */
  async _openMeteo(location, forecast) {
    let { lat, lon } = this._params(location);
    let label = '';
    if (lat === undefined) {
      const g = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
        params: { name: location, count: 1 }, timeout: 6000,
      });
      const hit = g.data?.results?.[0];
      if (!hit) throw new Error('Location not found');
      lat = hit.latitude; lon = hit.longitude;
      label = [hit.name, hit.country_code].filter(Boolean).join(', ');
    }
    const { data } = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lat, longitude: lon, timezone: 'auto',
        current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
        daily: 'temperature_2m_max,relative_humidity_2m_mean,weather_code',
        forecast_days: 5,
      },
      timeout: 6000,
    });
    const text = (c) => WMO[c] || 'unknown';
    if (forecast) {
      return data.daily.time.map((d, i) => ({
        date: d, temperature: Math.round(data.daily.temperature_2m_max[i]),
        description: text(data.daily.weather_code[i]), icon: null,
        humidity: Math.round(data.daily.relative_humidity_2m_mean[i]),
      }));
    }
    const c = data.current;
    return {
      location: label || `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
      temperature: Math.round(c.temperature_2m), feelsLike: Math.round(c.apparent_temperature),
      description: text(c.weather_code), icon: null, humidity: c.relative_humidity_2m,
      windSpeed: c.wind_speed_10m / 3.6, timestamp: new Date().toISOString(),
    };
  }

  async _get(kind, location) {
    const p = this._params(location);
    const key = `${kind}|${p.q ? p.q.toLowerCase() : `${p.lat.toFixed(2)},${p.lon.toFixed(2)}`}`;
    if (p.q === '') throw new Error('Location is required');
    const hit = cache.get(key);
    if (hit) return hit;
    const forecast = kind === 'forecast';
    let out;
    try {
      const data = await this._openWeather(forecast ? 'forecast' : 'weather', location, forecast ? { cnt: 5 } : {});
      out = forecast ? this.formatForecastData(data) : this.formatWeatherData(data);
    } catch (err) {
      console.warn('[weather] OpenWeather failed, using Open-Meteo:', err.response?.data?.message || err.message);
      try {
        out = await this._openMeteo(location, forecast);
      } catch (err2) {
        throw new Error(err2.message === 'Location not found' ? 'Location not found' : 'Weather service unavailable');
      }
    }
    cache.set(key, out);
    return out;
  }

  getCurrentWeather(location) { return this._get('current', location); }

  getForecast(location) { return this._get('forecast', location); }

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
