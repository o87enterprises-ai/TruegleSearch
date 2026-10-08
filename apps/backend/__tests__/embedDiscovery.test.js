// Universal embed (owner, 2026-10-08): "If there's a free embed code listed on
// a site I want Truegle to be able to play it, period."
const { discoverEmbed, extractCandidates, framingForbidden } = require('../services/EmbedDiscovery');
const { safeFetch, isPublicAddress } = require('../utils/safeFetch');
const { MediaService } = require('../services/MediaService');

const PAGE = 'https://news.example.org/story/42';
const page = (body) => ({ url: PAGE, body: `<html><head><title>A story</title>${body}</head><body></body></html>`, type: 'text/html', headers: {} });
// A fake web: url → response. Frames are framable unless listed.
const web = (map) => jest.fn(async (url) => {
  if (url in map) return map[url];
  return { url, body: '<html></html>', type: 'text/html', headers: {} };
});
const classify = (u) => { try { const k = MediaService.classifyMedia(u); return k; } catch { return null; } };

describe('what a page offers', () => {
  it('oEmbed discovery: the site\'s own embed code', async () => {
    const fetch = web({
      [PAGE]: page('<link rel="alternate" type="application/json+oembed" href="https://news.example.org/oembed?u=42">'),
      'https://news.example.org/oembed?u=42': { url: 'x', body: JSON.stringify({ type: 'video', title: 'The clip', html: '<iframe src="https://player.example.org/e/42" allowfullscreen></iframe>' }), type: 'application/json', headers: {} },
    });
    const r = await discoverEmbed(PAGE, { fetch, classify });
    expect(r).toMatchObject({ kind: 'embed', src: 'https://player.example.org/e/42', title: 'A story', via: 'oEmbed' });
  });

  it('Open Graph video player', async () => {
    const r = await discoverEmbed(PAGE, { fetch: web({ [PAGE]: page('<meta property="og:video:secure_url" content="https://cdn.example.org/player/9"><meta property="og:video:type" content="text/html"><meta property="og:image" content="/p.jpg">') }), classify });
    expect(r).toMatchObject({ kind: 'embed', src: 'https://cdn.example.org/player/9', poster: 'https://news.example.org/p.jpg' });
  });

  it('Open Graph video FILE plays in the native player', async () => {
    const r = await discoverEmbed(PAGE, { fetch: web({ [PAGE]: page('<meta property="og:video" content="https://cdn.example.org/a.mp4"><meta property="og:video:type" content="video/mp4">') }), classify });
    expect(r).toMatchObject({ kind: 'video', src: 'https://cdn.example.org/a.mp4' });
  });

  it('Twitter player card', async () => {
    const r = await discoverEmbed(PAGE, { fetch: web({ [PAGE]: page('<meta name="twitter:player" content="https://v.example.net/embed/abc">') }), classify });
    expect(r).toMatchObject({ kind: 'embed', src: 'https://v.example.net/embed/abc' });
  });

  it('schema.org VideoObject embedUrl', async () => {
    const ld = { '@context': 'https://schema.org', '@graph': [{ '@type': 'NewsArticle' }, { '@type': 'VideoObject', embedUrl: 'https://vid.example.com/embed/77' }] };
    const r = await discoverEmbed(PAGE, { fetch: web({ [PAGE]: page(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`) }), classify });
    expect(r).toMatchObject({ kind: 'embed', src: 'https://vid.example.com/embed/77' });
  });

  it('an embed code written out in a copy box', async () => {
    const r = await discoverEmbed(PAGE, { fetch: web({ [PAGE]: page('<textarea>&lt;iframe width="560" src="https://archive.example.edu/embed/lecture-3"&gt;&lt;/iframe&gt;</textarea>') }), classify });
    expect(r).toMatchObject({ kind: 'embed', src: 'https://archive.example.edu/embed/lecture-3' });
  });

  it('a story wrapping a YouTube clip plays as YouTube (the controllable player)', async () => {
    const r = await discoverEmbed(PAGE, { fetch: web({ [PAGE]: page('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>') }), classify });
    expect(r).toMatchObject({ kind: 'youtube', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', title: 'A story' });
  });

  it('a plain <video> file on the page', async () => {
    const r = await discoverEmbed(PAGE, { fetch: web({ [PAGE]: page('<video controls><source src="/media/talk.webm" type="video/webm"></video>') }), classify });
    expect(r).toMatchObject({ kind: 'video', src: 'https://news.example.org/media/talk.webm' });
  });

  it('ad and widget frames are not mistaken for the video', () => {
    const { candidates } = extractCandidates('<iframe src="https://googleads.g.doubleclick.net/pagead/ads?video=1"></iframe><iframe src="https://www.facebook.com/plugins/like.php"></iframe><iframe src="https://example.org/sidebar"></iframe>', PAGE);
    expect(candidates).toEqual([]);
  });

  it('a player the site forbids framing is skipped for the next one', async () => {
    const fetch = web({
      [PAGE]: page('<meta property="og:video" content="https://locked.example.org/player/1"><meta name="twitter:player" content="https://open.example.org/player/1">'),
      'https://locked.example.org/player/1': { url: 'x', body: '', type: 'text/html', headers: { 'x-frame-options': 'SAMEORIGIN' } },
    });
    const r = await discoverEmbed(PAGE, { fetch, classify });
    expect(r.src).toBe('https://open.example.org/player/1');
  });

  it('nothing playable → null, said rather than guessed', async () => {
    expect(await discoverEmbed(PAGE, { fetch: web({ [PAGE]: page('<p>just words</p>') }), classify })).toBeNull();
  });

  it('reads framing rules the way a browser does', () => {
    expect(framingForbidden({ 'x-frame-options': 'DENY' })).toBe(true);
    expect(framingForbidden({ 'content-security-policy': "frame-ancestors 'self'" })).toBe(true);
    expect(framingForbidden({ 'content-security-policy': 'frame-ancestors *' })).toBe(false);
    expect(framingForbidden({})).toBe(false);
  });
});

describe('it only ever reads the public internet', () => {
  it.each(['127.0.0.1', '10.1.2.3', '169.254.169.254', '192.168.1.1', '172.20.0.1', '100.64.0.1', '::1', 'fe80::1', 'fd00::1', '::ffff:10.0.0.1'])('refuses %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });
  it('accepts a public address', () => { expect(isPublicAddress('93.184.216.34')).toBe(true); });
  // DNS rebinding / a public name pointed at an inside address: judged at the
  // socket's own lookup, so the address checked is the one connected to.
  it('refuses a public-looking NAME that resolves to an inside address', async () => {
    const dns = require('node:dns');
    const spy = jest.spyOn(dns, 'lookup').mockImplementation((host, opts, cb) => cb(null, [{ address: '10.0.0.5', family: 4 }]));
    await expect(safeFetch('http://sneaky.example.com/')).rejects.toThrow(/not on the public internet/);
    spy.mockRestore();
  });
  it.each([
    'http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://localhost:3001/api', 'https://[::1]/',
    'file:///etc/passwd', 'ftp://example.com/', 'https://example.com:8443/', 'https://user:pw@example.com/',
  ])('safeFetch refuses %s before any request', async (u) => {
    await expect(safeFetch(u)).rejects.toThrow();
  });
});
