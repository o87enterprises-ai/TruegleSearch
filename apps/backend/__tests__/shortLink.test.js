/**
 * TikTok share links (vm.tiktok.com/…) → the video, nothing else.
 * Owner, 2026-10-06: pasting the TikTok app's "Copy link" into the Feed did
 * nothing — the short link has no video id.
 */
const axios = require('axios');
const { expandShortLink, isShortLink } = require('../services/ShortLinkService');

afterEach(() => jest.restoreAllMocks());

const REAL_TARGET = 'https://www.tiktok.com/@steve_ralph_official/video/7692911186957913374?_d=secCgYI&sec_user_id=MS4wLjABAAAA&share_link_id=fef386f4&user_id=7317853762098676782&utm_campaign=client_share&utm_source=copy';

test('recognises the share-link forms, and nothing else', () => {
  expect(isShortLink('https://vm.tiktok.com/ZP9DxU2eqh4Kh-9N0he/')).toBe(true);
  expect(isShortLink('https://vt.tiktok.com/ZSabc123/')).toBe(true);
  expect(isShortLink('https://www.tiktok.com/t/ZTabc123/')).toBe(true);
  expect(isShortLink('https://www.tiktok.com/@x/video/7692911186957913374')).toBe(false);
  expect(isShortLink('https://evil.example/vm.tiktok.com/abc')).toBe(false);
});

test('follows the redirect and keeps ONLY the canonical video link (no tracking)', async () => {
  jest.spyOn(axios, 'get').mockResolvedValue({ status: 301, headers: { location: REAL_TARGET } });
  const out = await expandShortLink('https://vm.tiktok.com/ZP9DxU2eqh4Kh-9N0he/');
  expect(out).toBe('https://www.tiktok.com/@steve_ralph_official/video/7692911186957913374');
  expect(out).not.toMatch(/user_id|share|utm|checksum/);
});

test('will not follow a redirect off TikTok', async () => {
  jest.spyOn(axios, 'get').mockResolvedValue({ status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } });
  expect(await expandShortLink('https://vm.tiktok.com/ZP9abc/')).toBe(null);
});

test('never fetches anything that is not a share link', async () => {
  const spy = jest.spyOn(axios, 'get');
  expect(await expandShortLink('https://example.com/a')).toBe(null);
  expect(await expandShortLink('https://www.youtube.com/watch?v=abc')).toBe(null);
  expect(spy).not.toHaveBeenCalled();
});

test('a dead link is null, not a throw', async () => {
  jest.spyOn(axios, 'get').mockRejectedValue(new Error('ECONNRESET'));
  expect(await expandShortLink('https://vm.tiktok.com/ZP9abc/')).toBe(null);
});
