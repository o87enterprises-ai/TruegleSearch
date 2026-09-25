jest.mock('axios');
jest.mock('../services/TomTomService', () => ({ getRoute: jest.fn() }));
jest.mock('../services/TrafficIncidentService', () => ({ getIncidents: jest.fn() }));
jest.mock('../services/OpenTrafficCamService', () => ({ getCamerasInBounds: jest.fn() }));
const axios = require('axios');
const TomTom = require('../services/TomTomService');
const Incidents = require('../services/TrafficIncidentService');
const Cams = require('../services/OpenTrafficCamService');
const { getBrief } = require('../services/BeforeYouGoService');

const to = { lat: 36.1147, lng: -115.1728 }; // the Strip
const from = { lat: 36.084, lng: -115.1537 }; // the airport

beforeEach(() => {
  jest.resetAllMocks();
  TomTom.getRoute.mockResolvedValue({ duration: 1260, trafficDelay: 300, distance: 8046, arrivalTime: '2026-09-25T20:21:00Z' });
  Incidents.getIncidents.mockResolvedValue({ incidents: [{ kind: 'Crash', road: 'I-15', delaySeconds: 240 }] });
  Cams.getCamerasInBounds.mockResolvedValue([
    { id: 'far', name: 'Far', urls: { image: 'https://x/far.jpg' }, location: { lat: 36.15, lng: -115.17 } },
    { id: 'near', name: 'Near', urls: { image: 'https://x/near.jpg' }, location: { lat: 36.115, lng: -115.173 } },
    { id: 'video', name: 'Stream', urls: { video: 'https://x/s.m3u8' }, location: { lat: 36.114, lng: -115.172 } },
  ]);
  axios.get.mockResolvedValue({ data: { current: { temperature_2m: 97.4, weather_code: 0, wind_speed_10m: 8.2, precipitation: 0 } } });
});

test('a full brief: drive with traffic, incidents, nearest still cameras, weather', async () => {
  const b = await getBrief({ from, to });
  expect(b.drive).toEqual({ minutes: 21, trafficDelayMinutes: 5, miles: 5, arrival: '2026-09-25T20:21:00Z' });
  expect(b.incidents.count).toBe(1);
  expect(b.cameras.map((c) => c.id)).toEqual(['near', 'far']); // stills only, nearest first
  expect(b.weather).toEqual({ tempF: 97, summary: 'Clear', windMph: 8, precipitationIn: 0 });
  expect(b.unavailable).toEqual([]);
});

test('no starting point → no drive, everything else still there', async () => {
  const b = await getBrief({ to });
  expect(b.drive).toBeNull();
  expect(TomTom.getRoute).not.toHaveBeenCalled();
  expect(b.incidents.count).toBe(1);
});

test('one source failing leaves the others and names what is missing', async () => {
  TomTom.getRoute.mockRejectedValue(new Error('TomTom down'));
  const b = await getBrief({ from, to: { lat: 36.2, lng: -115.2 } });
  expect(b.drive).toBeNull();
  expect(b.unavailable).toEqual(['drive']);
  expect(b.weather.summary).toBe('Clear');
});

test('rejects a missing destination', async () => {
  await expect(getBrief({})).rejects.toMatchObject({ code: 'BAD_INPUT' });
});
