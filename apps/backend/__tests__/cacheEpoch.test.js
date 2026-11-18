const { epochId, isRefreshHour } = require('../utils/cacheEpoch');
const at = (iso) => Date.parse(iso);

describe('the cache turns over at 6:00 AM Pacific', () => {
  test('winter (PST, UTC-8): 6 AM is 14:00 UTC', () => {
    expect(epochId(at('2026-11-09T13:59:59Z'))).toBe('2026-11-08'); // 5:59:59 AM: still yesterday's cache
    expect(epochId(at('2026-11-09T14:00:00Z'))).toBe('2026-11-09'); // 6:00:00 AM: the new one
    expect(epochId(at('2026-11-10T13:59:59Z'))).toBe('2026-11-09'); // all day, until the next 6 AM
  });

  test('summer (PDT, UTC-7): 6 AM is 13:00 UTC', () => {
    expect(epochId(at('2026-07-15T12:59:59Z'))).toBe('2026-07-14');
    expect(epochId(at('2026-07-15T13:00:00Z'))).toBe('2026-07-15');
  });

  test('daylight-saving days: spring forward (Mar 8) and fall back (Nov 1)', () => {
    expect(epochId(at('2026-03-08T12:59:59Z'))).toBe('2026-03-07'); // 5:59 PDT
    expect(epochId(at('2026-03-08T13:00:00Z'))).toBe('2026-03-08'); // 6:00 PDT
    expect(epochId(at('2026-11-01T13:59:59Z'))).toBe('2026-10-31'); // 5:59 PST
    expect(epochId(at('2026-11-01T14:00:00Z'))).toBe('2026-11-01'); // 6:00 PST
  });

  test('midnight Pacific is still the previous 6 AM, not a new day', () => {
    expect(epochId(at('2026-11-09T08:00:00Z'))).toBe('2026-11-08'); // 00:00 PST Nov 9
    expect(epochId(at('2026-11-09T07:59:59Z'))).toBe('2026-11-08');
  });

  test('month and year boundaries', () => {
    expect(epochId(at('2026-12-31T14:00:00Z'))).toBe('2026-12-31');
    expect(epochId(at('2027-01-01T13:59:59Z'))).toBe('2026-12-31');
    expect(epochId(at('2027-01-01T14:00:00Z'))).toBe('2027-01-01');
  });
});

describe('isRefreshHour is the 6 o\'clock hour in Pacific time, whatever the season', () => {
  test('winter: 14:00-14:59 UTC only', () => {
    expect(isRefreshHour(at('2026-11-09T13:59:59Z'))).toBe(false);
    expect(isRefreshHour(at('2026-11-09T14:00:00Z'))).toBe(true);
    expect(isRefreshHour(at('2026-11-09T14:59:59Z'))).toBe(true);
    expect(isRefreshHour(at('2026-11-09T15:00:00Z'))).toBe(false);
  });
  test('summer: 13:00-13:59 UTC only', () => {
    expect(isRefreshHour(at('2026-07-15T12:59:59Z'))).toBe(false);
    expect(isRefreshHour(at('2026-07-15T13:00:00Z'))).toBe(true);
    expect(isRefreshHour(at('2026-07-15T13:59:59Z'))).toBe(true);
    expect(isRefreshHour(at('2026-07-15T14:00:00Z'))).toBe(false);
  });
  test('exactly one of the two scheduled UTC hours matches on any given day', () => {
    for (const day of ['2026-01-15', '2026-03-07', '2026-03-08', '2026-03-09', '2026-07-15', '2026-10-31', '2026-11-01', '2026-11-02']) {
      const a = isRefreshHour(at(`${day}T13:30:00Z`));
      const b = isRefreshHour(at(`${day}T14:30:00Z`));
      expect([a, b].filter(Boolean)).toHaveLength(1);
    }
  });
});
