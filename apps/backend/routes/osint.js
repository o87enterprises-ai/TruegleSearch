const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const router = express.Router();
const config = require('../config/env');
const logger = require('../utils/logger');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { rateLimitSearch } = require('../middleware/rateLimit');
const OsintInvestigationService = require('../services/OsintInvestigationService');
const OsintLookups = require('../services/OsintLookups');
const TokenService = require('../services/TokenService');

// Common disposable / throwaway email domains (small built-in list, no API).
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com',
  'temp-mail.org', 'throwawaymail.com', 'yopmail.com', 'getnada.com',
  'trashmail.com', 'sharklasers.com', 'dispostable.com', 'maildrop.cc',
  'fakeinbox.com', 'mailnesia.com', 'mohmal.com', 'spamgourmet.com',
]);

// Mailbox names that are role/group addresses, not individuals.
const ROLE_EMAIL_LOCALPARTS = new Set([
  'admin', 'administrator', 'info', 'support', 'sales', 'contact', 'help',
  'noreply', 'no-reply', 'webmaster', 'postmaster', 'abuse', 'billing',
  'hello', 'team', 'office', 'marketing', 'hr', 'jobs', 'careers', 'security',
]);

// OSINT search using Hunter.io API
router.get('/email-finder', authenticate, async (req, res) => {
  try {
    const { domain, company, firstName, lastName } = req.query;

    // Validate required parameters
    if (!domain && !company) {
      return res.status(400).json({
        error: 'Either domain or company parameter is required'
      });
    }

    // Check if Hunter.io API key is configured
    if (!config.hunterIo.apiKey) {
      return res.status(500).json({
        error: 'Hunter.io API key is not configured'
      });
    }

    // Prepare query parameters
    const params = {
      domain,
      company,
      first_name: firstName,
      last_name: lastName,
      api_key: config.hunterIo.apiKey
    };

    // Clean up undefined parameters
    Object.keys(params).forEach(key => {
      if (params[key] === undefined) {
        delete params[key];
      }
    });

    // Call the Hunter.io API
    const response = await axios.get('https://api.hunter.io/v2/domain-search', {
      params
    });

    res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    logger.error('Error in email finder:', error);
    
    res.status(500).json({
      error: 'Failed to perform email search',
      details: 'Service unavailable'
    });
  }
});

// Email verification endpoint
router.get('/email-verifier', authenticate, async (req, res) => {
  try {
    const { email } = req.query;

    // Validate required parameters
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({
        error: 'A valid email address is required'
      });
    }

    // Check if Hunter.io API key is configured
    if (!config.hunterIo.apiKey) {
      return res.status(500).json({
        error: 'Hunter.io API key is not configured'
      });
    }

    // Call the Hunter.io API for email verification
    const response = await axios.get('https://api.hunter.io/v2/email-verifier', {
      params: {
        email,
        api_key: config.hunterIo.apiKey
      }
    });

    res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    logger.error('Error in email verifier:', error);
    
    res.status(500).json({
      error: 'Failed to verify email',
      details: 'Service unavailable'
    });
  }
});

// Get account information
router.get('/account-info', authenticate, async (req, res) => {
  try {
    // Check if Hunter.io API key is configured
    if (!config.hunterIo.apiKey) {
      return res.status(500).json({
        error: 'Hunter.io API key is not configured'
      });
    }

    // Call the Hunter.io API to get account information
    const response = await axios.get('https://api.hunter.io/v2/account', {
      params: {
        api_key: config.hunterIo.apiKey
      }
    });

    res.status(200).json({
      success: true,
      data: response.data
    });

  } catch (error) {
    logger.error('Error getting account info:', error);
    
    res.status(500).json({
      error: 'Failed to get account information',
      details: 'Service unavailable'
    });
  }
});

// ---------------------------------------------------------------------------
// Free OSINT tools — no API key required
// ---------------------------------------------------------------------------

/**
 * @route   GET /api/osint/ip-lookup
 * @desc    Geolocate an IP address via ipinfo.io (free, unauthenticated for basic info)
 * @access  Public
 */
router.get('/ip-lookup', async (req, res) => {
  try {
    const { ip } = req.query;
    if (!ip || !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
      return res.status(400).json({ error: 'Valid IPv4 address required' });
    }

    const response = await axios.get(`https://ipinfo.io/${ip}/json`, { timeout: 8000 });
    res.json({ success: true, data: response.data });
  } catch (error) {
    logger.error('IP lookup error:', error.message);
    res.status(500).json({ error: 'IP lookup failed', details: 'Service unavailable' });
  }
});

/**
 * @route   GET /api/osint/dns-lookup
 * @desc    DNS record lookup via Google DNS-over-HTTPS (free, no key)
 * @access  Public
 */
router.get('/dns-lookup', async (req, res) => {
  try {
    const { domain, type = 'A' } = req.query;
    if (!domain || !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
      return res.status(400).json({ error: 'Valid domain required' });
    }

    const validTypes = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA'];
    const recordType = validTypes.includes(type.toUpperCase()) ? type.toUpperCase() : 'A';

    const response = await axios.get('https://dns.google/resolve', {
      params: { name: domain, type: recordType },
      timeout: 8000,
    });

    res.json({ success: true, data: response.data });
  } catch (error) {
    logger.error('DNS lookup error:', error.message);
    res.status(500).json({ error: 'DNS lookup failed', details: 'Service unavailable' });
  }
});

/**
 * @route   GET /api/osint/whois
 * @desc    WHOIS / RDAP lookup via rdap.org (free, no key)
 * @access  Public
 */
router.get('/whois', async (req, res) => {
  try {
    const { domain } = req.query;
    if (!domain || !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
      return res.status(400).json({ error: 'Valid domain required' });
    }

    const response = await axios.get(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      timeout: 10000,
      headers: { Accept: 'application/json' },
    });

    // Parse key fields from RDAP response
    const d = response.data;
    const parsed = {
      domain: d.ldhName || domain,
      status: Array.isArray(d.status) ? d.status : [],
      registrar: d.entities?.find(e => e.roles?.includes('registrar'))?.vcardArray?.[1]
        ?.find(f => f[0] === 'fn')?.[3] || 'Unknown',
      registeredOn: d.events?.find(e => e.eventAction === 'registration')?.eventDate || null,
      updatedOn: d.events?.find(e => e.eventAction === 'last changed')?.eventDate || null,
      expiresOn: d.events?.find(e => e.eventAction === 'expiration')?.eventDate || null,
      nameservers: d.nameservers?.map(ns => ns.ldhName) || [],
      raw: d,
    };

    res.json({ success: true, data: parsed });
  } catch (error) {
    logger.error('WHOIS lookup error:', error.message);
    res.status(500).json({ error: 'WHOIS lookup failed', details: 'Service unavailable' });
  }
});

// Best-effort existence probe. Returns true (found), false (definitely not
// found), or null (couldn't determine — login wall, bot block, timeout).
// Only used for platforms that expose a clean public 404/JSON check.
async function probeExists(kind, handle) {
  const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; TruegleOSINT/1.0)' };
  try {
    if (kind === 'github' || kind === 'gitlab') {
      const base = kind === 'github' ? 'https://github.com' : 'https://gitlab.com';
      const r = await axios.head(`${base}/${handle}`, { timeout: 6000, headers: UA, validateStatus: () => true, maxRedirects: 2 });
      return r.status === 200 ? true : r.status === 404 ? false : null;
    }
    if (kind === 'reddit') {
      const r = await axios.get(`https://www.reddit.com/user/${handle}/about.json`, { timeout: 6000, headers: UA, validateStatus: () => true });
      if (r.status === 404) return false;
      if (r.status === 200 && r.data?.data?.name) return true;
      return null;
    }
    if (kind === 'keybase') {
      const r = await axios.get(`https://keybase.io/_/api/1.0/user/lookup.json?username=${encodeURIComponent(handle)}`, { timeout: 6000, headers: UA, validateStatus: () => true });
      if (r.status === 200 && r.data?.status?.code === 0 && r.data?.them) return true;
      if (r.status === 200 && r.data?.status?.code === 205) return false; // not found
      return null;
    }
    if (kind === 'hackernews') {
      const r = await axios.get(`https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(handle)}.json`, { timeout: 6000, headers: UA, validateStatus: () => true });
      if (r.status === 200) return r.data ? true : false; // null body => no such user
      return null;
    }
    if (kind === 'mastodon') {
      const r = await axios.head(`https://mastodon.social/@${handle}`, { timeout: 6000, headers: UA, validateStatus: () => true, maxRedirects: 2 });
      return r.status === 200 ? true : r.status === 404 ? false : null;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * @route   GET /api/osint/username-platforms
 * @desc    Turn a username OR a real name (spaces / apostrophes / weird input
 *          allowed) into candidate profile links across platforms, probe the
 *          ones that expose a clean public existence check, and label the rest
 *          honestly as "candidate — verify manually". Includes Facebook (both
 *          the public people-directory for names and the vanity-URL for
 *          handles) plus name web-search fallbacks. No API key required.
 * @access  Public
 */
router.get('/username-platforms', async (req, res) => {
  try {
    const raw = String(req.query.username || '').trim();
    if (raw.length < 2 || raw.length > 80) {
      return res.status(400).json({ error: 'Enter a username or name (2–80 characters).' });
    }

    // A "name" is anything with a space or a character that can't be a handle.
    const looksLikeName = /\s/.test(raw) || /[^\w.-]/.test(raw);
    // Slugified handle for handle-based platforms: strip everything but
    // alphanumerics (so "Odin Idesae O'Shea" -> "odinidesaeoshea").
    const handle = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
    // Facebook public directory uses dash-joined name parts.
    const fbNameSlug = raw.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
    const q = encodeURIComponent(raw);

    // Handle-based platforms. `probe` names the existence check to run (if any).
    const handlePlatforms = handle.length >= 2 ? [
      { name: 'GitHub', url: `https://github.com/${handle}`, category: 'dev', probe: 'github' },
      { name: 'GitLab', url: `https://gitlab.com/${handle}`, category: 'dev', probe: 'gitlab' },
      { name: 'Reddit', url: `https://www.reddit.com/user/${handle}`, category: 'social', probe: 'reddit' },
      { name: 'Keybase', url: `https://keybase.io/${handle}`, category: 'identity', probe: 'keybase' },
      { name: 'HackerNews', url: `https://news.ycombinator.com/user?id=${handle}`, category: 'dev', probe: 'hackernews' },
      { name: 'Mastodon', url: `https://mastodon.social/@${handle}`, category: 'social', probe: 'mastodon' },
      { name: 'Twitter / X', url: `https://twitter.com/${handle}`, category: 'social' },
      { name: 'Instagram', url: `https://instagram.com/${handle}`, category: 'social' },
      { name: 'TikTok', url: `https://tiktok.com/@${handle}`, category: 'social' },
      { name: 'YouTube', url: `https://youtube.com/@${handle}`, category: 'video' },
      { name: 'Twitch', url: `https://twitch.tv/${handle}`, category: 'video' },
      { name: 'Telegram', url: `https://t.me/${handle}`, category: 'messaging' },
      { name: 'Medium', url: `https://medium.com/@${handle}`, category: 'blog' },
      { name: 'LinkedIn', url: `https://linkedin.com/in/${handle}`, category: 'professional' },
    ] : [];

    // Facebook: vanity URL for a handle; public people-search for a name.
    const facebook = looksLikeName
      ? [
          { name: 'Facebook (people search)', url: `https://www.facebook.com/public/${encodeURIComponent(fbNameSlug)}`, category: 'social' },
          { name: 'Facebook (search)', url: `https://www.facebook.com/search/top?q=${q}`, category: 'social' },
        ]
      : [{ name: 'Facebook', url: `https://www.facebook.com/${handle}`, category: 'social' }];

    // Name web-search fallbacks — always useful, especially for real names.
    const webSearch = [
      { name: 'Google', url: `https://www.google.com/search?q=${q}`, category: 'search' },
      { name: 'Bing', url: `https://www.bing.com/search?q=${q}`, category: 'search' },
      { name: 'DuckDuckGo', url: `https://duckduckgo.com/?q=${q}`, category: 'search' },
    ];

    const platforms = [...facebook, ...handlePlatforms, ...webSearch].map((p) => ({
      ...p,
      // exists: true/false from a probe, null = candidate (verify manually).
      exists: null,
      checkable: !!p.probe,
    }));

    // Run the cheap existence probes in parallel (bounded set, short timeout).
    await Promise.all(
      platforms.map(async (p) => {
        if (p.probe) p.exists = await probeExists(p.probe, handle);
        delete p.probe;
      })
    );

    res.json({ success: true, username: raw, handle, isName: looksLikeName, platforms });
  } catch (error) {
    logger.error('Username platforms error:', error.message);
    res.status(500).json({ error: 'Username lookup failed' });
  }
});

/**
 * @route   GET /api/osint/email-intel
 * @desc    Free, no-key email intelligence: syntax, role/disposable flags, live
 *          MX check (domain can receive mail), and Gravatar presence.
 * @access  Public
 */
router.get('/email-intel', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return res.status(400).json({ error: 'Valid email address required' });
    }

    const [localPart, domain] = email.split('@');

    // Live MX lookup via Google DNS-over-HTTPS (free, no key).
    let mxRecords = [];
    let mxFound = false;
    try {
      const dns = await axios.get('https://dns.google/resolve', {
        params: { name: domain, type: 'MX' },
        timeout: 8000,
      });
      mxRecords = (dns.data?.Answer || [])
        .filter((a) => a.type === 15) // 15 = MX
        .map((a) => a.data)
        .sort();
      mxFound = mxRecords.length > 0;
    } catch (e) {
      // Non-fatal: report MX as unknown rather than failing the whole lookup.
      logger.warn('email-intel MX lookup failed:', e.message);
    }

    // Gravatar presence: md5 of the normalized email, d=404 → 200 means avatar exists.
    const hash = crypto.createHash('md5').update(email).digest('hex');
    const gravatarUrl = `https://www.gravatar.com/avatar/${hash}`;
    let gravatarExists = false;
    try {
      const g = await axios.get(`${gravatarUrl}?d=404&s=200`, {
        timeout: 8000,
        validateStatus: () => true,
        responseType: 'arraybuffer',
      });
      gravatarExists = g.status === 200;
    } catch (e) {
      logger.warn('email-intel gravatar check failed:', e.message);
    }

    res.json({
      success: true,
      data: {
        email,
        localPart,
        domain,
        validSyntax: true,
        role: ROLE_EMAIL_LOCALPARTS.has(localPart),
        disposable: DISPOSABLE_EMAIL_DOMAINS.has(domain),
        mxFound,
        deliverable: mxFound, // domain accepts mail (best-effort, no SMTP probe)
        mxRecords,
        gravatarExists,
        gravatarUrl: gravatarExists ? `${gravatarUrl}?s=200` : null,
      },
    });
  } catch (error) {
    logger.error('email-intel error:', error.message);
    res.status(500).json({ error: 'Email lookup failed', details: 'Service unavailable' });
  }
});

/**
 * @route   GET /api/osint/phone-intel
 * @desc    Free, no-key phone intelligence via libphonenumber metadata: validity,
 *          line type, country, calling code, and formatted variants.
 * @access  Public
 */
router.get('/phone-intel', async (req, res) => {
  try {
    const phone = String(req.query.phone || '').trim();
    const country = String(req.query.country || '').trim().toUpperCase() || undefined;
    if (!phone) {
      return res.status(400).json({ error: 'Phone number required (include country code, e.g. +14155552671)' });
    }

    // libphonenumber-js/max bundles line-type metadata (mobile vs fixed line).
    const { parsePhoneNumberWithError } = require('libphonenumber-js/max');

    // NORMALIZE FIRST — this is the bug that made a bare 10-digit number report
    // "not a valid number". Handed "5416230460" with no country, libphonenumber
    // cannot infer a region and throws, so the panel's Phone tool showed every
    // un-prefixed US number as invalid. The /investigate path already went
    // through OsintLookups.normalizePhone (which assumes +1 for a 10-digit
    // number); this direct route never did. Reuse the same normalization so both
    // paths agree.
    const norm = OsintLookups.normalizePhone(phone, country);

    let parsed;
    try {
      parsed = parsePhoneNumberWithError(norm.input, norm.region);
    } catch (e) {
      return res.json({
        success: true,
        data: { input: phone, valid: false, reason: e.message || 'Could not parse number' },
      });
    }

    const regionNames =
      typeof Intl !== 'undefined' && Intl.DisplayNames
        ? new Intl.DisplayNames(['en'], { type: 'region' })
        : null;

    res.json({
      success: true,
      data: {
        input: phone,
        valid: parsed.isValid(),
        possible: parsed.isPossible(),
        type: parsed.getType() || 'unknown', // mobile, fixed_line, voip, toll_free, etc.
        country: parsed.country || null,
        countryName: parsed.country && regionNames ? regionNames.of(parsed.country) : null,
        callingCode: parsed.countryCallingCode ? `+${parsed.countryCallingCode}` : null,
        nationalNumber: parsed.nationalNumber || null,
        formats: {
          e164: parsed.number,
          international: parsed.formatInternational(),
          national: parsed.formatNational(),
          uri: parsed.getURI(),
        },
        // Surfaced so the UI can say "assumed US" rather than pretending the
        // country was stated by the user.
        assumedRegion: norm.assumedRegion || null,
      },
    });
  } catch (error) {
    logger.error('phone-intel error:', error.message);
    res.status(500).json({ error: 'Phone lookup failed', details: 'Service unavailable' });
  }
});

/**
 * @route   POST /api/osint/investigate
 * @desc    AI-directed OSINT investigation: detect entities in a free-text
 *          query, run the relevant free lookups in parallel, and synthesize an
 *          investigator's report via Nephesh (Ocean mode). One query, no manual
 *          tool selection. Lawful public-source recon only.
 * @access  Public with optional auth (token-gated for signed-in users)
 * @body    { query: string }
 */
router.post('/investigate', optionalAuth, rateLimitSearch, async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid request', message: 'Query is required' });
    }

    const user = req.user;
    const isAuthed = user?.isAuthenticated && user?.userId;
    if (isAuthed) {
      const canAccess = await TokenService.canAccessFeature(user.userId, 'ai-chat');
      if (!canAccess) {
        return res.status(402).json({
          error: 'Insufficient tokens',
          message: 'Not enough tokens for an investigation. Please watch an ad or upgrade your account.',
        });
      }
    }

    const result = await OsintInvestigationService.investigate(query.trim());

    if (result.noEntities) {
      return res.json({
        success: true,
        query: query.trim(),
        noEntities: true,
        report: null,
        message: 'No investigable entity (domain, IP, email, username, or phone) found in the query.',
        timestamp: new Date().toISOString(),
      });
    }

    if (isAuthed) await TokenService.spendToken(user.userId, 'ai-chat');

    logger.info('OSINT investigation complete:', {
      userId: isAuthed ? user.userId : 'guest',
      entities: result.entities.length,
      provider: result.provider,
    });

    res.json({ success: true, query: query.trim(), ...result, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('OSINT investigate error:', error.message);
    res.status(500).json({ error: 'Investigation failed', message: 'Unable to complete the investigation right now.' });
  }
});

module.exports = router;