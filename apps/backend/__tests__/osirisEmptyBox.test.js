/**
 * An area with nothing in it is an empty answer, not a broken feed.
 *
 * Found 2026-10-06 checking the map's Cameras layer on the live site: zoomed in
 * on a downtown block with no camera, /api/osiris/cctv answered 502
 * "unrecognised shape" — the "rows but none with readable coordinates" check
 * counted rows that were readable but outside the box. Every live layer did
 * this for any empty area (no fires over the ocean, no aircraft over a field).
 */
const BODY = { earthquakes: [{ lat: 35.6, lon: 139.7, place: 'Off Honshu' }], total: 1 };

function load(body = BODY) {
  jest.resetModules();
  jest.doMock('axios', () => ({ get: jest.fn().mockResolvedValue({ data: body }) }));
  jest.doMock('../db/connection', () => ({ query: jest.fn().mockResolvedValue({ rows: [] }), pool: {} }));
  jest.doMock('../utils/logger', () => ({ info: () => {}, warn: () => {}, error: () => {} }));
  return require('../services/OsirisService');
}

afterEach(() => { jest.resetModules(); jest.clearAllMocks(); });

test('a box with nothing in it returns an empty collection, not an error', async () => {
  const service = load();
  const fc = await service.getLayer('earthquakes', { bbox: '-118.25,34.04,-118.24,34.05' });
  expect(fc.features).toEqual([]);
  expect(fc.meta).toMatchObject({ total: 1, returned: 0, withoutCoords: 0 });
});

test('rows with no readable coordinates at all are still reported as a shape problem', async () => {
  const service = load({ earthquakes: [{ place: 'nowhere' }], total: 1 });
  await expect(service.getLayer('earthquakes', { bbox: '-180,-90,180,90' })).rejects.toMatchObject({ code: 'UNRECOGNISED_SHAPE' });
});
