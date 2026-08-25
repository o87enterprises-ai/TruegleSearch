import { useEffect, useMemo, useState } from 'react';

/* ── Link health check ──────────────────────────────────────────────────────
 *
 * WHAT THIS IS, said honestly up front: a STRUCTURAL check of the URL itself,
 * run entirely in the browser. It reads the address the way a suspicious person
 * would and reports what it finds. It does not fetch the page, so it cannot see
 * the page's contents, and it therefore cannot tell you a site is safe. It can
 * only tell you when an address is shaped like one used to trick people.
 *
 * WHY IT IS NOT A REPUTATION LOOKUP, which is what "check links for malicious
 * code" usually means. Every free blocklist API — Safe Browsing, URLhaus,
 * PhishTank — works by SENDING THEM THE URL. On a product whose entire promise
 * is that nobody is told what you looked at, shipping every link a user pastes
 * to a third party would trade the one thing Truegle sells for a green tick.
 * That trade is not available, so the default check is local and costs nothing
 * in money or privacy.
 *
 * THE UPGRADE PATH, if a reputation check is ever wanted: it has to run on OUR
 * backend, not the browser, so the provider sees Truegle's server rather than
 * the user's IP, and it has to be opt-in. Google Safe Browsing's Update API is
 * the one that fits — it ships hash PREFIXES to the client and never learns the
 * full URL. That is a real project, not a flag, and it is deliberately not
 * pretended at here.
 *
 * THE RULE THE WORDING FOLLOWS: never claim more than the check proved.
 * "Looks clean" is not "is safe", and every verdict lists its reasons so the
 * user can disagree with it.
 */

export const VERDICT = {
  SAFE: 'safe',
  CAUTION: 'caution',
  DANGER: 'danger',
  UNKNOWN: 'unknown',
};

// TLDs with a well-documented abuse problem, or that collide with a file
// extension (.zip and .mov are read as filenames by humans, which is the whole
// trick). Presence here is a nudge, never a verdict on its own.
const RISKY_TLDS = new Set([
  'zip', 'mov', 'tk', 'ml', 'ga', 'cf', 'gq', 'top', 'xyz', 'work',
  'click', 'link', 'country', 'kim', 'science', 'party', 'review',
]);

// Shorteners hide the destination, which is not malicious by itself but does
// mean the address tells you nothing. Worth saying so.
const SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
  'rebrand.ly', 'cutt.ly', 'shorturl.at', 'rb.gy', 'tiny.cc', 'lnkd.in',
]);

// Downloads that RUN. A link that ends in one of these is asking to execute
// something on the user's machine and deserves to be called out.
const EXECUTABLE = /\.(exe|msi|apk|scr|bat|cmd|com|jar|dmg|pkg|vbs|ps1|sh)$/i;

// Brands impersonated often enough that seeing the name somewhere OTHER than
// the registered domain is a signal. Matching is deliberately narrow — the name
// must appear in the host but not as the actual registrable domain.
const IMPERSONATED = [
  'paypal', 'apple', 'microsoft', 'google', 'amazon', 'netflix', 'facebook',
  'instagram', 'whatsapp', 'coinbase', 'binance', 'metamask', 'steam',
  'chase', 'wellsfargo', 'dhl', 'fedex', 'usps',
];

/** The registrable-ish domain: last two labels. Good enough for these checks. */
function baseDomain(host) {
  const parts = host.split('.').filter(Boolean);
  return parts.slice(-2).join('.');
}

/**
 * Inspect a URL's structure. Pure, synchronous, no network.
 * @returns {{verdict: string, reasons: string[]}}
 */
export function inspectUrl(raw) {
  if (!raw) return { verdict: VERDICT.UNKNOWN, reasons: [] };

  let u;
  try { u = new URL(raw); } catch {
    return { verdict: VERDICT.UNKNOWN, reasons: ['That address could not be read as a URL.'] };
  }

  const reasons = [];
  const flags = { danger: false, caution: false };
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const base = baseDomain(host);

  // ── Outright red flags ───────────────────────────────────────────────────
  if (u.username || u.password) {
    flags.danger = true;
    reasons.push('The address carries a username before the site name — a classic way to disguise where a link really goes.');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    flags.danger = true;
    reasons.push(`Unusual scheme "${u.protocol.replace(':', '')}" — only http and https are ordinary web links.`);
  }
  if (host.startsWith('xn--') || host.includes('.xn--')) {
    flags.danger = true;
    reasons.push('The site name uses non-Latin characters that can be drawn to look like a familiar brand.');
  }
  if (EXECUTABLE.test(u.pathname)) {
    flags.danger = true;
    reasons.push('This link points at a program, not a page. Opening it downloads something that runs.');
  }

  // ── Worth a second look ──────────────────────────────────────────────────
  if (u.protocol === 'http:') {
    flags.caution = true;
    reasons.push('Not encrypted (http, not https) — anything you type there travels in the clear.');
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) {
    flags.caution = true;
    reasons.push('The address is a raw server number rather than a site name.');
  }
  if (SHORTENERS.has(base)) {
    flags.caution = true;
    reasons.push('A shortened link — the address does not say where it actually ends up.');
  }
  const tld = host.split('.').pop();
  if (RISKY_TLDS.has(tld)) {
    flags.caution = true;
    reasons.push(`The .${tld} ending is one attackers use disproportionately often.`);
  }
  const impersonated = IMPERSONATED.find((brand) => host.includes(brand) && !base.startsWith(`${brand}.`));
  if (impersonated) {
    flags.caution = true;
    reasons.push(`"${impersonated}" appears in the address, but the actual site is ${base} — not ${impersonated}'s own domain.`);
  }
  if (host.split('.').length > 4) {
    flags.caution = true;
    reasons.push('An unusually deep run of subdomains, which is often used to bury the real site name.');
  }
  if (raw.length > 300) {
    flags.caution = true;
    reasons.push('A very long address — long enough to push the real destination out of sight.');
  }

  if (flags.danger) return { verdict: VERDICT.DANGER, reasons };
  if (flags.caution) return { verdict: VERDICT.CAUTION, reasons };

  return {
    verdict: VERDICT.SAFE,
    reasons: [
      `Encrypted (https) and served by ${base} itself.`,
      // The limit of the check, stated on the card rather than buried in a
      // policy page. A user who thinks this means "scanned for viruses" has
      // been misled by us, not by the site.
      'Checked on your device — the address structure only. Truegle did not open the page, and nobody was told you looked at it.',
    ],
  };
}

/**
 * React wrapper. Kept async-shaped (a `loading` flag) even though the check is
 * synchronous, so a future backend reputation leg can slot in without every
 * caller changing.
 */
export function useLinkSafety(url) {
  const result = useMemo(() => inspectUrl(url), [url]);
  const [loading, setLoading] = useState(false);

  // No network call today, so nothing to wait for. The flag exists for the
  // shape, not for a spinner nobody will ever see.
  useEffect(() => { setLoading(false); }, [url]);

  return { ...result, loading };
}

export default useLinkSafety;
