/**
 * What Truegle keeps about a search — see services/SearchLog.js. The privacy
 * policy says exactly this, so these are the promises, not implementation detail.
 */
const { shouldStore, recordSearch, purge, RETENTION_DAYS, PURGE_ONE_IN } = require('../services/SearchLog');

const fakeDb = () => { const calls = []; return { calls, query: jest.fn(async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; }) }; };

describe('shouldStore — what may be kept', () => {
  it.each([
    ['trailer park boys', 'blue-pill'],
    ['michael jackson', 'red-pill'],
    ['how to repair a bike chain', 'green'],
    ['  Climate   Change  ', 'purple'],
  ])('keeps an ordinary search: %s', (q, mode) => expect(shouldStore(q, mode)).toBe(true));

  it.each([
    ['dan@example.com', 'blue-pill', 'an email'],
    ['danoden 541-555-0123', 'blue-pill', 'a phone number'],
    ['(541) 555-0123', 'blue-pill', 'a phone number in brackets'],
    ['123-45-6789', 'blue-pill', 'a US SSN'],
    ['4111 1111 1111 1111', 'blue-pill', 'a card number'],
    ['1600 pennsylvania avenue', 'blue-pill', 'a street address'],
    ['192.168.1.1', 'blue-pill', 'an IP address'],
    ['https://example.com/private/page', 'blue-pill', 'a pasted link'],
    ['www.example.com', 'blue-pill', 'a bare link'],
  ])('never keeps %s (%s)', (q, mode) => expect(shouldStore(q, mode)).toBe(false));

  it('never keeps anything from Ocean / OSINT mode, however harmless it looks', () => {
    expect(shouldStore('example domain', 'ocean')).toBe(false);
    expect(shouldStore('example domain', 'OSINT')).toBe(false);
  });

  it('never keeps what is too short or too long to be a trending pill', () => {
    expect(shouldStore('ai', 'blue-pill')).toBe(false);
    expect(shouldStore('', 'blue-pill')).toBe(false);
    expect(shouldStore(null, 'blue-pill')).toBe(false);
    expect(shouldStore('x'.repeat(121), 'blue-pill')).toBe(false);
    expect(shouldStore('x'.repeat(120), 'blue-pill')).toBe(true);
  });
});

describe('recordSearch', () => {
  it('stores the lower-cased text and the mode — and nothing that identifies anyone', async () => {
    const db = fakeDb();
    await recordSearch('  Trailer   Park BOYS ', 'blue-pill', db, () => 0.99);
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].sql).toMatch(/INSERT INTO search_queries \(query, mode\)/);
    expect(db.calls[0].params).toEqual(['trailer park boys', 'blue-pill']);
  });

  it('writes nothing for a search that must not be kept', async () => {
    const db = fakeDb();
    await recordSearch('dan@example.com', 'blue-pill', db, () => 0.99);
    await recordSearch('some domain', 'ocean', db, () => 0.99);
    expect(db.calls).toHaveLength(0);
  });

  it('cleans up on roughly one write in fifty, whether or not it stored anything', async () => {
    const db = fakeDb();
    await recordSearch('trailer park boys', 'blue-pill', db, () => 0);
    expect(db.calls.map((c) => (c.sql.startsWith('DELETE') ? 'purge' : 'insert'))).toEqual(['insert', 'purge']);
    const quiet = fakeDb();
    await recordSearch('trailer park boys', 'blue-pill', quiet, () => 1 / PURGE_ONE_IN + 0.001);
    expect(quiet.calls).toHaveLength(1);
  });

  it('never throws and never blocks a search, even if the database is down', async () => {
    const db = { query: jest.fn(async () => { throw new Error('db down'); }) };
    await expect(recordSearch('trailer park boys', 'blue-pill', db, () => 0)).resolves.toBeUndefined();
  });
});

describe('purge', () => {
  it('deletes past the retention window, plus anything that should never have been kept', async () => {
    const db = fakeDb();
    await purge(db);
    const { sql, params } = db.calls[0];
    expect(params).toEqual([RETENTION_DAYS]);
    expect(RETENTION_DAYS).toBe(7);
    expect(sql).toMatch(/created_at < NOW\(\) - make_interval\(days => \$1\)/);
    expect(sql).toMatch(/mode IN \('ocean', 'osint'\)/);
    expect(sql).toMatch(/@/);            // emails
    expect(sql).toMatch(/\[0-9\]\{3\}/); // phone numbers
    expect(sql).toMatch(/https\?:\/\//); // links
  });
});
