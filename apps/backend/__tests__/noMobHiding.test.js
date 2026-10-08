// Owner audit 2026-10-08: no one can hide a video from everyone.
const mockQuery = jest.fn();
jest.mock('../db/connection', () => ({ query: (...a) => mockQuery(...a) }));
const { MediaService, isReallyGone, __verified } = require('../services/MediaService');

const status = (code) => jest.fn(async () => ({ status: code }));

beforeEach(() => { mockQuery.mockReset(); __verified.clear(); });

describe('votes', () => {
  it('the hide rule no longer counts 👎 at all', async () => {
    mockQuery.mockResolvedValue({ rows: [{ ups: 0, downs: 50, broken: 0, hidden: false }] });
    await MediaService.signal({ key: 'youtube:abcdefghijk', from: 0, to: -1 });
    const sql = mockQuery.mock.calls[0][0];
    const hideRule = sql.slice(sql.indexOf('hidden   ='), sql.indexOf('updated_at'));
    expect(hideRule).not.toMatch(/downs/);
  });
});

describe('"broken" is checked with the platform', () => {
  it('YouTube says 200 → not gone; 401/404 → gone; 500 → unknown', async () => {
    expect(await isReallyGone('youtube:kJQP7kiw5Fk', status(200))).toBe(false);
    __verified.clear();
    expect(await isReallyGone('youtube:aaaaaaaaaaa', status(404))).toBe(true);
    __verified.clear();
    expect(await isReallyGone('youtube:bbbbbbbbbbb', status(401))).toBe(true);
    __verified.clear();
    expect(await isReallyGone('youtube:ccccccccccc', status(500))).toBeNull();
    expect(await isReallyGone('rumble:v123', status(404))).toBeNull(); // cannot be checked
  });

  it('a playable video reported "broken" is put straight back', async () => {
    global.fetch = status(200);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ ups: 0, downs: 0, broken: 2, hidden: true }] })
      .mockResolvedValue({ rows: [] });
    const r = await MediaService.signal({ key: 'youtube:kJQP7kiw5Fk', broken: true });
    expect(r.hidden).toBe(false);
    expect(mockQuery.mock.calls[1][0]).toMatch(/SET hidden = FALSE, broken = 0/);
  });

  it('an uncheckable platform needs more reports', async () => {
    mockQuery.mockResolvedValue({ rows: [{ hidden: false }] });
    await MediaService.signal({ key: 'rumble:v1abc', broken: true });
    expect(mockQuery.mock.calls[0][1][10]).toBe(5);
    await MediaService.signal({ key: 'youtube:kJQP7kiw5Fk', broken: true });
    expect(mockQuery.mock.calls[1][1][10]).toBe(2);
  });

  it('the public dead-list restores what was hidden by mistake (Despacito)', async () => {
    global.fetch = jest.fn(async (url) => ({ status: url.includes('kJQP7kiw5Fk') ? 200 : 404 }));
    mockQuery
      .mockResolvedValueOnce({ rows: [{ media_key: 'youtube:kJQP7kiw5Fk' }, { media_key: 'youtube:deadvideo01' }, { media_key: 'rumble:v1abc' }] })
      .mockResolvedValue({ rows: [] });
    const keys = await MediaService.brokenKeys();
    expect(keys).toEqual(['youtube:deadvideo01', 'rumble:v1abc']);
    expect(mockQuery.mock.calls.some(([sql, args]) => /SET hidden = FALSE/.test(sql) && args[0] === 'youtube:kJQP7kiw5Fk')).toBe(true);
  });
});
