/**
 * Look at a link BEFORE the user opens it inside Truegle.
 *
 * WHAT THIS CAN AND CANNOT PROVE — read before trusting a verdict.
 * It fetches the page through utils/safeFetch (SSRF-safe, size- and
 * time-capped), then reads three things: the redirect chain, the response
 * headers, and the first part of the HTML. From those it can say:
 *   - where the link REALLY ends up (shorteners and redirects hide this);
 *   - whether it is a web page or a download, and whether the download is a
 *     program;
 *   - whether the site ALLOWS being shown inside another site. This is the one
 *     question a browser cannot answer for itself (see the long note in
 *     frontend utils/embeddable.js): the block is enforced silently on the
 *     response. Reading X-Frame-Options / CSP frame-ancestors HERE is what
 *     turns "is in-app viable?" from a hand-kept list into a real answer;
 *   - a few well-known tricks in the page source (hidden frames, a meta-refresh
 *     to another site, heavily obfuscated script).
 * It CANNOT see what the page does after it loads, cannot run script, and knows
 * no zero-days. "Looks clean" is never "is safe", and the wording the UI shows
 * says so.
 *
 * PRIVACY. No reputation service is called: Safe Browsing, URLhaus and
 * PhishTank all work by being SENT the URL, which this product does not do (see
 * frontend hooks/useLinkSafety.js). The URL goes to Truegle's own server, which
 * fetches it from the target. The target therefore sees Truegle's server, not
 * the visitor's address.
 */
const { safeFetch, FetchRefused } = require('../utils/safeFetch');

const MAX_BYTES = 256 * 1024;
const TIMEOUT_MS = 6000;      // per hop
const OVERALL_MS = 10000;     // the whole check, redirects included

// Content that RUNS when opened. Matched on type and on file extension: a server
// is free to lie about either, so both count.
const EXEC_TYPE = /application\/(x-msdownload|x-msdos-program|vnd\.microsoft\.portable-executable|x-dosexec|x-sh|x-bat|x-msi|java-archive|vnd\.android\.package-archive|x-apple-diskimage|x-executable|x-mach-binary|x-sharedlib)/i;
const EXEC_EXT = /\.(exe|msi|apk|scr|bat|cmd|com|jar|dmg|pkg|vbs|ps1|sh|appimage)$/i;

const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };
// Last two labels: good enough to tell "same site" from "different site".
const baseOf = (host) => host.split('.').filter(Boolean).slice(-2).join('.');

/**
 * Hosts this app is served from: FRONTEND_URL plus the production domain.
 * Kept EXACT — in a CSP `truegle.info` and `www.truegle.info` are different
 * origins, and guessing "allowed" wrongly is the costly direction (a blank frame).
 */
function ourHosts() {
  const out = new Set(['truegle.info', 'www.truegle.info']);
  try { if (process.env.FRONTEND_URL) out.add(new URL(process.env.FRONTEND_URL).hostname.toLowerCase()); } catch { /* ignore */ }
  return out;
}

/** Does one frame-ancestors source token name one of our hosts? */
function tokenIsOurs(token, ours) {
  const wildcard = /^(?:[a-z][a-z0-9+.-]*:\/\/)?\*\.(.+)$/i.exec(token);
  if (wildcard) {
    // `*.base` matches SUBDOMAINS of base only (not base itself), per the CSP spec.
    const base = wildcard[1].replace(/[/:].*$/, '');
    return [...ours].some((h) => h.endsWith(`.${base}`));
  }
  try { return ours.has(new URL(token.includes('://') ? token : `https://${token}`).hostname.toLowerCase()); } catch { return false; }
}

/**
 * Does the response let a page on one of OUR hosts frame it?
 * @returns {{allowed: boolean|null, reason: string}} null = could not tell
 */
function framingOf(headers = {}) {
  const xfo = String(headers['x-frame-options'] || '').toLowerCase().trim();
  const csp = String(headers['content-security-policy'] || '');
  const fa = /(?:^|;)\s*frame-ancestors\s+([^;]+)/i.exec(csp);

  if (fa) {
    const tokens = fa[1].trim().toLowerCase().split(/\s+/);
    if (tokens.includes("'none'")) return { allowed: false, reason: 'The site forbids being shown inside any other site (frame-ancestors none).' };
    if (tokens.includes('*') || tokens.includes('https:')) return { allowed: true, reason: 'The site allows being shown inside other sites.' };
    const ours = ourHosts();
    const hit = tokens.some((t) => tokenIsOurs(t, ours));
    return hit
      ? { allowed: true, reason: 'The site lists Truegle as allowed to show it.' }
      : { allowed: false, reason: 'The site only lets specific other sites show it, and Truegle is not one of them.' };
  }
  if (xfo === 'deny' || xfo === 'sameorigin' || xfo.startsWith('allow-from')) {
    return { allowed: false, reason: 'The site forbids being shown inside other sites (X-Frame-Options).' };
  }
  return { allowed: true, reason: 'The site sends no rule against being shown inside other sites.' };
}

const count = (re, s) => (s.match(re) || []).length;

/**
 * Pure analysis of one fetch. No network — everything it needs is passed in, so
 * it is tested directly.
 */
function analyse({ entered, finalUrl, hops = [], headers = {}, type = '', body = '', truncated = false }) {
  const findings = [];
  const add = (level, text) => findings.push({ level, text });

  const enteredHost = hostOf(entered);
  const finalHost = hostOf(finalUrl);
  const finalPath = (() => { try { return new URL(finalUrl).pathname; } catch { return ''; } })();
  const ct = String(type || headers['content-type'] || '').toLowerCase();
  const disposition = String(headers['content-disposition'] || '').toLowerCase();

  // ── Where it really goes ───────────────────────────────────────────────────
  if (baseOf(enteredHost) !== baseOf(finalHost)) {
    add('caution', `The link does not stay on ${enteredHost}: it ends up on ${finalHost}.`);
  } else if (hops.length > 1) {
    add('info', `Redirected ${hops.length - 1} time${hops.length > 2 ? 's' : ''}, staying on ${baseOf(finalHost)}.`);
  }
  if (hops.some((h, i) => i > 0 && /^http:/i.test(h) && /^https:/i.test(hops[i - 1]))) {
    add('caution', 'The link was moved from an encrypted address to an unencrypted one along the way.');
  }
  if (/^http:/i.test(finalUrl)) add('caution', 'The final page is not encrypted (http), so anything typed there travels in the clear.');

  // ── What it is ─────────────────────────────────────────────────────────────
  const isDownload = /attachment/.test(disposition) || (ct && !/html|xhtml|text\/plain|json|xml|pdf|image\/|video\/|audio\//.test(ct) && ct !== '');
  const runs = EXEC_TYPE.test(ct) || EXEC_EXT.test(finalPath);
  if (runs) add('danger', 'This link is a program, not a page. Opening it would download something that runs on your device.');
  else if (isDownload) add('caution', `This link downloads a file${ct ? ` (${ct.split(';')[0]})` : ''} instead of showing a page.`);

  const isHtml = /html|xhtml/.test(ct) || (!ct && /<html|<!doctype/i.test(body.slice(0, 500)));

  // ── Page-source tricks (HTML only, first slice of the page) ────────────────
  if (isHtml && body) {
    const refresh = /<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url=([^"'>\s]+)/i.exec(body);
    if (refresh) {
      let target = '';
      try { target = new URL(refresh[1], finalUrl).hostname.toLowerCase().replace(/^www\./, ''); } catch { /* ignore */ }
      if (target && baseOf(target) !== baseOf(finalHost)) add('caution', `The page tries to send you on to ${target} automatically.`);
    }
    const hiddenFrames = count(/<iframe[^>]*(?:width=["']?0|height=["']?0|display\s*:\s*none|visibility\s*:\s*hidden)/gi, body);
    if (hiddenFrames) add('caution', `The page hides ${hiddenFrames} embedded frame${hiddenFrames > 1 ? 's' : ''} from view.`);
    const obf = count(/\beval\s*\(|\batob\s*\(|\bunescape\s*\(|String\.fromCharCode\s*\(|document\.write\s*\(\s*unescape/gi, body);
    if (obf >= 8) add('caution', 'The page contains a lot of scrambled script, which is how malicious code is often hidden.');
    if (/<input[^>]+type=["']?password/i.test(body)) add('info', 'The page asks for a password. Only enter one if you trust the site.');
    if (/\b(?:top|parent)\.location\s*=|\bwindow\.top\.location\b|if\s*\(\s*(?:top|window\.top)\s*!==?\s*(?:self|window)/i.test(body)) {
      add('info', 'The page tries to break out of frames, so it may leave Truegle instead of staying inside it.');
    }
  }
  if (truncated) add('info', 'Only the first part of a large page was examined.');

  // ── Can it be shown in the app? ────────────────────────────────────────────
  const framing = framingOf(headers);
  const inAppPossible = isHtml && !isDownload && !runs && framing.allowed !== false;

  const verdict = findings.some((f) => f.level === 'danger') ? 'danger'
    : findings.some((f) => f.level === 'caution') ? 'caution' : 'safe';

  return {
    verdict,
    findings,
    finalUrl,
    hops,
    contentType: ct.split(';')[0] || null,
    isDownload,
    isHtml,
    framing,
    inAppPossible,
  };
}

/**
 * Fetch and analyse. Never throws: a link we cannot read is a normal answer
 * ({ ok:false }), not an error, and the reason is generic on purpose — the
 * detail of why the server could not reach somewhere is not the caller's to see.
 */
async function inspect(entered) {
  // safeFetch's timeout is PER HOP, so a slow redirect chain could otherwise hold
  // a request (and a small free instance) for ~6 x 6s. One overall deadline.
  let timer;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('deadline')), OVERALL_MS); });
  try {
    const res = await Promise.race([
      safeFetch(entered, { timeoutMs: TIMEOUT_MS, maxBytes: MAX_BYTES, maxRedirects: 5 }),
      deadline,
    ]);
    return { ok: true, ...analyse({ entered, finalUrl: res.url, hops: res.hops, headers: res.headers, type: res.type, body: String(res.body || ''), truncated: res.truncated }) };
  } catch (err) {
    if (err instanceof FetchRefused) return { ok: false, reason: 'refused' };
    return { ok: false, reason: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { inspect, analyse, framingOf };
