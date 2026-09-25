jest.mock('axios');
const axios = require('axios');

process.env.TOMTOM_API_KEY = process.env.TOMTOM_API_KEY || 'test-key';
const svc = require('../services/TrafficIncidentService');

describe('TrafficIncidentService', () => {
  beforeEach(() => axios.get.mockReset());

  test('rejects a malformed box', async () => {
    await expect(svc.getIncidents('nonsense')).rejects.toMatchObject({ code: 'BAD_BBOX' });
    await expect(svc.getIncidents('1,2,0,3')).rejects.toMatchObject({ code: 'BAD_BBOX' });
  });

  test('a zoomed-out view is "too large", not a request to TomTom', async () => {
    const out = await svc.getIncidents('-125,40,-115,46');
    expect(out).toEqual({ incidents: [], tooLarge: true });
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('normalises TomTom incidents into pins people can read', async () => {
    axios.get.mockResolvedValue({ data: { incidents: [
      { type: 'Feature', geometry: { type: 'LineString', coordinates: [[-123.1, 44.0], [-123.09, 44.01], [-123.08, 44.02]] },
        properties: { id: 'a1', iconCategory: 8, magnitudeOfDelay: 4, events: [{ description: 'Closed' }], from: 'Main St', to: '5th Ave', delay: 300, length: 812.4, roadNumbers: ['OR-99'] } },
      { type: 'Feature', geometry: { type: 'Point', coordinates: [-123.05, 44.05] },
        properties: { id: 'b2', iconCategory: 1, magnitudeOfDelay: 2, events: [] } },
    ] } });
    const { incidents } = await svc.getIncidents('-123.2,43.95,-123.0,44.1');
    expect(incidents).toHaveLength(2);
    expect(incidents[0]).toMatchObject({ kind: 'Road closed', severity: 'major', lat: 44.01, lng: -123.09, road: 'OR-99', delaySeconds: 300, lengthMeters: 812, description: 'Closed' });
    expect(incidents[1]).toMatchObject({ kind: 'Crash', severity: 'moderate', lat: 44.05, description: null });
  });

  test('a small pan inside the same ~1 km box reuses the cached answer', async () => {
    axios.get.mockResolvedValue({ data: { incidents: [] } });
    await svc.getIncidents('-122.501,45.501,-122.401,45.601');
    await svc.getIncidents('-122.502,45.502,-122.402,45.602');
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});
