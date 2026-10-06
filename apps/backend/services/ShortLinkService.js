/**
 * Share links → the video they point at.
 *
 * Owner, 2026-10-06: pasting a TikTok link into the Feed did nothing. The
 * TikTok app's "Copy link" gives a SHORT link — vm.tiktok.com/ZP9DxU2eqh4… —
 * which carries no video id, so nothing recognised it as playable. It is a
 * redirect to https://www.tiktok.com/@user/video/<id>?…, and the redirect is
 * the only place the id lives.
 *
 * PRIVACY: the redirect target is stuffed with tracking — the sharer's
 * user_id, sec_user_id, share_link_id, checksum, utm_*. None of it is kept:
 * only the canonical /@user/video/<id> comes back, and nothing is logged.
 *
 * SAFETY: this follows redirects on the server, so it is locked to TikTok's
 * own hosts at every hop. It is not a general URL fetcher.
 */
const axios = require('axios');

const SHORT = /^https?:\/\/(?:vm|vt)\.tiktok\.com\/[\w-]+\/?|^https?:\/\/(?:www\.|m\.)?tiktok\.com\/t\/[\w-]+\/?/i;
const TIKTOK_HOST = /(^|\.)tiktok\.com$/i;
const CANONICAL = /^https?:\/\/(?:www\.|m\.)?tiktok\.com\/@([\w.-]+)\/(?:video|photo)\/(\d{8,})/i;
const MAX_HOPS = 4;

const isShortLink = (url) => SHORT.test(String(url || '').trim());

/**
 * @param {string} url  anything; only TikTok short links are expanded
 * @returns {Promise<string|null>} https://www.tiktok.com/@user/video/<id>, or null
 */
async function expandShortLink(url) {
  let current = String(url || '').trim();
  if (!isShortLink(current)) return null;
  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    const host = (() => { try { return new URL(current).hostname; } catch { return ''; } })();
    if (!TIKTOK_HOST.test(host)) return null;           // never leave TikTok
    const m = CANONICAL.exec(current);
    if (m) return `https://www.tiktok.com/@${m[1]}/video/${m[2]}`;
    let res;
    try {
      res = await axios.get(current, {
        maxRedirects: 0,
        validateStatus: (s) => s >= 200 && s < 400,
        timeout: 6000,
        responseType: 'text',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Truegle/1.0; +https://truegle.info)' },
      });
    } catch {
      return null;
    }
    const next = res.headers?.location;
    if (!next) return null;
    current = new URL(next, current).toString();
  }
  return null;
}

module.exports = { expandShortLink, isShortLink };
