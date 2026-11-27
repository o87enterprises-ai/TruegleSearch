/**
 * Feed channel lookup: a creator's name finds the channel, a Facebook link
 * resolves to its page. Both shapes were checked against the live services on
 * 2026-11-21 — `@criscoart` exists on TikTok but is a different account
 * (user28445693846); `@crisco_art` is the one called "Crisco_Art".
 */
jest.mock('axios');
const axios = require('axios');
const { lookupChannels, handleGuesses, facebookUrlOf, cleanFacebookUrl } = require('../services/feed/ChannelLookup');

beforeEach(() => { axios.get.mockReset(); });

describe('handleGuesses', () => {
  test('a two-word name tries underscore, joined and dotted handles', () => {
    expect(handleGuesses('Crisco Art')).toEqual(['crisco_art', 'criscoart', 'crisco.art']);
  });
  test('a leading @ is a handle and stays one guess', () => {
    expect(handleGuesses('@NASA')).toEqual(['nasa']);
  });
  test('a sentence is not a name', () => {
    expect(handleGuesses('why is the sky blue today friend')).toEqual([]);
  });
});

describe('TikTok channel by name', () => {
  test('keeps only the account whose display name is the name typed', async () => {
    axios.get.mockImplementation(async (url, opts) => {
      const handle = String(opts?.params?.url || '').split('@')[1];
      if (handle === 'crisco_art') return { data: { author_name: 'Crisco_Art' } };
      if (handle === 'criscoart') return { data: { author_name: 'user28445693846' } }; // same handle guess, someone else
      throw Object.assign(new Error('400'), { response: { status: 400 } });
    });
    const { items } = await lookupChannels('Crisco Art', { facebook: false });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ platform: 'TikTok', title: 'Crisco_Art', url: 'https://www.tiktok.com/@crisco_art', channel: true });
  });

  test('a name with no matching account is an empty lane, not an error', async () => {
    axios.get.mockRejectedValue(new Error('400'));
    await expect(lookupChannels('Zzqx Wvut', {})).resolves.toEqual({ items: [], next: null });
  });

  test('does nothing when TikTok is not among the requested platforms', async () => {
    const r = await lookupChannels('Crisco Art', { tiktok: false });
    expect(r.items).toEqual([]);
    expect(axios.get).not.toHaveBeenCalled();
  });
});

describe('Facebook links', () => {
  const page = '<meta property="og:title" content="Crisco Art" /><meta property="og:description" content="Crisco Art. 3M followers &#xb7; The artist" />'
    + '<meta property="og:image" content="https://scontent.xx.fbcdn.net/a.jpg?x=1&amp;y=2" /><meta property="og:url" content="https://www.facebook.com/criscoart" />';

  test('only a Facebook-owned URL counts', () => {
    expect(facebookUrlOf('https://www.facebook.com/share/1A7wTiHLM7/')).toBeTruthy();
    expect(facebookUrlOf('https://fb.watch/abc/')).toBeTruthy();
    expect(facebookUrlOf('https://evil.example/facebook.com/x')).toBeNull();
    expect(facebookUrlOf('https://notfacebook.com/x')).toBeNull();
    expect(facebookUrlOf('crisco art')).toBeNull();
  });

  test('a share link resolves to the page and its preview card', async () => {
    axios.get
      .mockResolvedValueOnce({ status: 302, headers: { location: 'https://www.facebook.com/criscoart?rdid=x&share_url=y' }, data: '' })
      .mockResolvedValueOnce({ status: 200, headers: {}, data: page });
    const { items } = await lookupChannels('https://www.facebook.com/share/1A7wTiHLM7/', {});
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ platform: 'Facebook', title: 'Crisco Art', url: 'https://www.facebook.com/criscoart', channel: true });
    expect(items[0].snippet).toContain('3M followers');
    expect(items[0].thumbnail).toBe('https://scontent.xx.fbcdn.net/a.jpg?x=1&y=2');
  });

  test('never follows a redirect off Facebook', async () => {
    axios.get.mockResolvedValueOnce({ status: 302, headers: { location: 'https://evil.example/steal' }, data: '' });
    const { items } = await lookupChannels('https://www.facebook.com/share/OFFSITE1/', {});
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(items[0].url).not.toContain('evil.example');
  });

  test('strips share and tracking parameters', () => {
    expect(cleanFacebookUrl('https://www.facebook.com/criscoart/?rdid=a&share_url=b')).toBe('https://www.facebook.com/criscoart');
    expect(cleanFacebookUrl('https://www.facebook.com/profile.php?id=123&sk=x')).toBe('https://www.facebook.com/profile.php?id=123');
  });
});
