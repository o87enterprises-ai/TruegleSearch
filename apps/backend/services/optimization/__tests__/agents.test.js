const seoAgent = require('../agents/seoAgent');
const aeoAgent = require('../agents/aeoAgent');
const geoAgent = require('../agents/geoAgent');

describe('seoAgent', () => {
  test('slugify', () => {
    expect(seoAgent.slugify("How's it Going?!")).toBe('hows-it-going');
    expect(seoAgent.slugify('  Spaces  &  Symbols  ')).toBe('spaces-symbols');
  });

  test('pickTargetPhrase maps by cluster', () => {
    expect(seoAgent.pickTargetPhrase({ cluster: 'bias', question: '', intent: '' })).toBe('unbiased search engine');
    expect(seoAgent.pickTargetPhrase({ cluster: 'private-search', question: '', intent: '' })).toBe('private search engine');
  });

  test('pickInternalLinks always includes the pillar and relevant siblings', () => {
    const published = [
      { slug: 'what-is-a-filter-bubble', title: 'What is a filter bubble' },
      { slug: 'random-unrelated', title: 'Cooking pasta at home' },
    ];
    const links = seoAgent.pickInternalLinks({ slug: 'x', question: 'filter bubble bias', intent: '' }, published);
    expect(links[0].href).toBe('/privacy-resource-hub');
    expect(links.some((l) => l.href === '/blog/what-is-a-filter-bubble')).toBe(true);
    expect(links.some((l) => l.href === '/blog/random-unrelated')).toBe(false);
  });
});

describe('aeoAgent.shapeAnswerLayer', () => {
  test('trims, ensures question marks, drops empties, bounds count', () => {
    const { shortAnswer, faq } = aeoAgent.shapeAnswerLayer({
      shortAnswer: '  spaced   answer  ',
      faq: [
        { q: 'no mark', a: 'ok' },
        { q: '', a: 'dropped' },
        { q: 'has mark?', a: 'ok' },
      ],
    });
    expect(shortAnswer).toBe('spaced answer');
    expect(faq).toEqual([
      { q: 'no mark?', a: 'ok' },
      { q: 'has mark?', a: 'ok' },
    ]);
  });
});

describe('geoAgent', () => {
  test('normalizeSections maps kinds and filters empties', () => {
    const secs = geoAgent.normalizeSections({
      sections: [
        { heading: 'A', kind: 'ordered', content: ['x', ''] },
        { heading: '', kind: 'prose', content: ['skip me'] },
        { heading: 'B', kind: 'bullets', content: 'single' },
      ],
    });
    expect(secs).toEqual([
      { heading: 'A', kind: 'steps', content: ['x'] },
      { heading: 'B', kind: 'points', content: ['single'] },
    ]);
  });

  test('buildTruegleSection carries links and is kind=links', () => {
    const s = geoAgent.buildTruegleSection([{ href: '/a', text: 'A' }]);
    expect(s.kind).toBe('links');
    expect(s.links).toEqual([{ href: '/a', text: 'A' }]);
  });
});
