/**
 * The player's automatic health beacons — the no-tap-required version of the
 * mailto Report button (POST /api/player/diagnostics), and the owner's
 * periodic check of them (GET /api/admin/player-health).
 *
 * The privacy rule under test, not just the plumbing: migrations/
 * 025_player_health.sql says this table is "deliberately incapable of
 * profiling anyone" the same way media_signals is — no user, session, IP or
 * raw User-Agent column. These tests prove the WRITE PATH actually honors
 * that, not just that the table definition says so.
 */
const request = require('supertest');
const express = require('express');

const mockQuery = jest.fn();
jest.mock('../db/connection', () => ({ query: (...a) => mockQuery(...a) }));

const { PlayerHealthService, REASONS, cleanTrace, _resetColumns } = require('../services/PlayerHealthService');
const playerRouter = require('../routes/player');
const adminRouter = require('../routes/admin');

beforeEach(() => { mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [] }); _resetColumns(); });

// The service issues a one-time ALTER (adds the 026 columns) before its first
// write; these helpers look at the INSERT only.
const inserts = () => mockQuery.mock.calls.filter(([sql]) => /INSERT INTO player_health_events/.test(sql));
const insertArgs = () => inserts()[0][1];

function makeApp(router, path) {
  const app = express();
  app.use(express.json());
  app.use(path, router);
  return app;
}

describe('PlayerHealthService.record', () => {
  it('writes every field the beacon can legitimately carry', async () => {
    const r = await PlayerHealthService.record({
      kind: 'youtube', reason: 'silent', errorCode: '150', heard: false, muted: true,
      platform: 'android', connection: '4g',
    });
    expect(r.ok).toBe(true);
    expect(inserts()).toHaveLength(1);
    expect(insertArgs()).toEqual(['youtube', 'silent', '150', false, true, 'android', '4g', null, null, null]);
  });

  it('every reason the player actually sends is accepted', async () => {
    for (const reason of REASONS) {
      mockQuery.mockClear();
      const r = await PlayerHealthService.record({ reason, kind: 'youtube' });
      expect(r.ok).toBe(true);
    }
  });

  it('rejects an out-of-enum reason without touching the database', async () => {
    const r = await PlayerHealthService.record({ reason: 'DROP TABLE player_health_events' });
    expect(r.ok).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('the new flight-recorder reasons are accepted', () => {
    for (const r of ['unmute_rejected', 'autonext_empty', 'autonext_repeat', 'mode_fail']) expect(REASONS.has(r)).toBe(true);
  });

  it('a missing reason is also rejected — it is the one required field', async () => {
    expect((await PlayerHealthService.record({ kind: 'youtube' })).ok).toBe(false);
    expect((await PlayerHealthService.record()).ok).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('an out-of-enum kind or platform is dropped to null/other, never passed through raw', async () => {
    await PlayerHealthService.record({ reason: 'silent', kind: '<script>', platform: 'whatever the client claims' });
    const args = insertArgs();
    expect(args[0]).toBeNull();          // kind
    expect(args[5]).toBe('other');       // platform falls back, never echoes client text
  });

  it('an oversized error code is capped, not rejected outright', async () => {
    await PlayerHealthService.record({ reason: 'dead_error', errorCode: 'x'.repeat(500) });
    expect(insertArgs()[2].length).toBe(20);
  });

  it('never throws: a database fault must not cost anyone a working player', async () => {
    mockQuery.mockRejectedValue(new Error('db down'));
    await expect(PlayerHealthService.record({ reason: 'silent' })).resolves.toEqual({ ok: false });
  });
});

describe('flight-recorder trace', () => {
  const ev = (e, d, t = 1) => ({ t, e, ...(d ? { d } : {}) });

  it('keeps only known event codes and number/boolean/short-token values', () => {
    const t = cleanTrace([
      ev('src', { kind: 'youtube', n: 3, ok: true, title: 'A Song With Spaces', url: 'https://x.test/a?b=c' }),
      ev('evil', { a: 1 }),
      { t: 2, e: 'tap', d: { c: 'player-next', nested: { a: 1 } } },
      'junk', null,
    ]);
    expect(t).toEqual([
      { t: 1, e: 'src', d: { kind: 'youtube', n: 3, ok: true } },
      { t: 2, e: 'tap', d: { c: 'player-next' } },
    ]);
  });

  it('caps at 30 events and 2 KB, keeping the newest', () => {
    const many = Array.from({ length: 200 }, (_, i) => ev('embed', { a: i, b: i, c: i, d: i, e: i, f: i, g: i, h: i }, i));
    const t = cleanTrace(many);
    expect(t.length).toBeLessThanOrEqual(30);
    expect(JSON.stringify(t).length).toBeLessThanOrEqual(2048);
    expect(t[t.length - 1].d.a).toBe(199);
  });

  it('non-array or empty traces become null', () => {
    expect(cleanTrace('nope')).toBeNull();
    expect(cleanTrace([])).toBeNull();
    expect(cleanTrace([{ e: 'nope' }])).toBeNull();
  });

  it('record() stores the cleaned trace plus device/browser buckets', async () => {
    await PlayerHealthService.record({
      reason: 'silent', kind: 'youtube', platform: 'android',
      trace: [ev('sound', { ios: false })], device: 'touch', browser: 'firefox',
    });
    const args = insertArgs();
    expect(JSON.parse(args[7])).toEqual([{ t: 1, e: 'sound', d: { ios: false } }]);
    expect(args[8]).toBe('touch');
    expect(args[9]).toBe('firefox');
  });

  it('an out-of-enum device/browser is dropped, never echoed', async () => {
    await PlayerHealthService.record({ reason: 'silent', device: 'Mozilla/5.0', browser: '<b>' });
    const args = insertArgs();
    expect(args[8]).toBeNull();
    expect(args[9]).toBeNull();
  });

  it('if the 026 columns cannot be added, the original insert still lands (no beacon lost)', async () => {
    mockQuery.mockImplementation((sql) => (/ALTER TABLE/.test(sql) ? Promise.reject(new Error('permission denied')) : Promise.resolve({ rows: [] })));
    const r = await PlayerHealthService.record({ reason: 'silent', kind: 'youtube', trace: [ev('sound')] });
    expect(r.ok).toBe(true);
    expect(inserts()[0][0]).not.toMatch(/trace/);
    expect(inserts()[0][1]).toHaveLength(7);
  });
});

describe('POST /api/player/diagnostics', () => {
  it('always answers 200, even with no body at all', async () => {
    const res = await request(makeApp(playerRouter, '/api/player')).post('/api/player/diagnostics').send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('200 even when the write itself fails — the response never depends on the database', async () => {
    mockQuery.mockRejectedValue(new Error('db down'));
    const res = await request(makeApp(playerRouter, '/api/player'))
      .post('/api/player/diagnostics').send({ reason: 'silent', kind: 'youtube' });
    expect(res.status).toBe(200);
  });

  it('never stores the raw User-Agent — only a bucket derived from it', async () => {
    await request(makeApp(playerRouter, '/api/player'))
      .post('/api/player/diagnostics')
      .set('User-Agent', 'Mozilla/5.0 (Linux; Android 14; Pixel 9) Chrome/128')
      .send({ reason: 'silent', kind: 'youtube' });
    const args = insertArgs();
    expect(args).not.toContain(expect.stringContaining('Mozilla'));
    expect(args[5]).toBe('android'); // the bucket, not the string
  });

  it('buckets an iPhone UA as ios and a plain desktop UA as desktop', async () => {
    const app = makeApp(playerRouter, '/api/player');
    await request(app).post('/api/player/diagnostics').set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)').send({ reason: 'silent' });
    expect(insertArgs()[5]).toBe('ios');
    mockQuery.mockClear();
    await request(app).post('/api/player/diagnostics').set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)').send({ reason: 'silent' });
    expect(insertArgs()[5]).toBe('desktop');
  });

  it('no IP, cookie, session or user id is ever part of what gets written', async () => {
    await request(makeApp(playerRouter, '/api/player'))
      .post('/api/player/diagnostics')
      .send({ reason: 'silent', kind: 'youtube', userId: 'me', ip: '1.2.3.4', sessionId: 'abc' });
    const [sql] = inserts()[0];
    expect(sql).not.toMatch(/\bip\b|user_id|session/i);
  });
});

describe('GET /api/admin/player-health', () => {
  const OLD_KEY = process.env.ADMIN_API_KEY;
  beforeEach(() => { process.env.ADMIN_API_KEY = 'test-admin-key'; });
  afterEach(() => { process.env.ADMIN_API_KEY = OLD_KEY; });

  it('is gated the same way every other admin route already is', async () => {
    const res = await request(makeApp(adminRouter, '/api/admin')).get('/api/admin/player-health');
    expect(res.status).toBe(401);
  });

  it('returns a summary shape once authorized', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // the one-time ALTER
      .mockResolvedValueOnce({ rows: [{ reason: 'silent', count: 3 }] })
      .mockResolvedValueOnce({ rows: [{ kind: 'youtube', count: 3 }] })
      .mockResolvedValueOnce({ rows: [{ platform: 'android', count: 3 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: 3 }] })
      .mockResolvedValueOnce({ rows: [{ browser: 'firefox', reason: 'silent', count: 3 }] });
    const res = await request(makeApp(adminRouter, '/api/admin'))
      .get('/api/admin/player-health?days=7')
      .set('x-admin-key', 'test-admin-key');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.byReason).toEqual([{ reason: 'silent', count: 3 }]);
    expect(res.body.byBrowserReason).toEqual([{ browser: 'firefox', reason: 'silent', count: 3 }]);
    expect(res.body.recentTraces).toEqual([]);
  });
});
