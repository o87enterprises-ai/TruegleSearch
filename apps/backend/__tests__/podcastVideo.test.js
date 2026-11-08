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
