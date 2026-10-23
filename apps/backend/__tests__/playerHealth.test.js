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

const { PlayerHealthService, REASONS } = require('../services/PlayerHealthService');
const playerRouter = require('../routes/player');
const adminRouter = require('../routes/admin');

beforeEach(() => { mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [] }); });

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
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, args] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO player_health_events/);
    expect(args).toEqual(['youtube', 'silent', '150', false, true, 'android', '4g']);
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

  it('a missing reason is also rejected — it is the one required field', async () => {
    expect((await PlayerHealthService.record({ kind: 'youtube' })).ok).toBe(false);
    expect((await PlayerHealthService.record()).ok).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('an out-of-enum kind or platform is dropped to null/other, never passed through raw', async () => {
    await PlayerHealthService.record({ reason: 'silent', kind: '<script>', platform: 'whatever the client claims' });
    const [, args] = mockQuery.mock.calls[0];
    expect(args[0]).toBeNull();          // kind
    expect(args[5]).toBe('other');       // platform falls back, never echoes client text
  });

  it('an oversized error code is capped, not rejected outright', async () => {
    await PlayerHealthService.record({ reason: 'dead_error', errorCode: 'x'.repeat(500) });
    const [, args] = mockQuery.mock.calls[0];
    expect(args[2].length).toBe(20);
  });

  it('never throws: a database fault must not cost anyone a working player', async () => {
    mockQuery.mockRejectedValue(new Error('db down'));
    await expect(PlayerHealthService.record({ reason: 'silent' })).resolves.toEqual({ ok: false });
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
    const [, args] = mockQuery.mock.calls[0];
    expect(args).not.toContain(expect.stringContaining('Mozilla'));
    expect(args[5]).toBe('android'); // the bucket, not the string
  });

  it('buckets an iPhone UA as ios and a plain desktop UA as desktop', async () => {
    const app = makeApp(playerRouter, '/api/player');
    await request(app).post('/api/player/diagnostics').set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)').send({ reason: 'silent' });
    expect(mockQuery.mock.calls[0][1][5]).toBe('ios');
    mockQuery.mockClear();
    await request(app).post('/api/player/diagnostics').set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)').send({ reason: 'silent' });
    expect(mockQuery.mock.calls[0][1][5]).toBe('desktop');
  });

  it('no IP, cookie, session or user id is ever part of what gets written', async () => {
    await request(makeApp(playerRouter, '/api/player'))
      .post('/api/player/diagnostics')
      .send({ reason: 'silent', kind: 'youtube', userId: 'me', ip: '1.2.3.4', sessionId: 'abc' });
    const [sql] = mockQuery.mock.calls[0];
    expect(sql).not.toMatch(/ip|user_id|session/i);
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
      .mockResolvedValueOnce({ rows: [{ reason: 'silent', count: 3 }] })
      .mockResolvedValueOnce({ rows: [{ kind: 'youtube', count: 3 }] })
      .mockResolvedValueOnce({ rows: [{ platform: 'android', count: 3 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: 3 }] });
    const res = await request(makeApp(adminRouter, '/api/admin'))
      .get('/api/admin/player-health?days=7')
      .set('x-admin-key', 'test-admin-key');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.byReason).toEqual([{ reason: 'silent', count: 3 }]);
  });
});
