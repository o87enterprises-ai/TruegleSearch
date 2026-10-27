/**
 * Mainstream vs Rabbit Hole: both rank on how many engines returned a link,
 * in opposite directions, so the same pool orders differently per mode.
 */
const SearchService = require('../services/SearchService');
const svc = new SearchService();

const r = (url, engines, extra = {}) => ({
  title: 'solar eclipse guide', snippet: 'solar eclipse guide', url, domain: new URL(url).hostname,
  engines, category: 'web', bias: 'unknown', ...extra,
});
const pool = () => [
  r('https://www.bigsite.com/', ['google', 'bing', 'duckduckgo', 'wikipedia']),
  r('https://oddblog.example.org/archive/2019/eclipse-notes', ['mojeek']),
  r('https://www.other.com/eclipse', ['google', 'bing']),
];

test('consensusScore: mainstream rewards agreement, rabbit rewards a lone, deep result', () => {
  const [big, odd, mid] = pool();
  expect(svc.consensusScore(big, 'mainstream')).toBe(1);
  expect(svc.consensusScore(odd, 'mainstream')).toBe(0);
  expect(svc.consensusScore(odd, 'rabbit')).toBeGreaterThan(svc.consensusScore(big, 'rabbit'));
  expect(svc.consensusScore(mid, 'rabbit')).toBeLessThan(svc.consensusScore(odd, 'rabbit'));
});

test('no engine info (API providers) is neutral — cannot reorder them', () => {
  expect(svc.consensusScore({ url: 'https://a.com/x', domain: 'a.com' }, 'mainstream')).toBe(0.5);
  expect(svc.consensusScore({ url: 'https://a.com/x', domain: 'a.com' }, 'rabbit')).toBe(0.5);
});

test('the same pool ranks the widely-agreed site first in Mainstream and last in Rabbit Hole', () => {
  const main = svc.rankResults('solar eclipse guide', pool(), { googleParity: true, consensus: 'mainstream' });
  const rabbit = svc.rankResults('solar eclipse guide', pool(), { boostAlternative: true, consensus: 'rabbit' });
  expect(main[0].domain).toBe('www.bigsite.com');
  expect(rabbit[0].domain).toBe('oddblog.example.org');
  expect(rabbit[rabbit.length - 1].domain).toBe('www.bigsite.com');
});

test('debug adds a score breakdown, and omits it otherwise', () => {
  const on = svc.rankResults('solar eclipse guide', pool(), { consensus: 'mainstream', debug: true });
  expect(on[0].rankDebug).toEqual(expect.objectContaining({ consensus: expect.any(Number), engines: expect.any(Array), final: expect.any(Number) }));
  const off = svc.rankResults('solar eclipse guide', pool(), { consensus: 'mainstream' });
  expect(off[0].rankDebug).toBeUndefined();
});
