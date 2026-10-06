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
    // Markets name the region's market since 2026-10-06 (a US reader was
    // getting Indian market shows); with no region it stays general.
    expect(queryFor('markets', 'local', 'Canada')).toBe('Canada stock market today analysis');
    expect(queryFor('markets', 'world', '')).toBe('stock market today analysis');
  });
});

// Owner, 2026-10-06: "make sure the news / market feed on landing is only
// English when US is selected. Lots of the results are in Hindi." The titles
// below are the ones the live US cards were serving that day.
describe('region rules (English for the US)', () => {
  const { regionRules, isLatinScript, languageFor } = require('../services/NewsVideos');
  const NOW2 = Date.parse('2026-10-06T12:00:00');
  const r = (n, title) => ({ url: `https://www.youtube.com/watch?v=${String(n).padStart(11, 'x')}`, title, date: '2026-10-06T08:00:00' });

  it('asks for English in English-speaking regions only', () => {
    expect(languageFor('US')).toBe('en');
    expect(languageFor('gb')).toBe('en');
    expect(languageFor('IN')).toBe(null);
    expect(languageFor('')).toBe(null);
  });

  it('a US card drops titles written in other scripts', () => {
    const rules = regionRules('news', 'US');
    const out = shapeVideos([
      r(1, 'பிபிசி தமிழ் தொலைக்காட்சி செய்தியறிக்கை | BBC Tamil TV News'),
      r(2, 'আজকের আন্তর্জাতিক খবর | World News Today'),
      r(3, 'Kyiv mayor on Russian strike that killed one'),
      r(4, 'Stock Market Today : లాభాల్లో ట్రేడవుతున్న సెన్సెక్స్'),
      r(5, 'Café owners react — “déjà vu” for Zürich'),
    ], { now: NOW2, english: rules.english, drop: rules.drop });
    expect(out.map((v) => v.title)).toEqual(['Kyiv mayor on Russian strike that killed one', 'Café owners react — “déjà vu” for Zürich']);
    expect(isLatinScript('Nasdaq & $NVDA Record Highs! 🚀')).toBe(true);
  });

  it('the US markets card is about US markets', () => {
    const rules = regionRules('markets', 'US');
    const out = shapeVideos([
      r(1, 'First Trade 6th October 2026: Zee Business Live | Share Market Live Updates'),
      r(2, 'Share Bazaar Today: Anuj Singhal Decodes Nifty, Sensex & Bank Nifty'),
      r(3, 'Stock Market Today: October 6, 2026'),
      r(4, 'Nasdaq & $NVDA Record Highs as Fed Minutes Loom'),
    ], { now: NOW2, english: rules.english, drop: rules.drop });
    expect(out.map((v) => v.title)).toEqual(['Stock Market Today: October 6, 2026', 'Nasdaq & $NVDA Record Highs as Fed Minutes Loom']);
    expect(queryFor('markets', 'world', 'United States')).toMatch(/US stock market/);
  });

  it('other regions are left as they were — no language forced on them', () => {
    const rules = regionRules('markets', 'IN');
    expect(rules).toEqual({ language: null, english: false, drop: null });
  });
});
