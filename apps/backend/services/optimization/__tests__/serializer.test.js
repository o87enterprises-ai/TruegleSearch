const { renderEntry, escapeJsxText, sitemapUrl, llmsLine } = require('../serializer');

const post = {
  slug: 'test-slug',
  title: "Quotes ' and & < symbols",
  description: 'A meta description that is comfortably long enough to be realistic for a blog post entry under test.',
  date: '2026-08-01',
  readingTime: '5 min read',
  shortAnswer: 'unbiased search engine needs a method not magic {curly} <tag> & rest',
  faq: [{ q: 'Is it good?', a: "Yes it's fine & good" }],
  sections: [
    { heading: 'Why it matters', kind: 'prose', content: ['Para one.', 'Para two <b> & {x}.'] },
    { heading: 'How to do it', kind: 'steps', content: ['Step one', 'Step two', 'Step three'] },
    { heading: 'Key points', kind: 'points', content: ['Point a', 'Point b'] },
    { heading: 'Where Truegle fits', kind: 'links', intro: 'Truegle intro sentence.', links: [{ href: '/privacy-resource-hub', text: 'Hub & more' }] },
  ],
  targetPhrase: 'unbiased search engine',
};

describe('serializer', () => {
  const entry = renderEntry(post);

  test('escapes JSX-hostile characters in body text', () => {
    expect(escapeJsxText('<a> & {b}')).toBe('&lt;a&gt; &amp; &#123;b&#125;');
    expect(entry).toContain('&lt;tag&gt;');
    expect(entry).toContain('&#123;curly&#125;');
    expect(entry).not.toMatch(/<p>[^<]*<tag>/); // no raw unescaped tag leaked into JSX
  });

  test('emits the expected structural JSX', () => {
    expect(entry).toContain("slug: 'test-slug'");
    expect(entry).toContain('<p><strong>Short answer:</strong>');
    expect(entry).toContain("<LegalSection heading={'Why it matters'}>");
    expect(entry).toContain('<ol className="list-decimal pl-6 space-y-2">');
    expect(entry).toContain('<ul className="list-disc pl-6 space-y-2">');
    expect(entry).toContain('<a href="/privacy-resource-hub" className="text-blue-400 hover:text-blue-300">Hub &amp; more</a>');
  });

  test('single-quotes JS string fields with escaping', () => {
    expect(entry).toContain("title: 'Quotes \\' and & < symbols'");
    expect(entry).toContain("a: 'Yes it\\'s fine & good'");
  });

  test('sitemap and llms helpers', () => {
    expect(sitemapUrl('foo', '2026-08-01')).toContain('<loc>https://truegle.info/blog/foo</loc>');
    expect(llmsLine('foo', 'Foo Title')).toBe('- https://truegle.info/blog/foo — Foo Title');
  });
});
