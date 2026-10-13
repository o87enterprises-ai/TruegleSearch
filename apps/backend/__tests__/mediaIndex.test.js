// A whole imported playlist joins the platform pool — played or not — so a new
// visitor's "Up next" is not drawn from only the handful of tracks anyone
// happened to sit through.
const mockQuery = jest.fn();
jest.mock('../db/connection', () => ({ query: (...a) => mockQuery(...a) }));
const { MediaService } = require('../services/MediaService');

beforeEach(() => { mockQuery.mockReset(); mockQuery.mockResolvedValue({ rows: [] }); });

const vid = (i) => ({ videoId: `abcdefghi${String(i).padStart(2, '0')}`, title: `Track ${i}`, channel: 'Someone' });

describe('MediaService.index', () => {
  it('writes every playlist video in ONE statement', async () => {
    const n = await MediaService.index([vid(1), vid(2), vid(3)]);
    expect(n).toBe(3);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [, args] = mockQuery.mock.calls[0];
    expect(args[0]).toEqual(['youtube:abcdefghi01', 'youtube:abcdefghi02', 'youtube:abcdefghi03']);
    expect(args[1]).toEqual(['Track 1', 'Track 2', 'Track 3']);
  });

  it('never touches counters or the hidden flag of a row that already exists', async () => {
    await MediaService.index([vid(1)]);
    const sql = mockQuery.mock.calls[0][0];
    const onConflict = sql.slice(sql.indexOf('ON CONFLICT'));
    expect(onConflict).not.toMatch(/ups|downs|plays|broken|hidden/);
    // …and only fills fields that were empty.
    expect(onConflict).toMatch(/COALESCE\(media_signals\.title/);
  });

  it('skips anything that is not a YouTube id, rather than storing an unplayable row', async () => {
    const n = await MediaService.index([vid(1), { videoId: 'nope' }, { videoId: '../../etc/pass' }, null, {}]);
    expect(n).toBe(1);
    expect(mockQuery.mock.calls[0][1][0]).toEqual(['youtube:abcdefghi01']);
  });

  it('caps one call at a playlist import’s worth', async () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ videoId: `v${String(i).padStart(10, '0')}` }));
    expect(await MediaService.index(many)).toBe(200);
  });

  it('does nothing — and does not query — for an empty list', async () => {
    expect(await MediaService.index([])).toBe(0);
    expect(await MediaService.index(undefined)).toBe(0);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('never throws: a database fault must not break the playlist import', async () => {
    mockQuery.mockRejectedValue(new Error('db down'));
    await expect(MediaService.index([vid(1)])).resolves.toBe(0);
  });
});

describe('trending', () => {
  it('offers indexed rows, but still keeps out rows whose only signal is a complaint', async () => {
    await MediaService.trending({ limit: 10 });
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/\(ups > 0 OR plays > 0 OR broken = 0\)/);
  });
});
