const { queryKeywords, exactMatch, orderByExactMatch } = require('../services/exactMatch');

describe('queryKeywords — the words a person asked for', () => {
  it('keeps every real word, drops filler', () => {
    expect(queryKeywords('the duck sauce quack album on bandcamp')).toEqual(['duck', 'sauce', 'quack', 'album', 'bandcamp']);
  });
  it('keeps short words that carry meaning (EP, numbers) but not single letters', () => {
    expect(queryKeywords('Side A EP 2 Duck E. Duck')).toEqual(['side', 'ep', '2', 'duck']);
  });
  it('drops search operators, negations, bangs and OR/AND', () => {
    expect(queryKeywords('quack site:bandcamp.com -remix !yt duck OR sauce')).toEqual(['quack', 'duck', 'sauce']);
  });
});

describe('exactMatch', () => {
  const q = 'duck sauce quack album bandcamp';
  it('counts whole words as typed — no stemming', () => {
    expect(exactMatch('quack', { title: 'Quacks and quacking' }).matched).toBe(0);
    expect(exactMatch('quack', { title: 'Quack!' }).matched).toBe(1);
  });
  it('reads the URL path as words too', () => {
    const m = exactMatch(q, { title: 'Duck Sauce', url: 'https://ducksauce.bandcamp.com/album/quack' });
    expect(m.matched).toBe(5);
    expect(m.inTitle).toBe(2);
  });
  it('rewards the words appearing together, as written', () => {
    const a = exactMatch('duck sauce', { title: 'Duck Sauce live' }).together;
    const b = exactMatch('duck sauce', { title: 'Sauce for duck' }).together;
    expect(a).toBeGreaterThan(b);
  });
});

describe('orderByExactMatch — the reported case (2026-10-01)', () => {
  // Titles and URLs as production returned them, in production's order.
  const live = [
    { title: 'Spandex | Duck Sauce - Bandcamp', url: 'https://ducksauce.bandcamp.com/track/spandex', snippet: 'Duck Sauce', finalScore: 0.76 },
    { title: 'Quack (album) - Wikipedia', url: 'https://en.wikipedia.org/wiki/Quack_(album)', snippet: 'Quack is the debut studio album by Duck Sauce', finalScore: 0.65 },
    { title: 'Quack - Duck Sauce - Bandcamp', url: 'https://ducksauce.bandcamp.com/album/quack', snippet: 'Fueled by the duo', finalScore: 0.63 },
    { title: 'Duck Sauce, by Duck and Steve', url: 'https://duckandsteve.bandcamp.com/album/duck-sauce', snippet: '', finalScore: 0.49 },
  ];
  const ordered = orderByExactMatch('duck sauce quack album bandcamp', live);

  it('puts the result holding every word first', () => {
    expect(ordered[0].title).toBe('Quack - Duck Sauce - Bandcamp');
  });
  it('puts the one missing two words below every one that has more', () => {
    const spandex = ordered.findIndex((r) => r.title.startsWith('Spandex'));
    expect(ordered[spandex].keywordMatch.matched).toBeLessThan(ordered[0].keywordMatch.matched);
    expect(spandex).toBeGreaterThan(0);
  });
  it('orders strictly by words matched, most to least', () => {
    const counts = ordered.map((r) => r.keywordMatch.matched);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });
  it('falls back to the blended score between equal matches', () => {
    const tie = orderByExactMatch('duck', [{ title: 'duck', finalScore: 0.1 }, { title: 'duck', finalScore: 0.9 }]);
    expect(tie[0].finalScore).toBe(0.9);
  });
  it('leaves results alone when the query has no real words', () => {
    const rows = [{ title: 'a' }, { title: 'b' }];
    expect(orderByExactMatch('the of', rows)).toBe(rows);
  });
});
