/* Every keyless feed source, checked against the real upstream.
 *
 * WHY THIS EXISTS: the agent sandbox's egress proxy answers 403 to CONNECT for
 * every outbound host — mastodon.social, public.api.bsky.app, lemmy.world and
 * news.google.com included — so the adapters in routes/social.js were written
 * where their response shapes could not be checked even once. Code that has
 * never executed and looks finished is the failure this repo has been bitten by
 * before, so the adapters are not trusted until this passes somewhere with
 * normal outbound network.
 *
 * It asserts the FIELDS EACH ADAPTER ACTUALLY READS, not just that a request
 * succeeds. An upstream that renames one key answers 200 and produces a feed of
 * blank cards, which is the failure mode worth catching.
 *
 *   node apps/backend/scripts/verify-feed-sources.mjs
 *   # or, from apps/backend:  npm run feedsources:test
 *
 * Exit 0 = every reachable source answers in the shape its adapter expects.
 * Exit 1 = an upstream ANSWERED but has moved a field. The report names the
 *          source and the field, so the fix is a line, not an investigation.
 * Exit 2 = nothing was reachable, so nothing was asserted. A network result,
 *          never a verdict on the code.
 */
const UA = process.env.REDDIT_USER_AGENT || 'TruegleSearch/1.0 (aggregated feed)';
const ok = []; const bad = []; const note = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);
const str = (v) => typeof v === 'string' && v.length > 0;
let reached = 0;

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r;
}

// ── Google News RSS ─────────────────────────────────────────────────────────
// The one source already proven in production (routes/news.js fetches this
// exact URL shape), so a failure here means Google moved something.
try {
  const r = await get('https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en');
  const xml = await r.text();
  reached += 1;
  const items = xml.match(/<item>/g) || [];
  check(items.length > 0, 'news: the WORLD section returns items', `${items.length}`);
  check(/<link>/.test(xml) && /<pubDate>/.test(xml) && /<title>/.test(xml),
    'news: items carry title, link and pubDate — the three fields parseRss reads');
} catch (e) { note.push(`SKIP news — ${e.message}`); }

// ── Mastodon ────────────────────────────────────────────────────────────────
try {
  const host = process.env.MASTODON_INSTANCE || 'https://mastodon.social';
  const r = await get(`${host}/api/v1/timelines/public?limit=5`);
  const rows = await r.json();
  reached += 1;
  check(Array.isArray(rows) && rows.length > 0, 'mastodon: public timeline returns statuses',
    Array.isArray(rows) ? `${rows.length}` : typeof rows);
  const t = rows[0] || {};
  check(str(t.id), 'mastodon: status has an id');
  check(str(t.url) || str(t.uri), 'mastodon: status has a url');
  check(typeof t.content === 'string', 'mastodon: status has content');
  check(str(t.created_at), 'mastodon: status has created_at');
  check(str(t.account?.acct), 'mastodon: status has account.acct');
  check(typeof t.favourites_count === 'number', 'mastodon: status has favourites_count');
} catch (e) { note.push(`SKIP mastodon — ${e.message}`); }

// ── Bluesky ─────────────────────────────────────────────────────────────────
try {
  const feed = 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot';
  const r = await get(`https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed?feed=${encodeURIComponent(feed)}&limit=5`);
  const d = await r.json();
  reached += 1;
  const posts = (d.feed || []).map((f) => f.post).filter(Boolean);
  check(posts.length > 0, 'bluesky: whats-hot returns posts', `${posts.length}`);
  const p = posts[0] || {};
  check(str(p.uri), 'bluesky: post has a uri');
  check(str(p.author?.handle), 'bluesky: post has author.handle — the web URL is built from it');
  check(typeof p.record?.text === 'string', 'bluesky: post has record.text');
  check(str(p.record?.createdAt) || str(p.indexedAt), 'bluesky: post has a timestamp');
  check(str(d.cursor), 'bluesky: response carries a cursor for the next page');
} catch (e) { note.push(`SKIP bluesky — ${e.message}`); }

// ── Lemmy ───────────────────────────────────────────────────────────────────
try {
  const host = process.env.LEMMY_INSTANCE || 'https://lemmy.world';
  const r = await get(`${host}/api/v3/post/list?limit=5&sort=Hot&type_=All`);
  const d = await r.json();
  reached += 1;
  const rows = d.posts || [];
  check(rows.length > 0, 'lemmy: post/list returns posts', `${rows.length}`);
  const v = rows[0] || {};
  check(typeof v.post?.id === 'number' || str(v.post?.id), 'lemmy: post has an id');
  check(str(v.post?.name), 'lemmy: post has a name (the title)');
  check(str(v.post?.ap_id), 'lemmy: post has ap_id — the permalink for a self post');
  check(str(v.post?.published), 'lemmy: post has published');
  check(str(v.community?.name), 'lemmy: post has community.name');
  check(typeof v.counts?.score === 'number', 'lemmy: post has counts.score');
} catch (e) { note.push(`SKIP lemmy — ${e.message}`); }

ok.forEach((l) => console.log(l));
note.forEach((l) => console.log(l));
if (!reached) {
  console.log('\nNothing was reachable, so nothing was asserted. This is a network');
  console.log('result, not a verdict on the adapters.');
  process.exit(2);
}
if (bad.length) {
  console.log('');
  bad.forEach((l) => console.log(l));
  console.log(`\n${bad.length} failed, ${ok.length} passed`);
  console.log('\nA failure names the source and the field. Each source in routes/social.js');
  console.log('is behind its own settled promise, so one moved field costs that source');
  console.log('and not the feed.');
  process.exit(1);
}
console.log(`\nall ${ok.length} passed across ${reached} reachable sources`);
