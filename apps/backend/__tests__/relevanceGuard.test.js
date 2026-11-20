/**
 * Off-topic web pages get one second look.
 *
 * The fixtures are the REAL results the live API returned on 2026-11-19 for
 * "lane county court house eugene oregon" (every row from Bing, every row about the word "lane"),
 * and the courthouse results the same query gets when asked of other engines.
 */
jest.mock('axios');
const axios = require('axios');

process.env.SEARXNG_URL = 'http://searx.test';
process.env.SEARXNG_PRIMARY = 'true';
const SearchService = require('../services/SearchService');
const { assess, significantTerms } = require('../utils/relevanceGuard');

const row = (engine, title, url, content) => ({ engine, engines: [engine], title, url, content });

const JUNK = [
  row('bing', 'Natural Gas - Kinder Morgan', 'https://www.kindermorgan.com/Operations/Natural-Gas/Index', 'Kinder Morgan operates natural gas pipelines.'),
  row('bing', 'Plus Size Clothing for Women | Lane Bryant', 'https://www.lanebryant.com/', 'The latest looks in plus size clothing for women are just a click away at Lane Bryant.'),
  row('bing', 'LANE Definition & Meaning - Merriam-Webster', 'https://www.merriam-webster.com/dictionary/lane', 'The meaning of LANE is a narrow passageway between fences or hedges.'),
  row('bing', 'Lane Boots - Shop Women Cowgirl Boots', 'https://laneboots.com/', 'Indulge in Lane Boots exclusive womens western boots.'),
  row('bing', 'Lane - Wikipedia', 'https://en.wikipedia.org/wiki/Lane', 'A traffic lane or travel lane is a lane for the movement of vehicles.'),
  row('bing', 'Lane Furniture Official Site | Recliners & Sofas USA', 'https://lanefurnitureco.com/', 'Lane Furniture official site. Shop American-made recliners.'),
  row('bing', 'LANE | English meaning - Cambridge Dictionary', 'https://dictionary.cambridge.org/dictionary/english/lane', 'a narrow road in the countryside or in a town.'),
  row('bing', 'Lane Southern Orchards | Georgia Pecans', 'https://lanesouthernorchards.com/', 'Georgia pecans, Southern food gifts and corporate gift baskets.'),
  row('bing', 'Park Lane Jewelry Official - Fashion Jewelry since 1955', 'https://parklanejewelry.com/', 'Inspired Jewelry Since 1955.'),
  row('bing', 'Lane Construction | Industrial Construction and Engineering', 'https://laneconstruct.com/', 'Lane delivers a more modern and connected United States.'),
];

const GOOD = [
  row('mojeek', 'Lane County Circuit Court - Case Lookup', 'https://www.courts.oregon.gov/courts/lane/Pages/default.aspx', 'Lane County Circuit Court, Lane County Courthouse, 125 E 8th Avenue, Eugene, Oregon.'),
  row('brave', 'Lane County Courthouse - Eugene, Oregon', 'https://www.lanecountyor.gov/government/county_departments/county_counsel/courthouse', 'The Lane County Courthouse in Eugene Oregon houses the circuit court.'),
  row('mojeek', 'Lane County Courthouse (Eugene) - Wikipedia', 'https://en.wikipedia.org/wiki/Lane_County_Courthouse', 'The Lane County Courthouse is a historic court house in Eugene, Oregon.'),
];

// A FULL on-topic page. GOOD alone is 3 rows, under SEARXNG_PRIMARY_MIN (5), which triggers the
// separate, older thin-page retry — not what the tests below are measuring.
const FULL_GOOD = [...GOOD, ...[4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => row('mojeek', `Lane County Courthouse info ${i}`, `https://example${i}.gov/lane-county-courthouse`, 'Lane County Courthouse in Eugene, Oregon.'))];

const FILTERS = { category: 'web', page: 1, perPage: 10, safeSearch: 'safe', bias: 'all', sortBy: 'relevance', dateRange: 'any' };

// Which fake engine set answers: the mainstream set and the instance default return the junk;
// the independent indexes return the courthouse.
let calls;
beforeEach(() => {
  calls = [];
  axios.get.mockReset();
  axios.get.mockImplementation(async (url, cfg) => {
    if (!String(url).startsWith('http://searx.test/search')) throw new Error(`unexpected ${url}`);
    const engines = cfg?.params?.engines;
    calls.push(engines || '(default)');
    return { data: { results: engines && engines.includes('mojeek') ? GOOD : JUNK } };
  });
});

describe('assess()', () => {
  const Q = 'lane county court house eugene oregon';

  test('the reported page is off-topic: every result matches only "lane"', () => {
    const v = assess(JUNK.map((r) => ({ title: r.title, url: r.url, snippet: r.content })), Q);
    expect(v.offTopic).toBe(true);
    expect(v.onTopic).toBe(0);
  });

  test('the courthouse results are on-topic, "court house" matching "courthouse"', () => {
    const v = assess(GOOD.map((r) => ({ title: r.title, url: r.url, snippet: r.content })), Q);
    expect(v.offTopic).toBe(false);
    expect(v.onTopic).toBe(3);
  });

  test('short queries are never judged — "weather" and "chat gpt" are navigational', () => {
    expect(assess(JUNK, 'weather').offTopic).toBe(false);
    expect(assess(JUNK, 'chat gpt').offTopic).toBe(false);
  });

  test('an empty page is not "off-topic" (the thin-page retry owns that case)', () => {
    expect(assess([], Q).offTopic).toBe(false);
  });

  test('stop words and plurals are not topic words', () => {
    expect(significantTerms('how to fix the courts of lane counties')).toEqual(['fix', 'court', 'lane', 'county']);
  });
});

describe('performSearch — off-topic second look', () => {
  const svc = () => new SearchService();

  test('junk from the mainstream engines is followed by an independent-index look, and the answer wins', async () => {
    const results = await svc().performSearch('lane county court house eugene oregon', FILTERS, 'blue-pill');
    expect(calls[0]).toBe('google,bing,duckduckgo,wikipedia');
    expect(calls.some((c) => c.includes('mojeek'))).toBe(true);
    const top3 = results.slice(0, 3).map((r) => r.url);
    expect(top3.every((u) => /court|lane_county|lanecountyor/i.test(u))).toBe(true);
    // Nothing was thrown away: the original rows are still on the page, below the answer.
    expect(results.some((r) => /lanebryant/.test(r.url))).toBe(true);
  });

  // The guard's own requests are the independent set ("mojeek,…") and the unscoped default. Other
  // SearXNG calls in the flow (the joined-brand look-up, the thin-page retry) are older behaviour.
  const guardRequests = () => calls.filter((c) => c.includes('mojeek') || c === '(default)');

  test('a page that is already on-topic adds no second look', async () => {
    axios.get.mockImplementation(async (url, cfg) => {
      if (!String(url).startsWith('http://searx.test/search')) throw new Error(`unexpected ${url}`);
      calls.push(cfg?.params?.engines || '(default)');
      return { data: { results: FULL_GOOD } };
    });
    await svc().performSearch('lane county court house eugene oregon', FILTERS, 'blue-pill');
    expect(guardRequests()).toEqual([]);
  });

  test('a short query never triggers a second look', async () => {
    await svc().performSearch('weather', FILTERS, 'blue-pill');
    expect(guardRequests()).toEqual([]);
  });

  test('Rabbit Hole already uses the independent indexes: no second look', async () => {
    axios.get.mockImplementation(async (url, cfg) => {
      if (!String(url).startsWith('http://searx.test/search')) throw new Error(`unexpected ${url}`);
      calls.push(cfg?.params?.engines || '(default)');
      return { data: { results: FULL_GOOD } };
    });
    await svc().performSearch('lane county court house eugene oregon', FILTERS, 'red-pill');
    expect(calls).toHaveLength(1);
  });

  test('if the second look also fails the original page stands', async () => {
    axios.get.mockImplementation(async (url, cfg) => {
      calls.push(cfg?.params?.engines || '(default)');
      if (calls.length > 1) throw new Error('boom');
      return { data: { results: JUNK } };
    });
    const results = await svc().performSearch('lane county court house eugene oregon', FILTERS, 'blue-pill');
    expect(results.length).toBeGreaterThan(0);
  });
});
