#!/usr/bin/env node
/* Google Search Console from the command line — the part of SEO that needs a
 * Google account: is each page indexed, and if not, WHY.
 *
 *   node scripts/gsc.mjs sites                 # which properties the key can see (an access check)
 *   node scripts/gsc.mjs sitemap               # (re)submit https://truegle.info/sitemap.xml
 *   node scripts/gsc.mjs inspect [URL …]       # index status + reason for each URL (default: every sitemap URL)
 *   node scripts/gsc.mjs perf [--days 28]      # clicks / impressions / position, by page and by query
 *
 *   --site sc-domain:truegle.info   property (default: $GSC_SITE, else sc-domain:truegle.info)
 *   --out file.json                 also write the full result as JSON (inspect, perf)
 *   --dry                           show what would be called; touch no network
 *
 * WHAT IT CANNOT DO. Google offers no API for "Request indexing" — only the
 * Search Console page does that, and only for the URL Inspection box. This
 * reads what Google decided and resubmits the sitemap; it does not nudge.
 *
 * CREDENTIALS. A service-account key, NOT an API key (an API key cannot read
 * a private property). Put the JSON in the environment, never in the repo or
 * in chat:
 *   GSC_SA_JSON='{"type":"service_account",…}'   the key's contents, or
 *   GSC_SA_FILE=/path/to/key.json                a path to it
 * The service account's email must also be added as a user of the property in
 * Search Console (Settings → Users and permissions) — Google will answer 403
 * "does not have sufficient permission" until it is. The token and key are
 * never printed.
 *
 * Dependency-free: the JWT is signed with node:crypto.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, '..', 'public');
const ORIGIN = 'https://truegle.info';

// Overridable so scripts/verify-gsc.mjs can run against a local stand-in.
const TOKEN_URL = process.env.GSC_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const API = (process.env.GSC_API_BASE || 'https://www.googleapis.com/webmasters/v3').replace(/\/$/, '');
const INSPECT_API = process.env.GSC_INSPECT_URL || 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';
const SCOPE = 'https://www.googleapis.com/auth/webmasters';

const b64u = (b) => Buffer.from(b).toString('base64url');

/** A signed service-account assertion (RFC 7523). Pure apart from the clock. */
export function signJwt(sa, { now = Math.floor(Date.now() / 1000), scope = SCOPE, aud = TOKEN_URL } = {}) {
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT', ...(sa.private_key_id ? { kid: sa.private_key_id } : {}) }));
  const claims = b64u(JSON.stringify({ iss: sa.client_email, scope, aud, iat: now, exp: now + 3600 }));
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${claims}`), sa.private_key);
  return `${head}.${claims}.${b64u(sig)}`;
}

function loadKey(env = process.env) {
  const raw = env.GSC_SA_JSON || (env.GSC_SA_FILE && fs.existsSync(env.GSC_SA_FILE) ? fs.readFileSync(env.GSC_SA_FILE, 'utf8') : '');
  if (!raw) throw new Error('No credentials: set GSC_SA_JSON (the service-account key JSON) or GSC_SA_FILE (a path to it).');
  let sa;
  try { sa = JSON.parse(raw); } catch { throw new Error('GSC_SA_JSON is not valid JSON — paste the whole key file, braces included.'); }
  if (!sa.client_email || !sa.private_key) throw new Error('That JSON has no client_email/private_key — it is not a service-account key.');
  return sa;
}

async function accessToken(sa) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: signJwt(sa) }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) {
    throw new Error(`Google refused the key (HTTP ${res.status}): ${j.error_description || j.error || 'no detail'}`);
  }
  return j.access_token;
}

async function call(token, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { /* an empty 204 */ }
  if (!res.ok) {
    const why = json.error?.message || text.slice(0, 200) || res.statusText;
    const hint = res.status === 403
      ? ' — add the service account\'s email as a user of this property in Search Console (Settings → Users and permissions), and enable the Search Console API on its project.'
      : '';
    throw new Error(`HTTP ${res.status} from ${new URL(url).pathname}: ${why}${hint}`);
  }
  return json;
}

const sitemapUrls = () => [...fs.readFileSync(path.join(pub, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const enc = encodeURIComponent;

// ── commands ────────────────────────────────────────────────────────────────

async function sites(token) {
  const { siteEntry = [] } = await call(token, 'GET', `${API}/sites`);
  if (!siteEntry.length) console.log('The key works, but it can see no properties. Add its email as a user in Search Console.');
  for (const s of siteEntry) console.log(`${s.permissionLevel.padEnd(20)} ${s.siteUrl}`);
}

async function sitemap(token, site) {
  const feed = `${ORIGIN}/sitemap.xml`;
  await call(token, 'PUT', `${API}/sites/${enc(site)}/sitemaps/${enc(feed)}`);
  const s = await call(token, 'GET', `${API}/sites/${enc(site)}/sitemaps/${enc(feed)}`);
  const warn = Number(s.warnings || 0); const err = Number(s.errors || 0);
  console.log(`Submitted ${feed}`);
  console.log(`  last downloaded: ${s.lastDownloaded || 'not yet'} · errors ${err} · warnings ${warn}${s.isPending ? ' · still pending' : ''}`);
  for (const c of s.contents || []) console.log(`  ${c.type}: ${c.submitted} submitted, ${c.indexed ?? 'n/a'} indexed`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function inspect(token, site, urls, out) {
  const rows = [];
  for (const url of urls) {
    // Quota is 600 a minute and 2,000 a day per property; one a moment is polite.
    const r = await call(token, 'POST', INSPECT_API, { inspectionUrl: url, siteUrl: site, languageCode: 'en-US' });
    const ix = r.inspectionResult?.indexStatusResult || {};
    rows.push({
      url,
      verdict: ix.verdict || 'UNKNOWN',
      state: ix.coverageState || 'no data',
      crawled: ix.lastCrawlTime || '',
      canonicalGoogle: ix.googleCanonical || '',
      canonicalUser: ix.userCanonical || '',
      robots: ix.robotsTxtState || '',
      fetch: ix.pageFetchState || '',
    });
    const last = rows[rows.length - 1];
    console.log(`${last.verdict.padEnd(8)} ${last.state.padEnd(42)} ${url}`);
    if (last.canonicalGoogle && last.canonicalUser && last.canonicalGoogle !== last.canonicalUser) {
      console.log(`         ↳ Google chose a different canonical: ${last.canonicalGoogle}`);
    }
    if (process.env.GSC_NO_DELAY !== '1') await sleep(150);
  }
  const tally = rows.reduce((m, r) => ({ ...m, [r.state]: (m[r.state] || 0) + 1 }), {});
  console.log('\nSummary');
  for (const [state, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${state}`);
  if (out) { fs.writeFileSync(out, JSON.stringify(rows, null, 2)); console.log(`\nWrote ${out}`); }
}

async function perf(token, site, days, out) {
  const end = new Date(Date.now() - 2 * 86400000); // Search Console lags about two days
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  const day = (d) => d.toISOString().slice(0, 10);
  const q = (dimensions) => call(token, 'POST', `${API}/sites/${enc(site)}/searchAnalytics/query`,
    { startDate: day(start), endDate: day(end), dimensions, rowLimit: 25 });
  const [byPage, byQuery] = await Promise.all([q(['page']), q(['query'])]);
  const show = (title, rows) => {
    console.log(`\n${title} (${day(start)} → ${day(end)})`);
    console.log('  clicks  impr    ctr   pos  key');
    for (const r of rows || []) {
      console.log(`  ${String(r.clicks).padStart(6)} ${String(r.impressions).padStart(5)} ${(r.ctr * 100).toFixed(1).padStart(5)}% ${r.position.toFixed(1).padStart(5)}  ${r.keys[0]}`);
    }
  };
  show('Top pages', byPage.rows); show('Top queries', byQuery.rows);
  if (out) { fs.writeFileSync(out, JSON.stringify({ pages: byPage.rows || [], queries: byQuery.rows || [] }, null, 2)); console.log(`\nWrote ${out}`); }
}

// ── main ────────────────────────────────────────────────────────────────────

async function main(argv) {
  const [cmd, ...rest] = argv;
  const flag = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };
  const site = flag('--site') || process.env.GSC_SITE || 'sc-domain:truegle.info';
  const out = flag('--out');
  const dry = rest.includes('--dry');
  const days = Math.min(480, Math.max(1, Number(flag('--days')) || 28));
  const skip = new Set(['--site', '--out', '--days']);
  const urls = rest.filter((a, i) => a.startsWith('http') && !skip.has(rest[i - 1]));

  if (!['sites', 'sitemap', 'inspect', 'perf'].includes(cmd)) {
    console.error('Usage: node scripts/gsc.mjs <sites|sitemap|inspect|perf> [options]  (see the header of this file)');
    return 2;
  }
  if (dry) {
    const list = cmd === 'inspect' ? (urls.length ? urls : sitemapUrls()) : [];
    console.log(`[dry] ${cmd} on ${site}${list.length ? ` — ${list.length} URLs` : ''}; no network.`);
    if (list.length) console.log(list.join('\n'));
    try { loadKey(); console.log('[dry] credentials: found and parseable.'); } catch (e) { console.log(`[dry] credentials: ${e.message}`); }
    return 0;
  }
  const token = await accessToken(loadKey());
  if (cmd === 'sites') await sites(token);
  if (cmd === 'sitemap') await sitemap(token, site);
  if (cmd === 'inspect') await inspect(token, site, urls.length ? urls : sitemapUrls(), out);
  if (cmd === 'perf') await perf(token, site, days, out);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(`gsc: ${e.message}`); process.exit(1); });
}
