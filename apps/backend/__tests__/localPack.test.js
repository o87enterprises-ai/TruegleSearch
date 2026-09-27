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

// ── Businesses by name ───────────────────────────────────────────────────────
// Reported 2026-09-27: "O'Reilly's near me" and "Autozone cottage grove" got
// web links and no listings, because only trade words were recognised.
describe('business and brand queries', () => {
  const { _internals: { parseBusinessQuery, squash } } = require('../services/LocalPackService');
  const store = (name, address, distance, cats = ['auto parts']) => ({
    name, address, distance, category: cats, phone: '+1 541-942-0000', position: { lat: 43.8, lon: -123.05 }, url: 'oreillyauto.com',
  });

  test('parses the name, drops the possessive and "near me"', () => {
    expect(parseBusinessQuery("O'Reilly's near me")).toMatchObject({ tokens: ["O'Reilly"], nearMe: true });
    expect(squash("O'Reilly's")).toBe('oreilly');
    expect(parseBusinessQuery('near me')).toBeNull();
    // Chat phrasing.
    expect(parseBusinessQuery("where's the nearest O'Reilly's?")).toMatchObject({ tokens: ["O'Reilly"], nearMe: true });
    expect(parseBusinessQuery('is there an AutoZone near me')).toMatchObject({ tokens: ['AutoZone'], nearMe: true });
  });

  test('"O\'Reilly\'s near me" lists every branch, nearest first', async () => {
    TomTom.searchPlaces.mockResolvedValue([
      store("O'Reilly Auto Parts", '1589 Lee St', 5200),
      store("O'Reilly Auto Parts", '321 W Irving Park Rd', 1200),
      store('Oreilly Law Group', '9 Main St', 800, ['legal services']),
      store('NAPA Auto Parts', '4 Elm St', 300),
    ]);
    const pack = await resolve("O'Reilly's near me", { lat: 43.8, lng: -123.05 });
    // Both branches survive (dedupe is name + address); NAPA does not (no
    // "oreilly" in its name). The chain ranks ahead of the nearer one-off
    // that merely shares the word, then by distance.
    expect(pack.places.map((p) => p.address)).toEqual(['321 W Irving Park Rd', '1589 Lee St', '9 Main St']);
    expect(pack.label).toBe("O'Reilly Auto Parts locations");
    expect(pack.where).toBe('Near you');
    expect(TomTom.searchPlaces.mock.calls[0][0]).toBe("O'Reilly");
  });

  test('"Autozone cottage grove": one search; the name holds "autozone", the ADDRESS "cottage grove"', async () => {
    TomTom.searchPlaces.mockResolvedValue([
      store('AutoZone Auto Parts', '801 Row River Rd, Cottage Grove, OR 97424', null),
      store('AutoZone Auto Parts', '7240 E Point Douglas Rd, Cottage Grove, MN 55016', null),
      store('AutoZone Auto Parts', '2255 W 11th Ave, Eugene, OR 97402', null),
      store('Cottage Grove Auto Body', '12 Main St, Cottage Grove, OR 97424', null),
      store('AutoZone Auto Parts', '8127 South Cottage Grove Avenue, Chicago, IL 60619', null),
    ]);
    const pack = await resolve('Autozone cottage grove', {});
    expect(TomTom.searchPlaces).toHaveBeenCalledTimes(1);
    expect(TomTom.searchPlaces.mock.calls[0][0]).toBe('Autozone cottage grove');
    expect(TomTom.geocode).not.toHaveBeenCalled();
    // Both Cottage Groves (no position to choose between them); not Eugene,
    // not the body shop that merely has the town in its name.
    expect(pack.places.map((p) => p.address)).toEqual([
      '801 Row River Rd, Cottage Grove, OR 97424', '7240 E Point Douglas Rd, Cottage Grove, MN 55016']);
    expect(pack.where).toBe('Cottage Grove, OR');
  });

  test('"auto parts near me" is a KIND of shop: nearest first, whoever runs it', async () => {
    TomTom.searchPlaces.mockResolvedValue([
      store("O'Reilly Auto Parts", '1800 E Main St', 900),
      store("O'Reilly Auto Parts", '2020 W 11th Ave', 28000),
      store('NAPA Auto Parts', '4 Elm St', 400, ['auto parts']),
      store('AutoZone Auto Parts', '801 Row River Rd', 700),
    ]);
    const pack = await resolve('auto parts near me', { lat: 43.8, lng: -123.05 });
    expect(pack.places.map((p) => p.name)).toEqual(['NAPA Auto Parts', 'AutoZone Auto Parts', "O'Reilly Auto Parts", "O'Reilly Auto Parts"]);
    expect(pack.label).toBe('Auto parts');
  });

  test('a general query costs at most one place search and shows nothing', async () => {
    TomTom.searchPlaces.mockResolvedValue([store('Swift Tire', '5 Oak St', 100)]);
    const pack = await resolve('taylor swift tour dates', {});
    expect(pack).toBeNull();
    expect(TomTom.searchPlaces).toHaveBeenCalledTimes(1);
    expect(TomTom.geocode).not.toHaveBeenCalled();
  });

  test('"near me" with no position looks nothing up', async () => {
    expect(await resolve("O'Reilly's near me", {})).toBeNull();
    expect(TomTom.searchPlaces).not.toHaveBeenCalled();
  });

  test('questions never trigger a lookup', async () => {
    expect(await resolve('what is autozone', {})).toBeNull();
    expect(TomTom.searchPlaces).not.toHaveBeenCalled();
  });
});
