/* Reddit app-only OAuth, checked against the real Reddit.
 *
 * WHY THIS EXISTS: the agent sandbox cannot reach Reddit — the egress proxy
 * answers 403 to CONNECT for www.reddit.com and oauth.reddit.com — so the
 * token exchange in services/social/RedditAppToken.js could not be run where
 * it was written. Code that has never once executed and looks finished is the
 * exact failure this repo has been bitten by before, so it is not called done
 * until this script passes on a machine with normal outbound network.
 *
 * It answers the three things that cannot be reasoned out from the docs:
 *
 *   1. Does a SCRIPT app accept grant_type=client_credentials at all?
 *   2. Can an app-only token (no user attached) read public listings?
 *   3. What is the REAL rate budget? That number sizes the feed's fan-out and
 *      its cache TTLs, and guessing it wrong is how a feed 429s in production.
 *
 * Run it from anywhere with normal outbound network:
 *
 *   REDDIT_CLIENT_ID=... REDDIT_CLIENT_SECRET=... \
 *   REDDIT_USER_AGENT='TruegleSearch/1.0 by u/YourName' \
 *   node apps/backend/scripts/verify-reddit-auth.mjs
 *
 * Or put those three in apps/backend/.env and use `npm run redditauth:test`.
 *
 * IT PRINTS NO SECRET AND NO TOKEN. Every line of its output is safe to paste
 * into a chat, an issue or a commit. That is deliberate: the whole point is
 * that someone else can run it and report back.
 *
 * Exit 0 = app-only auth works; the feed can stop being blocked.
 * Exit 1 = Reddit ANSWERED but refused, or answered in a shape the adapter
 *          cannot use. The report names which.
 * Exit 2 = nothing was reachable, so nothing was asserted. A network result,
 *          never a verdict on the code.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// RedditAppToken.js requires nothing — node builtins and global fetch only —
// which is what lets this run before `npm install` has ever been executed.
const { fromEnv } = require('../services/social/RedditAppToken.js');

// A bare-bones .env reader so the three variables can live in the usual place
// without dragging dotenv (and therefore node_modules) into this script.
function loadEnvFile() {
  for (const p of [join(here, '..', '.env'), join(here, '..', '..', '..', '.env')]) {
    let raw;
    try { raw = readFileSync(p, 'utf8'); } catch { continue; }
    for (const line of raw.split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const key = m[1];
      if (process.env[key] !== undefined) continue;      // real env wins
      process.env[key] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
}
loadEnvFile();

const ok = []; const bad = []; const note = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);
const str = (v) => typeof v === 'string' && v.length > 0;

const UA = process.env.REDDIT_USER_AGENT
  || 'TruegleSearch/1.0 (aggregated feed; +https://truegle.info)';

function report(code) {
  ok.forEach((l) => console.log(l));
  note.forEach((l) => console.log(l));
  if (bad.length) {
    console.log('');
    bad.forEach((l) => console.log(l));
    console.log(`\n${bad.length} failed, ${ok.length} passed`);
  } else if (code === 0) {
    console.log(`\nall ${ok.length} passed — app-only auth works, the feed's Reddit leg can go live`);
  }
  process.exit(code);
}

// ── credentials present? ────────────────────────────────────────────────────
// Existence only. The values are never printed, never length-hinted, and never
// echoed back on failure.
const holder = fromEnv();
if (!holder.configured) {
  console.log('FAIL credentials: REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET not set');
  console.log('');
  console.log('Set them in apps/backend/.env or pass them inline. From');
  console.log('reddit.com/prefs/apps: the client id is the short string UNDER the');
  console.log('app name, the secret is the field labelled "secret".');
  process.exit(2);
}
check(true, 'credentials: client id and secret are present');
check(str(process.env.REDDIT_USER_AGENT),
  'credentials: REDDIT_USER_AGENT is set',
  process.env.REDDIT_USER_AGENT ? '' : `falling back to "${UA}" — Reddit prefers one naming your account`);
if (!str(process.env.REDDIT_USER_AGENT)) { bad.pop(); note.push(`NOTE  REDDIT_USER_AGENT unset — using "${UA}"`); }

// ── 1. the mint ─────────────────────────────────────────────────────────────
let token = null;
try {
  token = await holder.get();
} catch (err) {
  check(false, 'mint: client_credentials is accepted for this app', err.message);
  console.log('');
  bad.forEach((l) => console.log(l));
  console.log('');
  console.log('If the reason is "unsupported_grant_type" the app is an INSTALLED app,');
  console.log('not a script/web app: those use grant_type=https://oauth.reddit.com/');
  console.log('grants/installed_client plus a device_id, and RedditAppToken.js needs');
  console.log('that branch added. If it is "invalid_client" the id or secret is wrong.');
  process.exit(1);
}
check(str(token), 'mint: an access token came back');
if (!str(token)) report(1);
check(holder.mode === 'app-only', 'mint: holder reports app-only mode', holder.mode);

// A second get() inside the TTL must not re-mint. Cheap to assert here and it
// is the difference between one token an hour and one per request.
const again = await holder.get();
check(again === token, 'mint: the token is cached, not re-minted on every call');

// ── 2. can it read? ─────────────────────────────────────────────────────────
async function askReddit(label, path) {
  let res;
  try {
    res = await fetch(`https://oauth.reddit.com${path}`, {
      headers: { Authorization: `bearer ${token}`, 'User-Agent': UA },
    });
  } catch (err) {
    check(false, `${label}: oauth.reddit.com is reachable`, err.message);
    return null;
  }
  check(res.ok, `${label}: HTTP ${res.status}`, res.ok ? '' : 'an app-only token was refused for this endpoint');

  // The budget. This is the number the aggregator has to be designed around.
  const remaining = res.headers.get('x-ratelimit-remaining');
  const used = res.headers.get('x-ratelimit-used');
  const reset = res.headers.get('x-ratelimit-reset');
  if (remaining !== null) {
    note.push(`NOTE  ${label}: rate budget — used ${used}, remaining ${remaining}, resets in ${reset}s`);
  } else {
    note.push(`NOTE  ${label}: no x-ratelimit-* headers on the response`);
  }
  if (!res.ok) return null;

  let body = null;
  try { body = await res.json(); } catch (err) {
    check(false, `${label}: response is JSON`, err.message);
    return null;
  }
  return body;
}

// The fields routes/social.js normaliseReddit() actually reads. If Reddit
// moves one of these the feed renders blank cards, and the failure names the
// field rather than sending anyone reading upstream docs.
function assertPostShape(label, body) {
  const children = body?.data?.children;
  check(Array.isArray(children) && children.length > 0,
    `${label}: returned posts`, Array.isArray(children) ? `${children.length} of them` : 'data.children missing');
  if (!Array.isArray(children) || !children.length) return;

  const d = children[0].data || {};
  check(str(d.id), `${label}: post has an id`);
  check(str(d.title), `${label}: post has a title`);
  check(str(d.permalink), `${label}: post has a permalink`);
  check(typeof d.created_utc === 'number', `${label}: post has a numeric created_utc`);
  check(typeof d.score === 'number', `${label}: post has a numeric score`);
  // `after` is the cursor useSocialFeed pages on. Null here is legitimate (a
  // short listing), so this is reported rather than asserted.
  note.push(`NOTE  ${label}: next cursor (data.after) = ${body?.data?.after ?? 'null'}`);
}

const hot = await askReddit('listing', '/hot?limit=5');
if (hot) assertPostShape('listing', hot);

// routes/social.js switches to search whenever there is a query, so app-only
// search working is a separate question from app-only listings working.
const search = await askReddit('search', '/search?q=privacy&sort=hot&limit=5&type=link&t=week');
if (search) assertPostShape('search', search);

// ── verdict ─────────────────────────────────────────────────────────────────
if (!hot && !search) report(2);
report(bad.length ? 1 : 0);
