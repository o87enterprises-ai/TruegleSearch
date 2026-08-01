const { check, isSensitiveQuery, countWords } = require('../qualityGate');

const words = (n) => Array.from({ length: n }, () => 'insight').join(' ');

function goodPost(overrides = {}) {
  return {
    slug: 'good-clean-post',
    title: 'How to Get Unbiased Search Results Without Tracking',
    description:
      'Getting unbiased search results is a repeatable method: compare multiple sources, start from primary evidence, and avoid personalized ranking.',
    shortAnswer:
      'unbiased search engine results come from a method not a single ranking, so compare multiple independent sources before trusting any one of them.',
    targetPhrase: 'unbiased search engine',
    faq: [
      { q: 'Is any engine unbiased?', a: 'No engine is perfectly neutral, but a non-tracking one lets you compare views.' },
      { q: 'Does signing out help?', a: 'It reduces personalization but does not remove it entirely.' },
    ],
    sections: [
      { heading: 'Why one ranked list misleads', kind: 'prose', content: [words(120), words(120)] },
      { heading: 'The method step by step', kind: 'steps', content: [words(110), words(110)] },
      { heading: 'Key points to remember', kind: 'points', content: [words(90), words(90)] },
      { heading: 'Where Truegle fits', kind: 'links', intro: 'Truegle intro.', links: [{ href: '/privacy-resource-hub', text: 'Hub' }] },
    ],
    ...overrides,
  };
}

describe('qualityGate.check', () => {
  test('a well-formed post passes', () => {
    const v = check(goodPost());
    expect(v.ok).toBe(true);
    expect(v.words).toBeGreaterThanOrEqual(650);
  });

  test('rejects thin content', () => {
    const v = check(goodPost({ sections: [{ heading: 'Tiny', kind: 'prose', content: ['too short'] }] }));
    expect(v.ok).toBe(false);
    expect(v.reasons.join(' ')).toMatch(/words/);
  });

  test('rejects when target phrase is not in the opening', () => {
    const v = check(goodPost({ shortAnswer: 'Some generic opening that never mentions the target phrase at all here today.' }));
    expect(v.ok).toBe(false);
    expect(v.reasons.join(' ')).toMatch(/target phrase/);
  });

  test('rejects fabricated citations/stats', () => {
    const p = goodPost();
    p.sections[0].content[0] = `According to a study, 73% of users insight ${words(120)}`;
    const v = check(p);
    expect(v.ok).toBe(false);
    expect(v.reasons.join(' ')).toMatch(/fabricated/);
  });

  test('rejects personal identifiers in the topic', () => {
    const v = check(goodPost({ title: 'Find john.doe@example.com Online' }));
    expect(v.ok).toBe(false);
    expect(v.reasons.join(' ')).toMatch(/personal identifier/);
  });

  test('countWords excludes the deterministic links section', () => {
    const p = goodPost();
    const withoutLinks = p.sections.filter((s) => s.kind !== 'links');
    expect(countWords(p)).toBe(countWords({ ...p, sections: withoutLinks }));
  });
});

describe('isSensitiveQuery', () => {
  test.each([
    ['jane@example.com', true],
    ['call +1 415 555 1234 now', true],
    ['123 Main Street', true],
    ['dox this person', true],
    ['how to search privately', false],
    ['best free osint tools', false],
  ])('%s → %s', (q, expected) => {
    expect(isSensitiveQuery(q)).toBe(expected);
  });
});
