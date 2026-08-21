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
  // Leading '(' allowed: '(541) 623-0460' is how people actually write it,
  // and requiring a digit first rejected it outright as 'invalid phone'.
  phone: /^\+?[\d(][\d\s().-]{6,}$/,
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

/**
 * Gravatar PROFILE, not just the avatar.
 *
 * emailIntel already asks whether an avatar exists, which answers "is this
 * address attached to something" and nothing else. The profile endpoint keyed
 * on the same md5 hash is the actual find: a display name, a location, a bio,
 * and — most useful of all — the list of OTHER accounts the owner has linked
 * to it themselves. Keyless, server-friendly, and entirely self-published by
 * the account holder, which is exactly the kind of source this toolkit is for.
 */
async function gravatarProfile(email) {
  if (!RE.email.test(email)) return { ok: false, error: 'invalid email' };
  const hash = crypto.createHash('md5').update(String(email).trim().toLowerCase()).digest('hex');
  try {
    const res = await get(`https://gravatar.com/${hash}.json`, { validateStatus: () => true, timeout: 7000 });
    const entry = res.status === 200 && Array.isArray(res.data?.entry) ? res.data.entry[0] : null;
    if (!entry) return { ok: true, found: false };
    return {
      ok: true,
      found: true,
      profileUrl: entry.profileUrl || `https://gravatar.com/${hash}`,
      displayName: entry.displayName || entry.preferredUsername || null,
      name: entry.name?.formatted || null,
      location: entry.currentLocation || null,
      aboutMe: entry.aboutMe || null,
      // Self-linked accounts: platform + handle + URL, straight from the owner.
      accounts: (entry.accounts || []).map((a) => ({
        platform: a.domain || a.shortname || null,
        username: a.username || a.display || null,
        url: a.url || null,
      })).filter((a) => a.url || a.username),
      urls: (entry.urls || []).map((u) => u.value).filter(Boolean),
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Public commits carry the author's email, and GitHub indexes that — so an
 * address can resolve straight to an account. Keyless (60 requests/hour
 * unauthenticated, which is plenty behind the investigation cache).
 */
async function githubByEmail(email) {
  if (!RE.email.test(email)) return { ok: false, error: 'invalid email' };
  try {
    const res = await get('https://api.github.com/search/users', {
      params: { q: `${email} in:email` },
      headers: { Accept: 'application/vnd.github+json' },
      validateStatus: () => true,
      timeout: 7000,
    });
    if (res.status === 403) return { ok: false, error: 'rate limited' };
    if (res.status !== 200) return { ok: false, error: `http ${res.status}` };
    const items = Array.isArray(res.data?.items) ? res.data.items : [];
    return {
      ok: true,
      found: items.length > 0,
      users: items.slice(0, 5).map((u) => ({ login: u.login, profile: u.html_url, avatar: u.avatar_url })),
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * "Which services is this email on?" — the free, lawful answer.
 *
 * A faithful holehe walks ~120 sites' password-reset/registration endpoints to
 * infer whether an address is registered. That is fragile (every one of those
 * forms changes), it is exactly the kind of automated account-enumeration that
 * trips a site's abuse defences from a datacenter IP, and much of it is against
 * those sites' terms — so we do NOT do it. What we do instead is compose the
 * three signals a server can ask for cleanly and lawfully, each labelled by how
 * strong it is:
 *   · Gravatar profile + the accounts its OWNER chose to link there — the
 *     highest-confidence signal, because the person published it themselves.
 *   · GitHub's public commit-email index — an address on a public commit
 *     resolves straight to the account (confirmed).
 *   · The email's LOCAL-PART treated as a username, checked across the
 *     platforms that answer a clean 200/404 — labelled CANDIDATE, because
 *     "jane" in jane@gmail.com being a real handle somewhere is a guess, not a
 *     fact about this address.
 * Everything settles independently so one rate-limit can't empty the list.
 */
async function emailAccounts(email) {
  if (!RE.email.test(email)) return { ok: false, error: 'invalid email' };
  const localPart = String(email).split('@')[0].toLowerCase();
  const [grav, gh, handles] = await Promise.all([
    gravatarProfile(email),
    githubByEmail(email),
    RE.username.test(localPart) ? usernameCheck(localPart) : Promise.resolve(null),
  ]);

  const services = [];
  const seen = new Set();
  const push = (service, url, status, via) => {
    if (!url || !service) return;
    const key = `${String(service).toLowerCase()}|${url}`;
    if (seen.has(key)) return;
    seen.add(key);
    services.push({ service, url, status, via });
  };

  if (grav?.found) {
    push('Gravatar', grav.profileUrl, 'confirmed', 'Gravatar profile for this address');
    (grav.accounts || []).forEach((a) => push(a.platform || 'Linked account', a.url, 'confirmed', 'linked on the Gravatar profile'));
    (grav.urls || []).forEach((u) => push('Website', u, 'confirmed', 'listed on the Gravatar profile'));
  }
  (gh?.users || []).forEach((u) => push('GitHub', u.profile, 'confirmed', 'public commit email'));
  (handles?.results || []).forEach((r) => {
    if (r.found === true && r.profile) push(r.platform, r.profile, 'candidate', 'email local-part as a username');
  });

  return {
    ok: true,
    email: String(email).toLowerCase(),
    localPart,
    derivedUsername: localPart,
    services,
    counts: {
      confirmed: services.filter((s) => s.status === 'confirmed').length,
      candidate: services.filter((s) => s.status === 'candidate').length,
    },
    // So the UI can be honest about a partial answer rather than implying a
    // clean "no accounts found" when a source was simply unreachable.
    sources: {
      gravatar: grav?.ok !== false,
      github: gh?.ok !== false,
      usernameDerivation: !!handles,
    },
  };
}

/**
 * Normalise whatever the user typed into something libphonenumber can parse.
 *
 * THE BUG THIS FIXES: this was called with no `country`, and libphonenumber
 * cannot parse a bare national number without one — it throws INVALID_COUNTRY.
 * Every plain US number a user typed ("5416230460", "(541) 623-0460") came back
 * valid:false, the debrief printed "Not a valid number" about a real, working
 * phone, and the model went on to infer the user had given false details.
 * "I could not tell which country this belongs to" is not "this number is fake",
 * and reporting one as the other is worse than reporting nothing.
 *
 * So: digits are extracted (dropping stray brackets the entity matcher leaves
 * behind), and a 10-digit or 1+10-digit number is treated as North American —
 * which is what a bare number in that shape overwhelmingly is. Anything with an
 * explicit + is left exactly as written.
 */
function normalizePhone(raw, country) {
  const s = String(raw || '').trim();
  if (s.startsWith('+')) return { input: s, region: country ? String(country).toUpperCase() : undefined };
  const digits = s.replace(/\D/g, '');
  if (digits.length === 10) return { input: `+1${digits}`, region: undefined, assumedRegion: 'US' };
  if (digits.length === 11 && digits.startsWith('1')) return { input: `+${digits}`, region: undefined, assumedRegion: 'US' };
  return { input: s, region: country ? String(country).toUpperCase() : 'US', assumedRegion: country ? undefined : 'US' };
}

function phoneIntel(phone, country) {
  if (!RE.phone.test(String(phone || '').trim())) return { ok: false, error: 'invalid phone' };
  try {
    const { parsePhoneNumberWithError } = require('libphonenumber-js/max');
    const norm = normalizePhone(phone, country);
    const parsed = parsePhoneNumberWithError(norm.input, norm.region);
    const regionNames = typeof Intl !== 'undefined' && Intl.DisplayNames ? new Intl.DisplayNames(['en'], { type: 'region' }) : null;
    return {
      ok: true,
      valid: parsed.isValid(),
      type: parsed.getType() || 'unknown',
      country: parsed.country || null,
      countryName: parsed.country && regionNames ? regionNames.of(parsed.country) : null,
      callingCode: parsed.countryCallingCode ? `+${parsed.countryCallingCode}` : null,
      formats: { e164: parsed.number, international: parsed.formatInternational() },
      // Surfaced so a report can say "assumed US" rather than pretending the
      // country was stated.
      assumedRegion: norm.assumedRegion || null,
    };
  } catch (e) {
    // NOT `valid: false`. A parse failure means we could not tell, and saying
    // "invalid" here is what put a false accusation in front of a user.
    return { ok: true, valid: null, parsed: false, reason: e.message || 'could not parse' };
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
// Sites a SERVER can actually ask. That is the whole selection criterion, and
// it is why this list looks nothing like a published OSINT bookmark dump: most
// of the well-known handle checkers are browser-only apps, want their own API
// key, or block datacenter IPs outright, so wrapping them would produce a
// toolbelt that mostly returns errors (see OsintToolbelt's header).
//
// It used to be four developer sites, which is why an ordinary person's handle
// came back with nothing at all — the tool was only capable of finding
// programmers. These are keyless, answer from a datacenter, and give a clean
// exists/does-not signal.
//
// `json` lets a platform judge its own 200: several return HTTP 200 with a
// null or empty body for a handle that does not exist, and counting that as a
// hit is how these checkers end up claiming every account on earth.
const USERNAME_PLATFORMS = [
  { platform: 'GitHub', url: (u) => `https://api.github.com/users/${u}`, profile: (u) => `https://github.com/${u}` },
  { platform: 'Reddit', url: (u) => `https://www.reddit.com/user/${u}/about.json`, profile: (u) => `https://www.reddit.com/user/${u}` },
  { platform: 'GitLab', url: (u) => `https://gitlab.com/api/v4/users?username=${u}`, profile: (u) => `https://gitlab.com/${u}`, isArray: true },
  { platform: 'Dev.to', url: (u) => `https://dev.to/api/users/by_username?url=${u}`, profile: (u) => `https://dev.to/${u}` },
  // Firebase returns 200 + literal `null` for an unknown user.
  { platform: 'Hacker News', url: (u) => `https://hacker-news.firebaseio.com/v0/user/${u}.json`, profile: (u) => `https://news.ycombinator.com/user?id=${u}`, json: (d) => d && typeof d === 'object' },
  { platform: 'Keybase', url: (u) => `https://keybase.io/_/api/1.0/user/lookup.json?username=${u}`, profile: (u) => `https://keybase.io/${u}`, json: (d) => d?.status?.code === 0 && !!d.them },
  { platform: 'Chess.com', url: (u) => `https://api.chess.com/pub/player/${u}`, profile: (u) => `https://www.chess.com/member/${u}` },
  { platform: 'Lichess', url: (u) => `https://lichess.org/api/user/${u}`, profile: (u) => `https://lichess.org/@/${u}`, json: (d) => !!d?.id },
  { platform: 'npm', url: (u) => `https://registry.npmjs.org/-/user/org.couchdb.user:${u}`, profile: (u) => `https://www.npmjs.com/~${u}` },
  { platform: 'PyPI', url: (u) => `https://pypi.org/user/${u}/`, profile: (u) => `https://pypi.org/user/${u}/` },
  { platform: 'Codeberg', url: (u) => `https://codeberg.org/api/v1/users/${u}`, profile: (u) => `https://codeberg.org/${u}` },
  { platform: 'Gravatar', url: (u) => `https://gravatar.com/${u}.json`, profile: (u) => `https://gravatar.com/${u}`, json: (d) => Array.isArray(d?.entry) && d.entry.length > 0 },
  { platform: 'Wikipedia', url: (u) => `https://en.wikipedia.org/w/api.php?action=query&list=users&ususers=${u}&format=json`, profile: (u) => `https://en.wikipedia.org/wiki/User:${u}`, json: (d) => !!d?.query?.users?.[0]?.userid },
  { platform: 'Mastodon (mastodon.social)', url: (u) => `https://mastodon.social/api/v1/accounts/lookup?acct=${u}`, profile: (u) => `https://mastodon.social/@${u}`, json: (d) => !!d?.id },
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
        if (found && p.json) found = !!p.json(res.data);
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
  emailAccounts,
  gravatarProfile,
  githubByEmail,
  phoneIntel,
  normalizePhone,
  certTransparency,
  usernameCheck,
  wayback,
};
