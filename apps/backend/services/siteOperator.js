/**
 * The `site:` operator, honoured the way Google honours it: ONLY that site.
 *
 * Owner audit, 2026-10-08 ("make sure results aren't being blocked or
 * censored"): `site:aljazeera.com` came back mixed with grocery stores and
 * `site:4chan.org` with car listings — some upstream engines ignore the
 * operator, or (under strict Safe Search) quietly drop the named site and
 * answer something else. Padding the page with unrelated sites hides what
 * really happened. Now a `site:` search shows that site's pages and nothing
 * else; when there are none, the page says so (and, with Safe Search on, that
 * Safe Search may be why) instead of disguising it.
 *
 * One `site:` term only. `site:a OR site:b` and `-site:` are left to the
 * engines as typed.
 */
const SITE = /(?:^|\s)site:([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?=\s|$)/gi;

function siteOperatorDomain(query) {
  const q = String(query || '');
  if (/\bOR\b/.test(q) || /(^|\s)-site:/i.test(q)) return null;
  const hits = [...q.matchAll(SITE)];
  if (hits.length !== 1) return null;
  return hits[0][1].toLowerCase().replace(/^www\./, '');
}

function onlyFromSite(results, domain) {
  if (!domain) return results;
  return (results || []).filter((r) => {
    try {
      const host = new URL(r.url).hostname.toLowerCase().replace(/^www\./, '');
      return host === domain || host.endsWith(`.${domain}`);
    } catch { return false; }
  });
}

module.exports = { siteOperatorDomain, onlyFromSite };
