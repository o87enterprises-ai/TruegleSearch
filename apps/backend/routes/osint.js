const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const router = express.Router();
const config = require('../config/env');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');

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

/**
 * @route   GET /api/osint/username-platforms
 * @desc    Generate platform check URLs for a username (no external API needed)
 * @access  Public
 */
router.get('/username-platforms', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username || username.length < 2 || username.length > 64 || !/^[\w.\-]+$/.test(username)) {
      return res.status(400).json({ error: 'Valid username required (2-64 chars, alphanumeric/_/./-)' });
    }

    const platforms = [
      { name: 'GitHub', url: `https://github.com/${username}`, category: 'dev' },
      { name: 'Twitter / X', url: `https://twitter.com/${username}`, category: 'social' },
      { name: 'Instagram', url: `https://instagram.com/${username}`, category: 'social' },
      { name: 'Reddit', url: `https://reddit.com/user/${username}`, category: 'social' },
      { name: 'LinkedIn', url: `https://linkedin.com/in/${username}`, category: 'professional' },
      { name: 'TikTok', url: `https://tiktok.com/@${username}`, category: 'social' },
      { name: 'YouTube', url: `https://youtube.com/@${username}`, category: 'video' },
      { name: 'Twitch', url: `https://twitch.tv/${username}`, category: 'video' },
      { name: 'Pinterest', url: `https://pinterest.com/${username}`, category: 'social' },
      { name: 'Tumblr', url: `https://${username}.tumblr.com`, category: 'social' },
      { name: 'Medium', url: `https://medium.com/@${username}`, category: 'blog' },
      { name: 'Substack', url: `https://${username}.substack.com`, category: 'blog' },
      { name: 'Mastodon', url: `https://mastodon.social/@${username}`, category: 'social' },
      { name: 'Telegram', url: `https://t.me/${username}`, category: 'messaging' },
      { name: 'Rumble', url: `https://rumble.com/user/${username}`, category: 'video' },
      { name: 'Odysee', url: `https://odysee.com/@${username}`, category: 'video' },
      { name: 'Bitchute', url: `https://bitchute.com/profile/${username}`, category: 'video' },
      { name: 'Keybase', url: `https://keybase.io/${username}`, category: 'identity' },
      { name: 'HackerNews', url: `https://news.ycombinator.com/user?id=${username}`, category: 'dev' },
      { name: 'GitLab', url: `https://gitlab.com/${username}`, category: 'dev' },
    ];

    res.json({ success: true, username, platforms });
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

    let parsed;
    try {
      parsed = parsePhoneNumberWithError(phone, country);
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
      },
    });
  } catch (error) {
    logger.error('phone-intel error:', error.message);
    res.status(500).json({ error: 'Phone lookup failed', details: 'Service unavailable' });
  }
});

module.exports = router;