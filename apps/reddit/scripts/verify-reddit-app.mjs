/* The Devvit rules that actually get apps rejected, checked before submission.
 *
 * App review takes about a week and a rejection costs another one, so the
 * expensive failures are the ones a machine can see: a fetch domain written in
 * a shape the allow-list will not accept, a link back to truegle.com, a
 * client-side call to somewhere the runtime will block, a README missing the
 * section the reviewer looks for. None of that needs Reddit, a browser or a
 * network — it is all in the files.
 *
 * Run it:  npm test
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const cfgRaw = read('devvit.json');
const cfg = JSON.parse(cfgRaw);
const server = read('src/server/index.js');
const client = read('src/client/main.js');
const html = read('src/client/index.html');
const readme = read('README.md');

// ── the config the CLI validates ────────────────────────────────────────────
check(/^[a-z][a-z0-9-]*$/.test(cfg.name) && cfg.name.length >= 3 && cfg.name.length <= 20,
  'the app name matches the slug rules', cfg.name);
check(!!cfg.post || !!cfg.server, 'there is at least one of post or server');
check(!cfg.triggers || !!cfg.server, 'triggers, if any, come with a server');
check(!!cfg.post?.entrypoints?.default, 'there is a default entrypoint');

// The published schema sets `additionalProperties: false`, so one mistyped key
// fails every playtest and upload. Checked against the copy the installed CLI
// carries, when there is one — the checks below matter more and must still run
// on a machine that has not installed anything.
try {
  const schema = JSON.parse(read('node_modules/@devvit/shared-types/schemas/config-file.v1.json'));
  const stray = (obj, allowed, where) => Object.keys(obj || {})
    .filter((k) => k !== '$schema' && !(k in (allowed || {})))
    .map((k) => `${where}.${k}`);
  const unknown = [
    ...stray(cfg, schema.properties, 'devvit.json'),
    ...stray(cfg.permissions, schema.properties?.permissions?.properties, 'permissions'),
  ];
  check(unknown.length === 0, 'every key in devvit.json is one the schema knows', unknown.join(' '));
} catch {
  ok.push('SKIP schema key check — run npm install to enable it');
}

// Every endpoint the platform calls must be /internal/. A menu item pointing at
// /api/ silently never fires.
const endpoints = [
  ...(cfg.menu?.items || []).map((i) => i.endpoint),
  ...Object.values(cfg.triggers || {}),
  ...Object.values(cfg.scheduler?.tasks || {}).map((t) => (typeof t === 'string' ? t : t.endpoint)),
].filter(Boolean);
check(endpoints.every((e) => e.startsWith('/internal/')),
  'every platform-called endpoint is under /internal/', endpoints.join(' '));
check(endpoints.every((e) => server.includes(`'${e}'`)),
  '…and each one is actually implemented', endpoints.join(' '));

// ── the fetch allow-list, in the shape review accepts ───────────────────────
// Reddit rejects wildcards, protocols and paths outright, and the error arrives
// days later attached to a rejected submission rather than at build time.
const domains = cfg.permissions?.http?.domains || [];
check(cfg.permissions?.http?.enable === true && domains.length > 0,
  'http is enabled with an explicit domain list', JSON.stringify(domains));
for (const d of domains) {
  check(!d.includes('*') && !d.includes('://') && !d.includes('/') && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d),
    `"${d}" is a bare hostname — no wildcard, protocol or path`);
}

// Every host the server actually calls has to be on that list, and every host
// on the list has to be one the server calls. Both directions: an unlisted host
// is blocked at runtime, and a listed host we never call is a domain request
// the reviewer has to ask about.
//
// Reddit's own domain is the one exception, and it earns it: a menu action
// answers with a `navigateTo` URL that the CLIENT follows. Nothing fetches it,
// so it needs no allow-list entry — but the check below proves that rather
// than assuming it, because "we only navigate there" is exactly the sentence
// somebody writes just before adding a fetch.
const REDDIT_NAV = new Set(['reddit.com', 'www.reddit.com']);
//
// A URL only counts when it is a STRING, hence the leading quote in the
// pattern. Scanning bare `https://…` anywhere in the file made every comment
// that mentioned a URL look like an outbound call — including the one above
// pointing at our own documentation. A check that fails on prose gets its
// prose deleted, which is the wrong thing to lose.
const fetched = [...server.matchAll(/['"`]https:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1]);
const external = fetched.filter((h) => !REDDIT_NAV.has(h));
check(external.length > 0, 'the server calls something', external.join(' '));
check(external.every((h) => domains.includes(h)),
  'every host the server fetches is allow-listed',
  external.filter((h) => !domains.includes(h)).join(' ') || 'all listed');
check(domains.every((d) => fetched.includes(d)),
  '…and nothing is allow-listed that the server never calls',
  domains.filter((d) => !fetched.includes(d)).join(' ') || 'none spare');
check(!/fetch\([^;]*reddit\.com/.test(server),
  '…and reddit.com is only ever navigated to, never fetched');

// The README section the reviewer reads, naming each domain.
check(/^##\s+Fetch Domains\s*$/m.test(readme), 'the README has a Fetch Domains section');
check(domains.every((d) => readme.includes(d)),
  '…that names every requested domain', domains.join(' '));
check(readme.length > 1200, 'the README is not the vague one that gets rejected',
  `${readme.length} chars`);

// THE DOMAIN HAS TO BE DOCUMENTED SOMEWHERE A REVIEWER CAN READ IT.
// Devvit approves an outside domain when the API behind it is publicly
// documented and publicly accessible, and refuses personal servers. Our answer
// to that is truegle.info/developers — so if the requested hostname and the
// page ever drift apart, the domain request quietly becomes the version that
// gets refused. Checked against the real page in the same repository.
try {
  const docs = read('../frontend/src/pages/Developers.jsx');
  check(domains.every((d) => docs.includes(d)),
    'every requested domain is named on the public docs page',
    domains.filter((d) => !docs.includes(d)).join(' ') || 'all documented');
  check(readme.includes('truegle.info/developers'),
    '…and the README points the reviewer at that page');
} catch {
  ok.push('SKIP docs-page check — apps/frontend is not checked out beside this project');
}

// ── the client cannot reach outside, so it must not try ─────────────────────
// Devvit blocks a client-side fetch to an external domain and requires the path
// to start with /api/. Both failures show up only at runtime, inside Reddit.
const clientFetches = [...client.matchAll(/fetch\(\s*(['"`])([^'"`]*)\1/g)].map((m) => m[2]);
check(clientFetches.length > 0, 'the client fetches something', clientFetches.join(' '));
check(clientFetches.every((u) => u.startsWith('/api/')),
  'every client fetch is a same-app /api/ path', clientFetches.join(' '));
check(!/fetch\(\s*['"`]https?:/.test(client), 'the client fetches no external URL directly');

// ── "no linking out to external apps" ───────────────────────────────────────
// The rule that would sink this app if it were written as a taster for the
// website: Devvit rejects apps that link out to a full version elsewhere, upsell
// another platform, or ask for an account off Reddit. The post has to be the
// whole thing.
const surface = `${html}\n${client}`;
check(!/truegle\.com/i.test(surface),
  'nothing on the page links to the Truegle website',
  (surface.match(/[^\s"'<>]*truegle\.com[^\s"'<>]*/i) || [])[0] || '');
check(!/(sign up|sign in|log in|create an account|register)/i.test(surface),
  'the post asks nobody to make an account anywhere');
check(!/(full version|open in truegle|get the app|download)/i.test(surface),
  'the post does not upsell another version of itself');

// Results open in a new tab with no referrer — a destination should not learn
// which community sent the click.
check(/rel\s*=\s*['"]noopener noreferrer['"]|rel\s*=\s*['"]noreferrer/.test(client)
  || /\.rel\s*=\s*['"]noopener noreferrer['"]/.test(client),
  'result links carry noopener noreferrer');

// THE APP HAS TO SAY WHO IT IS.
// Truegle answers 403 to undeclared automation on /api/search, and the Devvit
// runtime's fetch sends no User-Agent — so without this header every search in
// every post is either refused or sharing a five-per-minute throttle. It is one
// line, it is invisible when present, and its absence looks exactly like the
// API being down.
check(/'X-Truegle-Client':\s*'[a-z0-9-]+'/i.test(server),
  'the upstream request identifies this app to Truegle',
  (server.match(/'X-Truegle-Client':\s*'[^']*'/i) || ['missing'])[0]);

// ── nothing about the redditor leaves ───────────────────────────────────────
// The privacy claim the README makes, checked against the code that would have
// to break it. `context` may be read for the subreddit name when CREATING a
// post; what must never happen is context data travelling upstream.
const upstreamCall = server.slice(server.indexOf('await fetch('), server.indexOf('} finally'));
check(!/userId|username|context\.|req\.headers|postId/.test(upstreamCall),
  'the upstream search request carries no Reddit identity',
  (upstreamCall.match(/userId|username|context\.|req\.headers|postId/) || [])[0] || '');
// REDIS IS ON, AND THE CHECK IS THAT WE DO NOT USE IT.
// It used to be off, with a test asserting so — until `devvit playtest` refused
// the app outright: `config.menu.items` requires `config.permissions.redis`.
// The cache helper is Redis-backed too, so the earlier setting would have
// failed at runtime as well. The permission being on is now the platform's
// requirement rather than our choice, which makes "we store nothing" a claim
// about the CODE, so that is what is checked: no direct store, no key of our
// own, nothing but the cache helper.
check(!/@devvit\/redis|\bredis\s*\.\s*(set|get|hset|del|incr|expire)/.test(server),
  'the app never writes to storage itself — only the shared result cache',
  (server.match(/@devvit\/redis|\bredis\s*\.\s*\w+/) || [])[0] || 'clean');

// The shared cache must not be keyed on anything that identifies a reader —
// the cache helper hands one person's response to everyone with the same key.
const cacheKey = (server.match(/key:\s*`([^`]*)`/) || [])[1] || '';
check(!!cacheKey && !/userId|username|postId|subreddit/.test(cacheKey),
  'the shared cache is keyed on the query alone', cacheKey);

// ── the build the runtime demands ───────────────────────────────────────────
const buildScript = read('build.mjs');
check(/format:\s*'cjs'/.test(buildScript),
  'the server bundle is CommonJS — the Devvit runtime will not load ESM');
check(buildScript.includes(cfg.server.entry) && cfg.server.entry.endsWith('.cjs'),
  'the built server filename matches devvit.json', cfg.server.entry);

// The monorepo's own rule: this project must stay out of the workspaces that
// the website and API build from, or the Devvit toolchain lands in their
// lockfile.
const rootPkg = JSON.parse(read('../../package.json'));
check((rootPkg.workspaces || []).includes('!apps/reddit'),
  'the root package.json still excludes this project from its workspaces',
  JSON.stringify(rootPkg.workspaces));

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
