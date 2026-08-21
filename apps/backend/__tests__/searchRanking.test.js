/**
 * What comes first, and why.
 *
 * REPORTED, with the scores attached: searching "how do tides work" returned a
 * games-industry redundancy story (relevance 0.163) and a Bitcoin piece
 * (relevance 0.013) ABOVE the actual "How Do Tides Work?" video (relevance
 * 0.600). Three separate causes, all in rankResults:
 *
 *   1. Relevance was 0.5 of the score against recency 0.35 and diversity 0.15,
 *      so the two supporting signals together outweighed the one that answers
 *      the question.
 *   2. Recency applied to every query regardless of whether anything about it
 *      was time-sensitive, and an unknown date scored 0.3 — a penalty. Web
 *      results usually carry no date; news results always do.
 *   3. Diversity gave 1.0 to the first result from each domain, where "first"
 *      meant whichever provider answered earliest. News arrives as a block of
 *      distinct domains, so all of it scored perfectly.
 *
 * These tests are written against the SYMPTOM rather than the constants, so
 * tuning the weights later does not require rewriting them — only breaking the
 * behaviour does.
 */
const SearchService = require('../services/SearchService');

const svc = new SearchService();
const titles = (rows) => rows.map((r) => r.title);

// The real shape, minus the fields ranking does not read.
const result = (title, url, { date = null, snippet = '' } = {}) => ({ title, url, date, snippet });

describe('rankResults — relevance decides', () => {
  // The reported case, reproduced: an off-topic but fresh news item on its own
  // domain, against a bang-on-topic result from a domain that has already
  // appeared.
  const tides = [
    result('People want to play arcade racers again', 'https://gamesindustry.biz/a',
      { date: new Date().toISOString(), snippet: 'redundancy notice sequel studio' }),
    result('Bitcoin may have one more drop', 'https://coinage.media/b',
      { date: new Date().toISOString(), snippet: 'crypto tides are turning apathy' }),
    result('Ocean basics', 'https://youtube.com/watch?v=aaa', { snippet: 'sea' }),
    result('How Do Tides Work?', 'https://youtube.com/watch?v=bbb',
      { snippet: 'how do tides work explained' }),
  ];

  it('puts the result that answers the question first', () => {
    const ranked = svc.rankResults('how do tides work', tides);
    expect(ranked[0].title).toBe('How Do Tides Work?');
  });

  it('does not let a fresh, off-topic story outrank an on-topic one', () => {
    const ranked = svc.rankResults('how do tides work', tides);
    const answer = ranked.findIndex((r) => r.title === 'How Do Tides Work?');
    const games = ranked.findIndex((r) => /arcade racers/.test(r.title));
    expect(answer).toBeLessThan(games);
  });
});

describe('calculateRecency — freshness only when freshness was asked for', () => {
  const today = new Date().toISOString();
  const old = new Date(Date.now() - 400 * 864e5).toISOString();

  it('is neutral on a question with nothing time-sensitive about it', () => {
    expect(svc.calculateRecency(today, false)).toBe(0.5);
    expect(svc.calculateRecency(old, false)).toBe(0.5);
  });

  it('treats an unknown date as neutral, never as a penalty', () => {
    // 0.3 here was the specific thing that sank undated web results beneath
    // dated news ones.
    expect(svc.calculateRecency(null, true)).toBe(0.5);
    expect(svc.calculateRecency('not a date', true)).toBe(0.5);
    expect(svc.calculateRecency(null, false)).toBe(0.5);
  });

  it('does rank by age once the question is about now', () => {
    expect(svc.calculateRecency(today, true)).toBeGreaterThan(svc.calculateRecency(old, true));
  });

  it('and that changes the order, for those queries only', () => {
    const rows = [
      result('Sports roundup, last year', 'https://a.com/1', { date: old, snippet: 'latest news scores' }),
      result('Sports roundup, today', 'https://b.com/2', { date: today, snippet: 'latest news scores' }),
    ];
    expect(titles(svc.rankResults('latest news', rows))[0]).toBe('Sports roundup, today');
  });
});

describe('isTimeSensitiveQuery', () => {
  it('recognises questions about now', () => {
    for (const q of ['latest news', 'election results today', 'breaking', 'current weather']) {
      expect(svc.isTimeSensitiveQuery(q)).toBe(true);
    }
  });

  it('leaves ordinary questions alone', () => {
    for (const q of ['how do tides work', 'photosynthesis explained', 'monoatomic gold']) {
      expect(svc.isTimeSensitiveQuery(q)).toBe(false);
    }
  });

  it('does not throw on nothing', () => {
    expect(svc.isTimeSensitiveQuery('')).toBe(false);
    expect(svc.isTimeSensitiveQuery(null)).toBe(false);
  });
});

describe('diversity is about domains, not arrival order', () => {
  // The same domain twice, with the WEAKER copy listed first — which is how a
  // provider that answers early used to hand its worst result the full
  // diversity score and mark the better one as the duplicate.
  const rows = [
    result('Tides, a passing mention', 'https://example.com/weak', { snippet: 'mostly about boats' }),
    result('How tides work, in full', 'https://example.com/strong',
      { snippet: 'how tides work tides work explained in full' }),
    result('Unrelated', 'https://other.com/x', { snippet: 'nothing to do with it' }),
  ];

  it('gives the full score to the BEST result from a domain, not the earliest', () => {
    const ranked = svc.rankResults('how tides work', rows);
    const strong = ranked.find((r) => /in full/.test(r.title));
    const weak = ranked.find((r) => /passing mention/.test(r.title));
    expect(strong.diversityScore).toBeGreaterThan(weak.diversityScore);
  });

  it('still stops one site taking every slot', () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      result(`Same site ${i}`, `https://one.com/${i}`, { snippet: 'tides' }));
    const ranked = svc.rankResults('tides', many);
    const scores = ranked.map((r) => r.diversityScore);
    expect(Math.min(...scores)).toBeLessThan(Math.max(...scores));
  });
});

describe('rankResults — the things that must not change', () => {
  it('returns everything it was given', () => {
    const rows = [result('a', 'https://a.com/1'), result('b', 'https://b.com/2')];
    expect(svc.rankResults('anything', rows)).toHaveLength(2);
  });

  it('survives an empty list and a missing one', () => {
    expect(svc.rankResults('q', [])).toEqual([]);
    expect(svc.rankResults('q', null)).toEqual([]);
  });

  it('still carries its scores out for the UI to show', () => {
    const [row] = svc.rankResults('tides', [result('Tides', 'https://a.com/1', { snippet: 'tides' })]);
    for (const k of ['relevanceScore', 'recencyScore', 'diversityScore', 'finalScore']) {
      expect(typeof row[k]).toBe('number');
    }
  });
});
