/**
 * Query Interpreter tests — self-brand recognition (piece #1).
 */
const QueryInterpreter = require('../services/QueryInterpreter');
const SearchService = require('../services/SearchService');
const UnifiedAIService = require('../services/UnifiedAIService');

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

  it('detects a leading ABBREVIATION and strips it', () => {
    expect(QueryInterpreter.detectSiteKeyword('yt lofi beats')).toEqual({
      domain: 'youtube.com', keyword: 'yt', cleanedQuery: 'lofi beats',
    });
  });

  it('does NOT fire on a leading full brand name (it is the subject, not a filter)', () => {
    // "youtube downloader" is a search FOR a youtube downloader — must not
    // collapse to youtube.com. Regression for the over-strict-bang report.
    expect(QueryInterpreter.detectSiteKeyword('youtube downloader')).toBeNull();
    expect(QueryInterpreter.detectSiteKeyword('reddit alternatives')).toBeNull();
    expect(QueryInterpreter.detectSiteKeyword('github status')).toBeNull();
    // ...but the full name still works as a trailing site filter.
    expect(QueryInterpreter.detectSiteKeyword('lofi beats youtube')).toEqual({
      domain: 'youtube.com', keyword: 'youtube', cleanedQuery: 'lofi beats',
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

describe('QueryInterpreter.detectAcronym', () => {
  it('expands unambiguous curated acronyms at any case', () => {
    expect(QueryInterpreter.detectAcronym('dea')).toMatchObject({ key: 'dea', expansion: 'drug enforcement administration' });
    expect(QueryInterpreter.detectAcronym('FBI raid')).toMatchObject({ key: 'fbi' });
    expect(QueryInterpreter.detectAcronym('history of nasa')).toMatchObject({ key: 'nasa' });
  });

  it('only expands ambiguous acronyms (WHO/SEC/UN) when uppercase', () => {
    expect(QueryInterpreter.detectAcronym('who is the president')).toBeNull();
    expect(QueryInterpreter.detectAcronym('WHO guidelines')).toMatchObject({ key: 'who', expansion: 'world health organization' });
    expect(QueryInterpreter.detectAcronym('the sec of the movie')).toBeNull();
    expect(QueryInterpreter.detectAcronym('SEC filing')).toMatchObject({ key: 'sec' });
  });

  it('returns null when there is no curated acronym', () => {
    expect(QueryInterpreter.detectAcronym('length of the great wall of china')).toBeNull();
    expect(QueryInterpreter.detectAcronym('')).toBeNull();
  });
});

describe('QueryInterpreter.looksLikeUnknownAcronym', () => {
  it('flags a bare uppercase unknown acronym', () => {
    expect(QueryInterpreter.looksLikeUnknownAcronym('NORAD')).toBe('NORAD');
    expect(QueryInterpreter.looksLikeUnknownAcronym('DARPA')).toBe('DARPA');
  });

  it('ignores curated ones, stopwords, lowercase, multi-word, and wrong length', () => {
    expect(QueryInterpreter.looksLikeUnknownAcronym('DEA')).toBeNull();      // curated
    expect(QueryInterpreter.looksLikeUnknownAcronym('LOL')).toBeNull();      // stopword
    expect(QueryInterpreter.looksLikeUnknownAcronym('norad')).toBeNull();    // not uppercase
    expect(QueryInterpreter.looksLikeUnknownAcronym('NORAD base')).toBeNull(); // multi-word
    expect(QueryInterpreter.looksLikeUnknownAcronym('A')).toBeNull();        // too short
    expect(QueryInterpreter.looksLikeUnknownAcronym('ABCDEFG')).toBeNull();  // too long
  });
});

describe('QueryInterpreter.buildExpandedQuery', () => {
  it('replaces the acronym token in place, preserving surrounding words', () => {
    expect(QueryInterpreter.buildExpandedQuery('dea', { token: 'dea', expansion: 'drug enforcement administration' }))
      .toBe('drug enforcement administration');
    expect(QueryInterpreter.buildExpandedQuery('DEA history', { token: 'DEA', expansion: 'drug enforcement administration' }))
      .toBe('drug enforcement administration history');
  });
});

describe('QueryInterpreter.isAnswerableQuery', () => {
  it('accepts questions and factual lookups', () => {
    expect(QueryInterpreter.isAnswerableQuery('how many times has the president been impeached')).toBe(true);
    expect(QueryInterpreter.isAnswerableQuery('length of the great wall of china')).toBe(true);
    expect(QueryInterpreter.isAnswerableQuery('what is the capital of France')).toBe(true);
    expect(QueryInterpreter.isAnswerableQuery('who is the ceo of tesla')).toBe(true);
    expect(QueryInterpreter.isAnswerableQuery('define serendipity')).toBe(true);
    expect(QueryInterpreter.isAnswerableQuery('population of tokyo?')).toBe(true);
  });

  it('rejects navigational, brand, and open-ended queries', () => {
    expect(QueryInterpreter.isAnswerableQuery('truegle')).toBe(false);
    expect(QueryInterpreter.isAnswerableQuery('nike running shoes')).toBe(false);
    expect(QueryInterpreter.isAnswerableQuery('best pizza near me')).toBe(false);
    expect(QueryInterpreter.isAnswerableQuery('')).toBe(false);
  });
});

describe('SearchService.aiExpandAcronym', () => {
  let service;
  beforeEach(() => { service = new SearchService(); });
  afterEach(() => jest.restoreAllMocks());

  it('returns the AI expansion and caches it (one AI call for repeats)', async () => {
    const spy = jest.spyOn(UnifiedAIService, 'chat').mockResolvedValue({ content: 'North American Aerospace Defense Command' });
    const first = await service.aiExpandAcronym('NORAD');
    const second = await service.aiExpandAcronym('NORAD');
    expect(first).toBe('north american aerospace defense command');
    expect(second).toBe(first);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('caches a negative result when the AI replies NONE', async () => {
    const spy = jest.spyOn(UnifiedAIService, 'chat').mockResolvedValue({ content: 'NONE' });
    expect(await service.aiExpandAcronym('ZZQX')).toBeNull();
    await service.aiExpandAcronym('ZZQX');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('resolves to null (never throws) when the AI provider fails', async () => {
    jest.spyOn(UnifiedAIService, 'chat').mockRejectedValue(new Error('provider down'));
    await expect(service.aiExpandAcronym('QWXZ')).resolves.toBeNull();
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

describe('QueryInterpreter.scoreNavigationalMatch', () => {
  const s = (q, url) => QueryInterpreter.scoreNavigationalMatch(q, url);

  it('ranks the bare official domain above brand-TLD and subdomain variants ("google")', () => {
    const google = s('google', 'https://www.google.com/');
    const blog = s('google', 'https://blog.google/');
    const accounts = s('google', 'https://accounts.google.com/');
    const research = s('google', 'https://research.google/');
    expect(google).toBeGreaterThan(blog);
    expect(google).toBeGreaterThan(accounts);
    expect(google).toBeGreaterThan(research);
    expect(accounts).toBeGreaterThan(blog); // exact root beats substring
  });

  it('matches sub+root for multi-word navigational queries ("dash cloudflare")', () => {
    const dash = s('dash cloudflare', 'https://dash.cloudflare.com/');
    const root = s('dash cloudflare', 'https://cloudflare.com/');
    const blogPost = s('dash cloudflare', 'https://someblog.net/cloudflare-dashboard-guide');
    expect(dash).toBeGreaterThan(root);
    expect(root).toBeGreaterThan(blogPost);
    expect(dash).toBeGreaterThanOrEqual(0.9);
  });

  it('rewards known subdomain brands ("aws" -> aws.amazon.com)', () => {
    expect(s('aws', 'https://aws.amazon.com/')).toBeGreaterThan(s('aws', 'https://amazon.com/'));
  });

  it('penalizes social profile pages, except when the platform IS the query', () => {
    const profile = s('google', 'https://www.youtube.com/Google');
    const homepage = s('google', 'https://www.google.com/');
    expect(profile).toBeLessThan(0.2);
    expect(homepage).toBeGreaterThan(profile);
    // but "youtube" itself must still win youtube.com
    expect(s('youtube', 'https://www.youtube.com/')).toBe(1.0);
  });

  it('prefers homepages over deep paths on the same domain', () => {
    const home = s('cloudflare', 'https://cloudflare.com/');
    const deep = s('cloudflare', 'https://cloudflare.com/learning/dns/what-is-dns/');
    expect(home).toBeGreaterThan(deep);
  });

  it('returns 0 for junk input', () => {
    expect(s('google', 'not a url')).toBe(0);
    expect(s('', 'https://google.com/')).toBe(0);
    expect(s(null, null)).toBe(0);
  });
});
