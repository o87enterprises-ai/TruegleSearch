const { epochId, isRefreshHour } = require('../utils/cacheEpoch');
const at = (iso) => Date.parse(iso);

describe('the cache turns over at 9:00 AM Pacific', () => {
  test('winter (PST, UTC-8): 9 AM is 17:00 UTC', () => {
    expect(epochId(at('2026-11-09T16:59:59Z'))).toBe('2026-11-08'); // 8:59:59 AM: still yesterday's cache
    expect(epochId(at('2026-11-09T17:00:00Z'))).toBe('2026-11-09'); // 9:00:00 AM: the new one
    expect(epochId(at('2026-11-10T16:59:59Z'))).toBe('2026-11-09'); // all day, until the next 9 AM
  });

  test('summer (PDT, UTC-7): 9 AM is 16:00 UTC', () => {
    expect(epochId(at('2026-07-15T15:59:59Z'))).toBe('2026-07-14');
    expect(epochId(at('2026-07-15T16:00:00Z'))).toBe('2026-07-15');
  });

  test('daylight-saving days: spring forward (Mar 8) and fall back (Nov 1)', () => {
    expect(epochId(at('2026-03-08T15:59:59Z'))).toBe('2026-03-07'); // 8:59 PDT
    expect(epochId(at('2026-03-08T16:00:00Z'))).toBe('2026-03-08'); // 9:00 PDT
    expect(epochId(at('2026-11-01T16:59:59Z'))).toBe('2026-10-31'); // 8:59 PST
    expect(epochId(at('2026-11-01T17:00:00Z'))).toBe('2026-11-01'); // 9:00 PST
  });

  test('midnight Pacific is still the previous 9 AM, not a new day', () => {
    expect(epochId(at('2026-11-09T08:00:00Z'))).toBe('2026-11-08'); // 00:00 PST Nov 9
    expect(epochId(at('2026-11-09T07:59:59Z'))).toBe('2026-11-08');
  });

  test('month and year boundaries', () => {
    expect(epochId(at('2026-12-31T17:00:00Z'))).toBe('2026-12-31');
    expect(epochId(at('2027-01-01T16:59:59Z'))).toBe('2026-12-31');
    expect(epochId(at('2027-01-01T17:00:00Z'))).toBe('2027-01-01');
  });
});

describe('isRefreshHour is the 9 o\'clock hour in Pacific time, whatever the season', () => {
  test('winter: 17:00-17:59 UTC only', () => {
    expect(isRefreshHour(at('2026-11-09T16:59:59Z'))).toBe(false);
    expect(isRefreshHour(at('2026-11-09T17:00:00Z'))).toBe(true);
    expect(isRefreshHour(at('2026-11-09T17:59:59Z'))).toBe(true);
    expect(isRefreshHour(at('2026-11-09T18:00:00Z'))).toBe(false);
  });
  test('summer: 16:00-16:59 UTC only', () => {
    expect(isRefreshHour(at('2026-07-15T15:59:59Z'))).toBe(false);
    expect(isRefreshHour(at('2026-07-15T16:00:00Z'))).toBe(true);
    expect(isRefreshHour(at('2026-07-15T16:59:59Z'))).toBe(true);
    expect(isRefreshHour(at('2026-07-15T17:00:00Z'))).toBe(false);
  });
  test('exactly one of the two scheduled UTC hours matches on any given day', () => {
    for (const day of ['2026-01-15', '2026-03-07', '2026-03-08', '2026-03-09', '2026-07-15', '2026-10-31', '2026-11-01', '2026-11-02']) {
      const a = isRefreshHour(at(`${day}T16:30:00Z`));
      const b = isRefreshHour(at(`${day}T17:30:00Z`));
      expect([a, b].filter(Boolean)).toHaveLength(1);
    }
  });
});
