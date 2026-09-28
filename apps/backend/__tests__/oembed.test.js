/* Titles for packed share links, and the allowlist that keeps the route safe.
 *
 * This service makes an OUTBOUND request on behalf of an unauthenticated
 * caller, which is the shape of an SSRF gadget. The allowlist is the whole
 * defence, so most of what is pinned here is what it REFUSES — internal
 * addresses, other schemes, lookalike hostnames — rather than what it fetches.
 *
 * The rest is failure behaviour, because a title is cosmetic and must never be
 * able to hang or break the page that wanted it.
 */
const OembedService = require('../services/OembedService');
const { providerFor, lookup, lookupMany, __cache } = OembedService;

beforeEach(() => {
  __cache.clear();
  jest.restoreAllMocks();
});

const mockFetch = (impl) => { global.fetch = jest.fn(impl); };
const okJson = (body) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

describe('the allowlist', () => {
  it('accepts the providers that publish a keyless oEmbed endpoint', () => {
    expect(providerFor('https://www.youtube.com/watch?v=abc')?.name).toBe('youtube');
    expect(providerFor('https://youtu.be/abc')?.name).toBe('youtube');
    expect(providerFor('https://vimeo.com/123')?.name).toBe('vimeo');
    expect(providerFor('https://soundcloud.com/a/b')?.name).toBe('soundcloud');
    expect(providerFor('https://www.dailymotion.com/video/x1')?.name).toBe('dailymotion');
  });

  // The SSRF surface. Every one of these would be a request our server makes
  // to somewhere it was told to by a stranger.
  it.each([
    ['http://localhost/admin', 'localhost'],
    ['http://127.0.0.1:8080/', 'loopback'],
    ['http://169.254.169.254/latest/meta-data/', 'cloud metadata'],
    ['http://[::1]/', 'ipv6 loopback'],
    ['https://10.0.0.5/internal', 'private range'],
    ['file:///etc/passwd', 'file scheme'],
    ['gopher://evil.example/', 'gopher scheme'],
    ['https://evilyoutube.com/watch?v=a', 'lookalike host'],
    ['https://youtube.com.evil.example/x', 'suffix-attack host'],
    ['https://example.com/page', 'ordinary unrelated site'],
  ])('refuses %s (%s)', (url) => {
    expect(providerFor(url)).toBeNull();
  });

  it('refuses http even for an allowlisted provider', () => {
    // Not a lookalike — the real host, over plain http. We would be the one
    // making an unencrypted request, on somebody else's behalf.
    expect(providerFor('http://www.youtube.com/watch?v=abc')).toBeNull();
  });

  it('never calls fetch for a refused URL', async () => {
    mockFetch(() => okJson({ title: 'should not happen' }));
    expect(await lookup('http://169.254.169.254/')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('lookup', () => {
  it('returns the title and uploader', async () => {
    mockFetch(() => okJson({ title: 'Lefty Gunplay - Blue Print', author_name: 'Lefty Gunplay' }));
    const r = await lookup('https://www.youtube.com/watch?v=io3ncomDCtk');
    expect(r).toEqual({ title: 'Lefty Gunplay - Blue Print', author: 'Lefty Gunplay', provider: 'youtube' });
  });

  it('caches a hit so a shared queue is not re-asked on every render', async () => {
    mockFetch(() => okJson({ title: 'One' }));
    const url = 'https://vimeo.com/123456';
    await lookup(url);
    await lookup(url);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('caches a MISS too — a dead link must not be re-asked forever', async () => {
    mockFetch(() => Promise.resolve({ ok: false, status: 404 }));
    const url = 'https://www.youtube.com/watch?v=deleted';
    expect(await lookup(url)).toBeNull();
    expect(await lookup(url)).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT cache a network failure, so the next try can succeed', async () => {
    const url = 'https://www.youtube.com/watch?v=flaky';
    mockFetch(() => Promise.reject(new Error('ECONNRESET')));
    expect(await lookup(url)).toBeNull();
    mockFetch(() => okJson({ title: 'Back online' }));
    expect((await lookup(url))?.title).toBe('Back online');
  });

  it('treats an empty title as no title rather than an empty string', async () => {
    mockFetch(() => okJson({ title: '   ' }));
    expect(await lookup('https://vimeo.com/1')).toBeNull();
  });

  it('caps a hostile title instead of storing it whole', async () => {
    mockFetch(() => okJson({ title: 'x'.repeat(5000) }));
    const r = await lookup('https://vimeo.com/2');
    expect(r.title.length).toBe(200);
  });

  it('refuses an absurdly long URL without calling out', async () => {
    mockFetch(() => okJson({ title: 'nope' }));
    expect(await lookup(`https://www.youtube.com/watch?v=${'a'.repeat(600)}`)).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('carries the player shape when the provider gives one (Reels uses it to prove a Short)', async () => {
    mockFetch(() => okJson({ title: 'A short', author_name: 'someone', width: 113, height: 200 }));
    const r = await lookup('https://www.youtube.com/shorts/abcdefghijk');
    expect(r).toEqual({ title: 'A short', author: 'someone', provider: 'youtube', width: 113, height: 200 });
  });

  it('survives a provider returning something that is not JSON', async () => {
    mockFetch(() => Promise.resolve({ ok: true, json: () => Promise.reject(new Error('bad json')) }));
    expect(await lookup('https://vimeo.com/3')).toBeNull();
  });
});

describe('lookupMany', () => {
  it('resolves what it can and omits what it cannot', async () => {
    mockFetch((url) => (String(url).includes('good')
      ? okJson({ title: 'Good one' })
      : Promise.resolve({ ok: false, status: 404 })));

    const out = await lookupMany([
      'https://www.youtube.com/watch?v=good',
      'https://www.youtube.com/watch?v=bad',
      'https://example.com/not-a-provider',
    ]);

    expect(Object.keys(out)).toEqual(['https://www.youtube.com/watch?v=good']);
    expect(out['https://www.youtube.com/watch?v=good'].title).toBe('Good one');
  });

  it('one provider blowing up does not lose the others', async () => {
    mockFetch((url) => (String(url).includes('boom')
      ? Promise.reject(new Error('boom'))
      : okJson({ title: 'Fine' })));

    const out = await lookupMany([
      'https://vimeo.com/boom',
      'https://vimeo.com/ok',
    ]);
    expect(out['https://vimeo.com/ok'].title).toBe('Fine');
    expect(out['https://vimeo.com/boom']).toBeUndefined();
  });

  it('dedupes and caps the batch, so one request cannot fan out unbounded', async () => {
    mockFetch(() => okJson({ title: 'T' }));
    const many = Array.from({ length: 60 }, (_, i) => `https://vimeo.com/${i}`);
    await lookupMany([...many, ...many]); // duplicated on purpose
    expect(global.fetch.mock.calls.length).toBeLessThanOrEqual(25);
  });

  it('an empty or junk input is an empty result, not a throw', async () => {
    mockFetch(() => okJson({ title: 'T' }));
    await expect(lookupMany([])).resolves.toEqual({});
    await expect(lookupMany(null)).resolves.toEqual({});
    await expect(lookupMany([null, '', undefined])).resolves.toEqual({});
  });
});
