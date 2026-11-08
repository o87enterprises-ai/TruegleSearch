const { shapePodcasts } = require('../services/PodcastVideoService');

describe('shapePodcasts', () => {
  const row = (id, title, extra = {}) => ({ url: `https://www.youtube.com/watch?v=${id}`, title, ...extra });
  it('dedupes by video id, drops non-YouTube rows, puts full episodes before clips', () => {
    const out = shapePodcasts([
      row('aaaaaaaaaaa', 'Clip', { duration: '2:00' }),
      row('bbbbbbbbbbb', 'Episode 1', { duration: '1:10:00' }),
      row('bbbbbbbbbbb', 'Episode 1 again'),
      { url: 'https://example.com/x', title: 'Not YouTube' },
      row('ccccccccccc', 'Unknown length'),
    ]);
    expect(out.map((v) => v.id)).toEqual(['bbbbbbbbbbb', 'ccccccccccc', 'aaaaaaaaaaa']);
    expect(out[0].url).toBe('https://www.youtube.com/watch?v=bbbbbbbbbbb');
  });
  it('respects the limit', () => {
    const rows = Array.from({ length: 5 }, (_, i) => row(`ddddddddd${i}x`.slice(0, 11), `T${i}`));
    expect(shapePodcasts(rows, 2)).toHaveLength(2);
  });
});

describe('mergeRosterFirst', () => {
  const { mergeRosterFirst } = require('../services/PodcastVideoService');
  const row = (u, a = 'x') => ({ url: `https://www.youtube.com/watch?v=${u}`, author: a });
  it('puts roster episodes first, one show at a time, then search rows, deduped', () => {
    const bema = [row('b1', 'BEMA'), row('b2', 'BEMA')];
    const roland = [row('r1', 'Roland'), row('r2', 'Roland')];
    const search = [row('s1'), row('b1', 'BEMA'), row('s2')];
    const out = mergeRosterFirst([bema, roland], search, 20).map((r) => r.url.slice(-2));
    expect(out).toEqual(['b1', 'r1', 'b2', 'r2', 's1', 's2']);
  });
  it('caps the roster lead and respects the limit', () => {
    const lane = Array.from({ length: 20 }, (_, i) => row(`l${i}`.padEnd(2, '_')));
    expect(mergeRosterFirst([lane], [], 3)).toHaveLength(3);
    expect(mergeRosterFirst([lane], [row('zz')], 50).length).toBe(9); // 8 roster + 1 search
  });
  it('works with no roster at all', () => {
    expect(mergeRosterFirst([], [row('s1')], 5)).toHaveLength(1);
  });
});
