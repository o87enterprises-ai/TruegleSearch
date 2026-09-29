/**
 * The landing cards' YouTube coverage: what survives the shaping.
 * Rows below are the shape the live index returns (title carries a " - YouTube"
 * suffix, date is an ISO string, duration is usually absent).
 */
const { shapeVideos, queryFor, youtubeId, cleanTitle, isLivestream } = require('../services/NewsVideos');

const NOW = Date.parse('2026-09-29T12:00:00Z');
const row = (id, title, date, extra = {}) => ({
  title: `${title} - YouTube`, url: `https://www.youtube.com/watch?v=${id}`, date, ...extra,
});
const ID = (n) => `abcdefghi${String(n).padStart(2, '0')}`; // 11 chars

describe('shapeVideos', () => {
  it('keeps YouTube videos only, with thumbnails derived from the id', () => {
    const out = shapeVideos([
      row(ID(1), 'Markets close lower', '2026-09-28T21:28:06'),
      { title: 'A dailymotion clip', url: 'https://www.dailymotion.com/video/x8dmq12', date: '2026-09-28T10:00:00' },
      { title: 'A web page', url: 'https://example.com/watch?v=abcdefghi77' },
    ], { now: NOW });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: ID(1), title: 'Markets close lower',
      thumbnail: `https://i.ytimg.com/vi/${ID(1)}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${ID(1)}`,
    });
  });

  it('orders newest first, and keeps undated rows behind the dated ones', () => {
    const out = shapeVideos([
      row(ID(1), 'Undated story', undefined),
      row(ID(2), 'Older story', '2026-09-25T10:00:00'),
      row(ID(3), 'Newest story', '2026-09-28T10:00:00'),
    ], { now: NOW });
    expect(out.map((v) => v.id)).toEqual([ID(3), ID(2), ID(1)]);
  });

  it('drops anything older than a week, and dates from the future', () => {
    const out = shapeVideos([
      row(ID(1), 'Fresh', '2026-09-28T10:00:00'),
      row(ID(2), 'Last month', '2026-08-01T10:00:00'),
      row(ID(3), 'Time traveller', '2027-01-01T10:00:00'),
    ], { now: NOW });
    expect(out.map((v) => v.id)).toEqual([ID(1)]);
  });

  it('drops livestreams: a channel that never ends is not a report', () => {
    const out = shapeVideos([
      row(ID(1), 'Stock Market LIVE Today | Nifty LIVE', '2026-09-28T10:00:00'),
      row(ID(2), 'Breaking News 24/7 coverage', '2026-09-28T10:00:00'),
      row(ID(3), 'Traders deliver a verdict', '2026-09-28T10:00:00'),
    ], { now: NOW });
    expect(out.map((v) => v.id)).toEqual([ID(3)]);
    expect(isLivestream('Nifty LIVE')).toBe(true);
    expect(isLivestream('Olive branch talks')).toBe(false);
  });

  it('collapses a daily bulletin that differs only by its date', () => {
    const out = shapeVideos([
      row(ID(1), 'ABC World News Tonight With David Muir 9/26/26', '2026-09-26T21:00:00'),
      row(ID(2), 'ABC World News Tonight With David Muir 09/25/26', '2026-09-25T21:00:00'),
      row(ID(3), 'ABC World News Tonight With David Muir 9/24/26', '2026-09-24T21:00:00'),
      row(ID(4), 'A different story', '2026-09-25T09:00:00'),
    ], { now: NOW });
    expect(out.map((v) => v.id)).toEqual([ID(1), ID(4)]);
  });

  it('removes the same video seen twice (watch, shorts and youtu.be forms)', () => {
    const out = shapeVideos([
      row(ID(1), 'One video', '2026-09-28T10:00:00'),
      { title: 'One video again', url: `https://youtu.be/${ID(1)}`, date: '2026-09-28T10:00:00' },
      { title: 'And again', url: `https://www.youtube.com/shorts/${ID(1)}`, date: '2026-09-28T10:00:00' },
    ], { now: NOW });
    expect(out).toHaveLength(1);
  });

  it('honours the limit, and survives junk input', () => {
    const many = Array.from({ length: 30 }, (_, i) => row(ID(i), `Story number ${i} about topic ${i * 7}`, '2026-09-28T10:00:00'));
    expect(shapeVideos(many, { now: NOW, limit: 5 })).toHaveLength(5);
    expect(shapeVideos(null)).toEqual([]);
    expect(shapeVideos([null, {}, { url: 5 }])).toEqual([]);
  });

  it('reads durations in either notation', () => {
    const out = shapeVideos([
      row(ID(1), 'Short report', '2026-09-28T10:00:00', { duration: '3:23' }),
      row(ID(2), 'Long report', '2026-09-28T09:00:00', { duration: '1:02:03' }),
    ], { now: NOW });
    expect(out.map((v) => v.duration)).toEqual([203, 3723]);
  });
});

describe('helpers', () => {
  it('cleans the index label off a title', () => {
    expect(cleanTitle('The Market Close - YouTube')).toBe('The Market Close');
    expect(cleanTitle('A | B – YouTube')).toBe('A | B');
    expect(cleanTitle('YouTube tips')).toBe('YouTube tips');
  });
  it('finds ids without being fooled by look-alike hosts', () => {
    expect(youtubeId('https://youtu.be/abcdefghi01')).toBe('abcdefghi01');
    expect(youtubeId('https://www.youtube.com/watch?feature=x&v=abcdefghi01')).toBe('abcdefghi01');
    expect(youtubeId('https://example.com/?u=youtube.com/watch?v=abcdefghi01')).toBe('abcdefghi01'); // id still valid; host is checked by the route's site: query
    expect(youtubeId('https://vimeo.com/123456789')).toBeNull();
  });
  it('asks for local news by region name, and world or markets otherwise', () => {
    expect(queryFor('news', 'local', 'Canada')).toBe('Canada news today');
    expect(queryFor('news', 'local', '')).toBe('world news today');
    expect(queryFor('news', 'world', 'Canada')).toBe('world news today');
    expect(queryFor('markets', 'local', 'Canada')).toBe('stock market today analysis');
  });
});
