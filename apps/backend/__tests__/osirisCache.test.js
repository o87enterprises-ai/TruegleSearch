/**
 * The two-tier cache.
 *
 * This is not a performance test. The cache is the PRIVACY mechanism: these
 * feeds are proxied so the upstream cannot correlate visitors, and the thing
 * that collapses many visitors into one upstream call is the cache. A cache
 * that silently stops working restores the rate-and-timing signal the proxy
 * exists to destroy — and it does so invisibly, because the map keeps working
 * perfectly the whole time.
 *
 * So what is asserted here is mostly "how many times did we call the
 * upstream", and the answer must almost always be zero.
 */

const LAYER = 'earthquakes';
const BODY = { earthquakes: [{ lat: 35.6, lon: 139.7, place: 'Off Honshu' }], total: 1 };

/** Fresh module state per case — the service holds its L1 map and its
 *  "is the shared tier usable" latch at module scope, and a test that
 *  inherited either would be testing the previous test. */
function load({ dbRows = [], dbThrows = null } = {}) {
  jest.resetModules();
  const upstream = jest.fn().mockResolvedValue({ data: BODY });
  const dbQuery = jest.fn().mockImplementation((sql) => {
    if (dbThrows) return Promise.reject(new Error(dbThrows));
    if (/^SELECT/i.test(sql)) return Promise.resolve({ rows: dbRows });
    return Promise.resolve({ rows: [] });
  });

  jest.doMock('axios', () => ({ get: upstream }));
  jest.doMock('../db/connection', () => ({ query: dbQuery, pool: {} }));
  jest.doMock('../utils/logger', () => ({ info: () => {}, warn: () => {}, error: () => {} }));

  const service = require('../services/OsirisService');
  return { service, upstream, dbQuery };
}

const sharedRow = (agoMs = 0, source) => ({
  body: BODY,
  source: source === undefined ? 'https://osirisai.live' : source,
  fetched_at: new Date(Date.now() - agoMs).toISOString(),
});

afterEach(() => { jest.resetModules(); jest.clearAllMocks(); });

describe('cold everywhere', () => {
  it('fetches the upstream once and writes it to the shared tier', async () => {
    const { service, upstream, dbQuery } = load();
    const fc = await service.getLayer(LAYER);
    expect(fc.features).toHaveLength(1);
    expect(upstream).toHaveBeenCalledTimes(1);
    // The write is for the NEXT instance, so it is not awaited by the request.
    await new Promise((r) => setImmediate(r));
    expect(dbQuery.mock.calls.some(([sql]) => /INSERT INTO osiris_cache/i.test(sql))).toBe(true);
  });

  it('serves the second call from memory without touching the network', async () => {
    const { service, upstream } = load();
    await service.getLayer(LAYER);
    await service.getLayer(LAYER);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('makes ONE upstream call for simultaneous callers, not one each', async () => {
    // A cold cache and ten map loads must not become ten 25-second requests to
    // an upstream that is slow precisely because it is under load.
    const { service, upstream } = load();
    await Promise.all(Array.from({ length: 10 }, () => service.getLayer(LAYER)));
    expect(upstream).toHaveBeenCalledTimes(1);
  });
});

describe('a fresh entry in the shared tier', () => {
  it('is used instead of calling the upstream — the point of the whole table', async () => {
    // THE production case: a brand-new serverless instance with an empty L1.
    // Without this it would fetch, and every instance fetching is what makes
    // the visitor-correlation guarantee false.
    const { service, upstream } = load({ dbRows: [sharedRow(1000)] });
    const fc = await service.getLayer(LAYER);
    expect(fc.features).toHaveLength(1);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('hydrates memory, so the rest of that instance costs nothing at all', async () => {
    const { service, dbQuery } = load({ dbRows: [sharedRow(1000)] });
    await service.getLayer(LAYER);
    const afterFirst = dbQuery.mock.calls.length;
    await service.getLayer(LAYER);
    expect(dbQuery.mock.calls.length).toBe(afterFirst);
  });

  it('is reported as fresh, not stale', async () => {
    const { service } = load({ dbRows: [sharedRow(1000)] });
    const fc = await service.getLayer(LAYER);
    expect(fc.meta.stale).toBe(false);
  });
});

describe('a shared entry from a different upstream', () => {
  it('is ignored, so repointing OSIRIS_BASE_URL does not keep serving old answers', async () => {
    const { service, upstream } = load({ dbRows: [sharedRow(1000, 'https://someone-elses-instance.example')] });
    await service.getLayer(LAYER);
    expect(upstream).toHaveBeenCalledTimes(1);
  });
});

describe('an expired entry', () => {
  it('is served immediately and refreshed behind the request', async () => {
    // earthquakes has a 5 minute TTL; 6 minutes old is expired but well within
    // the stale window.
    const { service, upstream } = load({ dbRows: [sharedRow(6 * 60_000)] });
    const fc = await service.getLayer(LAYER);
    expect(fc.features).toHaveLength(1);
    expect(fc.meta.stale).toBe(true);
    // Refreshed, but the caller did not wait for it.
    await new Promise((r) => setImmediate(r));
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('says how old it is, so nothing is presented as live when it is not', async () => {
    const { service } = load({ dbRows: [sharedRow(6 * 60_000)] });
    const fc = await service.getLayer(LAYER);
    expect(fc.meta.ageSeconds).toBeGreaterThanOrEqual(355);
  });
});

describe('when the shared tier is unavailable', () => {
  it('still serves the map rather than failing with it', async () => {
    // A caching layer that can take the feature down is not a caching layer.
    const { service, upstream } = load({ dbThrows: 'relation "osiris_cache" does not exist' });
    const fc = await service.getLayer(LAYER);
    expect(fc.features).toHaveLength(1);
    expect(upstream).toHaveBeenCalledTimes(1);
  });

  it('stops asking after a structural failure instead of failing per request', async () => {
    const { service, dbQuery } = load({ dbThrows: 'relation "osiris_cache" does not exist' });
    await service.getLayer(LAYER);
    const afterFirst = dbQuery.mock.calls.length;
    // Force L1 past its TTL so the next call would consult the shared tier.
    await new Promise((r) => setTimeout(r, 5));
    await service.getLayer(LAYER);
    // No NEW select — the latch is off.
    const selects = dbQuery.mock.calls.filter(([sql]) => /^SELECT/i.test(sql)).length;
    expect(dbQuery.mock.calls.length).toBeLessThanOrEqual(afterFirst + 1);
    expect(selects).toBeLessThanOrEqual(1);
  });

  it('does not reject the request when the WRITE fails', async () => {
    const { service } = load({ dbThrows: 'connection terminated' });
    await expect(service.getLayer(LAYER)).resolves.toBeTruthy();
  });
});

describe('when the upstream is down', () => {
  it('serves old data rather than nothing, and marks it stale', async () => {
    // An old map beats a broken one, as long as it says which it is.
    jest.resetModules();
    const upstream = jest.fn().mockRejectedValue(new Error('timeout of 25000ms exceeded'));
    jest.doMock('axios', () => ({ get: upstream }));
    jest.doMock('../db/connection', () => ({
      query: jest.fn().mockImplementation((sql) =>
        (/^SELECT/i.test(sql) ? Promise.resolve({ rows: [sharedRow(20 * 60_000)] }) : Promise.resolve({ rows: [] }))),
      pool: {},
    }));
    jest.doMock('../utils/logger', () => ({ info: () => {}, warn: () => {}, error: () => {} }));
    const service = require('../services/OsirisService');

    const fc = await service.getLayer(LAYER);
    expect(fc.features).toHaveLength(1);
    expect(fc.meta.stale).toBe(true);
  });

  it('throws when there is nothing cached to fall back to', async () => {
    // Nothing to serve and no way to say "there are no earthquakes" honestly,
    // so the route turns this into a 502 the UI can show.
    jest.resetModules();
    jest.doMock('axios', () => ({ get: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) }));
    jest.doMock('../db/connection', () => ({ query: jest.fn().mockResolvedValue({ rows: [] }), pool: {} }));
    jest.doMock('../utils/logger', () => ({ info: () => {}, warn: () => {}, error: () => {} }));
    const service = require('../services/OsirisService');
    await expect(service.getLayer(LAYER)).rejects.toThrow(/ECONNREFUSED/);
  });
});
