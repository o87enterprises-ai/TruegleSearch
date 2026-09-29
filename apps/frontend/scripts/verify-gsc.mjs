/* scripts/gsc.mjs against a local stand-in for Google.
 *
 * Pins what matters when the real key arrives: the JWT is a correctly signed
 * RS256 assertion for the right account, scope and audience; the four commands
 * call the right endpoints and read the answers; a 403 tells the owner the one
 * step that fixes it; a bad or missing key fails with words, not a stack; and
 * the private key and token are never printed.
 *
 * Run it:  npm run gsc:test
 */
import crypto from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { signJwt } from './gsc.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const SA = { type: 'service_account', client_email: 'seo@truegle-test.iam.gserviceaccount.com', private_key: privateKey, private_key_id: 'abc123' };

// ── the JWT itself ──────────────────────────────────────────────────────────
{
  const jwt = signJwt(SA, { now: 1_800_000_000, scope: 'S', aud: 'A' });
  const [h, c, s] = jwt.split('.');
  const head = JSON.parse(Buffer.from(h, 'base64url')); const claims = JSON.parse(Buffer.from(c, 'base64url'));
  check(head.alg === 'RS256' && head.typ === 'JWT' && head.kid === 'abc123', 'header is RS256/JWT with the key id');
  check(claims.iss === SA.client_email && claims.scope === 'S' && claims.aud === 'A', 'claims name the account, scope and audience');
  check(claims.exp - claims.iat === 3600, 'valid for one hour');
  check(crypto.verify('RSA-SHA256', Buffer.from(`${h}.${c}`), publicKey, Buffer.from(s, 'base64url')), 'signature verifies with the matching public key');
}

// ── the stand-in ────────────────────────────────────────────────────────────
const seen = [];
let forbid = false;
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    const url = new URL(req.url, 'http://x');
    seen.push(`${req.method} ${url.pathname}`);
    const json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (url.pathname === '/token') {
      const jwt = new URLSearchParams(body).get('assertion') || '';
      const [h, c, s] = jwt.split('.');
      const valid = s && crypto.verify('RSA-SHA256', Buffer.from(`${h}.${c}`), publicKey, Buffer.from(s, 'base64url'));
      return valid ? json(200, { access_token: 'TOKEN-SECRET-XYZ', expires_in: 3600 }) : json(400, { error: 'invalid_grant', error_description: 'bad signature' });
    }
    if (req.headers.authorization !== 'Bearer TOKEN-SECRET-XYZ') return json(401, { error: { message: 'no token' } });
    if (forbid) return json(403, { error: { message: 'User does not have sufficient permission for site' } });
    if (url.pathname === '/wm/sites') return json(200, { siteEntry: [{ siteUrl: 'sc-domain:truegle.info', permissionLevel: 'siteOwner' }] });
    if (req.method === 'PUT' && url.pathname.includes('/sitemaps/')) { res.writeHead(204); return res.end(); }
    if (url.pathname.includes('/sitemaps/')) return json(200, { lastDownloaded: '2026-09-29T00:00:00Z', errors: '0', warnings: '0', contents: [{ type: 'web', submitted: '40', indexed: '12' }] });
    if (url.pathname === '/inspect') {
      const u = JSON.parse(body).inspectionUrl;
      const indexed = u.endsWith('/');
      return json(200, { inspectionResult: { indexStatusResult: indexed
        ? { verdict: 'PASS', coverageState: 'Submitted and indexed', lastCrawlTime: '2026-09-20T00:00:00Z' }
        : { verdict: 'NEUTRAL', coverageState: 'Duplicate without user-selected canonical', googleCanonical: 'https://truegle.info/', userCanonical: u } } });
    }
    if (url.pathname.endsWith('/searchAnalytics/query')) {
      const dim = JSON.parse(body).dimensions[0];
      return json(200, { rows: [{ keys: [dim === 'page' ? 'https://truegle.info/' : 'truegle'], clicks: 7, impressions: 210, ctr: 0.0333, position: 4.2 }] });
    }
    return json(404, { error: { message: 'unhandled' } });
  });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const run = (args, env = {}) => new Promise((resolve) => {
  const p = spawn('node', [path.join(here, 'gsc.mjs'), ...args], {
    env: { PATH: process.env.PATH, GSC_TOKEN_URL: `http://localhost:${port}/token`, GSC_API_BASE: `http://localhost:${port}/wm`,
      GSC_INSPECT_URL: `http://localhost:${port}/inspect`, GSC_NO_DELAY: '1', ...env },
  });
  let out = ''; p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; });
  p.on('close', (code) => resolve({ code, out }));
});
const withKey = { GSC_SA_JSON: JSON.stringify(SA) };

{
  const r = await run(['sites'], withKey);
  check(r.code === 0 && /siteOwner\s+sc-domain:truegle\.info/.test(r.out), 'sites lists what the key can see', r.out.trim().slice(0, 80));
}
{
  seen.length = 0;
  const r = await run(['sitemap'], withKey);
  check(r.code === 0 && seen.some((s) => s.startsWith('PUT') && s.includes('sitemap.xml')), 'sitemap submits sitemap.xml with PUT');
  check(/40 submitted, 12 indexed/.test(r.out) && /errors 0/.test(r.out), '…and reports what Google made of it', r.out.trim().split('\n').slice(0, 3).join(' | '));
}
{
  const r = await run(['inspect', 'https://truegle.info/', 'https://truegle.info/red'], withKey);
  check(/PASS\s+Submitted and indexed\s+https:\/\/truegle\.info\/\n/.test(r.out), 'inspect reports an indexed page');
  check(/NEUTRAL\s+Duplicate without user-selected canonical/.test(r.out) && /Google chose a different canonical: https:\/\/truegle\.info\//.test(r.out),
    'inspect reports the reason and the canonical Google chose instead');
  check(/1\s+Submitted and indexed/.test(r.out) && /1\s+Duplicate without/.test(r.out), 'inspect prints a tally by reason');
}
{
  const r = await run(['inspect', '--dry'], withKey);
  check(r.code === 0 && /\[dry\] inspect on sc-domain:truegle\.info — \d+ URLs/.test(r.out) && /credentials: found/.test(r.out),
    '--dry lists the sitemap URLs and checks the key without any network', r.out.split('\n')[0]);
}
{
  const r = await run(['perf', '--days', '7'], withKey);
  check(r.code === 0 && /Top pages/.test(r.out) && /Top queries/.test(r.out) && /210/.test(r.out), 'perf prints pages and queries');
}
{
  forbid = true;
  const r = await run(['sites'], withKey);
  forbid = false;
  check(r.code === 1 && /403/.test(r.out) && /Users and permissions/.test(r.out), 'a 403 says to add the service account as a user', r.out.trim().slice(0, 100));
}
{
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const r = await run(['sites'], { GSC_SA_JSON: JSON.stringify({ ...SA, private_key: other.privateKey }) });
  check(r.code === 1 && /refused the key/.test(r.out) && !/at .*gsc\.mjs/.test(r.out), 'a wrong key fails with words, not a stack', r.out.trim().slice(0, 100));
}
{
  const none = await run(['sites']);
  check(none.code === 1 && /No credentials/.test(none.out), 'no key: says which variables to set');
  const junk = await run(['sites'], { GSC_SA_JSON: '{nope' });
  check(junk.code === 1 && /not valid JSON/.test(junk.out), 'junk in the variable: says so');
  const notSa = await run(['sites'], { GSC_SA_JSON: '{"a":1}' });
  check(notSa.code === 1 && /not a service-account key/.test(notSa.out), 'a JSON that is not a service-account key: says so');
  const usage = await run(['bogus'], withKey);
  check(usage.code === 2 && /Usage/.test(usage.out), 'an unknown command prints usage');
}
{
  const all = (await Promise.all([run(['sites'], withKey), run(['inspect', 'https://truegle.info/'], withKey), run(['perf'], withKey)])).map((r) => r.out).join('\n');
  check(!all.includes('TOKEN-SECRET-XYZ') && !all.includes('BEGIN PRIVATE KEY') && !all.includes(SA.private_key.slice(40, 90)),
    'neither the access token nor the private key is ever printed');
}

server.close();
console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
