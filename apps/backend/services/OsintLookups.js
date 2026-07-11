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

// US state name → 2-letter code, for building people-search deep links.
const US_STATES = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
};

const digits = (s) => String(s || '').replace(/\D/g, '');

/**
 * Build deep links into PUBLIC people-search / public-records directories for a
 * person. Pure URL construction — no scraping, no API key. These are the same
 * public directories anyone can use (Whitepages, TruePeopleSearch, etc.); we
 * just pre-fill the search so the user (or the report) has one-click access.
 */
function peopleSearchLinks({ name, city, state } = {}) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ');
  if (!clean) return { ok: false, error: 'name required' };
  const parts = clean.split(' ');
  const first = parts[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const stateCode = state ? (US_STATES[state.toLowerCase()] || (state.length === 2 ? state.toUpperCase() : '')) : '';
  const citySlug = city ? city.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '';
  const cityState = [city, stateCode].filter(Boolean).join(', ');

  const links = [
    { name: 'TruePeopleSearch', url: `https://www.truepeoplesearch.com/results?name=${encodeURIComponent(clean)}${cityState ? `&citystatezip=${encodeURIComponent(cityState)}` : ''}` },
    { name: 'FastPeopleSearch', url: `https://www.fastpeoplesearch.com/name/${slug}${citySlug && stateCode ? `_${citySlug}-${stateCode.toLowerCase()}` : ''}` },
    { name: 'ThatsThem', url: `https://thatsthem.com/name/${[first, last].filter(Boolean).join('-')}${cityState ? `/${encodeURIComponent(cityState)}` : ''}` },
    { name: 'Whitepages', url: `https://www.whitepages.com/name/${[first, last].filter(Boolean).join('-')}${citySlug && stateCode ? `/${citySlug}-${stateCode.toLowerCase()}` : ''}` },
    { name: 'Google (exact name)', url: `https://www.google.com/search?q=${encodeURIComponent(`"${clean}"${cityState ? ` "${cityState}"` : ''}`)}` },
    { name: 'VoterRecords', url: `https://voterrecords.com/voters/${slug}/1` },
  ];
  return { ok: true, name: clean, cityState: cityState || null, links };
}

/**
 * Build deep links into PUBLIC reverse-phone directories for a phone number.
 * Pure URL construction — no scraping, no API key.
 */
function phoneSearchLinks(phone) {
  const d = digits(phone);
  if (d.length < 10) return { ok: false, error: 'need a 10-digit number' };
  const nanp = d.length === 11 && d.startsWith('1') ? d.slice(1) : d.slice(-10);
  const pretty = `(${nanp.slice(0, 3)}) ${nanp.slice(3, 6)}-${nanp.slice(6)}`;
  const area = nanp.slice(0, 3);
  return {
    ok: true,
    number: nanp,
    formatted: pretty,
    links: [
      { name: 'TruePeopleSearch (reverse phone)', url: `https://www.truepeoplesearch.com/resultphone?phoneno=${nanp}` },
      { name: 'FastPeopleSearch (reverse phone)', url: `https://www.fastpeoplesearch.com/${nanp}` },
      { name: 'ThatsThem (reverse phone)', url: `https://thatsthem.com/phone/${nanp.slice(0, 3)}-${nanp.slice(3, 6)}-${nanp.slice(6)}` },
      { name: 'Google (exact number)', url: `https://www.google.com/search?q=${encodeURIComponent(`"${pretty}" OR "${nanp}"`)}` },
    ],
    areaCode: area,
  };
}

module.exports = {
  RE,
  US_STATES,
  peopleSearchLinks,
  phoneSearchLinks,
  whois,
  dns,
  ipGeo,
  emailIntel,
  phoneIntel,
  certTransparency,
  usernameCheck,
  wayback,
};
