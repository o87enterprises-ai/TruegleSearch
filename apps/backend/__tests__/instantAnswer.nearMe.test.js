/**
 * The instant-answer card must not guess where you are.
 *
 * REPORTED: "coffee near me" produced a quick-results card for a coffee shop
 * in a random major US city. It was not random — it was whichever coffee shop
 * ranked first globally. The card is built from the TOP WEB RESULT's pagemap,
 * and this process has no position and never will: geolocation lives in the
 * browser and nothing sends it here.
 *
 * That is worse than an empty card, because a confident wrong answer costs a
 * journey to a shop in another state. A near-me question is answered by the
 * map the client opens, not by a guess from the server.
 *
 * These run the real route with the search service mocked, because the bug was
 * in the routing of the QUERY to a card type — not in any provider.
 */
const request = require('supertest');
const express = require('express');

// SearchService is a CLASS the route instantiates at module load, so the mock
// has to be a constructor — returning a plain object makes the route throw
// "SearchService is not a constructor" before a single test runs.
// The route calls performSearch() — not search() — and it returns the results
// ARRAY directly, not an envelope. Both details matter: a mock with the wrong
// method name makes every request 500, which looks like the feature failing
// rather than the mock.
const mockPerformSearch = jest.fn();
jest.mock('../services/SearchService', () => jest.fn().mockImplementation(() => ({
  performSearch: mockPerformSearch,
})));
const searchRouter = require('../routes/search');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/search', searchRouter);
  return app;
}

// A coffee shop that ranks well globally, with the rich pagemap that makes a
// local-business card look authoritative. This is the shape that was being
// served for "coffee near me" to somebody nowhere near it.
const COFFEE_RESULTS = [
  {
    title: 'Ninth Street Espresso — East Village',
    snippet: 'Coffee bar in New York City.',
    url: 'https://example-coffee.com/',
    domain: 'example-coffee.com',
    pagemap: {
      localbusiness: [{
        name: 'Ninth Street Espresso',
        address: '341 E 10th St, New York, NY',
        telephone: '+1-212-555-0100',
      }],
    },
  },
];

beforeEach(() => {
  mockPerformSearch.mockResolvedValue(COFFEE_RESULTS);
});
afterEach(() => jest.restoreAllMocks());

const ask = (query) => request(makeApp()).post('/api/search').send({ query });

describe('instant answers and "near me"', () => {
  it('refuses to build a card for a near-me query', async () => {
    const res = await ask('coffee near me');
    expect(res.status).toBe(200);
    // The results themselves still come back; it is only the CARD that is
    // withheld, because only the card claims to be the answer.
    expect(res.body.results.length).toBeGreaterThan(0);
    expect(res.body.instantAnswer).toBeNull();
  });

  it.each([
    'pharmacy nearby',
    'closest atm',
    'gas station around me',
    'restaurants close to me',
  ])('…and for "%s" too', async (query) => {
    const res = await ask(query);
    expect(res.body.instantAnswer).toBeNull();
  });

  it('still answers a query that NAMES the business', async () => {
    // "starbucks hours" is answerable from the top result precisely because
    // the query says which business it is about. Suppressing these too would
    // throw away the working half of the feature.
    const res = await ask('starbucks hours');
    expect(res.body.instantAnswer).not.toBeNull();
    expect(res.body.instantAnswer.type).toBe('local_business');
  });

  it('does not mistake an ordinary phrase for a location', async () => {
    // "near miss" contains "near". The boundary matters: over-matching here
    // silently removes working cards.
    const res = await ask('engineer near miss reporting');
    expect(res.body.instantAnswer?.type).not.toBe('near_me');
  });
});
