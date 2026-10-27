jest.mock('axios');
jest.mock('../config/env', () => ({ searchApis: { weather: { apiKey: 'k1', apiKey2: 'k2' } } }));
const axios = require('axios');

const OW = { name: 'Paris', sys: { country: 'FR' }, main: { temp: 11.6, feels_like: 10, humidity: 70 }, weather: [{ description: 'rain', icon: '10d' }], wind: { speed: 3 }, dt: 1790000000 };
const METEO = { current: { temperature_2m: 9.2, apparent_temperature: 8, relative_humidity_2m: 80, wind_speed_10m: 7.2, weather_code: 3 }, daily: { time: ['2026-10-28'], temperature_2m_max: [12], relative_humidity_2m_mean: [75], weather_code: [61] } };

let svc;
beforeEach(() => { jest.resetModules(); jest.mock('axios'); svc = require('../services/WeatherService'); require('axios').get.mockReset(); });

test('lat/lon goes to OpenWeather as coordinates, not q', async () => {
  const ax = require('axios'); ax.get.mockResolvedValue({ data: OW });
  const r = await svc.getCurrentWeather({ lat: 48.85, lon: 2.35 });
  expect(ax.get.mock.calls[0][1].params).toMatchObject({ lat: 48.85, lon: 2.35 });
  expect(ax.get.mock.calls[0][1].params.q).toBeUndefined();
  expect(r.temperature).toBe(12);
});

test('city-not-found (404) does not burn the second key; falls to Open-Meteo', async () => {
  const ax = require('axios');
  ax.get.mockImplementation((url) => {
    if (url.includes('openweathermap')) return Promise.reject({ response: { status: 404, data: { message: 'city not found' } } });
    if (url.includes('geocoding')) return Promise.resolve({ data: { results: [{ name: 'Lyon', country_code: 'FR', latitude: 45.7, longitude: 4.8 }] } });
    return Promise.resolve({ data: METEO });
  });
  const r = await svc.getCurrentWeather('Lyon');
  expect(ax.get.mock.calls.filter((c) => c[0].includes('openweathermap')).length).toBe(1);
  expect(r).toMatchObject({ location: 'Lyon, FR', temperature: 9 });
});

test('quota failure tries second key; result is cached', async () => {
  const ax = require('axios');
  ax.get.mockRejectedValueOnce({ response: { status: 429 } }).mockResolvedValue({ data: OW });
  await svc.getCurrentWeather('Paris');
  await svc.getCurrentWeather('paris');
  expect(ax.get).toHaveBeenCalledTimes(2);
  expect(ax.get.mock.calls[1][1].params.appid).toBe('k2');
});

test('unknown place everywhere -> Location not found', async () => {
  const ax = require('axios');
  ax.get.mockImplementation((url) => url.includes('geocoding') ? Promise.resolve({ data: {} }) : Promise.reject({ response: { status: 404 } }));
  await expect(svc.getCurrentWeather('Zzzxqq')).rejects.toThrow('Location not found');
});
