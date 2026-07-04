/**
 * Query Interpreter tests — self-brand recognition (piece #1).
 */
const QueryInterpreter = require('../services/QueryInterpreter');
const SearchService = require('../services/SearchService');

describe('QueryInterpreter.isBrandQuery', () => {
  it('matches the exact brand name and branded phrases', () => {
    expect(QueryInterpreter.isBrandQuery('truegle')).toBe(true);
    expect(QueryInterpreter.isBrandQuery('Truegle')).toBe(true);
    expect(QueryInterpreter.isBrandQuery('truegle search')).toBe(true);
    expect(QueryInterpreter.isBrandQuery('truegle search engine')).toBe(true);
    expect(QueryInterpreter.isBrandQuery('go to truegle.info')).toBe(true);
    expect(QueryInterpreter.isBrandQuery('TRUEGLE!')).toBe(true);
  });

  it('matches common misspellings', () => {
    expect(QueryInterpreter.isBrandQuery('trugle')).toBe(true);
    expect(QueryInterpreter.isBrandQuery('truggle')).toBe(true);
    expect(QueryInterpreter.isBrandQuery('truegel')).toBe(true);
    expect(QueryInterpreter.isBrandQuery('trueagle')).toBe(true);
  });

  it('does NOT match unrelated words or other brands', () => {
    expect(QueryInterpreter.isBrandQuery('google')).toBe(false);
    expect(QueryInterpreter.isBrandQuery('true')).toBe(false);
    expect(QueryInterpreter.isBrandQuery('truth')).toBe(false);
    expect(QueryInterpreter.isBrandQuery('truffle')).toBe(false);
    expect(QueryInterpreter.isBrandQuery('how many times has the president been impeached')).toBe(false);
    expect(QueryInterpreter.isBrandQuery('')).toBe(false);
    expect(QueryInterpreter.isBrandQuery(null)).toBe(false);
  });
});

describe('QueryInterpreter.buildOfficialResult', () => {
  it('returns a well-formed, flagged, top-ranked official result', () => {
    const r = QueryInterpreter.buildOfficialResult();
    expect(r.domain).toBe('truegle.info');
    expect(r.url).toBe('https://truegle.info');
    expect(r.isOfficial).toBe(true);
    expect(r.category).toBe('web');
    expect(r.bias).toBeDefined();
    expect(r.biasLabel).toBeDefined();
    expect(r.finalScore).toBeGreaterThan(1);
  });
});

describe('QueryInterpreter.detectSiteKeyword', () => {
  it('detects a trailing keyword and strips it', () => {
    expect(QueryInterpreter.detectSiteKeyword('darkwaters 9 yt')).toEqual({
      domain: 'youtube.com', keyword: 'yt', cleanedQuery: 'darkwaters 9',
    });
    expect(QueryInterpreter.detectSiteKeyword('caveman git')).toEqual({
      domain: 'github.com', keyword: 'git', cleanedQuery: 'caveman',
    });
  });

  it('detects a leading keyword and strips it', () => {
    expect(QueryInterpreter.detectSiteKeyword('yt lofi beats')).toEqual({
      domain: 'youtube.com', keyword: 'yt', cleanedQuery: 'lofi beats',
    });
  });

  it('ignores mid-sentence keywords and bare single tokens', () => {
    expect(QueryInterpreter.detectSiteKeyword('the git repository workflow')).toBeNull();
    expect(QueryInterpreter.detectSiteKeyword('youtube')).toBeNull(); // bare nav query, don't collapse to empty
    expect(QueryInterpreter.detectSiteKeyword('yttrium properties')).toBeNull(); // substring, not a standalone token
  });

  it('returns null when no keyword is present', () => {
    expect(QueryInterpreter.detectSiteKeyword('length of the great wall of china')).toBeNull();
    expect(QueryInterpreter.detectSiteKeyword('')).toBeNull();
  });
});

describe('SearchService.boostDomainToTop', () => {
  let service;
  beforeEach(() => { service = new SearchService(); });

  it('moves target-site results (and subdomains) to the top, preserving order', () => {
    const results = [
      { title: 'A blog', url: 'https://blog.example.com/a', domain: 'blog.example.com' },
      { title: 'YT vid 1', url: 'https://www.youtube.com/watch?v=1', domain: 'www.youtube.com' },
      { title: 'A news piece', url: 'https://news.example.com/x', domain: 'news.example.com' },
      { title: 'YT vid 2', url: 'https://youtube.com/watch?v=2', domain: 'youtube.com' },
    ];
    const boosted = service.boostDomainToTop(results, 'youtube.com');
    expect(boosted[0].domain).toBe('www.youtube.com');
    expect(boosted[1].domain).toBe('youtube.com');
    expect(boosted[2].domain).toBe('blog.example.com'); // non-target order preserved
    expect(boosted[3].domain).toBe('news.example.com');
  });

  it('does not match unrelated domains that merely contain the name', () => {
    const results = [
      { title: 'Fake', url: 'https://notyoutube.com/x', domain: 'notyoutube.com' },
      { title: 'Real', url: 'https://youtube.com/x', domain: 'youtube.com' },
    ];
    const boosted = service.boostDomainToTop(results, 'youtube.com');
    expect(boosted[0].domain).toBe('youtube.com');
    expect(boosted[1].domain).toBe('notyoutube.com');
  });
});

describe('SearchService.pinOfficialResult', () => {
  let service;
  beforeEach(() => { service = new SearchService(); });

  it('prepends the official result for a brand query', () => {
    const results = [
      { title: 'Some blog about truegle', url: 'https://medium.com/x', domain: 'medium.com' },
      { title: 'Truegle on ProductHunt', url: 'https://producthunt.com/truegle', domain: 'producthunt.com' },
    ];
    const pinned = service.pinOfficialResult('truegle', results);
    expect(pinned[0].domain).toBe('truegle.info');
    expect(pinned[0].isOfficial).toBe(true);
    expect(pinned.length).toBe(3);
  });

  it('de-dupes an existing truegle.info result instead of duplicating it', () => {
    const results = [
      { title: 'Third-party', url: 'https://medium.com/x', domain: 'medium.com' },
      { title: 'Truegle (provider copy)', url: 'https://truegle.info/', domain: 'truegle.info' },
    ];
    const pinned = service.pinOfficialResult('truegle', results);
    const truegleCount = pinned.filter((r) => r.domain === 'truegle.info').length;
    expect(truegleCount).toBe(1);
    expect(pinned[0].isOfficial).toBe(true);
  });

  it('leaves non-brand queries untouched', () => {
    const results = [{ title: 'Great Wall', url: 'https://en.wikipedia.org/wiki/Great_Wall', domain: 'en.wikipedia.org' }];
    const pinned = service.pinOfficialResult('length of the great wall of china', results);
    expect(pinned).toBe(results);
  });
});
