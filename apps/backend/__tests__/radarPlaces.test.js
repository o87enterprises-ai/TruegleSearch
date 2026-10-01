/**
 * Radar place search: never send a request Radar is bound to refuse.
 * Radar answers 400 "At least one value must be present: chains, categories,
 * groups" — which reached the map as a 500 on every non-chain autocomplete.
 */
const RadarService = require('../services/RadarService');

const svc = () => {
  const s = Object.create(Object.getPrototypeOf(RadarService));
  s.axiosInstance = { get: jest.fn(async () => ({ data: { places: [{ name: 'Starbucks' }], meta: { code: 200 } } })) };
  return s;
};
const near = { latitude: 44.05, longitude: -123.09 };

describe('RadarService.searchPlaces', () => {
  it('asks Radar nothing when there is nothing it can search by', async () => {
    const s = svc();
    const r = await s.searchPlaces(near, { categories: '', limit: 5 });
    expect(r).toEqual(expect.objectContaining({ success: true, places: [] }));
    expect(s.axiosInstance.get).not.toHaveBeenCalled();
  });
  it('sends a typed chain name as Radar\'s slug', async () => {
    const s = svc();
    await s.searchPlaces(near, { chains: '  Taco Bell ' });
    expect(s.axiosInstance.get.mock.calls[0][1].params.chains).toBe('taco-bell');
  });
  it('passes categories through', async () => {
    const s = svc();
    const r = await s.searchPlaces(near, { categories: ['coffee-shop'] });
    expect(s.axiosInstance.get.mock.calls[0][1].params.categories).toEqual(['coffee-shop']);
    expect(r.places).toHaveLength(1);
  });
});
