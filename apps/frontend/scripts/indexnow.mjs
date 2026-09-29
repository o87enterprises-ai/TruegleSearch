#!/usr/bin/env node
/* Tell Bing, Yandex, Naver, Seznam and every other IndexNow engine that pages
 * changed — the free, keyless way to get re-crawled without waiting for a bot.
 * (Google does not take part in IndexNow; use scripts/gsc.mjs for Google.)
 *
 * The key is the file in public/ named <32 hex>.txt whose body is its own name:
 * that file, served from the site root, is how an engine knows the submission
 * is ours. Every URL is read from public/sitemap.xml, so there is nothing to
 * keep in step.
 *
 *   node scripts/indexnow.mjs            # submit every sitemap URL
 *   node scripts/indexnow.mjs --dry      # show what would be sent
 *   node scripts/indexnow.mjs URL [URL]  # just these
 *
 * Run it after a deploy that changes pages. Limits: 10,000 URLs a call.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, '..', 'public');
const HOST = 'truegle.info';

const keyFile = fs.readdirSync(pub).find((f) => /^[0-9a-f]{32}\.txt$/.test(f)
  && fs.readFileSync(path.join(pub, f), 'utf8').trim() === f.replace('.txt', ''));
if (!keyFile) { console.error('No IndexNow key file (<32 hex>.txt containing its own name) in public/'); process.exit(2); }
const key = keyFile.replace('.txt', '');

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const given = args.filter((a) => a.startsWith('http'));
const urlList = given.length
  ? given
  : [...fs.readFileSync(path.join(pub, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const body = { host: HOST, key, keyLocation: `https://${HOST}/${keyFile}`, urlList };
console.log(`${urlList.length} URLs, key ${key.slice(0, 6)}…, keyLocation ${body.keyLocation}`);
if (dry) { console.log(urlList.join('\n')); process.exit(0); }

// The key file has to be reachable, or every engine rejects the whole batch.
const probe = await fetch(body.keyLocation);
if (!probe.ok || (await probe.text()).trim() !== key) {
  console.error(`Key file is not served at ${body.keyLocation} (HTTP ${probe.status}). Deploy first.`);
  process.exit(3);
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});
// 200 accepted · 202 accepted, key validation pending · 400 bad request ·
// 403 key not valid · 422 URLs do not match host · 429 too many requests
console.log(`IndexNow answered HTTP ${res.status} ${res.statusText}`);
process.exit(res.status === 200 || res.status === 202 ? 0 : 1);
