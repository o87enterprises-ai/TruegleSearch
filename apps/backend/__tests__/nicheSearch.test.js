const { fold, queryKeywords, exactMatch, orderByExactMatch, balanceSources } = require('../services/exactMatch');

const vid = (t) => ({ title: t, url: `https://youtube.com/${t}`, snippet: '', category: 'videos', bias: 'platform' });
const web = (t, s = '') => ({ title: t, url: `https://ex.org/${t.replace(/\W/g, '')}`, snippet: s, category: 'web', bias: 'unknown' });

describe('accent folding', () => {
  it('folds diacritics and non-decomposing letters', () => {
    expect(fold('Dvořák')).toBe('dvorak');
    expect(fold('Søren Straße Łódź')).toBe('soren strasse lodz');
  });
  it('lets "dvorak" match a "Dvořák" title', () => {
    expect(exactMatch('dvorak', web('Dvořák: New World Symphony')).matched).toBe(1);
    expect(queryKeywords('Dvořák')).toEqual(['dvorak']);
  });
});

describe('rarity weighting', () => {
  it('ranks the page with the rare word above one with only the common word', () => {
    const rs = [web('New World order'), web('New things'), web('Jaaybo new interview'), web('New news')];
    expect(orderByExactMatch('new jaaybo', rs)[0].title).toBe('Jaaybo new interview');
  });
  it('keeps equal-coverage results in the fallback order', () => {
    const a = { ...web('alpha beta'), finalScore: 1 };
    const b = { ...web('alpha beta two'), finalScore: 2 };
    expect(orderByExactMatch('alpha beta', [a, b])[0]).toMatchObject({ finalScore: 2 });
  });
});

describe('balanceSources', () => {
  const mixed = [...Array.from({ length: 9 }, (_, i) => vid(`v${i}`)), web('page1'), web('page2')];
  it('caps clips in the top 10 for a plain query, removing nothing', () => {
    const out = balanceSources('kakapo egg', mixed);
    expect(out).toHaveLength(mixed.length);
    expect(out.slice(0, 3).every((r) => r.category === 'videos')).toBe(true);
    expect(out.slice(3, 5).map((r) => r.title)).toEqual(['page1', 'page2']);
  });
  it('leaves order alone when the query wants video', () => {
    expect(balanceSources('kakapo video', mixed)).toEqual(mixed);
  });
  it('never leaves a hole when there are no pages to promote', () => {
    const only = Array.from({ length: 12 }, (_, i) => vid(`v${i}`));
    expect(balanceSources('abc', only)).toHaveLength(12);
  });
});
