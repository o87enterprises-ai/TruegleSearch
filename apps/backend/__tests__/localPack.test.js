/**
 * The inline Truegle Maps card: "eugene oregon patent lawyers" → local firms,
 * each with a phone number. TomTom is mocked with the real Eugene data it
 * returned for "law firm" on 2026-09-24.
 */
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../services/TomTomService', () => ({ geocode: jest.fn(), searchPlaces: jest.fn() }));

const TomTom = require('../services/TomTomService');
const { resolve, _internals: { parseLocalQuery, locationWindows, mentionedIn, explains } } = require('../services/LocalPackService');

const place = (name, url, distance, cats = ['company', 'legal services']) => ({
  name, url, distance, category: cats, phone: '+1 541-000-0000', address: `${name} St, Eugene, OR`, position: { lat: 44.05, lon: -123.08 },
});
const EUGENE_LAW = [
  place('Luvaas Cobb', 'luvaascobb.com', 102),
  place('Hershner Hunter', 'www.hershnerhunter.com', 319),
  place('Cascade Title', 'www.cascadetitle.com', 337),
  place('Financial Advisors - U.S. Bancorp Investments', 'www.usbank.com', 524),
  place('Diment Law Office', 'attorneyseugene.com', 467),
  place('Sawyer House', null, 50, ['company', 'restaurant']),
];

beforeEach(() => {
  jest.clearAllMocks();
  TomTom.geocode.mockImplementation(async (text) => (
    // Fuzzy like the real geocoder: "eugene oregon patent" also comes back
    // as Eugene — which is exactly what must not swallow the specialty.
    /eugene/.test(text)
      ? [{ type: 'Geography', address: 'Eugene, OR', position: { lat: 44.0521, lon: -123.0868 } }]
      : [{ type: 'Street', address: `${text} St`, position: { lat: 1, lon: 1 } }]
  ));
  TomTom.searchPlaces.mockResolvedValue(EUGENE_LAW);
});

describe('parseLocalQuery', () => {
  it('finds the service and leaves town + specialty', () => {
    const p = parseLocalQuery('eugene oregon patent lawyers');
    expect(p.service.label).toBe('Lawyers');
    expect(p.rest).toEqual(['eugene', 'oregon', 'patent']);
  });
  it('drops filler words and recognises near me', () => {
    const p = parseLocalQuery('best plumber near me');
    expect(p.service.label).toBe('Plumbers');
    expect(p.rest).toEqual([]);
    expect(p.nearMe).toBe(true);
  });
  it('is not a local query without a service word', () => {
    expect(parseLocalQuery('how do tides work')).toBeNull();
  });
});

it('tries the longest town-shaped windows first, at either end', () => {
  expect(locationWindows(['eugene', 'oregon', 'patent']).map((w) => w.join(' ')).slice(0, 3))
    .toEqual(['eugene oregon patent', 'eugene oregon', 'oregon patent']);
});

describe('resolve', () => {
  it('geocodes the town out of the query and keeps the rest as the specialty', async () => {
    const pack = await resolve('eugene oregon patent lawyers', {});
    expect(pack.where).toBe('Eugene, OR');
    expect(pack.label).toBe('Patent lawyers');
    expect(TomTom.searchPlaces.mock.calls[0][0]).toBe('patent law firm');
  });

  it('lists only legal businesses with a phone — no title company, bank or restaurant', async () => {
    const pack = await resolve('eugene oregon patent lawyers', {});
    const names = pack.places.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['Luvaas Cobb', 'Hershner Hunter', 'Diment Law Office']));
    expect(names).not.toEqual(expect.arrayContaining(['Cascade Title']));
    expect(names.some((n) => /Bancorp|Sawyer/.test(n))).toBe(false);
    expect(pack.places.every((p) => p.phone)).toBe(true);
    expect(pack.places.length).toBeLessThanOrEqual(6);
  });

  it('puts a firm the web results mention first, and marks it', async () => {
    const pack = await resolve('patent lawyers eugene oregon', { domains: ['hershnerhunter.com'] }); // town at the end, too
    expect(pack.places[0]).toMatchObject({ name: 'Hershner Hunter', mentioned: true, website: 'https://www.hershnerhunter.com' });
  });

  it('shows nothing when it cannot tell where (no town, no position)', async () => {
    TomTom.geocode.mockResolvedValue([]);
    expect(await resolve('patent lawyers', {})).toBeNull();
  });

  it('uses the visitor position for "near me"', async () => {
    const pack = await resolve('lawyer near me', { lat: 44.05, lng: -123.08 });
    expect(pack.where).toBe('Near you');
    expect(TomTom.searchPlaces.mock.calls[0][1]).toMatchObject({ lat: 44.05, lon: -123.08 });
  });
});

it('matches a mention by distinctive name words, not by "law office"', () => {
  expect(mentionedIn({ name: 'Diment Law Office', url: null }, { titles: ['diment law office — eugene attorneys'] })).toBe(true);
  expect(mentionedIn({ name: 'Diment Law Office', url: null }, { titles: ['some law office in eugene'] })).toBe(false);
});

it('does not count a query word (the town) as a mention', () => {
  expect(mentionedIn({ name: 'Eugene DUI Attorneys', url: null }, { titles: ['patent lawyers in eugene, oregon'] }, ['eugene', 'oregon', 'patent'])).toBe(false);
});

it('only accepts a town match that accounts for every word', () => {
  const eugene = { address: 'Eugene, OR' };
  expect(explains(eugene, ['eugene', 'oregon'])).toBe(true);
  expect(explains(eugene, ['eugene', 'oregon', 'patent'])).toBe(false);
});
