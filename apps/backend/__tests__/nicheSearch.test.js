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
  const mixed = [...Array.from({ length: 9 }, (_, i) => vid(`v${i}`)), web('kakapo egg page1'), web('kakapo egg page2')];
  it('caps clips in the top 10 for a plain query, removing nothing', () => {
    const out = balanceSources('kakapo egg', mixed);
    expect(out).toHaveLength(mixed.length);
    expect(out.slice(0, 3).every((r) => r.category === 'videos')).toBe(true);
    expect(out.slice(3, 5).map((r) => r.title)).toEqual(['kakapo egg page1', 'kakapo egg page2']);
  });
  it('leaves order alone when the query wants video', () => {
    expect(balanceSources('kakapo video', mixed)).toEqual(mixed);
  });
  it('never leaves a hole when there are no pages to promote', () => {
    const only = Array.from({ length: 12 }, (_, i) => vid(`v${i}`));
    expect(balanceSources('abc', only)).toHaveLength(12);
  });
});

describe('balanceSources never lifts a weak page', () => {
  it('keeps a good clip above a page holding 1 of 4 words', () => {
    const q = 'rapid api sign up';
    const clips = Array.from({ length: 5 }, (_, i) => vid(`rapid api sign up ${i}`));
    const weak = web('RAPID definition');
    const out = balanceSources(q, [...clips, weak]);
    expect(out.indexOf(weak)).toBe(5);
  });
});

describe('brand typed as two words', () => {
  const { compoundVariant } = require('../services/exactMatch');
  it('joins the first two words of a plain query', () => {
    expect(compoundVariant('rapid api sign up')).toEqual({ brand: 'rapidapi', query: 'rapidapi sign up' });
  });
  it('leaves short, operator and quoted queries alone', () => {
    expect(compoundVariant('rapid api')).toBeNull();
    expect(compoundVariant('"rapid api" sign up')).toBeNull();
    expect(compoundVariant('rapid api site:x.com')).toBeNull();
    expect(compoundVariant('the best pizza')).toBeNull();
  });
  it('counts "RapidAPI" as holding both "rapid" and "api"', () => {
    const r = { title: 'RapidAPI Sign Up', url: 'https://rapidapi.com/auth/sign-up', snippet: '' };
    expect(exactMatch('rapid api sign up', r).matched).toBe(4);
  });
});
