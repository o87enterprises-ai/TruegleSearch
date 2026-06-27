const { _internals } = require('../services/TranscriptService');

const { extractPlayerResponse, parseTimedText, decodeEntities, looksRateLimited } = _internals;

describe('TranscriptService internals', () => {
  describe('extractPlayerResponse', () => {
    it('brace-matches the JSON even with braces inside strings', () => {
      const html =
        '<script>var x=1;ytInitialPlayerResponse = ' +
        '{"a":{"b":"has } brace","c":[1,2]},"captions":{"x":true}};var y=2;</script>';
      const p = extractPlayerResponse(html);
      expect(p).toBeTruthy();
      expect(p.a.b).toBe('has } brace');
      expect(p.captions.x).toBe(true);
    });

    it('returns null when the marker is absent', () => {
      expect(extractPlayerResponse('<html>nothing here</html>')).toBeNull();
    });

    it('returns null on malformed JSON', () => {
      expect(extractPlayerResponse('ytInitialPlayerResponse = {not valid')).toBeNull();
    });
  });

  describe('parseTimedText', () => {
    it('parses segments, decodes entities, strips nested tags, skips empties', () => {
      const xml =
        '<transcript>' +
        '<text start="0.5" dur="1.2">Hello &amp; <b>world</b></text>' +
        '<text start="2.0">it&#39;s me</text>' +
        '<text start="3.0"></text>' +
        '</transcript>';
      const segs = parseTimedText(xml);
      expect(segs).toHaveLength(2);
      expect(segs[0]).toEqual({ text: 'Hello & world', offset: 0.5, duration: 1.2 });
      expect(segs[1].text).toBe("it's me");
      expect(segs[1].duration).toBe(0);
    });
  });

  describe('decodeEntities', () => {
    it('decodes named, decimal, and hex entities', () => {
      expect(decodeEntities('a&amp;b&#39;c&#x41;')).toBe("a&b'cA");
    });
  });

  describe('looksRateLimited', () => {
    it('flags HTTP 429', () => expect(looksRateLimited(429, '')).toBe(true));
    it('flags the /sorry/ captcha interstitial', () =>
      expect(looksRateLimited(200, '<a href=/sorry/index>')).toBe(true));
    it('passes a normal page', () => expect(looksRateLimited(200, 'normal page')).toBe(false));
  });
});
