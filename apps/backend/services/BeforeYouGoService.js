/**
 * "Before you go" — what a trip to one place looks like right now.
 *
 *   drive      now, with live traffic (TomTom routing, free tier) — only when
 *              the caller knows where they are starting from
 *   incidents  reported within ~3 km of the destination (TrafficIncidentService)
 *   cameras    public still-image traffic cameras within ~8 km, nearest first
 *   weather    current conditions at the destination (Open-Meteo: keyless,
 *              free, no account — nothing to leak or run up)
 *
 * Each part is fetched independently and fails on its own: a card with three
 * of four sections beats no card because the weather service was slow. A part
 * that could not be read is `null`, never a guess.
 *
 * No prices for Uber/Lyft — there is no free, lawful source for live fares,
 * and an estimate we made up would be exactly the kind of number this site
 * does not print. The client links out to both apps instead.
 */
const axios = require('axios');
const TomTomService = require('./TomTomService');
const TrafficIncidentService = require('./TrafficIncidentService');
const OpenTrafficCamService = require('./OpenTrafficCamService');
const { createTtlCache } = require('../utils/ttlCache');

const weatherCache = createTtlCache({ ttlMs: 10 * 60 * 1000, max: 300 });

// WMO weather interpretation codes (Open-Meteo's `weather_code`).
const WMO = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Freezing fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Violent rain showers',
  85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail',
};

const isCoord = (p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
  && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

function boxAround({ lat, lng }, km) {
  const dLat = km / 111.32;
  const dLng = km / (111.32 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

function metersBetween(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function drive(from, to) {
  const route = await TomTomService.getRoute(from.lat, from.lng, to.lat, to.lng, { traffic: true });
  if (!route) return null;
  return {
    minutes: Math.round(route.duration / 60),
    trafficDelayMinutes: Math.round((route.trafficDelay || 0) / 60),
    miles: Math.round((route.distance / 1609.34) * 10) / 10,
    arrival: route.arrivalTime || null,
  };
}

async function incidents(to) {
  const bbox = boxAround(to, 3).map((n) => n.toFixed(4)).join(',');
  const out = await TrafficIncidentService.getIncidents(bbox);
  const list = out.incidents || [];
  return {
    count: list.length,
    top: list.slice(0, 3).map((i) => ({ kind: i.kind, road: i.road, from: i.from, to: i.to, delaySeconds: i.delaySeconds })),
  };
}

async function cameras(to) {
  const [w, s, e, n] = boxAround(to, 8);
  const found = await OpenTrafficCamService.getCamerasInBounds(s, w, n, e);
  return found
    // Stills only: the card shows a picture, and an HLS stream needs a player.
    .filter((c) => c.urls?.image && Number.isFinite(c.location?.lat))
    .map((c) => ({
      id: c.id,
      name: c.name,
      imageUrl: c.urls.image,
      lat: c.location.lat,
      lng: c.location.lng,
      meters: Math.round(metersBetween(to, c.location)),
    }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, 3);
}

async function weather(to) {
  const key = `${to.lat.toFixed(2)},${to.lng.toFixed(2)}`;
  return weatherCache.wrap(key, async () => {
    const res = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: to.lat,
        longitude: to.lng,
        current: 'temperature_2m,weather_code,wind_speed_10m,precipitation',
        temperature_unit: 'fahrenheit',
        wind_speed_unit: 'mph',
        precipitation_unit: 'inch',
      },
      timeout: 6000,
    });
    const c = res.data?.current;
    if (!c) return null;
    return {
      tempF: Math.round(c.temperature_2m),
      summary: WMO[c.weather_code] || 'Unknown',
      windMph: Math.round(c.wind_speed_10m),
      precipitationIn: c.precipitation,
    };
  });
}

/**
 * @param {{from?: {lat,lng}, to: {lat,lng}}} input
 */
async function getBrief({ from, to } = {}) {
  if (!isCoord(to)) {
    const err = new Error('to must be { lat, lng }');
    err.code = 'BAD_INPUT';
    throw err;
  }
  const dest = { lat: Number(to.lat), lng: Number(to.lng) };
  const origin = isCoord(from) ? { lat: Number(from.lat), lng: Number(from.lng) } : null;

  const [d, i, c, w] = await Promise.allSettled([
    origin ? drive(origin, dest) : Promise.resolve(null),
    incidents(dest),
    cameras(dest),
    weather(dest),
  ]);
  const val = (r) => (r.status === 'fulfilled' ? r.value : null);
  return {
    drive: val(d),
    incidents: val(i),
    cameras: val(c) || [],
    weather: val(w),
    // Which parts failed, so the card can say "unavailable" rather than
    // leave a silent gap that reads as "nothing there".
    unavailable: ['drive', 'incidents', 'cameras', 'weather'].filter((_, k) => [d, i, c, w][k].status === 'rejected'),
  };
}

module.exports = { getBrief, WMO, boxAround };
