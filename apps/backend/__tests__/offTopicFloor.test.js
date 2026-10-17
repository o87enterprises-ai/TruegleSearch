/**
 * Padding is not results.
 *
 * REPORTED (owner, 2026-10-17), Select-All of a Blue results page for the query
 * "Truegle.info": "About 115 results", of which only the first two or three
 * were about Truegle. The rest were Microsoft Q&A threads on Windows network
 * sharing — pages that contain neither "truegle" nor anything like it. A
 * metasearch engine that has run out of real matches pads the page with loosely
 * related rows, and nothing downstream ever dropped a row: ranking only sorts.
 *
 * Written against the symptom: a result that shares no word with the query is
 * not an answer to it, whatever its rank.
 */
const SearchService = require('../services/SearchService');

const svc = new SearchService();
const row = (title, url, snippet = '') => ({ title, url, snippet });

const home = row('Truegle — Unbiased Search Engine', 'https://truegle.info/', 'Truegle is an unbiased search engine that shows comprehensive results.');
const noise = [
  row('How to fix network share issues ? - Microsoft Q&A', 'https://learn.microsoft.com/en-us/answers/questions/5923972/how-to-fix-network-share-issues', 'To fix network share issues, verify network connectivity, ensure both devices are on the same network'),
  row('File sharing over a network in Windows | Microsoft Support', 'https://support.microsoft.com/en-us/windows/file-sharing', 'This article focuses on sharing files or folders over a Local Area Network (LAN)'),
  row('Network shares stop working - Microsoft Q&A', 'https://learn.microsoft.com/en-us/answers/questions/5645917/network-shares-stop-working', 'intermittent connectivity issues with network shares in a workgroup environment'),
];

describe('dropOffTopic', () => {
  it('drops rows that share no word with a bare-domain query', () => {
    const out = svc.dropOffTopic('Truegle.info', [home, ...noise]);
    expect(out).toEqual([home]);
  });

  it('matches on the label, not the TLD: "info" alone is not on-topic', () => {
    const generic = row('Contact info for the council', 'https://example.org/contact', 'Office info and opening hours');
    expect(svc.dropOffTopic('truegle.info', [home, generic])).toEqual([home]);
  });

  it('keeps a row whose only match is in its URL', () => {
    const bare = row('Home', 'https://truegle.info/about', '');
    expect(svc.dropOffTopic('truegle.info', [bare, ...noise])).toEqual([bare]);
  });

  it('never empties the page: if nothing matches, everything stays', () => {
    expect(svc.dropOffTopic('truegle.info', noise)).toEqual(noise);
  });

  it('leaves ordinary multi-word queries alone when rows share any word', () => {
    const rows = [
      row('Eugene, Oregon - Wikipedia', 'https://en.wikipedia.org/wiki/Eugene', 'city in Oregon'),
      row('Top Patent Lawyers serving Eugene, Oregon', 'https://x.com/a', 'patent attorneys'),
    ];
    expect(svc.dropOffTopic('eugene oregon patent lawyers', rows)).toEqual(rows);
  });

  it('handles inflection: "lawyers" matches "lawyer"', () => {
    const r = row('Find a lawyer', 'https://x.com/b', '');
    expect(svc.dropOffTopic('lawyers', [r, noise[0]])).toEqual([r]);
  });
});
