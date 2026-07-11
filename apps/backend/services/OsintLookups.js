/**
 * OsintLookups — free, no-shell, no-install OSINT data sources.
 *
 * Every function calls a FIXED upstream service with a regex-validated,
 * URL-encoded entity as a parameter (never as a URL), so there is no SSRF
 * surface and no code-execution path. All are best-effort: they resolve to a
 * result object or `{ ok: false, error }` and never throw, so an investigation
 * degrades gracefully when one source is down or rate-limits.
 */

const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

const UA = 'TruegleOSINT/1.0 (+https://truegle.info)';
const get = (url, opts = {}) =>
  axios.get(url, { timeout: 8000, headers: { 'User-Agent': UA, ...(opts.headers || {}) }, ...opts });

const RE = {
  domain: /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i,
  ip: /^(\d{1,3}\.){3}\d{1,3}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  username: /^[a-z0-9_.-]{2,39}$/i,
  phone: /^\+?[\d][\d\s().-]{6,}$/,
};

async function whois(domain) {
  if (!RE.domain.test(domain)) return { ok: false, error: 'invalid domain' };
  try {
    const { data: d } = await get(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      headers: { Accept: 'application/json' },
      timeout: 10000,
    });
    return {
      ok: true,
      domain: d.ldhName || domain,
      status: Array.isArray(d.status) ? d.status : [],
      registrar: d.entities?.find((e) => e.roles?.includes('registrar'))?.vcardArray?.[1]
        ?.find((f) => f[0] === 'fn')?.[3] || 'Unknown',
      registeredOn: d.events?.find((e) => e.eventAction === 'registration')?.eventDate || null,
      updatedOn: d.events?.find((e) => e.eventAction === 'last changed')?.eventDate || null,
      expiresOn: d.events?.find((e) => e.eventAction === 'expiration')?.eventDate || null,
      nameservers: d.nameservers?.map((ns) => ns.ldhName) || [],
    };
  } catch (e) {
    logger.warn('osint whois failed:', e.message);
    return { ok: false, error: 'lookup failed' };
  }
}

async function dns(domain, types = ['A', 'AAAA', 'MX', 'NS', 'TXT']) {
  if (!RE.domain.test(domain)) return { ok: false, error: 'invalid domain' };
  const out = {};
  await Promise.all(
    types.map(async (type) => {
      try {
        const { data } = await get('https://dns.google/resolve', { params: { name: domain, type } });
        out[type] = (data.Answer || []).map((a) => a.data);
      } catch {
        out[type] = [];
      }
    })
  );
  return { ok: true, records: out };
}

async function ipGeo(ip) {
  if (!RE.ip.test(ip)) return { ok: false, error: 'invalid ip' };
  try {
    const { data } = await get(`https://ipinfo.io/${encodeURIComponent(ip)}/json`);
    return { ok: true, ...data };
  } catch (e) {
    logger.warn('osint ipGeo failed:', e.message);
    return { ok: false, error: 'lookup failed' };
  }
}

async function emailIntel(email) {
  if (!RE.email.test(email)) return { ok: false, error: 'invalid email' };
  const [localPart, domain] = email.toLowerCase().split('@');
  const result = { ok: true, email: email.toLowerCase(), localPart, domain, mxFound: false, mxRecords: [], gravatarExists: false };
  try {
    const { data } = await get('https://dns.google/resolve', { params: { name: domain, type: 'MX' } });
    result.mxRecords = (data.Answer || []).filter((a) => a.type === 15).map((a) => a.data).sort();
    result.mxFound = result.mxRecords.length > 0;
  } catch { /* non-fatal */ }
  try {
    const hash = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
    const g = await get(`https://www.gravatar.com/avatar/${hash}?d=404&s=200`, {
      validateStatus: () => true,
      responseType: 'arraybuffer',
    });
    result.gravatarExists = g.status === 200;
    if (result.gravatarExists) result.gravatarUrl = `https://www.gravatar.com/avatar/${hash}?s=200`;
  } catch { /* non-fatal */ }
  return result;
}

function phoneIntel(phone, country) {
  if (!RE.phone.test(String(phone || '').trim())) return { ok: false, error: 'invalid phone' };
  try {
    const { parsePhoneNumberWithError } = require('libphonenumber-js/max');
    const parsed = parsePhoneNumberWithError(String(phone).trim(), country ? String(country).toUpperCase() : undefined);
    const regionNames = typeof Intl !== 'undefined' && Intl.DisplayNames ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
    return {
      ok: true,
      valid: parsed.isValid(),
      type: parsed.getType() || 'unknown',
      country: parsed.country || null,
      countryName: parsed.country && regionNames ? regionNames.of(parsed.country) : null,
      callingCode: parsed.countryCallingCode ? `+${parsed.countryCallingCode}` : null,
      formats: { e164: parsed.number, international: parsed.formatInternational() },
    };
  } catch (e) {
    return { ok: true, valid: false, reason: e.message || 'could not parse' };
  }
}

// Certificate transparency: enumerate subdomains via crt.sh. Slow upstream, so
// a tight timeout and non-fatal — subdomain enumeration is a bonus, not core.
async function certTransparency(domain) {
  if (!RE.domain.test(domain)) return { ok: false, error: 'invalid domain' };
  try {
    const { data } = await get(`https://crt.sh/?q=${encodeURIComponent('%.' + domain)}&output=json`, { timeout: 7000 });
    const names = new Set();
    (Array.isArray(data) ? data : []).forEach((row) => {
      String(row.name_value || '').split('\n').forEach((n) => {
        const name = n.trim().toLowerCase();
        if (name && !name.startsWith('*') && name.endsWith(domain)) names.add(name);
      });
    });
    return { ok: true, subdomains: [...names].sort().slice(0, 50), count: names.size };
  } catch (e) {
    logger.warn('osint crt.sh failed:', e.message);
    return { ok: false, error: 'lookup failed' };
  }
}

// Live username presence check across platforms with clean 200/404 semantics.
const USERNAME_PLATFORMS = [
  { platform: 'GitHub', url: (u) => `https://api.github.com/users/${u}`, profile: (u) => `https://github.com/${u}` },
  { platform: 'Reddit', url: (u) => `https://www.reddit.com/user/${u}/about.json`, profile: (u) => `https://www.reddit.com/user/${u}` },
  { platform: 'GitLab', url: (u) => `https://gitlab.com/api/v4/users?username=${u}`, profile: (u) => `https://gitlab.com/${u}`, isArray: true },
  { platform: 'Dev.to', url: (u) => `https://dev.to/api/users/by_username?url=${u}`, profile: (u) => `https://dev.to/${u}` },
];

async function usernameCheck(username) {
  if (!RE.username.test(username)) return { ok: false, error: 'invalid username' };
  const u = encodeURIComponent(username);
  const results = await Promise.all(
    USERNAME_PLATFORMS.map(async (p) => {
      try {
        const res = await get(p.url(u), { validateStatus: () => true, timeout: 7000 });
        let found = res.status === 200;
        if (found && p.isArray) found = Array.isArray(res.data) && res.data.length > 0;
        return { platform: p.platform, found, profile: found ? p.profile(username) : null };
      } catch {
        return { platform: p.platform, found: null, profile: null }; // null = check failed
      }
    })
  );
  return { ok: true, results };
}

// Wayback Machine: is there an archived snapshot, and the latest one.
async function wayback(target) {
  const t = String(target || '').trim();
  if (!t) return { ok: false, error: 'invalid target' };
  try {
    const { data } = await get('https://archive.org/wayback/available', { params: { url: t }, timeout: 8000 });
    const snap = data?.archived_snapshots?.closest;
    return snap?.available
      ? { ok: true, archived: true, snapshot: snap.url, timestamp: snap.timestamp }
      : { ok: true, archived: false };
  } catch (e) {
    logger.warn('osint wayback failed:', e.message);
    return { ok: false, error: 'lookup failed' };
  }
}

module.exports = {
  RE,
  whois,
  dns,
  ipGeo,
  emailIntel,
  phoneIntel,
  certTransparency,
  usernameCheck,
  wayback,
};
