// `site:` shows that site only (owner audit 2026-10-08: no padding with unrelated
// sites that hides what the engines really returned).
const { siteOperatorDomain, onlyFromSite } = require('../services/siteOperator');

describe('site: operator', () => {
  it('reads one site: term', () => {
    expect(siteOperatorDomain('site:4chan.org')).toBe('4chan.org');
    expect(siteOperatorDomain('climate site:www.Jacobin.com')).toBe('jacobin.com');
    expect(siteOperatorDomain('plain words')).toBeNull();
  });
  it('leaves OR, exclusions and several sites to the engines', () => {
    expect(siteOperatorDomain('x site:a.com OR site:b.com')).toBeNull();
    expect(siteOperatorDomain('x -site:a.com')).toBeNull();
    expect(siteOperatorDomain('site:a.com site:b.com')).toBeNull();
  });
  it('keeps the site and its subdomains, drops everything else', () => {
    const rows = ['https://4chan.org/', 'https://boards.4chan.org/g/', 'https://www.autotrader.com/x', 'https://not4chan.org/', 'nonsense']
      .map((url) => ({ url }));
    expect(onlyFromSite(rows, '4chan.org').map((r) => r.url)).toEqual(['https://4chan.org/', 'https://boards.4chan.org/g/']);
  });
});
