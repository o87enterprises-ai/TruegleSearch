# UNIFIED HANDOFF — Truegle Search
_Last updated: 2026-08-23. Supersedes all prior handoff docs._

---

## 📕 OPERATIONS: see `docs/RUNBOOK.md`

Everything the agent cannot do from its sandbox — SearXNG recovery on the EC2
box, which of the two deploys to run, reading Vercel logs, the Reddit app steps —
is in one place now. **The SearXNG outage signature is worth memorising: a full
count of results with NOTHING but video and news cards in it.** SearXNG is
primary for web search, so when it is down the web tier vanishes silently while
everything else carries on, and it reads as "bad results" rather than "outage".
Third occurrence as of 2026-08-21.

---

## 🚧 IN PROGRESS — `claude/truegle-sharing-player-ux-t3hi43` (15 commits)

**Deliberately unmerged — this work isn't finished.** Noted 2026-08-24 while
syncing the Groq branch. Head `c07766a`, 15 commits ahead of `main`. Both Vercel
and Cloudflare build from `main`, so none of it is live yet, which is intended:

- Cloudflare fronting SearXNG so **port 8080 can close** (+ `scripts/searxng-nginx.conf`,
  `docs/SEARXNG-CLOUDFLARE.md`) — the security-relevant one
- RFC 9116 `security.txt`; email-to-services OSINT; OSINT phone bare-number fix
- Player queue UX (persistent glow, pinned play, tabs, reel sizing) + wheel-scroll
- Overpass nearby-search provider that needs no key; shared OSM category table

22 files across `apps/backend` and `apps/frontend`. Only overlap with the Groq
branch is `.claude/memory/graph.json`, so landing it later is a trivial merge —
do NOT treat it as abandoned or sweep it into an unrelated sync. When it is
ready it also triggers a Cloudflare frontend deploy, and the nginx/EC2 pieces
may need applying by hand on the box.

---

## 🔴 2026-08-24 — Groq retired every Llama model; the AI was 404ing

Found the moment the new key pool went live and the health check ran a real
request. **Not caused by the key work** — `llama-3.3-70b-versatile` had been the
`GROQ_MODEL` default since long before, and `GROQ_MODEL` is not set in Vercel, so
the dead default applied. Every AI surface was getting `404 model does not exist`.

`/v1/models` on a live key returns **no Llama chat model at all** — only
`openai/gpt-oss-120b` / `-20b`, `groq/compound(-mini)`, `qwen/qwen3.6-27b`,
`allam-2-7b`, whisper, orpheus, and the prompt-guard classifiers.

- **New default: `openai/gpt-oss-120b`** — largest general chat model Groq still
  serves. `qwen/qwen3.6-27b` (vision) and `whisper-large-v3-turbo` (STT) were
  already correct and unaffected.
- **🔴 gpt-oss bills you for thinking.** Measured on a six-word answer: **235 of
  251 completion tokens were reasoning**. `reasoning_effort: 'low'` does the same
  job in ~50 (66 total). On a free tier metered by TPM/TPD that is the difference
  between four orgs buying real headroom and the model eating it. New
  `GROQ_REASONING_EFFORT` env var, default `low`, sent only to `openai/gpt-oss*`
  (other models reject the parameter).
- **Empty-answer guard.** A reasoning model that exhausts its budget returns a
  200 OK with `content: ''` and `finish_reason: 'length'` — a blank answer, not
  an error. `GroqService` now throws on that so the failover chain takes over
  instead of shipping silence. This is why `max_tokens: 10` returned nothing
  during diagnosis.

Tests: `__tests__/groqService.test.js` (5). Suite 17/17, 183/183.

---

## 🗓️ SESSION LOG 2026-08-23 — Groq keys: unlimited pool, real tapering

- **🔑 HOW TO HAND OVER NEW KEYS — `docs/SECRETS-MAP.md` (new, was missing).**
  Never paste a key value into a chat, issue, PR, commit, or log; transcripts
  persist and containers get snapshotted, so a pasted key is a burned key.
  The user sets values in the Vercel store directly (dashboard, or
  `vercel env add <NAME> production`, which reads from stdin and skips shell
  history) and tells the agent only the NAMES. The map lists every variable
  name and which store it lives in — **names and locations only, never values**.

- **🔴 PERMANENT FACT — Groq meters rate limits PER ORGANIZATION, not per key.**
  Every key inside one org shares the same RPM/RPD/TPM/TPD bucket. **The org
  count is the quota multiplier**; extra keys within an org are hot standbys,
  not headroom. Current account: **4 orgs, 12 new keys → 4× headroom, not 12×.**

- **🟢 The 5-key ceiling is gone, and keys are grouped by org.**
  `collectGroqOrgs()` in `apps/backend/config/env.js` reads, additive and
  de-duplicated: `GROQ_ORG_1_KEYS`…`GROQ_ORG_20_KEYS` (**the shape to use** —
  one var per org, that org's keys comma separated), plus the ungrouped
  `GROQ_API_KEYS` / `GROQ_API_KEY` / `GROQ_API_KEY_2`…`_50`, where each key is
  assumed to be its own org. That assumption preserves the old behaviour
  exactly and only costs a wasted round-trip if two ungrouped keys turn out to
  be org-mates — move those into a `GROQ_ORG_n_KEYS` var to fix it.

- **🟢 Rotation is now a taper across ORGS, not a fallback across keys.** New
  `apps/backend/services/GroqKeyPool.js` goes **round-robin over orgs** per
  request. A 429 parks **the whole org** for exactly the `retry-after` Groq
  sends (clamped 1s–1h) — its sibling keys share the exhausted bucket, so
  probing them is a guaranteed wasted round-trip. A 401/403 drops **only that
  key**, since a revoked key says nothing about its org-mates. Each process
  starts on a **random** org — on Vercel every cold start is a fresh process,
  and a fixed start would point every concurrent lambda at org 0.

  Text chat, vision and speech-to-text share the one pool, so voice search no
  longer independently drains whichever org the chat surface is on
  (`SpeechToTextService` used to keep its own list and always start at index 0).

  Measured against a fake Groq metering **per org** at 3 requests/org: 12
  requests over 4 orgs × 3 keys → **12/12 succeeded, exactly 3 per org, every
  key exercised once, zero wasted 429 round-trips**. Once the pool is spent it
  fails with no HTTP call at all, so the failover chain (gemini→nvidia→…) gets
  control immediately. `healthCheck()` reports
  `{orgs, keys, usableOrgs, coolingOrgs, disabledKeys}` — counts only, never
  key material.

- Tests: `apps/backend/__tests__/groqKeyPool.test.js` (11). Full backend suite
  16/16 suites, 178/178 tests. (`new-endpoints.test.js` needs Postgres on
  :5432 and is skipped in a fresh container — unrelated.)

- **Still to do by hand:** set `GROQ_ORG_1_KEYS`…`GROQ_ORG_4_KEYS` in Vercel
  (one var per org, that org's keys comma separated) and redeploy — env changes
  only take effect on a new build. Move the 3 pre-existing keys into whichever
  org var they actually belong to.

---

## 🗓️ SESSION LOG 2026-08-20 — Reddit shuts the door, so we go through theirs

- **🔴 REDDIT'S DATA API IS CLOSED TO US, PERMANENTLY.** New app registration is
  limited to "a valid moderation use case" (r/reddit.com/wiki/api). Truegle is
  not one, so there is no application to make and no tier to buy — this is not a
  budget problem and money will not fix it. That also makes the 403 our Vercel
  deployment gets on keyless reads permanent: Reddit blocks datacenter IPs, and
  the authenticated path that would lift the block is the one now shut.
  **We do not route around it.**

  The Feed pill is `status: 'soon'`, disabled, carrying that exact reason —
  `apps/frontend/src/config/socialProviders.js`. GitHub and Hacker News remain
  as `'open'` public sources, and `verify-feed-page.mjs` was reworked around
  them (41/41). A stored connection for a provider that has since closed is
  filtered out on read, so nobody is left looking at an empty feed.

- **🟢 NEW: `apps/reddit/` — Truegle search, running INSIDE a Reddit post.**
  Devvit is open to us where the Data API is not, and a Devvit server may fetch
  allow-listed external domains — so the post calls our existing Vercel backend.
  No new hosting, no new API, **$0**.

  - Web view (`src/client`) is plain HTML/CSS/JS, no framework, no CDN, no font
    download — a Devvit web view can reach nothing but its own `/api/`.
  - `src/server` is the only thing that talks outward, and sends the query and
    nothing else: no username, no user ID, no post ID, no cookies. Redis off.
  - `npm test` (`scripts/verify-reddit-app.mjs`, 29 checks, no network) pins the
    rules that actually get apps rejected — bare-hostname fetch domains, README
    Fetch Domains section, no client-side external fetch, CJS server bundle, and
    **no link back to the website**.

  ⚠️ **TWO POLICY WALLS, BOTH REAL, NEITHER FATAL:**
  1. Devvit's fetch policy says **personal domains "will not be approved"**,
     with an exception for a *publicly documented and publicly accessible* API.
     Our host is a bare `*.vercel.app`, which is the weakest possible version of
     that request. **Putting the API on `api.truegle.com` with a public docs page
     materially improves the odds and costs nothing** — Vercel custom domains are
     free. Review takes 1–2 business days and can be denied.
  2. Devvit rejects apps that **link out to a fuller version of themselves**.
     The post therefore carries no link to the website, no sign-in and no upsell;
     it is a search box that works start to finish inside the thread. The test
     enforces this by scanning the whole client surface, comments included.

  💸 **No ads in it, ever** — advertising inside a Devvit app is against Reddit's
  developer terms. This surface is reach, not revenue.

  **Owner steps (cannot be done from here):**
  1. **FIRST — Vercel → backend project → Settings → Domains → add
     `api.truegle.info`**, then add the CNAME it asks for (normally `api` →
     `cname.vercel-dns.com`) at the DNS host for truegle.info. Free on the
     current plan. Verify with
     `curl https://api.truegle.info/api` before going further.
  2. `cd apps/reddit && npm install`
  3. `npm run login` (Reddit developer account)
  4. `npm run dev` — playtest. **This is the moment the domain request is
     submitted**, which is why step 1 comes first.
  5. `npm run launch` — submits for review.

- **🟢 `/developers` — the public API documentation page, and the reason it
  exists.** Devvit approves an outside domain when the API behind it is
  "publicly documented and publicly accessible" and refuses personal servers, so
  this page is what converts our request from the second category into the
  first. Prerendered (in `scripts/prerender-entry.jsx`), in `sitemap.xml` and
  `llms.txt`, and pinned by a check in `apps/reddit/npm test` — if the requested
  hostname and the page ever drift apart, the suite fails rather than the
  submission.

  The backend now also answers `GET /` and `GET /api` with a machine-readable
  index naming the endpoints and linking the docs. And `POST /api/search` now
  **caps queries at 300 characters** — there was no cap at all, so a multi-
  kilobyte paste went to every upstream provider — because the docs page
  promises one and a promise nobody enforces is just a nicer lie.

  **The website still calls the backend on its original `*.vercel.app` URL, on
  purpose.** Nothing about the live site changes until the new hostname is
  proven; switching it over is a one-line follow-up whenever you like.

---

## 🗓️ SESSION LOG 2026-08-19 — The paid tap nobody knew was open

- **🔴 SERPAPI WAS BEING CALLED AUTOMATICALLY, UNCAPPED.** The owner got
  "your searches are exhausted" emails while believing SearXNG served every
  query. Both halves were true: `SEARXNG_PRIMARY=true` IS set and SearXNG IS
  primary for web search — and `SearchService` *also* had

      if (searchWeb && webResultCount < 5 && this.serpApiKey) → performSerpSearch()

  with no cap, no counter and no log line. On a self-hosted metasearch running
  on a small box, "fewer than five web results" is not an edge case; it is most
  of a cold afternoon. So the paid tap ran constantly and the first signal was
  the vendor's email rather than anything in our own logs.

  **Three changes:**
  1. The threshold is `=== 0`, not `< 5`. Thin results are still results, and
     paying real money to pad them is not worth it.
  2. `services/PaidProviderBudget.js` — a per-provider UTC-day counter every
     paid call must claim from. **`SERP_DAILY_LIMIT` defaults to 0**: holding an
     API key is not authorising spend, and under a $0 budget a credential must
     never open a tap by itself. Somebody has to write a number down.
  3. `ShoppingService` draws on the SAME budget — it is the same SerpApi
     account, and a cap covering one of two callers is not a cap.

  ⚠️ **Known limit, stated rather than glossed:** the counter is in memory, so
  on serverless it bounds spend to roughly *limit × warm instances*, not exactly
  *limit*. It is a brake, not an accountant. A true global cap needs shared
  storage and is a follow-up.

  💸 **Action for the owner:** SerpApi is a paid vendor on a $0 budget. It is
  now OFF by default and will stay off unless `SERP_DAILY_LIMIT` is set on
  Vercel. Nothing needs setting for the site to work — SearXNG remains primary.

- **The "Pics" tab returning nothing is a separate, unpaid problem.** Images go
  SearXNG → Google Images (100/day free CSE cap) → Brave. An empty Pics tab
  means all configured image providers came back empty, most likely the CSE
  daily cap. Not yet fixed; see the open thread.

- **Trail cover art is IN.** The owner uploaded the three-panel box mockup
  rather than the square title card, and said to proceed with it — so the front
  panel was cropped out of it and framed as a 16:9 title card
  (`public/trail-title.png`, 640×360 = 2× the game's 320×180 frame). Shrinking
  the whole box to 320×180 would have made the back-cover copy an unreadable
  smear; letterboxing the tall front panel made it a 110px thumbnail. A
  deliberate band across the wordmark is the only framing of a portrait poster
  that reads as a title screen, and it leaves the bottom strip dark so the
  prompt text stays legible. Verified by screenshotting the real canvas, not by
  trusting the arithmetic. The full mockup is kept as `trail-box-art.jpg` — it
  is the right asset for an OG/social card, where it is seen large.
- **The slot itself: `public/trail-title.png`.** Optional, served
  from `public` so it can be swapped without a code change (same pattern as the
  True Tube mark), drawn to cover the 320×180 frame and **top-anchored** because
  a poster puts its lettering at the top and a centred crop cuts it off.
  `imageSmoothingEnabled = false` keeps the pixels. Absent or failed → the
  existing drawn title screen, unchanged. Any aspect ratio works.

**Verified:** paidBudget 12 (new), backend jest 142, trail 62, vaulttier 17,
plus the standing suites. Lint 0 errors, check:ads clean, build clean.

---

## 🗓️ SESSION LOG 2026-08-18b — The Tube mark, the guide for losers, and Reddit's 403 confirmed

- **The player was signed with the wrong logo.** `TruegleWatermark` hard-coded
  the TrueGLE Chat artwork, so True Tube's own viewer carried another product's
  mark. It reads `LOGO_VARIANTS` from `TruegleLogo` now and defaults to `tube` —
  two files each deciding what "the tube mark" means is exactly how one of them
  ends up wrong, which is what happened. Keeps the fallback: `/truetube.png` is
  served from `public` so it can be swapped without a code change, so it can
  also be absent, so a load failure falls back rather than leaving a broken
  image over the video.
- **The Trail guide unlocks on ANY finished run, not only on arrival.** It had
  it backwards: the people most likely to want a survival guide — the ones who
  ran out of water two hundred miles short — were the ones told nothing.
  `utils/vault.js` stores a **tier**: `'guide'` for any completion, `'full'`
  for arriving, and it never downgrades. **Migration matters here:** the
  original flag was the string `'1'` and could only be written by winning, so
  it reads as `full` — anybody who had already earned it keeps it. The over
  screen offers the library either way and labels which version you got.
  ⏳ **The deeper winners' guide is content the owner is supplying.** The
  `full` tier is wired and tested; deliberately NOTHING in the UI advertises a
  fuller edition yet, because claiming one exists before it does would be a lie
  on screen.
- **🔴 REDDIT'S 403 IS CONFIRMED, NOT SUSPECTED.** Every host in `REDDIT_HOSTS`
  returns 403 from the deployment. Reddit blocks keyless reads from datacenter
  IP ranges, so host-walking and User-Agent tuning cannot get past it — the only
  fix is an authenticated request via the free Reddit OAuth app that
  `socialProviders.js` already calls "the one that fully works". The error
  message now names that remedy instead of only the cause. **Note it got more
  visible** the moment `BACKEND_PLATFORMS` stopped padding the Reddit feed with
  Hacker News and GitHub: a 403 empties the feed outright now, which is honest
  and also means the OAuth app is the next real unblock.

**Verified:** vaulttier 17 (new), trail 62, vault 37, retention 27, playlist 22,
resultsort 12, published 19, markdown 12, player 59, feed 10, localquery 35,
map 30, nav 13, embeddable 26, backend jest 130. Lint 0 errors, check:ads clean,
build clean.

---

## 🗓️ SESSION LOG 2026-08-18 — Tube stops asking which website you want, and starts learning from what you watch

**Shipped (branch `claude/truegle-sharing-player-ux-t3hi43`):**

- **🔴 THE REDDIT FEED WAS SERVING GITHUB ON PURPOSE.** `BACKEND_PLATFORMS`
  mapped `reddit` → `['reddit','hackernews','github']`, on the reasoning that
  the other two are keyless so they may as well ride along. It padded a Reddit
  feed with repositories and gave nobody a way to switch them off, because they
  were not pills. They are pills now — `status: 'open'`, a **public source**
  rather than an account, so switching one on is a local toggle and never the
  OAuth handshake (`needsAuth()` gates the flow, `isConnectable()` gates
  storage). `ConnectedRow` gained an add-more control; without it the second
  source was unreachable once the first connected.
- **TUBE: the Where/What chip rows are gone,** and `PlayerScopeChips` is
  deleted. They asked you to pick a platform before searching, which is
  backwards. The multi-provider search is untouched and always on; bangs
  (`!yt`, `!reddit`, `!sc`) and `@handles` still steer a single query via
  `parsePlayerQuery` and cost no screen. What the chips carried for free —
  *which platform am I looking at* — moved onto the result: a coloured stripe
  per list row, a corner badge per deck card, read off the row's own `kind`.
- **🔴 EVERY SEARCH RESULT CLAIMED TO BE PUBLISHED TODAY.** Ten normalisers in
  `SearchService` did `date: x || new Date().toISOString()`, and SearXNG
  supplies `publishedDate` for a minority of rows — so "we don't know when"
  was indistinguishable from "an hour ago". Two consequences, both fixed:
  `calculateRecency` scored undated rows **1** instead of the 0.3 it has always
  had waiting for a null (undated ranked as the freshest thing on the page),
  and Tube could not show a date without printing today over a 2019 video.
  Null now means null; date sorts put undated **last** in both directions;
  `utils/published.js` also refuses future timestamps and anything pre-1995.
- **Sorting: Relevant · Newest · Popular.** Newest is offered only when the rows
  carry dates, because a sort that visibly reorders nothing reads as broken.
  **Popular is Truegle's OWN anonymous play/vote counts** via a new
  `POST /api/media/scores` — there is no view count in a search result and
  YouTube's costs a quota unit per video against a site-wide allowance, so the
  tooltip says "on Truegle". **A row with no signal is not a row with zero:**
  unscored rows keep relevance order behind scored ones, and with nothing known
  the sort falls back to relevance rather than shuffling.
- **Many pages.** One ask of 20 rows was the entire search for a query; the
  backend has always honoured `filters.page` (Google `start`, Brave `offset`,
  SearXNG `pageno`) and nothing ever asked. What gets re-asked is **the rung of
  the fallback ladder that actually answered**, not the ladder from the top —
  which would hand back page one of a different rung. The list gets a More
  control; the swipe deck asks two cards early and no longer jumps to card one
  when it grows.
- **A result's channel opens that creator's uploads.** The capability existed
  and was reachable only when the *query* named a channel. YouTube only, and
  deliberately: `/creators/resolve` speaks YouTube channel ids and nothing else.
- **The feed learns from watching, not only from thumbs** (`utils/retention.js`).
  Almost nobody presses a thumb, so the strongest rung of the recommender stayed
  permanently empty for most people. Kept separate from `taste.js` because they
  are different claims — a 👍 is speech, watching is behaviour — and because
  behaviour collected quietly is the thing Truegle exists not to do.
  **Dead band:** ≥70% is a weak yes, ≤15% on a ≥30s video is a weak no,
  everything between records *nothing*. No duration means no fraction means no
  claim. `retentionScore` is capped at **3 in total**, not just per term — a tab
  left running overnight scored ~17 before that, because title words stack, and
  would have been the loudest voice in the profile. A thumbs-down still returns
  -Infinity and wins outright. "Forget it" clears retention too: a profile you
  can delete half of is still a dossier.
- **Paste a YouTube playlist, get the whole thing** — `GET /api/creators/playlist`.
  The Data API path pages `playlistItems` 50 at a time (500 cap, 1 quota unit
  per call). The keyless RSS fallback returns ~15 entries with **no page
  parameter**, so the reply carries `complete: false` and the UI says a longer
  list may have more — importing 15 of somebody's 200 saved videos and reporting
  success is the worst outcome available, because they find out later by missing
  something. Private/deleted entries have no id and are skipped, which is why an
  import can honestly be smaller than YouTube's own count.

**Verified:** retention 27 (new), playlist 22 (new), resultsort 12 (new),
published 19 (new), markdown 12, localquery 35, map 30, player 59, nav 13,
embeddable 26, feed 10, mapui 63, chatmap 17, feedpage 41, backend jest 130.
Lint 0 errors, `check:ads` clean, build clean.

**Not verified from the sandbox** (the proxy denies every outbound host): the
playlist endpoint against real YouTube, and the Popular sort against a real
`media_signals` table. Both are exercised against stubs only.

---

## 🗓️ SESSION LOG 2026-08-17 — The answer stops sending people to Google, and the bottom of the screen changes hands

**Shipped (branch `claude/truegle-sharing-player-ux-t3hi43`):**

- **🔴 THE ZERO-WIDTH JUNK IN EVERY ANSWER WAS OURS.** The owner pasted a reply
  back and it read `Based ⁠⁠‌‌‌…⁠⁠on the search results provided`.
  `watermark.embed()` inserts after the **first space of whatever it is given**,
  and `nepheshAttribution.stampText` was handing it the whole answer — so the
  provenance canary landed inside the opening sentence of every response. The
  canary stays but now opens the attribution footer, between the `---` rule and
  "Research Provided by": still mid-document, so trailing-trims cannot reach it
  (the original reason it was buried in prose), and no visible word to split.
  It is built with the new `watermark.marker()`, which applies `MARKER_PREFIX` —
  `encode()` alone yields a canary that decodes fine and is then disowned by
  `extract()` and `scripts/check-watermark.js`. **Result-snippet watermarking in
  `routes/search.js` is unchanged** — that is the one `docs/ANTI-SCRAPING.md`
  actually specifies, and it defends against SERP scraping, not a human quoting
  a paragraph.
- **🔴 A SEARCH ENGINE TOLD ITS USER TO GOOGLE IT.** Asked "taxi cottage grove
  oregon", the assistant produced a "How to Find a Taxi" table whose first row
  was *Google "Cottage Grove Oregon taxi"*, plus Yelp and Yellow Pages.
  `BASE_IDENTITY` now forbids directing anyone to a rival search, maps or
  listings product — by name, as "search online for…", or as "check a local
  directory". Naming a real-world service that **is** the answer (a taxi firm, a
  transit authority, a number to ring) stays fine; the ban is on rival *finding*
  tools. `PROMPT_VERSION` → `2026-08-17.1`.
- **The AI no longer guesses what is on your screen.** It had written "if you're
  on a TrueGLE search page, the map pane should already be showing Cottage
  Grove" — a hedge about our own product, and false: nothing had opened.
  `/api/ai/summary` now takes a `mapSurface` the client reads straight off
  `parseLocalQuery` (the same function the page uses to decide), and
  `utils/mapFact.js` turns it into one line of fact. `state` is validated
  against a known set and the free-text fields are flattened and clamped, so a
  hand-rolled body cannot write its own instructions into the system prompt.
- **"taxi cottage grove oregon" opens a map now.** `SUBJECT_IN_PLACE` needs a
  preposition and nobody types one, so `<category> <town> <state>` was not a
  local query at all. A trailing US state is the cheap reliable signal; the
  front of the string may only be claimed by a category we can actually search
  for (`leadingCategory()` in `mapApi.js`, longest whole-word prefix, so "gas
  station" beats "gas"). Two-letter codes must be UPPERCASE — lower-cased, "or",
  "in" and "me" are ordinary English. `amenity=taxi` and transit categories added.
- **🔴 TABLES WERE NEVER GOING TO RENDER.** Not a model failure: tables are a
  **GFM extension**, and plain `react-markdown` is CommonMark, so the table was
  parsed as a paragraph — and a paragraph folds single newlines into spaces,
  which is the flat line of pipes that was reported. All **six** `ReactMarkdown`
  call sites (five bare, one with its own components map) now go through
  `components/ui/Markdown.jsx`: remark-gfm, links forced to a safe new tab, and
  tables that scroll inside their own box. TruegleChat's hand-rolled
  `linkifyBareUrls` is deleted — gfm's autolink-literal does it properly.
- **The freemium token meter is off** (`SHOW_TOKEN_METER` in `config/access.js`).
  `consumeFreemiumSearch()` has no call sites and `FREE_ACCESS_MODE` bypasses
  every gate, so the bar sat at 10/10 forever while holding a fixed strip on
  every page. Context, counter and component all kept; one flag brings it back.
- **The bottom of the screen belongs to what you are using.**
  `hooks/useBottomDock.js` — a ref-counted claim (module-level + window event,
  not a context: `PreProductionBanner` mounts above the provider tree). The
  footer-docked player and the open map claim it; the early-access bar collapses
  to its chip while claimed, **without** persisting the dismissal, and
  re-dispatches `BAR_EVENT` so `useFeedbackBarHeight` re-measures and the
  released height actually reaches the player. Tapping the chip still opens it.
- **Public descriptions rewritten** — landing mode cards, `ThreeCards`,
  `llms.txt`, and all four `index.html` meta/JSON-LD descriptions. **Green** is
  now zero-AI, environmentally conscious search (literal: green is in
  `AI_FREE_MODES`, so no model runs — and deliberately no energy figures, since
  we have measured none). **Purple is Wonderland**, a fold inside the Rabbit
  Hole that isolates results by one societal perspective at a time — political,
  faith, societal, economic. **True Tube** and **the Feed** now have cards of
  their own.
  ⚠️ **Known collision:** green means "Summarize" on *chat* (which needs a
  model) and "zero AI" on *search*. `modeTheme.searchModeLabel()` overrides the
  label for the search pill only. Worth resolving properly.

**Verified:** localquery 35, markdown 12 (new), map 30, player 59, nav 13,
embeddable 26, feed 10, ai 25, mapui 63, chatmap 17, feedpage 38, backend jest
130. Lint 0 errors. `check:ads` clean. `new-endpoints.test.js` still fails in
the sandbox — it needs a Postgres and a `JWT_SECRET` that are not here.

---

## 🗓️ SESSION LOG 2026-08-16 — Map: it draws now. Plus Trail's layout and an honest social feed

**Shipped (branch `claude/truegle-sharing-player-ux-t3hi43`):**

- **🔴 THE MAP NEVER DREW, AND THE REASON WAS THE TOKEN.** Every style was a
  `mapbox://` URL and `VITE_MAPBOX_ACCESS_TOKEN` is blank/unset, so mapbox-gl
  threw on the first style resolve and painted nothing — what showed through
  was the page background (a starfield in one screenshot, a bare dark panel in
  the others). The renderer is **MapLibre** now (`react-map-gl/maplibre`) over
  hand-built **raster** styles on keyless tiles: OSM standard, CARTO
  light_all/dark_all, Esri World Imagery, each carrying its required credit.
  See `components/map/config/basemap.js`.
  **Why not just get a Mapbox token:** Mapbox GL JS v2+ is licensed for use
  *with Mapbox services*, so aiming it at other tiles is a licence breach, not
  a workaround; MapLibre is the BSD-3 fork with no such condition. A token is
  also a metered account against a $0 budget. `hasMapboxToken` is the single
  switch if one is ever configured.
  `index.html`'s render-blocking CDN `<link>` to mapbox-gl.css is gone — the
  stylesheet is a module import, so it ships in the bundle instead of being
  fetched on every page whether or not a map is opened.
  New CSP `connect-src` entries in `public/_headers`: tile.openstreetmap.org,
  *.basemaps.cartocdn.com, server.arcgisonline.com, overpass-api.de.
- **🔴 "coffee near me" found nothing because Nominatim is a GEOCODER.** Ask it
  for "coffee" and it looks for a place *named* coffee. Every rung above it
  (Mapbox/Radar/TomTom) needs a key the deployment lacks, so the keyless floor
  IS the search. `mapApi.searchPlacesWithOSM` now asks **Overpass** first —
  OSM's own query engine, keyless — with a word→tag table (coffee →
  `amenity=cafe`), matched as both node and way, nearest-first, falling back to
  a name regex for unlisted subjects and then to bounded Nominatim.
- **The map search bar takes more than addresses.** `utils/mapSearch.js` reads
  intent first: "near me" searches around you, "coffee in austin" resolves the
  where then the what, an address still geocodes, a bare name looks nearby
  before globally. "Near me" with no position says so rather than returning an
  empty list.
- **Map pop-out + a mini player transport.** The map is no longer a mode you
  get stuck in: one `TruegleMap` element renders either in the results column
  or in `MapPopOutFrame` — a draggable, resizable window **portalled to
  document.body** (a transformed ancestor would make `position: fixed` resolve
  against the results column). `MapPlayerTransport` docks inside
  `#truegle-map-container` (so it survives native fullscreen) whenever the
  player has something: title, prev, play/pause, next, stop, nothing more.
  Skip rather than seek — scrubbing a cross-origin embed needs four vendor SDKs.
- **🔴 Scroll-to-zoom hiccup:** `onMove` wrote back only the zoom and dropped
  the lng/lat the renderer had computed. A wheel zoom is pointer-anchored, so
  every notch moves the centre; keeping the old centre shoved the map back a
  frame later. Now takes the whole viewState, pushes to shared state on
  `moveEnd` (it was re-rendering every context consumer dozens of times per
  flick), and the zoom≤3 azimuthal switch moved to moveEnd too — it was
  swapping the projection mid-gesture.
- **Map overlays now know about each other.** There were TWO zoom controls (a
  hand-rolled top-left stack at z-index 150 — which floated over the open
  Directions panel — plus the renderer's own +/- and compass top-right); the
  hand-rolled one is gone. The function bar wraps instead of ending on
  "✕ Clos", and drops labels based on the **map area's** measured width, not a
  viewport breakpoint (the map can be a 320px window on a 2560px monitor). The
  bar publishes its measured height as `--truegle-map-bottom-clearance`, and
  the tile attribution (a licence condition of OSM/CARTO/Esri), the scale bar
  and the mini transport all stack off it. Panels stop above the bar rather
  than running under the one row that closes them.
- **Traffic and Directions were literally the same icon** — lucide `Navigation`
  imported twice, once aliased as `NavigationIcon`, which made it look
  deliberate. Traffic is a `TrafficCone` now.
- **The Location button reports a state** (lit / located / unknown) and the
  blue dot shows its reverse-geocoded address on hover or focus. Fixing that
  surfaced a related bug: the dot was created inside the branch deciding where
  to *centre* the map, so "coffee near me" — the journey that most needs it —
  marked every cafe and never marked you.
- **Share a place: right-click, or press and hold.** The link is
  `/search?q=<lat>,<lng>`, and `parseLocalQuery` now understands coordinates,
  so a shared pin reopens the map on the pin. **Coordinates are matched BEFORE
  the postcode pattern** — `\b(\d{5})\b` otherwise pulls five digits out of
  "43.752413" and geocodes them somewhere else entirely.
- **Tube Reddit search asks Reddit.** The chip went to `/api/search` category
  `social`, served only by an optional SearXNG box and an optional Google CSE;
  with neither configured the backend queues no providers and answers empty.
  `usePlayerSearch` now calls `POST /api/social/feed` with
  `platforms: ['reddit']` first, keeping the index path as fallback. **Read
  `permalink`, never `url`** — `url` is whatever the post links to (i.redd.it,
  a news site) and `getPlayable` only accepts `/r/<sub>/comments/<id>`.
- **TRAIL was a different product wearing Truegle's URL.** Full-window black,
  a lone "TRAIL" wordmark, no route home. It renders through
  `SearchPageShell` now — logo (which goes to the landing page), mode
  background, game in a results-card container, **no search bar and no pill
  row** (the shell draws each only when handed one). A new `embedded`
  presentation keeps the full-screen one and stops locking the page scroll.
- **🔴 The social feed could not say why it was empty** — this is why "reddit
  still isn't working" and "feed won't load" were one bug. The route answers
  200 with `results: []` and the reason in `errors`; `useSocialFeed` fetched
  that field and dropped it, so a BLOCKED platform and a platform with nothing
  to show rendered identically. Worse, a failed platform reports a null cursor
  exactly like an exhausted one, so one refusal set `done` on page ONE — the
  feed declared itself finished having shown nothing and the sentinel never
  asked again. The route now reports the upstream's own words (HTTP 403 —
  commonly a blocked datacenter IP / 429 / timeout, and which host said it)
  and tries www., old. and bare reddit.com in turn; the hook surfaces
  `platformErrors` and no longer treats an all-failed page as the end.

**Verification:** `mapui` 60, `feedpage` 38, `localquery` 23, `map` 30,
`trailpage` 12 (new), `reddit` 9 (new), plus player/feed/nav/vault/trail all
green. `npm run build` and `npm run check:ads` pass.

**🔴 UNVERIFIED / OPEN:**
- **The production cause of the Reddit failure is still unconfirmed.** The
  agent sandbox proxy 403s every outbound host — `backend-seven-khaki-60`
  and reddit.com included — so nothing here reached the live stack. Leading
  suspect is Reddit blocking Vercel datacenter IPs; the new `errors` field
  will name it on the next real load. If it says 403, the fix is a Reddit
  OAuth app, not more retries.
- **Nothing on this branch is deployed.** The Radar `/local-businesses` call
  signature + return shape, the camera URL sanitising, and these social-route
  changes are all branch-only. The map fixes are frontend and take effect on
  the next frontend deploy.
- Real tiles/places have never been seen from here — every map host is denied
  by the sandbox's network policy, so browser tests stub them. The tests prove
  the map ASKS for tiles and draws a sized canvas; only `npm run dev` shows
  actual streets.

---
## 🗓️ SESSION LOG 2026-08-03 — Truegle player: share links + mobile UX + queue sources

**Shipped (branch `claude/truegle-sharing-player-ux-t3hi43`):**

- **Shareable Truegle player links — new `/w` route** (`pages/WatchPage.jsx`,
  `utils/playerLink.js`). Format: `truegle.info/w?u=<source url>&t=<title>`,
  repeat the pair to share a whole queue. Opening one drops the recipient
  straight into the persistent MiniPlayer instead of the source site. Share
  entry points: the player's own share button (copies, or the native share
  sheet on mobile) and a "Copy safe player link" row in `TruegleShareButton`
  on any playable result.
  **Security boundary — all of it lives in `playerLink.js` + `getPlayable`:**
  a `u` value is only accepted if `getPlayable` recognizes it, and what gets
  rendered is getPlayable's **output** (an embed URL we build ourselves on
  youtube-nocookie / player.vimeo / w.soundcloud, or a direct media file in a
  native `<audio>/<video>`) — never the raw input. Anything unrecognized is
  printed as inert text under "Not opened": never navigated to, never iframed.
  So a player link can't be dressed up as an open redirect.
- **Embeds are now sandboxed** (`PLAYER_SANDBOX` in MiniPlayer):
  `allow-scripts allow-same-origin allow-presentation allow-popups
  allow-popups-to-escape-sandbox`. `allow-same-origin` is safe on a
  cross-origin frame (it gets *its* origin, not ours) and the embeds don't
  play without it. **`allow-top-navigation` is deliberately withheld** — that
  is precisely what stops an embed hijacking the tab, and it's what makes
  "a Truegle link is a safe link" true. Same lesson as the 2026-08-01 ad
  hijack: CSP doesn't prevent top-navigation, only the sandbox does.
- **🔴 Fixed a real hole in `getVideoEmbed`:** the host test was
  `host.endsWith('youtube.com')`, which **also matches `evilyoutube.com`** —
  an attacker host would have been iframed as a trusted embed. Now exact host
  or true subdomain only. Pre-existing, but share links made it reachable by
  a third party. Don't loosen it.
- **Mini-player mobile UX** (the "hard to maneuver" fix): every drag surface
  sets `touch-action: none` — without it the browser claims the touch for page
  scrolling and `pointermove` never fires, which is the actual reason the
  player felt immovable on a phone. 44px grab bar with a visible grip, 36px
  controls on their own transport row (was six 13px icons crammed into the
  title bar), and a **Move/Adjust mode**: thick cyan border, the whole video
  becomes a drag surface (a shield stops the iframe eating the touch), plus
  SIZE −/+ buttons and a snap-back-to-corner. Position and width persist in
  `localStorage.truegle_player_geom`.
- **Queue "+" menu** (`QueueAddMenu.jsx`) — three sources: **Device** (local
  file via object URL, never uploaded), **Link** (any playable URL *or* a
  pasted Truegle player link, which round-trips back into the queue), and
  **Search** (POSTs `/api/search` category=videos and lists only results
  `getPlayable` can actually host).
- **"Add to queue" on qualifying links** (`QueueButton.jsx`, now used by
  UniversalSearch / TruegleChat / CreatorPage / MultimediaInterface): one
  shared button that reads **"Pop out"** when nothing is playing and
  **"Add to queue"** once the player is open — so a user can keep stacking
  media while they scroll without interrupting playback. The reducer always
  behaved this way; the affordance was invisible.

**Verified (Playwright/Chromium, iPhone-13 viewport + desktop, 33 checks):**
share link auto-opens the player · plays via youtube-nocookie · sandbox
present and withholds top-navigation · spoofed `evilyoutube.com` host rejected
· `javascript:` URL never becomes a source · adjust-mode drag moves the player
(y 278→48) · stretch/shrink · 44px grab bar · geometry survives reload · all
three "+" tabs · Truegle link pastes back into the queue · non-playable link
refused with an explanation · queueing doesn't interrupt playback · full share
→ copy → reopen → both items restored round trip. `vite build` + `check:ads`
clean.

---

## 🗓️ SESSION LOG 2026-08-03 (cont.) — Rich previews, ungated links, shorts feed, trending sanitizer

- **Rich link previews for `/w`** — `functions/_middleware.js` now rewrites the
  `<head>` at the edge for `/w`: real title, real YouTube thumbnail (derived
  keylessly as `i.ytimg.com/vi/<id>/hqdefault.jpg` from the embed id we built),
  `summary_large_image` card. Done inside the **existing** middleware rather
  than a new `functions/w.js` so there's no Functions-vs-`_redirects`
  precedence question, and it reuses the HTML-patching path already proven in
  production. It imports `parsePlayerParams` from `src/utils/playerLink.js`
  (hence the explicit `.js` on that file's own import — the Pages bundler
  isn't Vite) so the preview and the player share one definition of what's
  playable. Attacker-supplied titles are escaped via `escapeAttr`.
- **Ungated player links** — signed-out visitors get the share button and
  "Copy safe player link" on any playable result; only the social composers
  (which post *as* the user) still require sign-in.
- **Shorts / Reels** — new `utils/shortForm.js` (URL + duration detection),
  TikTok now playable via its keyless `/embed/v2/` player, vertical sources
  carry a `vertical` flag so the player frames them 9:16, new **`/shorts`**
  route (vertical snap feed, one-tap "play the whole feed" into the queue,
  per-clip add-to-queue + safe-link share, only the visible card mounts an
  iframe), and the pre-existing "Reels/Shorts" search filter now actually
  filters instead of just adding keywords. Reachable from the global nav.
  **Instagram/Facebook Reels are listed but link out** — Meta gates oEmbed
  behind app review. Labelled on the card; a documented dead end, not a TODO.
- **🔴 Live CSP bug fixed:** `frame-src`/`child-src` in `public/_headers`
  never listed `youtube-nocookie.com` or `w.soundcloud.com`, so the
  mini-player's YouTube and SoundCloud embeds were **blocked in production**.
  Added those + `tiktok.com`. Any new embed host needs BOTH directives.
- **Trending-feed sanitizer** (`utils/sanitizeTrending.js`) — the landing
  page's live trending pills are built from real visitors' search queries,
  i.e. republished user content. Now: profanity/slurs/adult terms are masked
  with asterisks; entries containing **PII are dropped entirely** (masking an
  email still advertises that someone searched a person, and the pill would
  re-run that search on tap); entries >50% asterisks are dropped as noise;
  and a masked pill navigates to the **clean remainder** ("best **** sites
  reviewed" → searches "best sites reviewed"), never the raw term. Catches
  leetspeak, stretched letters, and self-censoring (`f*ck`) via a consonant
  skeleton that only applies when a censor character is present, so "duck"
  stays "duck". Accepted false positive: `dick`/`cock` mask surnames — see
  the note in the file.

**Verified:** 68 automated checks across four Playwright/node suites (edge
preview injection incl. XSS + spoof-host rejection, ungated share, short-form
detection + duration parsing, feed filtering + lazy iframes + vertical
framing, TikTok embed resolution, trending masking over a full 70s rotation
incl. click-through, and regression over the original `/w` share flow).
`vite build` + `check:ads` clean.

**Still open:** `/w` previews rely on the Pages middleware actually running in
production — verify one shared link in a real Discord/iMessage after deploy.

---

## 🔴🔴 AD POLICY — READ `docs/AD-POLICY.md` BEFORE ANY AD WORK

**2026-08-01 incident:** the landing-page Adsterra tag hijacked the top window
(`https://bulsis.net/go/1740870?...`) on load — visitors could not use the site
at all. **Root cause:** ad iframes pointed at same-origin `/adframe.html` with
**no `sandbox` attribute**, so the ad script had full access to our page
(`window.top.location`, parent DOM, site-wide click listeners). CSP did not stop
it and cannot.

**Permanent rules (build fails on violation — `npm run check:ads`):**
1. **No ads on the landing page**, ever — `/`, `/de`, `/es`, `/fr`, `/nl`, `/pt`.
   The guard walks LandingPage's whole import tree, so nesting one won't pass.
2. **No popunders / social bars / push / interstitials**, any network, ever.
   Permitted: in-content native banner + Smartlink `<a href>`. That's it.
3. **Every ad iframe keeps `sandbox={AD_SANDBOX}`** =
   `allow-scripts allow-popups allow-popups-to-escape-sandbox`. **Never** add
   `allow-same-origin` or `allow-top-navigation*` — those are the hijack.
4. Fastest rollback for a bad zone: delete its key from
   `apps/frontend/src/config/ads.js` and redeploy. Adsterra can never delete an
   ad unit, so a bad zone is abandoned, never repaired.

---

## 🗓️ SESSION LOG 2026-07-15 — Redesign: expanding search bar + landing reorg + /chat flow

**Shipped (branch `claude/landing-chat-redesign-next-rbla1r`, pushed, not merged):**
- **Vertically-expanding search bar:** `SearchBar.jsx`'s `<input>` is now a
  `<textarea>` that auto-grows line-by-line as you type (min 56/48/40px by
  size, caps at 240px then scrolls internally). Search icon + right-side
  icons (clear/mic/camera/file) anchored to a fixed top offset instead of
  50%, so they stay pinned near the first line instead of drifting to the
  box's vertical center as it grows. Enter submits, Shift+Enter newlines.
  New `showSearchButton` prop (default `true`, back-compat) lets a caller
  hide the button row below the bar — landing passes `false` since the spec
  bans search buttons below the bar there. Same auto-grow technique applied
  to TruegleChat's chat box.
- **Landing page reorg** (`LandingPage.jsx` + new `components/landing/`:
  `ChatModeRow.jsx`, `VsToggleRow.jsx`, `ThreeCards.jsx`, `RewardsCTA.jsx`):
  8-pill mode row (black=Chat default/blue/green/red/purple/ocean/orange/
  yellow) directly below the search bar; vs.TrueGLE + Feeling-chat-e? toggle
  row (shares TruegleChat's `truegle_nephesh_mode`/`truegle_verbose_mode`
  localStorage keys — no query params needed, preference carries silently
  into the first /chat visit); compact "Get paid for the ads you see! Click
  here for Truegle Rewards!" teaser that scrolls to a new `RewardsCTA` card
  (Sign up/No thanks) near the footer; `ThreeCards` (TrueGLE Chat / vs.
  Grand Logic Equation / Chat-Search) replaces the old 8-feature grid that
  had drifted from spec. Red pill click reuses the page's own (previously
  dead/unwired) Rabbit Hole warning modal. `ModesAndTrending` (mode showcase
  + live trending feed) kept as bonus content beneath the core spec flow —
  not deleted, just not one of the 9 numbered sections.
  `modeTheme.js` gained `black`/`orange`/`yellow` entries in the shared
  `MODE_COLORS`/`MODE_LABELS` maps for the new pills.
- **`/chat` flow rework:** mode-selector pills + input are no longer pinned
  top/bottom — on send they're replaced by the loading indicator, then
  reappear directly below the finalized response (mode row above input, for
  a quick lens switch), matching the spec's disappear→loading→reappear
  sequence.

**Deliberate scope decisions (asked mid-session, defaults used where the
question tool failed to return):**
- **`/chat` stays ad-free** — the spec describes ad slots around the chat
  box, but the file has an explicit "deliberately no ads" comment predating
  this session. Didn't override a prior deliberate call inside a layout
  slice; ad placement on /chat is its own monetization decision for later.
- **Skipped the spec's "footer order" token-meter/feedback-banner bullet** —
  grepped the whole frontend, neither component exists anywhere in this
  codebase iteration. Nothing to reorder; note is stale.

**Verified:** `vite build` clean after each slice; Playwright/Chromium
click-through on both pages (mode pill clicks route correctly per the pill→
page map, red pill warning modal fires and stages the mode on confirm,
Enter-to-search routes chat-default vs. staged /search?mode=, chat send
cycle visually confirmed disappear/reappear). No console/page errors.

**Next up (per UI-REDESIGN-SPEC.md build sequence):** per-page application
of the uniform search-bar system (search/red/purple/osint), OSINT's
multi-select investigation-class row, rewards page (orange, glassmorphism +
live meters), extract page reskin, Learn More page, global hamburger nav,
response-end banner ads.

---

## 🗓️ SESSION LOG 2026-07-13 — Infra hygiene + brand + redesign kickoff

**Shipped (all on branch + main):**
- **Committed env manifests** `apps/backend/.env.example` + `apps/frontend/.env.example`
  (secret-free, force-tracked via .gitignore negation) — the single source of
  truth for every env var, so we stop re-deriving them. `DEV-SETUP.md` (Neon dev
  branch / local PG, fill .env once, F&F soft-launch via preview deploys).
  `docs/NEON-TASKS.md` = standalone checklist for the DEFERRED prod tasks.
- **Session-start auto-load:** `.claude/session-start.sh` now injects the memory
  digest + full `ponytail` + `executive-summary` (Mission & Values only) every
  session. settings.json calls the script.
- **Perspectives gate:** BASE_IDENTITY + Modelfile now answer simple/factual/
  navigational queries DIRECTLY; multi-perspective format fires ONLY for
  genuinely contested topics or when asked. PROMPT_VERSION 2026-07-13.
- **Final UI/UX + brand direction captured** in `docs/UI-REDESIGN-SPEC.md`
  (authoritative). Tagline: "TrueGLE. For the questions most search engines
  won't answer." Chat is the DEFAULT; search is power-user. Red mode renaming to
  "Rabbit Hole". Pills: black=chat/vs-TrueGLE, white=verbose, orange=rewards,
  yellow=transcripts. Recommended AGAINST the forced full-screen rewards-ad
  background (use opt-in "Watch an ad now" instead).
- **Redesign phase 'Landing → default chat' — slice 1 shipped:** /chat shows the
  new "TrueGLE chat" logo (TruegleLogo variant='chat', truegle-chat.png,
  mixBlendMode:screen). Silent transport: landing query (no explicit search pill)
  → /chat?q=… which auto-sends once on arrival; explicit pill → /search. Logos
  are ~1-1.6MB each — optimize before launch (parked in memory).

**Deferred / needs its own focused pass:**
- Safesearch 500 (traceId 2b498ff7…) — needs reproduction against the harness,
  not a blind patch. Mic/speech — real Web Speech API work, belongs in the
  search-bar phase.
- Prod migrations 008+009 + DB password rotation — deferred to pre-ship (user's
  call). Steps in docs/NEON-TASKS.md. **Note: Neon DB password was exposed in
  chat — rotate before launch.**

**Next up (this phase, per UI-REDESIGN-SPEC.md build sequence):** landing visual
reorg (chat-mode row below search bar, vs.TrueGLE/verbose row, 3 cards, CTA/
cookies), vertically-expanding search bar, /chat flow rework (disappearing input
→ loading → reappear, footer order: chat box → feedback → token meter).

---

## 🗓️ SESSION LOG 2026-07-12 — Chat memory + /chat crash + chat UX

Batch 1 (shipped): fixed the two live bugs the user reported + the well-scoped UX asks.

**1. `/chat` crash ("can't access property length, n is undefined"):** the
Ocean/OSINT path built `citations = { links: artifacts }` with no `videos`/`pics`,
then `Citations` destructured straight to `.length`. Made `Citations` defensive
(coerce each list to `[]`, bail if all empty). `TruegleChat.jsx`.

**2. No conversation memory / "the fish forgets":** every chat send was a cold,
contextless request — no history was threaded. Now full back-and-forth on ALL
chat surfaces:
- `UnifiedAIService.chat` accepts `options.history`, `sanitizeHistory()` cleans +
  caps it (last 12 turns, 4000 chars/turn, drops system/empty/junk), inserts it
  between the system prompt and the new user message. Multi-turn requests bypass
  the response cache (a follow-up means different things in different threads).
- Threaded through: `routes/ai.js` `/chat` → `api.js aiAPI.chat` (top-level
  `history`) → `AIChatOverlay.jsx` (search-page modal) + `TruegleChat.jsx`.

**3. TruegleChat UX:** thread now persists to `localStorage` (`truegle_chat_thread_v1`)
so navigating away and back resumes it (+ "New chat" reset). Layout switched to
`h-[100dvh]` so the mobile keyboard no longer hides the input; chat thread takes
the majority of the page, input pinned below. Added a "Modes" tutorial popover
(hover/tap) explaining each mode + how the Nephesh/verbose toggles combine.

**4. Renamed purple mode "Skeptical" → "Perspectives"** (modeTheme labels,
useSearchMode, landing ModesAndTrending, chat welcome). The "skeptical" *bias
lens* inside PerspectiveSelector/BiasedResults is a different concept, left as-is.

**Batch 2 (shipped): Multi-select modes.** User can now activate more than one
search flow at once and get ONE blended answer.
- `getModePrompt(nepheshPrompts.js)` accepts a string OR array. For 2+ modes it
  emits BASE_IDENTITY once + an "ACTIVE MODES (COMBINED)" header + each mode's
  directive stacked as "LENS n" (identity de-duplicated via `directiveOf`).
  Told to weight lenses equally and show divergent framings side by side.
  Nephesh/verbose layers still apply on top. PROMPT_VERSION → 2026-07-12.
  (Modelfile untouched — this is a runtime backend function, not baked in.)
- `/api/ai/chat` accepts `modes[]` (pill keys) — used when 2+, else `context`.
  `/api/ai/summary` accepts `modes[]`, maps each through MODE_TO_AI_CONTEXT.
  `api.js aiAPI.chat` passes `modes`.
- `TruegleChat`: pills are now multi-toggle (`truegle_modes_pref`, never empty).
  `primaryMode` = modes[0] drives theme/tint/citations/OSINT-routing/welcome
  (subtle ring marks it). Shows "Blending N lenses — A + B" when >1. Pill keys
  (blue/green/red/purple/ocean) sent as `modes` so each lens survives (context
  keys would collapse blue+green→search_results).
**Batch 3 (shipped): Results-page multi-select lens pills (`UniversalSearch`).**
Rather than making the deeply-wired `mode` multi-valued (it drives sources,
perspectives, OSINT routing, the URL param — high regression risk), the primary
`mode` stays single and drives the results grid unchanged. A new "AI lenses" pill
row (above the AI summary) lets the user layer EXTRA lenses that blend only into
the AI summary + follow-up chat:
- `extraLenses` state (persisted `truegle_extra_lenses`); `activeModes =
  [mode, ...extraLenses]`. Primary pill is ring-marked + disabled (change it via
  the existing mode toggle/URL); others toggle on/off.
- `fetchAiSummary` sends `modes: activeModes.map(MODE_TO_BACKEND)` when >1.
  A lens-only effect (`lensSig`) re-runs just the summary on lens change (no full
  re-search). `AIChatOverlay` now takes a `modes` prop → follow-up chat blends too.
- Verified: eslint clean, frontend build clean, backend combine logic unit-tested.

**Batch 4 (shipped): Transcripts via Invidious front-ends (fixes the "YouTube is
rate-limiting Truegle's server" error on /extract).** Root cause: the extractor
scraped YouTube's watch page directly from Vercel's datacenter IP, which YouTube
rate-limits. `TranscriptService.fetchTranscript` is now layered:
  1. Invidious/Piped instances (`/api/v1/captions/{id}` → WebVTT) — fetched from
     THEIR IPs, so YouTube can't rate-limit us. Multi-instance failover; override
     with `TRANSCRIPT_INVIDIOUS_INSTANCES` (comma list). This is the "use SearXNG
     for transcripts" ask — same decentralized YT pathway SearXNG uses.
  2. Direct watch-page scrape — unchanged, now last-resort fallback.
  New `parseVtt` + `pickTrack` helpers (unit-tested, 13/13 pass). Error priority:
  terminal codes (AGE_RESTRICTED/UNAVAILABLE) short-circuit; else NO_CAPTIONS >
  RATE_LIMITED > FETCH_FAILED. DeepResearchService inherits it (same function).
  NOTE: live-verify on deploy — Invidious/YouTube unreachable from the sandbox.
  Morty result-proxy is NOT usable for the scrape (it strips <script>, killing
  ytInitialPlayerResponse) — that's why Invidious, not the result-proxy.

**Bug fixed in passing:** `config/env.js` had TWO `email:` keys — the SMTP block
silently overrode the Resend block, leaving `config.email.resend` undefined and
Resend transactional email dead. Merged into one object; both survive now.

**Batch 5 (shipped): Persistent shareable threads (chat + OSINT investigations).**
A user shares a link; the recipient opens the LIVE thread (messages + cited
links/images/videos), not pasted text. Built on the EXISTING Postgres DB — no
new infra/credentials (chose this over Cloudflare KV for true $0/zero-ops).
- Migration `008_add_shared_threads.sql`: `shared_threads(id TEXT pk, kind,
  user_id→users(id) ON DELETE SET NULL, payload JSONB, views, created_at,
  expires_at DEFAULT now()+180d)`.
- `ShareService`: short unambiguous 10-char id (no 0/O/1/I/l), `sanitizePayload`
  (whitelists fields, coerces roles, caps title 200 / messages 200 /
  payload 256 KB), `createShare` (collision-retry), `getShare` (expiry-gated,
  increments views).
- `routes/share.js`: `POST /api/share` (optionalAuth+rateLimit) + `GET
  /api/share/:id`; registered in server.js.
- Frontend: `shareAPI` in api.js; TruegleChat "Share" button persists the whole
  thread → copies a `/s/:id` link; new read-only `SharedThread` page at `/s/:id`
  (reuses exported `Citations`). SPA routing added to `_redirects` (`/s/*`) +
  `_headers` (text/html + noindex).
- VERIFIED end-to-end against a REAL local Postgres: migration applies, create/
  load round-trip, JSONB citation integrity, view increment, NOT_FOUND for
  missing + malformed ids, and expiry→NOT_FOUND. Lint + frontend build clean.
  Local PG: role `truegle`, db `truegle_dev`, /tmp/pgdata-truegle (started via
  `sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgdata-truegle start`).

**Batch 6 (shipped): OSINT investigation graph (GraphiPy model).** User pointed
to github.com/shobeir/GraphiPy (couldn't add_repo cross-owner; read it via web).
GraphiPy models data as a graph of typed nodes (Id/Label/label_attribute, deduped
by id) + edges (Source/Target/Label, Id = source+target+label), BaseGraph with
create_node/create_edge/export_csv. Mirrored faithfully:
- `OsintGraphService.js`: `Node`(Id,Label,Type,attributes), `Edge`(Source,Target,
  Label,Id), `Graph`(createNode/createEdge/getNodes/getEdges/toJSON/exportCsv).
  `buildFromInvestigation(query, entities, findings)` → query node → entity nodes
  ("investigates") → artifact nodes (subdomains/org/registrar/dns/wayback/asn/geo/
  gravatar/mx/social-profiles/people+phone directories) with typed edges
  (has_subdomain/registered_to/resolves_to/profile_on/listed_in/…). Kept Id/Label/
  Source/Target field names so `exportCsv()` drops straight into Gephi.
- Wired into `investigate()` → response now carries `graph` (toJSON).
- Frontend `InvestigationGraph.jsx`: 3-column SVG (query→entities→artifacts) with
  curved edges, color-by-type, clickable artifact links, collapse toggle, and
  export buttons (Gephi CSV nodes+edges, JSON). Rendered in TruegleChat ocean
  replies AND persisted into shared threads (SharedThread renders it too).
- ShareService.sanitizePayload now whitelists `graph`.
- VERIFIED: graph-build unit tests (12 assertions: query/entity/artifact nodes,
  edge labels, edge-id format, dedupe, Gephi CSV headers, CSV escaping) + graph
  survives the share round-trip through the REAL local Postgres. Lint+build clean.

**Batch 7 (shipped): AI rename + mandates + feedback training.**
- **Rename Nephesh → TrueGLE (user-facing only).** Identity in BASE_IDENTITY +
  Modelfile ("You are TrueGLE 1.3…"), attribution footer/metadata/servedBy
  ("Research Provided by TrueGLE 1.3"), watermark canary TRUEGLE13, UI labels
  ("TrueGLE Mode"), share text ("Answered by TrueGLE"). INTERNAL identifiers
  intentionally KEPT as nephesh: env vars NEPHESH_BASE_URL/AUTH_TOKEN, provider
  key 'nephesh', metadata key nephesh_attribution, filenames, localStorage
  truegle_nephesh_mode, prop nepheshMode — renaming those would break live
  config/contracts. PROMPT_VERSION 2026-07-12.2.
- **Two absolute model mandates** baked into BASE_IDENTITY + Modelfile:
  MANDATE A (unbiased indifference — no opinions of its own; keep any verdict to
  itself; help the user form THEIR own view from unbiased research/media) and
  MANDATE B (100% honesty/transparency — never deceive, mislead, manipulate,
  spin, omit-to-steer, or fabricate). "No exceptions."
- **Thumbs up/down feedback = training signal.** `ai_feedback` (migration 009);
  thumbs-DOWN requires a brief explanation (DB CHECK constraint + API guard).
  `FeedbackService` + `POST /api/ai/feedback`; `FeedbackButtons.jsx` wired into
  TruegleChat messages + AIChatOverlay (replaced its old no-op thumbs). Stores
  vote+reason+answer+query+mode for later fine-tuning/correction.
- VERIFIED: prompt mandates + rename unit-checked; attribution rename verified;
  feedback migration + service round-trip + both reject paths (empty-reason
  down, bad vote) against REAL local Postgres; lint + frontend build clean.

**⚠️ Prod migrations now: run 008 (shared_threads) AND 009 (ai_feedback):**
`cd apps/backend && DATABASE_URL="<prod>" npm run migrate` after deploy.

**Still open (flagged to user, not yet built):** cross-session per-user persistent
memory (server-side saved-threads list — shared_threads store is the foundation);
TrueGLE security sub-agent; agent headless-browser OSINT. (needs a server store — $0 options
being weighed); agent-driven headless-browser research; installing OSINT toolkits
in a sandbox; a persistent Nephesh security/anti-injection sub-agent. The
"AI jailbreak / apply to Nephesh" ask was declined as framed (won't build safety
bypasses) — the legitimate goal, fewer false denials on lawful requests, is the
prompt-authorization + refusal-failover work already shipped 2026-07-11.

---

## 🗓️ SESSION LOG 2026-07-11 (cont'd) — Fix false denials on lawful OSINT / person lookups

User hit a refusal ("I can't assist with that request") on a lawful public-records
person lookup (name + phone + DOB + Oregon town). Two stacked failures, both fixed:

**1. Detection miss (root cause of the fall-through):** the bare 10-digit phone
(`5412281145`, no `+`) and the person's name weren't detected as entities, so the
investigation found nothing and fell through to plain Ocean chat — where the Groq
substrate refused. Fixed in `OsintInvestigationService.detectEntities`:
- Phone: now catches bare NANP numbers (10-digit, or 11 w/ leading 1, with separators), not just `+`-prefixed E.164.
- Person: new `detectPerson()` — anchors the name off intent phrases
  ("info about NAME…"), tolerates sloppy casing ("william James gardener" →
  "William James Gardener"), extracts city/state, and requires a person-lookup
  signal (intent verb OR phone/age/DOB/location) so "New York Times" /
  "photosynthesis" aren't treated as people. Caught + fixed a month-prefix bug
  (CONTEXT_KW matched "Jan"→"Jane", "Mar"→"Marcus" as prefixes — now whole-word).
- New public deep-link builders in `OsintLookups`: `peopleSearchLinks()` and
  `phoneSearchLinks()` → TruePeopleSearch / FastPeopleSearch / ThatsThem /
  Whitepages / VoterRecords / Google-exact. Pure URL construction, no scraping,
  no key — the same public directories anyone can use, pre-filled. Surfaced as
  citation chips via `extractArtifacts`.

**2. Substrate refusal (the safety net):** commercial models (Groq's Llama)
RLHF-refuse person lookups even when lawful. Two mitigations:
- **Refusal-aware provider failover** (`UnifiedAIService.chat` + the OSINT
  `synthesize` loop): if a provider returns refusal-shaped content on a lawful
  request, try the NEXT provider before giving up; only return a refusal if ALL
  refuse. New `isRefusalContent()` (unit-tested against the exact user-seen
  string; tuned tight so "I can't confirm X, but…" real answers don't trip it)
  + `contentOf()` helpers.
- **Prompt authorization**: the OSINT investigation system prompt now explicitly
  states that compiling PUBLICLY-available info about a named individual (public
  records, people-search directories, published contact info) is lawful and IN
  SCOPE — decline ONLY for non-public data (account breaking, sealed/private
  records, paywall bypass) or clear harm facilitation (stalking/harassment intent).

**Honest limit:** the COMPLETE cure for substrate refusals is the self-hosted
uncensored Nephesh model (blocked on hosting). Until then, failover + the
authorized OSINT path + real people-search links mean lawful person lookups now
return actionable public-records directories instead of a flat denial. On the
current single-substrate deploy (Groq only, no Nephesh box), failover has no
second provider to jump to unless GROQ has multiple keys — so the biggest lever
for person-name *chat* answers is still the prompt authorization + routing the
query through /osint/investigate (which it now does, since entities are detected).

**Verified**: entity detection across the real query + false-positive guards;
refusal detector against the exact refusal string + tricky true-answers; full
investigate route returns entities + 10 people-search artifacts + a report on
the user's exact query. Lint clean, jest 95/16 unchanged.

## 🗓️ SESSION LOG 2026-07-11 — Chat share + AI-directed OSINT investigation

### Chat answer sharing (SHIPPED, Playwright-verified)
Every assistant answer in `/chat` has a Share control (`ChatShareButton.jsx`):
"Copy full answer + links" copies the whole response + every cited
source/image/video URL; Twitter/Bluesky/LinkedIn/Reddit buttons open a share
intent with a trimmed body pointing at `truegle.info/chat`. Platform config
extracted from `TruegleShareButton` into shared `config/sharePlatforms.jsx`
(compose signature is now `{title,text,url}`); both share buttons use it.
NOTE: JSX-containing config files MUST be `.jsx` not `.js` (Vite/rollup won't
parse JSX in `.js`) — hit this, renamed the file.

### AI-directed OSINT investigation — Ocean mode (SHIPPED, pipeline-verified)
One natural-language query in Ocean mode → auto-investigation, zero manual
tool clicks. **Deliberately NOT "install GitHub CLI tools and exec them"** —
that's an RCE/SSRF surface and won't run on Vercel serverless anyway. Instead:
lookup-only over HTTP against FIXED upstreams with the user's entity as a
regex-validated, URL-encoded PARAMETER (no SSRF, no shell).
- `services/OsintLookups.js`: whois/RDAP, DNS-over-HTTPS, IP geolocation,
  email intel (MX + Gravatar), phone intel (libphonenumber), **crt.sh**
  certificate-transparency subdomain enum (new), **live username presence**
  across GitHub/Reddit/GitLab/Dev.to via their JSON APIs (new, upgrades the
  old URL-generation-only check), **Wayback** snapshot (new). Every fn is
  best-effort — returns `{ok:false}` instead of throwing.
- `services/OsintInvestigationService.js`: `detectEntities()` pulls
  domain/IP/email/username/phone out of free text (strips emails before
  domains so it doesn't double-match); `gather()` runs the right lookups per
  entity in parallel; `synthesize()` feeds findings to Nephesh (ocean mode +
  an investigation-report instruction) → report; `extractArtifacts()` maps
  discovered subdomains/profiles/snapshots into citation chips.
- `POST /api/osint/investigate` (routes/osint.js) — optionalAuth, token-gated
  for signed-in users, `noEntities` guard message when nothing investigable.
- `TruegleChat.jsx`: Ocean mode routes sends to `/osint/investigate`; if the
  query names no entity it falls through to normal Ocean chat (so "how do I
  research a domain" methodology questions still get answered).
- **Verification**: entity detection + artifact extraction unit-tested (all
  cases pass); Wayback parser confirmed against the live API; whois/dns/ip use
  the SAME upstreams the existing production osint.js routes already use (so
  proven from Vercel); full route pipeline booted + hit end-to-end (entities
  detected → findings gathered w/ graceful degradation → Nephesh report
  returned); browser E2E confirmed Ocean mode fires `/osint/investigate` (1x,
  not the chat endpoint) and renders the report. Sandbox egress blocks most
  live lookups so full data-richness only shows on Vercel — pipeline integrity
  is proven. Also fixed a pre-existing lint error in osint.js (`\-` in a
  char class). Jest baseline unchanged (95/16).
- **User-facing note**: works with no API keys. Optional future upgrades
  (HaveIBeenPwned breach check, Shodan) need free-tier keys — not wired yet.

## 🗓️ SESSION LOG 2026-07-10 (cont'd 2) — Truegle Chat (/chat)

### Truegle Chat — designated chat-first route (SHIPPED, boot-verified with Playwright)
New `/chat` page for chat-first users: landing-page minimalism (logo, one
large chat box), background + accents synced to pill mode, Nephesh answers
with cited links/pics/vids rendered inline, same 3 Truegle link actions as
search (Open link / View anonymously / Open in app) on every citation. No
ad containers. User's original build-plan doc never arrived this session —
built from their approved prose spec + one clarifying question (persistent
toggle placement, unanswered directly but not objected to — used as default).

- **`src/config/modeTheme.js`** (new, shared): `MODE_ACCENT`, `LITE_BG`,
  `PERSPECTIVE_COLORS`, `MODE_COLORS` (hex), `MODE_LABELS`, `MODE_TO_CONTEXT`
  — lifted out of inline copies in `UniversalSearch.jsx` and
  `AIChatOverlay.jsx` (both now import from here; zero behavior change,
  confirmed via lint+build+jest).
- **`src/utils/videoEmbed.js`** (new, shared): `getVideoEmbed()` extracted
  from `UniversalSearch.jsx` the same way, reused by chat's video citations.
- **`src/pages/TruegleChat.jsx`** (new): `LandingBackground` (WebGL-safe,
  self-probing — never a raw WebGL background here) + a mode-tinted
  radial-gradient overlay that crossfades on mode change (pure CSS/opacity,
  zero WebGL risk) + `CursorGlow` + `TruegleLogo`. 5-pill mode row + the same
  Nephesh Mode / "Feeling chat-e?" toggles as the search pages (shared
  localStorage keys — state carries over between `/search` and `/chat`).
  On each send: parallel `aiAPI.chat` (answer) + two `/api/search` calls
  (category `all` → links+videos, category `images` → pics), independently
  graceful when either fails/empties. Citation chips reuse the exact
  action-row semantics from `ResultCard` (Open link / View anonymously via
  `proxyUrl` / Open in app inline iframe expand).
- Routing: `App.jsx` route + `RouteBoundary`; `/chat` added to BOTH
  `public/_redirects` (→ `/_index 200`) and `public/_headers`
  (`Content-Type: text/html`) per the SPA-route rule. Deliberately left
  indexable (no noindex) — unlike `/search`'s per-query result pages, `/chat`
  is a single stable feature landing page, good for AEO/GEO discovery.
- **Verified end-to-end, not just built**: booted the backend against a mock
  Nephesh + mock SearXNG (general + images categories), ran the real Vite dev
  server, and drove `/chat` with the pre-installed Playwright Chromium —
  confirmed the assistant answer renders with the real attribution footer,
  Sources/Pics/Vids sections populate from actual API responses, citation
  action icons are clickable, switching pill mode live-changes the citation
  accent color and background tint (screenshotted), and the Nephesh
  Mode/verbose toggles flip both UI state and localStorage correctly. No
  console/page errors other than expected sandbox-network CDN blocks
  (Mapbox/Google Fonts/YouTube thumbnail — all external, all gracefully
  `onError`-hidden, unrelated to app code).
- Jest baseline unchanged: 95 passed / 16 pre-existing env-dependent failures.

## 🗓️ SESSION LOG 2026-07-10 (cont'd) — Nephesh Mode toggle, verbosity toggle, ad reposition

### Claim ad moved below AI summary (SHIPPED, per user)
`UniversalSearch.jsx`: relocated the yellow "claim this spot" slot from above
the AI summary to directly below it. Mechanical cut/paste, same `!queryIsQuestion`
guard preserved.

### Nephesh Mode + "Feeling chat-e?" verbosity — opt-in toggles (SHIPPED, boot-verified)
The Null-Prime dual-audit protocol was baked into EVERY mode's prompt by
default (root cause of the moon-landing query auto-triggering a full audit in
plain blue mode last session). Now opt-in via two persistent toggles next to
the search bar (localStorage `truegle_nephesh_mode` / `truegle_verbose_mode`,
both default OFF = plain unbiased multi-perspective + succinct answers).
- `nepheshPrompts.js` (v2026-07-10.2): `CONTESTED_CLAIM_PROTOCOL` removed from
  `BASE_IDENTITY`; `getModePrompt(mode, {nepheshMode, verbose})` layers it
  back on request-by-request, plus new `SUCCINCT_STYLE`/`VERBOSE_STYLE`.
  Applies uniformly across ALL modes including purple/ocean — their
  specialness is their own dedicated framing, not the audit ledger.
- `nephesh/Modelfile`: same protocol removed from the baked SYSTEM block —
  otherwise a self-hosted Nephesh would ignore the toggle entirely (always-on
  regardless of the flag). Backend now layers the protocol into the request
  prompt at call time (`NepheshService.formatMessages`) when `nepheshMode:true`.
- `routes/ai.js`: both `/chat` and `/summary` now build their system prompt via
  `getModePrompt` (previously `/chat` read a static map bypassing the toggle
  entirely, and `/summary` used the DB `ai_prompts` table, never nepheshPrompts
  at all). Fixed a latent context-key mismatch: `/summary`'s purple mode mapped
  to `'perspective_specific'`, a key that doesn't exist in nepheshPrompts —
  corrected to `'purple'`.
- `UnifiedAIService.analyzeContent`: gained the same `systemOverride` escape
  hatch `chat()` already had (unseeded `ai_prompts` table no longer breaks it).
- **Bug found + fixed during verification**: the response cache key only
  hashed `message+context`, so toggling nepheshMode/verbose on an identical
  message silently returned a STALE cached answer from before the toggle.
  Fixed by folding `systemOverride` into the cache key.
- **Bug found + fixed during verification**: `aiAPI.chat()` (frontend) nested
  `nepheshMode`/`verbose` inside a `options` sub-object the backend never
  read (backend expects them top-level, same as `context`) — silently no-op.
  Fixed to lift them to the top level, consistent with existing `context` handling.
- Verified end-to-end with a mock Nephesh that echoes which prompt layers it
  received: OFF→plain/succinct, ON→protocol present, verbose→verbose style,
  purple+nepheshMode→protocol layers correctly on top of purple's own framing,
  repeat-identical-request→correct cache hit (caching still works, just scoped
  right). `nephesh/eval/`: 6 existing audit items now pass `nepheshMode:true`
  explicitly; added `audit-off-1` negative-case item + `no_audit_machinery`
  check; `run-eval.mjs` now imports the real prompt fragments via
  `createRequire` (no more duplicated/drifting protocol text in the eval script).
- Jest baseline unchanged: 95 passed (+6 from earlier this session) / 16
  pre-existing env-dependent failures, same before and after.

## 🗓️ SESSION LOG 2026-07-10 — Verdict-logic fix, navigational ranking, ad declutter

### Null-Prime forced-draw bug (FIXED — prompt layer)
Live moon-landing audit listed 2 vs 3 axioms then declared "equal" → forced "∅".
Verified NOT trained-in (no fine-tune exists) — small-substrate arithmetic failure.
`prompts/nepheshPrompts.js` + `nephesh/Modelfile` (v2026-07-10.1, still byte-identical):
step 3 now REQUIRES "Affirmative axioms: N — Negation axioms: M" line; step 5 permits
"∅" ONLY when N=M, tie-on-unequal = protocol violation. Eval runner gained
`audit_counts` check (5 audit items). **User action: set `GROQ_MODEL=llama-3.3-70b-versatile`
on Vercel** — free tier, much better protocol adherence than 8b-instant.

### Navigational ranking (FIXED — shared scorer, boot-verified)
"google" surfaced blog.google as "Official site". Root causes: substring scoring
(`bloggoogle`⊃`google`) + `www.` counted as the subdomain, so blog.google tied
www.google.com and array order won; `dashcloudflare` never substring-matched
`cloudflare.com`. New `QueryInterpreter.scoreNavigationalMatch(query, url)` —
registrable-root-label comparison (google.com 1.0 > accounts.google.com 0.9 >
blog.google 0.4), sub+root concat for multi-word (dash.cloudflare.com 0.97),
social-profile penalty skipped when the platform IS the query. Replaces BOTH
duplicate scorers: `routes/search.js buildInstantAnswer` (threshold 0.35, no card
below it) and `SearchService.calculateNavigationalScore`. 6 new unit tests.
Boot-verified with the real-world result set: instantAnswer now picks
www.google.com; results order google.com → accounts → research.google.
Known limit: product names w/o matching domain ("nano banana") aren't fixable by
domain logic — that's substrate/relevance.

### Latent prod-crash bug (FIXED)
SearXNG category promises were pushed before an `await` gap (SearXNG-primary web
call) → a rejection in that gap = unhandled rejection = Node kills the process
(reproduced in test harness). `deferSettle()` in SearchService attaches a no-op
catch branch; Promise.allSettled still records the failure.

### Ad declutter (SHIPPED per user)
ALL ad containers commented out (`TODO(ads): re-enable when new Adsterra zones land`)
EXCEPT the yellow claim slot (`AdColorWrapper type="claim"` + `AdSlot adId="advertise-cta"`).
Touched: `UniversalSearch.jsx` (Adsterra strips, adult-gated banners + AdultConsentGate,
sidebar cpm/adult, house AdSlots, RewardAdSlot, footer Smartlink), `MultimediaInterface.jsx`
(4 grid injections), `App.jsx` (AdScriptLoader mount). Configs untouched — reactivation
= uncomment. Verified: build ✓, eslint ✓, only claim slot active in rendered JSX,
jest 95 pass (+6 new) / same 16 pre-existing env failures.

### Tap-to-open result cards (SHIPPED, needs on-device thumb-test)
Whole ResultCard is now a link (role=link, Enter key, pointer cursor) — tap
anywhere opens the result in a new tab. Guards: clicks on inner
a/button/iframe are excluded (Open link / View anonymously / Open in app /
Share all keep their own behavior), text-selection doesn't navigate, taps
ignored while the in-app viewer is open. Lint+build clean. NOT yet verified
on a real phone — confirm a scroll-flick over a card doesn't count as a tap.

### 🔜 NEXT SESSION
1. Truegle Chat interface — user has a full build plan to present (chat-first users).
2. Adsterra zone replacement when 14-day window ends (~2026-07-16) → uncomment TODO(ads) sites.
3. `GROQ_MODEL` bump on Vercel (above), then re-run a live audit pair to confirm leans follow counts.

---

## 🗓️ SESSION LOG 2026-07-08 — Company skills + Nephesh 1.3 foundation (branch `claude/truegle-company-skills-af5avu`)

### Truegle company skills (SHIPPED)
Nine agent skills under `.claude/skills/`: executive-summary, ponytail
(engineering principles), caveman (plain-language), user-task-instructions
(headless-browser visual guides), marketing, financial ($0-budget controller),
inference (Nephesh), tech (ops/security/handoff duties), design. Auto-load in
every session; see `.claude/skills/README.md` for the session protocol.

### Nephesh 1.3 — self-hosted AI foundation (SHIPPED, verified end-to-end)
Nephesh is Truegle's own model for ALL AI responses: everyday tasks, Q&A,
unbiased multi-perspective research, mode-aware behavior, deep-dive research.

**Backend (all booted + exercised against a mock Nephesh/SearXNG + local Postgres):**
- `services/NepheshService.js` — Ollama-API provider, registered FIRST in `UnifiedAIService` (interim providers are failover). Remote URLs require `NEPHESH_AUTH_TOKEN` or the provider refuses traffic.
- `prompts/nepheshPrompts.js` — versioned per-mode system prompts (blue/red/purple/ocean/green + legacy contexts). `routes/ai.js` MODE_SYSTEM_PROMPTS now imports from here (inline copies removed).
- `utils/nepheshAttribution.js` — exact block "Research Provided by Nephesh 1.3 - / https://truegle.info / Truegle Co. / ©2026" embedded 3 ways: visible footer (idempotent), `nephesh_attribution` metadata, invisible zero-width watermark (reuses utils/watermark.js; decodes as `NEPHESH13:<traceId>`).
- `services/DeepResearchService.js` + `POST /api/ai/deep-research` — gathers SearXNG web/news/social/videos in parallel + YouTube transcripts (sequential, rate-limit aware) → indexed corpus → multi-perspective report citing [index] sources. Graceful per-channel degradation; 503 when no material.
- `UnifiedAIService` fix: a missing/unseeded `ai_prompts` DB table no longer 500s chat when a systemOverride is supplied (falls back to defaults, `promptVersion: 'override-only'`).
- Env (config/env.js): `NEPHESH_BASE_URL`, `NEPHESH_MODEL` (default `nephesh:1.3`), `NEPHESH_AUTH_TOKEN`.

**Model build kit (`nephesh/` at repo root):**
- `Modelfile` (Ollama; base placeholder `llama3.1:8b-instruct-q4_K_M` — swap per final spec), `finetune/` (Axolotl QLoRA config + dataset schema + 10-example seed dataset), `eval/run-eval.mjs` (promotion gate: perspective balance, 0 refusals on lawful-controversial set, attribution present, mode divergence, p95 < 3s).
- Self-host guide in `nephesh/README.md`: Ollama on the EC2 box behind an nginx bearer-token proxy (NEVER expose 11434 directly).

**Test baseline:** jest 89 passed / 16 failed BOTH before and after changes — the 16 are pre-existing env-dependent failures, not regressions.

### ✅ RESOLVED — Nephesh build material received and reconciled (same session)
The claude.ai share link was unreadable from the remote-exec environment, but
the user uploaded the material directly: **Nephesh 1.3 = Null-Prime v3.1**, a
reversible epistemic-austerity engine (DECOMPOSE → DUAL AUDIT → DUAL IRE →
gated INSTRUMENT-BLIND/convergence check → qualitative VERDICT; consensus
earns no exemption; denial = strict logical negation; NEVER numerical
probabilities; "∅ — Underdetermined" when ledgers tie). Reconciled:
- `nephesh/Modelfile` + `prompts/nepheshPrompts.js` (v2026-07-08.2): full Null-Prime v3.1 protocol merged into the Nephesh identity; everyday tasks bypass the protocol. Base ladder per v3.1: **qwen3:8b default, phi4-mini-reasoning fallback, llama3.2 small-host** (params: temp 0.3, top_p 0.85).
- `nephesh/scripts/install-nephesh.sh` + `create-nephesh.sh`: Linux ports of the user's PowerShell scripts (swappable base at build time).
- `nephesh/eval/bias-battery.md`: the user's symmetry/calibration battery (matched pairs, borderline items, framing probes, 8-point rubric, treatment-gap indicators — target is SYMMETRY not agreement). Automated spot-checks added to `evalset.jsonl`/`run-eval.mjs`: audit machinery present, no numerical probabilities, matched audit pairs.
- `nephesh/docs/null-prime-source/`: original artifacts preserved. `nephesh/docs/EC2-DEPLOY.md`: full step-by-step production deployment guide (also delivered to the user in chat).
- `finetune/qlora-config.yaml` retargeted to Qwen3-8B/ChatML + battery-based acceptance test.

### 🔜 NEXT SESSION
1. User action (guide: `nephesh/docs/EC2-DEPLOY.md`): deploy Nephesh on the EC2 host — size check, install/create scripts, nginx bearer-token proxy, `ai.truegle.info` DNS, then `NEPHESH_BASE_URL`/`NEPHESH_MODEL`/`NEPHESH_AUTH_TOKEN` on Vercel.
2. Run `node nephesh/eval/run-eval.mjs` + the manual bias battery against the live box before flipping traffic; record p95 and treatment gap here.
3. Adsterra small-zone replacement still on hold until the 14-day deactivation window ends (~2026-07-16).

---

## 🗓️ SESSION LOG 2026-07-02 (session 2) — Ad saturation, zone strategy, revenue calc, UGC SEO

### What was done this session

**Ad saturation — zone assignment strategy (code shipped, awaiting dashboard action):**

Philosophy:
- **LARGE formats (728x90, 160x600, 160x300)** → `adultGated=true` in code. Higher CPM ($5–15) but rare; only render when all 5 adult gates pass.
- **SMALL formats (320x50, 300x250, 468x60, native)** → non-gated everywhere. Low CPM ($0.20–$1.20) but high volume. Add as many as possible.

**Changes in `apps/frontend/src/pages/UniversalSearch.jsx`:**
- Between search results (every 3rd): `banner300x250` → `banner320x50` strip
- Adult CPM slot: `banner300x250` → `banner728x90` with `adultGated=true`
- Collapsed AI summary: new `banner320x50` strip below the summary preview
- Expanded AI summary: two `banner320x50` strips inside expanded view
- After-summary inline: adult-gated `banner728x90` with `AdColorWrapper type="adult"`
- Standard CPM / Ad Banner 2: both `banner728x90` → `banner320x50`
- Media tabs: `banner320x50` (non-adult) + adult-gated `banner728x90`
- OSINT inline: `banner728x90` → `banner320x50`
- Map: `banner320x50` + adult-gated `banner160x300`
- Sidebar `banner160x600`: made `adultGated=true`
- Footer: replaced stub `AdSlot` with Smartlink anchor (`SMARTLINK_URL` from config)

**Changes in `apps/frontend/src/components/ui/MultimediaInterface.jsx`:**
- `Fragment` + `AdsterraBanner` already imported
- `ImageGrid` (the active render path at case 'pics'): injects `banner468x60` after every 6 images (`col-span-full`)
- `VideoGrid` (the active render path at case 'vids'): injects `banner320x50` after every 4 videos (`col-span-full`)
- Both use `searchQuery` from outer component scope for `searchContext`

**New page: `apps/frontend/src/pages/RevenueCalculator.jsx`**
- Route: `/revenue-calc` (added to `App.jsx`, `_redirects`, `_headers`)
- Sliders: daily pageviews (100–200K), ads per page (1–20), adult query % (0–50%), reward boost % (0–50%)
- 4 CPM scenarios: Conservative ($0.20/$5), Mainstream ($0.50/$8), Optimistic ($1.20/$12), Anti-AdBlock CNAME ($2.00/$15) — each shows daily/monthly/annual
- Smartlink revenue estimate (0.2% CTR × $0.08 CPC)
- Break-even / P&L table across 6 traffic milestones (1K–100K daily views)
- Monthly cost breakdown (currently $11/mo: $0 hosting + $1 domain + $10 compute)
- Dashboard action checklist inline on page

### 🔴 PERMANENT FACTS (same as prior session — still do not re-derive)

#### Adsterra API — COMPLETELY INACCESSIBLE
Every endpoint variation has been exhausted. Zone creation is dashboard-only. **Stop trying API. Stop asking user.**

#### Banner anti-adblock codes — DO NOT EXIST in this account
Only the Popunder zone has an anti-adblock URL. Banners have none. **Stop asking.**

#### Current zones — all have adult content ON
Until the user toggles them off in the dashboard, ALL zone keys in `config/ads.js` serve adult ads.

### 🔴 PERMANENT FACT — ADULT TOGGLE CANNOT BE DISABLED
Adsterra permanently locks the adult-content toggle ON the moment a zone is activated. It is not possible to disable it after activation. **Do not suggest the dashboard toggle as a fix — it does not work.**

The only path is:
1. Remove the zone key from code → zone goes inactive after 14 days of zero impressions
2. User creates a NEW zone (adult OFF, set before first activation) in the Adsterra dashboard
3. User provides the new key → update `config/ads.js`

### ⚠️ SMALL ZONES DEACTIVATED — AWAITING REPLACEMENT

Small-format keys removed from `config/ads.js` on 2026-07-02. All call sites that rendered small formats now silently render nothing (`AdsterraBanner` returns null when the key is missing). These zones will go inactive in ~14 days.

| Format | Old key (do not reuse) | Status |
|---|---|---|
| banner320x50 | `5c0cc5f396ae48cbf68f63ec86024c3f` | Deactivating (14 days) |
| banner300x250 | `0fca9299f48c601ea125d688c11ff7d2` | Deactivating (14 days) |
| banner468x60 | `7e53f17316c72708e8417a8a991171ac` | Deactivating (14 days) |
| nativeBanner | `a7a8599f485ec0638131d8f99bc29cb7` | Deactivating (14 days) |

**Next session action:** Once user creates replacement zones (adult OFF) in Adsterra dashboard, add the new keys to `ADSTERRA` in `apps/frontend/src/config/ads.js` and redeploy.

### ⚠️ LARGE ZONES ACTIVE (adult-gated in all call sites):
2. **Keep adult toggle ON** for large zones:
   - Banner 728×90 (key `d5f657ea7d55fc33ea532071957a2857`)
   - Banner 160×600 (key `c16f5233d71714d3151e160ac5778be2`)
   - Banner 160×300 (key `ffac08ed0f599aa8f389d387aa76001b`)

3. **CNAME anti-adblock (Firefox ETP fix — when at desktop):**
   - Adsterra dashboard → Anti-AdBlock → get CNAME target
   - Cloudflare DNS: `cdn CNAME [target]`
   - Cloudflare Pages env: `VITE_AD_DOMAIN=cdn.truegle.info`
   - Redeploy → all ad traffic becomes first-party → Firefox ETP can't block it

4. **Activate Smartlink** — wait for Adsterra approval email, confirm `SMARTLINK_URL` key in `config/ads.js` is still correct

### UGC / SEO strategy to increase AI Overview ranking (currently #7)

Goal: move Truegle from position #7 in AI Overview citations toward #1.

Strategy (do not ask the user for more detail — this is the complete plan):
1. Post on LinkedIn, YouTube (video description), Reddit (r/privacy, r/searchengines, r/SEO), TikTok, X/Twitter, Instagram with target keywords **at the very start of the post** (first 15 words). AI Overview models weight the beginning of content most heavily.
   - Target phrases: "unbiased search engine", "Truegle search", "alternative to Google", "search without tracking", "bias-free search results"
2. Each post must include a link to `truegle.info` — either in the post body or first comment.
3. Build backlinks to those social posts (link to your Reddit post from LinkedIn, link to YouTube video from your blog, etc.). This "amplification" is what makes AI citations stick.
4. Blog posts on `truegle.info/blog` with those exact phrases near the top of the title and first paragraph get indexed and cited directly.
5. Re-post / update every 30 days to keep freshness signals active.

The revenue calculator at `/revenue-calc` is intentionally internal-only (no nav link) — access via direct URL. Do not expose it in public navigation.

### Revenue model (for reference in next session)
- Break-even is ~$11/mo (just the compute cost; hosting is free)
- At 5K daily views with mainstream CPM ($0.50) and 6 ads/page: ~$47/mo before rewards
- At 10K daily views with anti-adblock CNAME CPM ($2.00): ~$370/mo
- Reward boost adds another 10–50% on top (depends on platform payout rates)
- Smartlink adds $0.08–$1.60/mo at current traffic (scales linearly)

---

## 🗓️ SESSION LOG 2026-07-02 (session 1) — Adsterra ads live, Firefox ETP fix, Smartlink footer

### 🔴 PERMANENT FACTS — DO NOT RE-DERIVE, DO NOT ASK THE USER AGAIN

#### Adsterra API — COMPLETELY INACCESSIBLE
Every endpoint variation has been exhausted across three sessions:
- `publishers.adsterra.com/api/v1/*` → 404 "File not found"
- `beta.publishers.adsterra.com/api/v1/*` → "No route found" for every path tried (sites, zones, statistic/zones, statistic/sites, statistic/date, placements, publisher/sites, zones/create, etc.)
- `api.adsterra.com/v1/*` → HTML dashboard page (no API)
- The Adsterra Publisher API **does not expose zone creation or zone listing endpoints at all**
- **Zone creation MUST be done in the Adsterra dashboard UI — there is no programmatic alternative**
- **Stop trying API endpoints. Stop asking the user to look for API access. It does not exist.**

#### Adsterra Anti-AdBlock — ONLY THE POPUNDER HAS ONE
The "ANTI-ADBLOCK JS SYNC" code shown in the Adsterra dashboard (truegle.info ad tags page) is ONLY for the Popunder zone:
- **Popunder anti-adblock URL:** `https://millionairelucidlytransmitted.com/03/50/81/03508109c0353dafe874e4f377262a99.js`
- **Banner zones (728x90, 300x250, 468x60, 160x600, 160x300, 320x50, Native Banner) have NO anti-adblock variants** — the dashboard provides only the standard `invoke.js` URLs for banners
- There is no individual "anti-adblock zone code" for banner formats. They don't exist in this account.
- **Stop asking the user to find banner anti-adblock codes. They do not exist in this account.**

#### Adsterra CNAME Anti-AdBlock
- The code to thread `AD_DOMAIN` through `adframe.html` is already shipped (PRs #29, #30)
- Setting `VITE_AD_DOMAIN=cdn.truegle.info` in Cloudflare Pages + a CNAME DNS record is the path forward when the user has desktop access
- The Adsterra dashboard may show a CNAME target under "Anti-AdBlock" for the site — not per-zone

#### Current banner zones serve ADULT content
All zone keys currently in `apps/frontend/src/config/ads.js` were created with adult content enabled in the Adsterra dashboard. They serve adult ads to all visitors. **New non-adult zones must be created in the Adsterra dashboard.**

#### Adsterra Smartlink
- URL: `https://millionairelucidlytransmitted.com/g385gzr0?key=63a965f91d254672ac250654790b5b8c`
- Stored in `apps/frontend/src/config/ads.js` as `SMARTLINK_URL`
- Renders as a "Sponsored / Discover relevant offers →" link in the results footer
- Plain `<a href>` — NOT a script load — so Firefox ETP cannot block it

### What was done this session (PRs #29, #30 — merged to main)

**PR #29 — Firefox ETP CNAME wiring:**
- `adframe.html` now reads invoke.js domain from URL param `d` (falls back to `millionairelucidlytransmitted.com`)
- `AdsterraBanner.jsx` imports `AD_DOMAIN` from config and passes it as `d` param
- `_headers` CSP for `/adframe.html` gains `https://*.truegle.info` so CNAME subdomain is pre-whitelisted
- Root cause established: Firefox Mobile Enhanced Tracking Protection silently drops all requests to `millionairelucidlytransmitted.com` before they hit the network — that's why MobiDevTools showed zero Adsterra requests. It was never a Referer/domain/srcdoc problem.

**PR #30 — Smartlink footer:**
- `SMARTLINK_URL` added to `config/ads.js`
- Footer `AdSlot size="small"` replaced with styled Smartlink anchor

### 🔜 NEXT SESSION — Replace adult zones + create private adult campaign

The user confirmed ads ARE loading now but all banner zones serve adult content. Next session must:

1. **User action first (dashboard):** In Adsterra → Websites → truegle.info → create NEW zones for each format WITH adult content disabled:
   - Banner 728x90 (non-adult)
   - Banner 300x250 (non-adult)
   - Banner 468x60 (non-adult)
   - Banner 160x600 (non-adult)
   - Banner 320x50 (non-adult)
   - Native Banner (non-adult)

2. **User action (dashboard):** Create a SEPARATE private/unlisted set of adult zones (same formats) — these will ONLY load when all 5 adult gates pass (authenticated + safeSearch=off + adult keywords + age confirmed + consent not revoked). Do NOT advertise or link these zones publicly.

3. **Once user provides the new zone keys:** Update `apps/frontend/src/config/ads.js`:
   - Replace current keys in `ADSTERRA` with the new non-adult keys
   - Add a new `ADSTERRA_ADULT` object with the adult-only zone keys
   - Update `AdsterraBanner.jsx` to use `ADSTERRA_ADULT[format]` when `adultGated=true`

4. **CNAME setup (when at desktop):**
   - Adsterra dashboard → look for "Anti-AdBlock" or "Custom Domain" at the site level
   - Get CNAME target → create `cdn CNAME [target]` in Cloudflare DNS
   - Set `VITE_AD_DOMAIN=cdn.truegle.info` in Cloudflare Pages env → redeploy

---

## 🗓️ SESSION LOG 2026-06-28 — Ad proxy, consent modal, mode fixes, popunder, campaign targeting

### First-party Adsterra proxy (LIVE)
All Adsterra scripts now load through Cloudflare Pages Functions instead of directly from third-party domains. This eliminates "Tracking Prevention blocked access to storage" errors in Edge/Firefox (which were degrading targeted ad quality and eCPM).

| Route | Proxies | Domain rewritten to |
|---|---|---|
| `GET /ad/:key` | `highperformanceformat.com/:key/invoke.js` | `ads.truegle.info` in script content |
| `GET /pop` | `millionairelucidlytransmitted.com/03/50/.../invoke.js` | no rewrite (tracking pings allowed via CSP) |

`ads.truegle.info` is an Adsterra-managed CNAME already pointing to their CDN — rewriting HPF domain references to it makes all ad-related requests appear first-party to the browser.

### GDPR Cookie Consent modal (LIVE — `CookieConsent.jsx`)
- Slide-up banner delays 1.2s so it doesn't flash over the loading screen
- **No Reject option** — premium is the only way to remove ads. Free users must accept ad cookies.
- Ad cookies locked on free plan (lock icon + "Premium required" badge in Customize panel)
- Analytics (Cloudflare) toggle remains optional
- Primary CTA: "Accept & start earning rewards"
- Dispatches `window.dispatchEvent(new CustomEvent('truegle:consent', { detail: { ads: true/false } }))` and sets `window.__truegle_ad_consent`
- All ad loading (banners + popunder) is gated on this consent signal

### Popunder reactivated (consent-gated, once-per-session)
`AdScriptLoader.jsx` reactivated. Loads `/pop` (first-party proxy) only after user accepts cookie consent. Uses `sessionStorage` to fire once per browser session.

**Popunder zone:** `Popunder_1` — truegle.info
**Script:** `millionairelucidlytransmitted.com/03/50/81/03508109c0353dafe874e4f377262a99.js`

### Adsterra Smartlink (stored in `AdScriptLoader.jsx`)
```
https://millionairelucidlytransmitted.com/g385gzr0?key=63a965f91d254672ac250654790b5b8c
```
Exported as `ADSTERRA_SMARTLINK` constant. Use as:
- Fallback link in house-ad / claim slots when Adsterra banner doesn't fill
- Target URL for "sponsored" text links anywhere on site
- CPA revenue when users click through to advertiser

### Adsterra Referral Program (LIVE — `/advertise` page)
5% lifetime revenue share for referred publishers. Banner + CTA added to `/advertise` above the contact section.
- **Referral URL:** `https://beta.publishers.adsterra.com/referral/Pqd4tGsBZw`
- **Banner:** `https://landings-cdn.adsterratech.com/referralBanners/png/728%20x%2090%20px.png`

### Mode color semantics — CORRECTED everywhere

| Mode | Correct meaning | Old (wrong) description |
|---|---|---|
| Blue | Mainstream · Traditional · Liberal (establishment/legacy media) | "Standard · Unbiased" |
| Red | Alternative · Free Thinker (questions official narrative, conspiracy-adjacent) | "Independent · Alternative" |
| Purple | Skeptical · Conservative (counter-mainstream, accountability journalism) | "All Perspectives" |
| Ocean | Privacy · Security · OSINT (developers, infosec, suspicious of surveillance) | "OSINT · Research" |

Updated in: `useSearchMode.js`, `ModesAndTrending.jsx`, `AdsterraBanner.jsx` CONTEXT_KEYWORDS.

### Perspective-based ad campaign targeting infrastructure (READY TO USE)
`AdsterraBanner.jsx` now accepts a `searchContext` prop and passes keyword arrays to `window.atOptions.params.keywords`. `UniversalSearch.jsx` derives `adContext` from the most specific signal available: perspective filter > search mode.

**To activate in Adsterra dashboard — create campaigns with these keyword targets:**

| Mode / Context | Adsterra campaign keywords | Target audience |
|---|---|---|
| `blue` | mainstream, traditional, liberal, establishment, legacy-media | Centrist/liberal mainstream users |
| `red` | alternative, conspiracy, independent, free-thinker, counter-narrative | Alt-media, free thinkers, conspiracy-curious |
| `purple` | conservative, skeptical, right-wing, traditional-values, anti-establishment | Conservative / skeptical users |
| `ocean` | privacy, cybersecurity, osint, developer, tech, infosec | Dev / security / privacy audience |
| `left` perspective | progressive, liberal, social-justice, democrat | Left-perspective filter users |
| `right` perspective | conservative, republican, traditional, right-wing | Right-perspective filter users |
| `neutral` perspective | non-partisan, centrist, balanced, independent | Centrist filter users |
| `gen-z` (explicit) | gen-z, youth, social-media, trending | Pass `searchContext="gen-z"` explicitly |
| `lgbtq` (explicit) | lgbtq, pride, inclusion, diversity | Pass `searchContext="lgbtq"` explicitly |
| `business` (explicit) | business, finance, investing, entrepreneur | Pass `searchContext="business"` explicitly |

**Campaign setup steps:**
1. Adsterra dashboard → Campaigns → Create Campaign
2. Targeting → Keywords → paste the keyword list for that audience
3. Match campaign creative/vertical to the audience (e.g. conservative news for `purple`, VPN/privacy tool for `ocean`)
4. Higher relevance → higher CTR → higher eCPM → larger rewards payouts

### Social Bar — TODO (next session or when Adsterra approves zone)
Social Bar is a high-CPM format (up to 30× higher CTR than standard web push). Key facts:
- Works like in-page push — no user subscription needed, all visitors see it
- Ad-blocker resistant (dynamic iFrame)
- Lightweight (single script tag above `</body>`)
- Best CPMs from: Entertainment, Streaming, E-commerce, Gaming advertisers
- Documented CPM range: $1–$3.9 average; top publishers earning $7k–$11k/month on news/entertainment sites

**To enable:** Get Social Bar ad tag from Adsterra dashboard → Websites → + Ad Unit → Social Bar.
Paste script above `</body>` in `index.html`, or inject via `AdScriptLoader.jsx` (consent-gated, same pattern as popunder).

### Accessibility fixes (this session)
- `FileInput.jsx` / `CameraInput.jsx`: `aria-hidden="true"` + `tabIndex={-1}` on hidden file inputs
- `Toast.jsx`: added `role="region"` + `aria-live="polite"` to notifications container
- `SignUpPage.jsx`: added `id` + `name` to notify-me email input
- CSP hash `sha256-SHjvrCsgwojSAPfnKP7i/G6fuEoY6yesZXQ073Yoa44=` added to `_headers`
- `index.html`: removed `onerror` inline handler (was the blocked inline script at :261); added `-webkit-text-wrap: balance`; added `mobile-web-app-capable` meta

---

## 🗓️ SESSION LOG 2026-06-28 — Ad fix, UX polish, CSP cleanup, auth flag

### Ads
- **Skyscraper removed**: `banner160x600` in the sidebar replaced with `banner300x250` (medium rectangle). Skyscraper was rendering above the results column and breaking page layout.
- **Popunder + Social Bar disabled**: `AdScriptLoader.jsx` now returns null. These scripts injected dynamic inline scripts that violated CSP and triggered Adsterra's 18+ tag even in safe-search mode. CPM revenue now served exclusively via iframe-based banner formats (300×250, 728×90, 468×60).
- **CSP cleaned up**: Removed `effectivecpmnetwork.com`, `utt.impactcdn.com` from `script-src` and `connect-src` in `public/_headers` — those domains are no longer loaded.

### Impact.com inline script removed
The inline IIFE in `index.html` (`utt.impactcdn.com`) was the primary CSP violation source. Removed (Impact.com account is closed; script was inert). Impact.com meta verification tag also removed. CSP sha256 hash for that inline script removed.

### BackgroundAnimation disabled on LandingPage
`<BackgroundAnimation />` commented out in `LandingPage.jsx`. The Prism/Aurora/LaserFlow WebGL components were crashing in a retry loop (10–20 attempts per page load) on devices without WebGL, causing the loading experience to glitch. Re-enable when a WebGL capability check + graceful CSS fallback is in place.

### QuickResultCard UX upgrade
- Added animated "Quick Answer" header label with pulsing Zap icon above each card
- Entire card wrapped in framer-motion entrance animation (slide-up + fade, spring easing)
- `theme.accent` colour used for the label so it matches the active search mode

### File/image/audio search wired up
SearchBar `FileInput` and `CameraInput` callbacks now populate the search text input:
- **Text files** (.txt, .md, .csv, .json): reads first 300 chars, sets as query
- **Audio files**: sets query to `"audio transcript: <filename>"`
- **Image files**: appends `"image: <filename>"` to existing query
- **CameraInput**: sets `"image search visual query"` and triggers search
- All callbacks trigger `onSubmit()`/`onSearch()` after setting the value

### OAuth disabled
`OAUTH_ENABLED = false` in `config/access.js`. OAuth was blocking users from gated features. Direct email/phone + payment flow to be implemented as replacement.

### Pending (next session)
- Auth redesign: email/phone registration → direct payment → one-time access code (premium)
- Freemium tier: zero-auth with on-screen token counter + mandatory ads to refill quota
- Payment payout routes: Cash App, PayPal, Venmo, Chime, FB Pay, Zelle, bank routing/account number. $20 min / $50 max / 10% fee. OpenPay repo not found in workspace — confirm location before implementing.
- Adsterra popunder replacement: if CPM drops without popunder, consider Adsterra Native Banner (placement 30006383) as CSP-safe alternative.

---

## 🔴 IMPACT.COM — PERMANENTLY CLOSED — DO NOT REVISIT

Impact.com **declined and will continue to decline** — reason: **traffic volume sub-50K/month**, not a technical issue. No amount of SEO fixes, prerendering, or canonical corrections will change this decision. Stop discussing Impact.com as a pending action item. Remove it from all action plans. Revisit only when monthly traffic exceeds 50K.

The `impact-site-verification` meta tag and UTT tracking script in `index.html` can stay (harmless) but are inert until reapplication is viable.

---

## 🔴 FIRST TASK NEXT SESSION — Install browser automation

Before doing anything else, install proper browser automation so Claude can operate the Cloudflare dashboard, Vercel, and other browser-gated services without needing the user to navigate manually.

**Priority order:**
1. **Hermes** — install as MCP server in `~/.claude.json`
2. **Manus** — install as MCP server in `~/.claude.json`
3. **Playwright MCP** (`@playwright/mcp`) — `npm install -g @playwright/mcp` then add as MCP server

If none of those work or aren't available, the user has a shelved build of a **custom headless hybrid browser agent** to fall back to — ask them to point you at that repo.

Once browser automation is confirmed working, use it to:
- Verify Cloudflare Pages build logs for `truegle-search` (check prerender step ran successfully)
- Purge Cloudflare cache for `sitemap.xml` and `robots.txt` (still serving stale cached versions)
- Confirm blog canonical: `curl -s https://truegle.info/blog/what-is-a-filter-bubble | grep canonical` should show the blog URL, not the homepage

---

## 🗓️ SESSION LOG 2026-06-28 — Ad color system + Adsterra CPM + QuickResultCard UX

### Adsterra re-integrated (deliberately, controlled) — LIVE
Adsterra was previously removed due to the Monetag/sinkhole incident. It has been re-added in a clean, controlled way using only their direct script URLs (no service workers, no `3nbf4.com`, no Monetag). Domain reputation was verified clean before re-adding.

**What's live:**
- **Popunder** (`pl30106879.effectivecpmnetwork.com`) — fires once per page load
- **Social Bar** (`pl30106881.effectivecpmnetwork.com`) — fires once per page load
- **Banner ads** (300×250, 728×90, 160×300, 160×600) — rendered via `AdsterraBanner.jsx` in search results

**Key clarification — cookies:** Truegle sets **ZERO cookies**. All user preferences live in `localStorage`. The cookies visible in DevTools (from `effectivecpmnetwork.com` / `highperformanceformat.com`) belong to Adsterra — they are third-party cookies on Adsterra's own domain, not Truegle cookies. We cannot prevent Adsterra from setting their own cookies without blocking their scripts entirely.

**Revenue model:** Adsterra uses CPM (cost-per-thousand impressions). Impressions are counted at the HTTP/script level — **no cookies are required to earn revenue**. Scripts should always fire unconditionally for maximum CPM earnings.

### AdScriptLoader component (NEW — `apps/frontend/src/components/ads/AdScriptLoader.jsx`)
React component that dynamically injects the Adsterra popunder + social bar scripts once per page lifecycle using `document.createElement('script')`. Module-level `injected` flag prevents double injection. Placed in `App.jsx` inside the `SettingsProvider` tree — fires for all users unconditionally.

**Note:** Dynamic injection means the scripts do NOT appear in `curl` of the static HTML — this is correct and expected. Scripts fire in the browser.

### Ad color system (SHIPPED — all commits on main)
New component `apps/frontend/src/components/ads/AdColorWrapper.jsx` wraps every ad slot with a colored glow border + small label badge:

| Color | CSS class | Ad type | Badge |
|---|---|---|---|
| Neon apple-green | `.ad-cpm` | CPM/affiliate (Adsterra banners, affiliate links) | "Sponsored" |
| Yellow | `.ad-claim` | Unsold inventory / claim spots | "Ad Spot" |
| Pulsing red ↔ blue | `.ad-adult` | Adult CPM (triple-gated) | "18+ Ad" |
| Pulsing red + white border | `.ad-reward` | Watch & Earn rewarded ads | "Watch & Earn" |

CSS keyframe animations defined in `apps/frontend/src/index.css`. All ad slots in `UniversalSearch.jsx` wrapped with the appropriate `<AdColorWrapper type="...">`.

### QuickResultCard — moved below search bar + mode-themed
- Moved to render directly below the search bar / LanguageSelector on every search (no scroll required).
- Mode-color theming added: blue page → blue border/glow, red page → red, biased → purple, ocean → ocean blue, green → emerald.
- `QuickResultCard` accepts `mode` prop; all 10 sub-components (business, place, weather, etc.) use `theme` from `MODE_THEME` map.

### New blog post live: `/blog/understanding-our-ad-color-system`
- slug: `understanding-our-ad-color-system`
- title: "What the Ad Colors on Truegle Mean — and Why We Show Them"
- date: 2026-06-28, 3 min read
- Explains all 4 ad color types + the transparency philosophy
- Added to `blogPosts.jsx`, prerendered at `/blog/understanding-our-ad-color-system/index.html`
- Sitemap updated to 12 URLs (was 11)

### Blog canonical bug — FIXED ✅ (this session)
Root cause: `_redirects` had `/blog` and `/blog/*` as 200 rewrite rules. In Cloudflare Pages, a 200 rewrite in `_redirects` **wins over a directory-index lookup**, so all blog posts were served the SPA shell (with homepage canonical) instead of the prerendered static file. Fix: removed those two lines from `_redirects` (commit `b290c77`).

All 4 blog posts verified live with correct canonicals:
- `/blog/understanding-our-ad-color-system/` ✅
- `/blog/what-is-a-filter-bubble/` ✅
- `/blog/how-to-search-privately/` ✅
- `/blog/why-multiple-perspectives-matter/` ✅

**Rule for future:** Never add a prerendered route to `_redirects`. Only pure client-side SPA routes (no static file) go in `_redirects`.

### Safe-search Adsterra banners in search results
Added `<AdsterraBanner format="banner728x90">` and `<AdsterraBanner format="banner160x600">` (skyscraper sidebar) wrapped in `<AdColorWrapper type="cpm">` to the search results page. Safe-search banners show to all users. Adult banners remain triple-gated (auth + safeSearch=off + adult query).

### Commits this session (all on main)
- `b290c77` — Fix blog canonical: remove /blog/* from _redirects
- `8f04ffd` — Update HANDOFF: Impact.com closed, blog canonical fixed
- `e1bfe9e` — Add ad color system, quick results below search bar, AdScriptLoader, blog post, mode-themed cards
- `81ce0dc` — Always fire Adsterra scripts (removed cookie gate)

---

## 🗓️ SESSION LOG 2026-06-28 — SEO Phase 1 + 2 + Cloudflare AI crawler fix

### SEO audit completed (truegle.info-audit/)
Full audit run via `/seo audit`. Health score: **40/100**. Artifacts in `truegle.info-audit/`:
- `FULL-AUDIT-REPORT.md` — complete findings
- `ACTION-PLAN.md` — 4-phase prioritized plan
- `audit-data.json` — structured data

### Phase 1 fixes shipped (commit `32a5320`)
- **P1-1**: Build assertion added to `prerender.mjs` — fails Cloudflare build if `dist/blog/` is missing
- **P1-3**: Removed `/search` + all `?mode=` URLs from `sitemap.xml`; added `X-Robots-Tag: noindex` to `/search` routes in `_headers`; added `Disallow: /search` to `robots.txt` — **VERIFIED LIVE** (`X-Robots-Tag: noindex, follow` confirmed on `/search`)
- **P1-4**: Sitemap cleaned — trailing-slash URLs, real git-derived `lastmod` dates, `changefreq`/`priority` removed, disallowed pages removed
- **P1-5**: Organization schema logo fixed: string `og-image.png` → `ImageObject` with `truegle.png`; added `foundingDate` and `contactPoint`
- **P1-6**: `impact-site-verification` `value=` → `content=`
- **P2-3**: `/assets/*` gets `Cache-Control: public, max-age=31536000, immutable`

### Phase 2 fixes shipped (commit `6a1a1ca`)
- **P2-6**: `BlogPost.jsx` schema upgraded — typed `mainEntityOfPage`, `image` ImageObject, `@id`/`url`, `isPartOf Blog`, publisher by `@id`
- **P2-8**: Live H1 in `LandingPage.jsx` — visually-hidden text added so Googlebot sees "Truegle — Unbiased, Transparent & Secure Search"
- **P2-9**: `llms.txt` expanded with 7 FAQ Q&A pairs, About the Team, Technology stack, blog URLs — **VERIFIED LIVE**

### Cloudflare AI crawler conflict fixed (user action — dashboard)
- Disabled **"Block AI training bots"** (WAF managed rule that was hard-blocking GPTBot, ClaudeBot, etc.)
- Disabled **"Instruct AI bot traffic with robots.txt"** (was prepending `Disallow: /` for AI bots before the manual `Allow: /` entries)
- `robots.txt` now serves clean with only the manual file — all AI bots have `Allow: /`

### Blog prerender + canonical — FIXED (2026-06-28, later session)
Root cause found and fixed: `_redirects` had `/blog` and `/blog/*` pointing to `_index` (SPA shell). A 200 rewrite in `_redirects` **wins over a directory-index lookup**, so all blog posts were served the SPA shell instead of `dist/blog/<slug>/index.html`. Fixed by removing those two lines from `_redirects` (commit `b290c77`).

All three blog posts now serve correct canonicals and titles — **VERIFIED LIVE:**
- `https://truegle.info/blog/what-is-a-filter-bubble/` → canonical: `https://truegle.info/blog/what-is-a-filter-bubble` ✅
- `https://truegle.info/blog/how-to-search-privately/` → canonical: `https://truegle.info/blog/how-to-search-privately` ✅
- `https://truegle.info/blog/why-multiple-perspectives-matter/` → canonical: `https://truegle.info/blog/why-multiple-perspectives-matter` ✅

**Rule for future blog/prerendered routes:** Never add a prerendered route to `_redirects`. Only pure client-side SPA routes (no static file) go in `_redirects`.

### Sitemap/robots.txt
Serving fresh — no cache purge needed.

---

## 🗓️ SESSION LOG 2026-06-28 — Ad network integration + affiliate setup + adult CPM gating

### Adsterra — APPROVED (2026-06-28)
Account approved. Placement IDs (get actual ad code keys from Adsterra dashboard → Ad Units → Get Ad Code):

| Ad Unit | Placement ID |
|---|---|
| Popunder | 30006380 |
| Smartlink | 30006381 |
| Social Bar | 30006382 |
| Native Banner | 30006383 |
| Banner 468x60 | 30006384 |
| Banner 300x250 | 30006385 |
| Banner 160x300 | 30006386 |
| Banner 728x90 | 30006387 |
| Banner 320x50 | 30006388 |
| Banner 160x600 | 30006389 |

Adult ads toggle available in Adsterra dashboard — enable when ready to boost CPM.

**All ad codes hardcoded directly in `AdsterraBanner.jsx` — no env vars needed.**

| Format | Key | Placement ID |
|---|---|---|
| Banner 468x60 | `7e53f17316c72708e8417a8a991171ac` | 30006384 |
| Banner 300x250 | `0fca9299f48c601ea125d688c11ff7d2` | 30006385 |
| Banner 728x90 | `d5f657ea7d55fc33ea532071957a2857` | 30006387 |
| Banner 160x300 | `ffac08ed0f599aa8f389d387aa76001b` | 30006386 |
| Banner 160x600 | `c16f5233d71714d3151e160ac5778be2` | 30006389 |
| Popunder | `https://pl30106879.effectivecpmnetwork.com/03/50/81/03508109c0353dafe874e4f377262a99.js` | 30006380 |
| Social Bar | `https://pl30106881.effectivecpmnetwork.com/f3/a9/76/f3a976b8789fcc63ba068a860561783b.js` | 30006382 |
| Smartlink | `https://www.effectivecpmnetwork.com/g385gzr0?key=63a965f91d254672ac250654790b5b8c` | 30006381 |

Popunder injected in `index.html` `<head>`. Social Bar injected before `</body>`. Banner formats rendered via `<AdsterraBanner format="..." />` React component.

### Adult CPM ad gating (SHIPPED 2026-06-28)
New component: `apps/frontend/src/components/ads/AdsterraBanner.jsx`
- Triple-gated: authenticated + `safeSearch === 'off'` + adult keyword in query
- Adult keyword list: `apps/frontend/src/utils/adultKeywords.js` (extend as needed)
- Wired into `UniversalSearch.jsx` after AI summary block (728×90 slot)
- Zero adult ads show to unauthenticated users or safe-search-on users, ever

### Other CPM networks to apply (priority order)
1. **HilltopAds** (hilltopads.com) — CPM display, permissive content, low traffic minimum
2. **PopAds** (popads.net) — instant approval, CPM popunder
3. **ylliX** (yllix.com) — CPM display, instant approval
4. **A-ADS** (anonymous-ads.com) — Bitcoin CPM, zero requirements, no KYC

Note: Adsterra caused sinkhole in prior session — expect ad blocker flags. For now revenue > reputation cost.

### Revive zone configuration (DONE 2026-06-28)
- Zone 4: Interstitial or Floating DHTML, 640×480
- Zone 5: Banner, Button or Rectangle, 720×405
- Cloudflare Page Rule active: `ads.truegle.info/*` → SSL Flexible (fixes 522 error)
- `ads.truegle.info` returns 200 via HTTPS ✓
- Playwright automation script: `scripts/revive-admin.mjs` (run with `REVIVE_PASS=... node scripts/revive-admin.mjs <cmd>`)
  - `list-zones` — prints all zones
  - `configure-zones` — sets zone 4+5 types and sizes

### Affiliates approved (CJ + direct)
Wire these via Revive HTML banners or direct inline links. All CPA/revenue-share (not CPM):

| Program | Network | Commission | Notes |
|---|---|---|---|
| **Proton** (VPN/Mail/Drive) | Direct (partners.proton.me) | Revenue share | Enter IBAN in TUNE dashboard. High relevance — privacy audience perfect fit |
| **Intego** (Mac security) | CJ | 25% per sale | 45-day cookie. Mac security software |
| **Personalabs** (blood tests/STD) | CJ | % per sale | Health/STD testing — relevant to adult audience |
| **TreatMyUTI.com** | CJ | 10% per sale | 30-day cookie. Female 18-80 demo |
| **SKUTCHI Designs** (office furniture) | CJ | 10% per sale | $2k avg order. Low relevance for search users |

**Proton affiliate** is the highest-priority integration — privacy-first brand + privacy-first search engine = natural conversion. Add Proton banner/link to search results, about page, and rewards page.

**Next session: affiliate integration**
1. Log into partners.proton.me → get tracking links + banners → add to Revive as HTML banners → link to Zone 3 (leaderboard)
2. Log into CJ account → get Intego + Personalabs banner HTML → add to Revive → link to Zone 1/2 (300×250)
3. Wire Proton text link into the About page and Privacy page footer

---

## 🗓️ SESSION LOG 2026-06-27d — Revive Adserver install + ad tag wiring + GitTools setup

### Revive Adserver 5.4.1 on EC2 (DONE)
Self-hosted open-source ad server running at `http://44.236.219.63:9090/www/admin/` (admin: `trueroot`).

- Docker Compose stack at `/home/ec2-user/revive/` — container `revive` (port 9090→80) + `revive-db` (MariaDB 10.11).
- 5 zones configured:
  - Zone 1 & 2: 300×250 display banners
  - Zone 3: 728×90 leaderboard
  - Zone 4: Rich media overlay (delivery=7) — used for token gate / freemium wall
  - Zone 5: Video in-stream (delivery=6) — inline video on feature pages

### Revive ad tag wiring into frontend (SHIPPED)
New component: `apps/frontend/src/components/ads/ReviveAd.jsx`
- Renders Revive zones via `<iframe src="https://ads.truegle.info/www/delivery/ai.php?zoneid=N&cb=RAND" />`
- Exports `ZONES` constants for all 5 zones

Wired into:
- **`AdPlayer.jsx`** (token gate overlay): Zone 4 rich media replaces placeholder animation when ad plays
- **`LandingPage.jsx`**: Zone 5 inline video inserted above footer
- **`ExtractPage.jsx`**: Zone 5 replaces spinner in ad modal + replaces bottom AdSlot
- **`UniversalSearch.jsx`**:
  - Zone 5 after MultimediaInterface when vids/pics/soc tab active
  - Zone 3 leaderboard below map view
  - Zone 5 after AI expanded summary (when not collapsed)
  - Zone 5 inside OSINT TokenGate (ocean mode)

CSP updated in `apps/frontend/public/_headers`:
- Added `https://ads.truegle.info` to `frame-src` and `child-src`

### Infrastructure needed to activate ads (PENDING — action required)
**1. Cloudflare DNS A record:**
- Name: `ads`, Value: `44.236.219.63`, Proxied: YES (orange cloud)
- Cloudflare proxying = HTTPS termination at edge → HTTP to origin (solves mixed-content for HTTPS frontend)

**2. nginx reverse proxy on EC2:**
- Script at `scripts/revive-nginx.conf` — deploy to `/etc/nginx/conf.d/revive.conf`
- Routes port 80 → Docker port 9090
- EC2 security group must allow port 80 from Cloudflare IPs

**Note on Cloudflare port proxying:** Cloudflare only proxies standard ports (80/443). Port 9090 is NOT proxied. The nginx config on the EC2 is REQUIRED to bridge port 80 → 9090.

### GitTools repos installed (DONE — via Gemini CLI)
11 repos configured for Claude Code. Key ones:
- **SuperPowers**: Claude Code plugin (skills: TDD, debugging, git worktrees)
- **ClaudeSEO v2.2.0**: SEO audit skill plugin (`/seo audit <url>`)
- **FireCrawl**: Plugin + CLI — needs `firecrawl login --api-key "fc-YOUR-API-KEY"`
- **BrowserUse**: MCP server (stdio) configured in `~/.claude.json` for `GitTools` directory
- **Fabric**: CLI at `~/.local/bin/fabric.exe` — needs `fabric --setup` to init API keys
- **OpenMontage**: Python venv ready, skills auto-load from `.claude/skills/`
- **OpenVoice**: Python 3.12 venv with patched deps
- **OpenHiggsfield**: Built via npm
- **n8n, Whisper, AirLLM**: Source available, not compiled

**Next steps for tools:**
1. Run `fabric --setup` to configure Fabric with your AI API keys
2. Run `firecrawl login --api-key "fc-YOUR-API-KEY"` to authenticate FireCrawl
3. BrowserUse MCP server activates automatically when Claude Code opens inside `GitTools` directory

### OAuth fix (SHIPPED — commit `a60f898`)
- Root cause: `BACKEND_URL` fell back to `VERCEL_URL` (per-deployment URL, changes every deploy) → callbackURL never matched Google's registered redirect URI
- Fixed: now uses `VERCEL_PROJECT_PRODUCTION_URL` as stable middle fallback

---

## 🗓️ SESSION LOG 2026-06-27c — Extract page redesign + App loading screen + Social feed panel

### `/extract` page — full UI redesign (SHIPPED)
Complete shell redesign of `apps/frontend/src/pages/ExtractPage.jsx` while preserving all extraction logic (`handleExtract`, spin system, ad modal, copy/download).

**What changed:**
- **Yellow-tinted starfield** — inline `YellowStarfield` canvas component with gold-interpolated stars (white→amber based on per-star `gold` factor). Distinct from the white starfields on other pages. Subtle yellow ambient glow behind the canvas.
- **TruegleLogo** on top (medium size, navigates to `/`), followed by "Content Extractor" heading in a yellow–amber gradient and a brief description.
- **Pill mode bar** added at the top of the page with four pills: Smart (blue) · Green · Red Pill · **Extract (yellow)**. Yellow is the extract-native mode; selecting any other pill navigates away to that mode's search page (`/search`, `/search?mode=green`, `/search?mode=red`).
- **Action buttons** in the top-right: "Extract" (yellow, primary) + "Return to Search" (grey, navigates to `/search?mode=<active pill>`).
- **Simplified URL bar** — `Link2` icon + plain URL input + "Extract" submit button. No voice/camera/file inputs, no category chips, no AI-summary toggle.
- **Transcript / Images toggle** — two pill buttons replace the old filters button; switching clears results.
- **Extracted content renders directly below the bar** — transcript (with expand/collapse + copy/.txt download + spin counter) or image grid (3–4 column responsive, broken-image hiding).
- **Ad containers** — `AdSlot` slots above and below the content area kept.
- **Spin gate + ad modal** — preserved logic: 3 free/day, 5-second countdown ad stub → 3 bonus spins on claim. No real ad SDK yet (wire in rewarded format when ad network is approved).
- **Watermark** appended to copy/download: `\n\n---\nExtracted via Truegle · truegle.info`.

### App loading screen redesign (SHIPPED)
Updated `ProtectedRoute` loading state in `apps/frontend/src/App.jsx`:
- **Before:** plain white screen, blue spinner, gray "Loading…" text.
- **After:** black background, 80 randomly-scattered CSS `animate-pulse` white stars with randomized size/opacity/delay, `TruegleLogo` (large, centered), three `animate-bounce` blue dots below the logo.
- Import of `TruegleLogo` added to `App.jsx`.

### Social feed panel (SHIPPED — prior sub-session)
- `/api/social/feed` endpoint (`apps/backend/routes/social.js`) — fetches Reddit, Hacker News, GitHub in parallel via `Promise.allSettled`; normalizes to shared shape; returns `{ results, platforms, errors }`.
- `MultimediaInterface.jsx` Social tab upgraded: `FeedPlatformTabs`, `RedditCard`, `HNCard`, `GitHubCard`, `YouTubeCard` (via SearXNG videos category), `ComingSoonPanel` for Twitter/X, Instagram, TikTok, Facebook (explains API access limitations).

### Bug fixes (SHIPPED — prior sub-session)
- **Search results page freeze** — 7 map service files had a broken `getBackendUrl()` returning `''` in production → all map/geocode POSTs hit Cloudflare Pages (405). Fixed: all 7 files now use `import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'` directly.
- **CSP inline script blocked** — Cloudflare Beacon inline script hash `'sha256-qsUG590fP2ZJ57ebibYm/ibZ7a6/xr76adozIVNz9mE='` added to `script-src` in `_headers`.

### Pending (deferred to v2)
- **Anonymous View via Morty** — enable on AWS SearXNG instance (see 2026-06-27b log for full steps).
- **Social OAuth** — Instagram, TikTok, Twitter/X, Facebook personalized feeds require platform app review (v2).
- **Cloudflare WARP** on AWS EC2 (see 2026-06-27b log for install commands).
- **`/api/search/health` searxng field** — cosmetic monitoring gap, not functional.
- **Ad SDK for rewarded extractions** — current ad modal is a 5s countdown stub; wire real rewarded format when ad network is approved.

---

## 🗓️ SESSION LOG 2026-06-27b — Green mode persistence, SearXNG labeling, proxy/social/VPN roadmap

### Green mode preference — ask once, never again (SHIPPED)
- Moved `truegle_first_search_done` from `sessionStorage` → `localStorage` (`truegle_mode_pref_asked`).
- Added `truegle_mode_pref` key: written on every pill-toggle change AND on first-modal answer. Initializes mode from it on load (URL param `?mode=` still overrides for direct links).
- Modal copy updated: added "Your choice is saved — we won't ask again. Change anytime via the pill toggle."
- "No, keep Smart features" button now explicitly saves `'blue'` preference (was silently defaulting).

### SearXNG result source labeling (SHIPPED)
- `formatSearXNGResults` and `formatSearXNGCategoryResults` now set `sourceName` to `"<engine> · via Truegle"` (e.g. "google · via Truegle", "brave · via Truegle") instead of the raw engine string.
- Tells users which underlying engine surfaced the result while making clear it came through Truegle's self-hosted, no-tracking metasearch layer — not a direct call to that provider.

### Anonymous View (Option A) — PLANNED, not yet built
SearXNG ships with built-in result proxying via **Morty** (a self-contained Go proxy). Steps to enable on the AWS instance:
1. On the AWS host: run Morty alongside SearXNG (Docker: `ghcr.io/searxng/morty:latest`), expose on an internal port (e.g. 3002). Set `MORTY_URL` and `MORTY_KEY` in SearXNG's `settings.yml`.
2. Add `SEARXNG_MORTY_URL=https://<aws-host>/morty` env var to Vercel backend.
3. In `apps/backend/config/env.js`: add `SEARXNG_MORTY_URL: Joi.string().optional()` under the `searxng` block.
4. In `SearchService.formatSearXNGResults`: add `proxyUrl: this.mortyUrl ? buildMortyUrl(item.url, this.mortyKey) : null` to each result.
5. In `UniversalSearch.jsx` result card: add a "View anonymously" button next to "Open link" that opens `result.proxyUrl` when available.
Option B (custom backend proxy route — more branding control, bigger SSRF risk): see note in this session's discussion. Defer until Option A is proven.

### Social media feed aggregator — PLANNED, not yet built
**Goal:** let users view content from Twitter/X, Reddit, Instagram, TikTok, LinkedIn, YouTube, etc. in a unified tabbed interface inside Truegle — no need to navigate to each platform. Huge UX win for content creators managing multiple accounts.

**Architecture decision needed:**
- **Iframe embed approach**: nearly impossible — Twitter/X, Instagram, TikTok all send `X-Frame-Options: DENY` or `frame-ancestors 'none'`. Iframes will be blank walls.
- **oEmbed / public API approach**: many platforms expose oEmbed (YouTube, Reddit, Twitter). Returns HTML snippets for individual posts — good for "search results that preview social content" but not a live feed.
- **RSS feed proxy**: Reddit supports RSS (`/r/topic.rss`), YouTube channels have feeds, some Twitter lists via third-party RSS bridges. Backend fetches + caches RSS → renders as a live feed panel. **Most feasible, zero API key cost, works today.**
- **Official APIs** (Twitter v2 free tier, Reddit OAuth, YouTube Data): gives real feed access but rate-limited and requires OAuth per-user for personalized feeds.
- **Recommended path for v1**: RSS-backed feed aggregator with fallback to SearXNG `social media` category. No auth needed, works for public content. Build a `/api/social/feed?platform=reddit|youtube|twitter` backend route that fetches the platform's RSS/Atom feed and returns normalized `{title, url, snippet, image, author, date}` objects. Frontend: a new "Social" sidebar tab on the search results page with platform switcher buttons.
- **v2**: Add OAuth "Connect your accounts" for personalized feeds (Twitter home timeline, Instagram, etc.).

### Sitewide VPN / proxy chain — OPTIONS DISCUSSED, infrastructure decision needed
**Goal:** add a network-layer privacy shield for all user → Truegle → internet traffic, so even the AWS SearXNG host doesn't see real user IPs, and upstream search providers only see Truegle's IP.

**What's already true:** SearXNG on AWS already proxies all search requests — upstream engines see the AWS Elastic IP, never the user's IP. That's significant.

**What's not yet protected:** if users visit result pages directly (clicking links), those sites see the user's real IP. That's what Anonymous View (Morty) solves.

**Free persistent options for the AWS host itself:**
1. **WireGuard** (free, self-hosted): Install WireGuard on the AWS instance, route SearXNG outbound traffic through it. Requires a second endpoint (another VPS, or a friend's server). Free but needs another machine.
2. **Tor exit via torify/torsocks** (free): Wrap SearXNG's outbound requests through the Tor network. Significant latency (2–5 s extra). Search engines actively block Tor exit nodes — will cause CAPTCHAs and blocks on Google/Bing. Not recommended for search traffic.
3. **Residential proxy rotation** (not free): Bright Data, Oxylabs, etc. — expensive but unblockable. Already partially wired in `apps/backend/config/env.js` (`BRIGHT_DATA_*`).
4. **Cloudflare WARP on the AWS host** (free): Install Cloudflare WARP on the EC2 instance. Routes all outbound traffic through Cloudflare's network, masking the Elastic IP from upstream engines. Zero cost, easy setup (`warp-cli`), low latency. **Best free option for adding a network layer over AWS.**

**Recommendation**: install Cloudflare WARP on the AWS EC2 instance for the SearXNG host. Commands:
```bash
curl -fsSL https://pkg.cloudflareclient.com/pubkey.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloudflare-warp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/cloudflare-warp-archive-keyring.gpg] https://pkg.cloudflareclient.com/ $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflare-client.list
sudo apt update && sudo apt install cloudflare-warp
warp-cli register && warp-cli connect
```
Then verify: `curl https://www.cloudflare.com/cdn-cgi/trace` should show `warp=on`. No cost, no new servers.

---

## 🗓️ SESSION LOG 2026-06-27 (b) — Anonymous View (SearXNG result proxy) + transcript fix + Morty script

### Anonymous View / proxied page views (SHIPPED — gated, off until host configured)
Startpage-style "Anonymous View" reusing the SearXNG result-proxy (Morty) we
already self-host on AWS. Root cause it addresses: SearXNG's **JSON API returns
raw URLs** — proxification only happens in SearXNG's HTML template — so the app
never had proxy links. We now replicate SearXNG's `proxify()` server-side.
- `apps/backend/config/env.js`: new `SEARXNG_RESULT_PROXY_URL` + `SEARXNG_RESULT_PROXY_KEY`.
- `apps/backend/services/SearchService.js`: `buildResultProxyUrl(url)` + `attachProxyUrls()`
  (extends anonymous view to Brave/Google/Bing/News results, not just SearXNG).
- `apps/frontend/src/pages/UniversalSearch.jsx` (`ResultCard`): "View anonymously" link + iframe.
- **Off by default** — activates only when the two env vars are set.
- Docs: `docs/ANONYMOUS-VIEW.md`.

### Morty setup script (SHIPPED — `scripts/setup-morty.sh`)
One-shot EC2-host script: generates the HMAC key, runs Morty in Docker on
`127.0.0.1:3000`, prints the settings.yml block + Vercel env vars. Front with TLS
at `anon.truegle.info`.

### YouTube transcript fix — accurate errors + proxy support (SHIPPED, host action needed)
Root cause: YouTube rate-limits/captchas our datacenter IP. Old route always blamed
"captions disabled," which was wrong.
- New `apps/backend/services/TranscriptService.js` replaces the unmaintained
  `youtube-transcript` dep. Loads watch page → parses `ytInitialPlayerResponse` → timedtext.
  Classifies errors (RATE_LIMITED / NO_CAPTIONS / AGE_RESTRICTED / UNAVAILABLE / FETCH_FAILED).
- Supports `TRANSCRIPT_PROXY_URL` env var to route through a non-blocked IP.
- **TODO (host):** set a residential/rotating proxy on Vercel.

---

## 🗓️ SESSION LOG 2026-06-27 — Bug fixes, share button, landing page, trending feed, SearXNG media categories

### Three user-reported bugs (SHIPPED, all on `main`)
1. **Map auto-opens while typing** — `useLocationDetection` was driven off live `searchValue`; the bare-query geocode fallback matched almost every short term. Fixed: now driven off `lastSearchedQuery` (the submitted query). Map-close reset also rekeyed to submitted query.
2. **"Transcribe URL" never routed to /extract** — the button was `<a href="/extract">` (full-page reload). Fixed: `onClick={(e) => { e.preventDefault(); navigate('/extract'); }}` in both `UniversalSearch.jsx` and `LandingPage.jsx`.
3. **New Google OAuth users hit `/auth/login?error=oauth_failed`** — `User.save()` never assigned the DB-generated `id` back onto the instance, so `getBalance(null)` threw "User not found". Fixed in `apps/backend/models/User.js`: `this.id = row.id` after both INSERT and UPDATE.

### `/extract` page served as octet-stream download (SHIPPED)
`/extract` and `/blog*` were in `_redirects` (→ `/_index 200`) but missing from `_headers`. Cloudflare Pages matches `_headers` against the *original* URL, not the rewrite target, so both routes served as `application/octet-stream` → browser download dialog. Fixed: added `Content-Type: text/html` entries for `/extract`, `/blog`, `/blog/*` to `apps/frontend/public/_headers`.

### "Posted on Truegle" share button (SHIPPED — `apps/frontend/src/components/ui/TruegleShareButton.jsx`)
- Appears on every result card action row, gated to registered users only
- Platform picker: Twitter/X, Bluesky, LinkedIn, Reddit, + copy-to-clipboard
- Auto-composes "Posted on Truegle" with result title, URL, query, and mode hashtag
- Anonymous users see a greyed "Sign in to share" prompt → `/auth/signup`

### Landing page mode showcase + trending feed (SHIPPED — `apps/frontend/src/components/landing/ModesAndTrending.jsx`)
- **Mode showcase strip** (4 cards: Blue/Red/Purple/Ocean) inserted between hero and existing features section; each card shows a live example query that routes to that mode on click
- **Trending on Truegle** pill feed below the cards; rotates every 4 s; fetches live data from `/api/search/trending`

### Real-time trending endpoint (SHIPPED — `apps/backend/routes/search.js` + migration `002_create_search_queries.sql`)
- `search_queries` Postgres table (query, mode, created_at — no PII)
- Auto-migration runs on server start (`server.js`) — idempotent `IF NOT EXISTS`, works on Vercel serverless
- Fire-and-forget `logSearchQuery()` called after every successful search
- `GET /api/search/trending` aggregates last 24 h, returns top 12 with most-used mode via `MODE()` aggregate
- Frontend merges live results with static fallback; shows "LIVE" badge when real data arrives; graceful error fallback

### SearXNG media categories — images / videos / social (SHIPPED — `apps/backend/services/SearchService.js`)
- `performSearXNGCategorySearch(query, searxCategory, filters)` — passes SearXNG's `categories` param so the self-hosted instance routes to the right engine group (images aggregates Bing Images/Google Images/Flickr/etc.; videos aggregates YouTube/Vimeo/etc.; social media aggregates Reddit/Twitter/HN/etc.)
- `formatSearXNGCategoryResults()` — maps SearXNG's category-specific fields: `img_src`/`thumbnail_src`/`resolution` for images; `iframe_src`/`thumbnail`/YouTube ID extraction for videos; standard fields for social
- **Images tab**: SearXNG fires first (free, no quota); Google Images + Brave Images still run in parallel as supplements. Unsplash now only fires when SearXNG, Google Images, AND Brave Images are all absent.
- **Videos tab**: SearXNG added in parallel to YouTube Data API + Brave/Google site:youtube.com fallbacks
- **Social tab**: SearXNG `social media` category added alongside existing Google CSE social search
- `detectSource` and `formatResults` updated to handle `searxng-images`, `searxng-videos`, `searxng-social-media` source tags
- **Net effect**: pics/vids/socials tabs now work even when paid API quotas are exhausted (Unsplash quota-exceeded, YouTube 403, etc.)

---

## 🗓️ SESSION LOG 2026-06-26 — Anti-scraping watermarking + Cloudflare auto-deploy FIXED at the root

### Anti-scraping / attribution (SHIPPED, live + verified)
Layered system so scraped content is watermarked, traceable, and (for obvious bots) blocked — without hurting legit SEO crawlers:
- `apps/backend/middleware/attribution.js` — `X-Truegle-Attribution` + per-request `X-Truegle-Trace-Id` headers on every response, plus an `attribution` block (with `traceId`) injected into every JSON object body.
- `apps/backend/utils/watermark.js` + `apps/backend/scripts/check-watermark.js` — invisible zero-width-unicode canary woven into each result snippet (`TRUEGLE:<traceId>`), with a CLI to detect it in suspect text.
- `apps/backend/middleware/botDetection.js` — allow-lists Googlebot/Bingbot/social unfurlers; 403s automation (curl/python-requests/scrapy/headless) on `/api/search`; tight 5/min limiter for suspicious requests. Reads CF headers (`cf-connecting-ip`, `cf-verified-bot`, `cf-threat-score`). Toggle: `BOT_DETECTION_DISABLED=true`.
- Visible "Results from Truegle" badge under search results in **`apps/frontend/src/pages/UniversalSearch.jsx`** (the component actually rendered at `/search` — NOT `components/SearchResults.jsx`, which is unused dead code that still has a stray copy of the badge).
- Docs: `docs/ANTI-SCRAPING.md`.

### ⚠️→✅ Backend 500 outage (caused + fixed same session)
The attribution header value originally contained a non-ASCII em-dash, so `res.setHeader` threw `ERR_INVALID_CHAR` on EVERY request → backend 500 across all routes (live search was down). Fixed: ASCII hyphen + a `try/catch` guard around the header writes so attribution can never 500 a request. Lesson for next time: boot the server and hit a route, not just `node --check`.

### ✅ Cloudflare Pages auto-deploy FIXED — root cause found (this resolves the 2026-06-24 entry below)
The "stale build / deploys are manual via wrangler" problem was caused by **`package-lock.json` being out of sync**: `youtube-transcript@^1.3.1` was in `package.json` (the `/extract` tool) but missing from the lockfile, so Cloudflare's `npm ci` failed its sync check in ~0 seconds (the instant "Build failed" checks). Regenerated the lockfile (PR #15, `02a0f03`) → **Cloudflare's own build now succeeds and auto-deploys on push to `main` again** (verified: a fresh CF-built bundle deployed to truegle.info, badge live, HTTP 200).
- Removed the stop-gap `.github/workflows/deploy-pages.yml` (a GitHub-Actions→Pages deploy added while CF builds were broken) since native CF auto-deploy is restored — and to avoid consuming GitHub Actions minutes. Backend still auto-deploys via Vercel.

---

## 🗓️ SESSION LOG 2026-06-24 (cont'd) — ✅ RESOLVED 2026-06-26 (see entry above) — Live site (truegle.info) was stuck on a stale Cloudflare Pages build

User reported the Transcribe button / `/extract` route / new 404 page (merged earlier in commits `ba5bf84`, `65a9977`, `6a6e00e`) weren't showing on the live `truegle.info` site despite being on `main`.

**Confirmed NOT a git/merge problem** — all three commits are present on `origin/main` (`git log` verified).

**Confirmed IS a stale Cloudflare Pages deployment**, and stale by more than just this feature. Live-probed `https://truegle.info`:
- Homepage JS bundle (`/assets/index-5VNdvv9V.js`) contains zero occurrences of `"Transcribe"` and zero occurrences of `"404?!"` (the new 404 page's copy).
- `https://truegle.info/llms.txt` → 404, even though that file was added to the repo back in commit `ee35d33` ("Add multi-engine indexing: llms.txt, IndexNow key, Bing verification, sitemap lastmod") — an *earlier* session than the Transcribe work.
- `https://truegle.info/sitemap.xml` → 200 but has **no `<lastmod>` tags**, even though that same `ee35d33` commit added them.
- `https://truegle.info/extract` (direct nav) → 404.
- Response headers show `cf-cache-status: REVALIDATED` on the JS bundle — Cloudflare re-checked with origin and origin itself served the old asset, so this isn't a simple CDN-cache-staleness issue; the deployed build itself is old.

**Conclusion:** the live site is pinned to (or auto-deploy is stuck on) a Cloudflare Pages build from *before* `ee35d33`, i.e. stale by at least 2 sessions, not just the most recent one. Per `DEPLOYMENT-INFRA.md` the frontend is hosted on **Cloudflare Pages** (project `truegle-search`), not Vercel (Vercel only hosts the backend). The available Cloudflare MCP tools in this environment (`mcp__Cloudflare_Developer_Platform__*`) only cover Workers/D1/KV/R2/Hyperdrive — **there is no tool to list Pages projects, deployments, or build logs**, and there's no Vercel CLI session or GitHub Actions workflow to check either. This needs a human to open the **Cloudflare Pages dashboard → `truegle-search` project → Deployments tab** and check: (a) whether the GitHub integration is still triggering builds on push to `main`, (b) whether recent builds are failing, and (c) whether the `truegle.info` custom domain is still attached to the latest production deployment or pinned to an old one.

**Fixed in the same pass (small, unrelated, low-risk):** `apps/frontend/public/_redirects` was missing a `/extract` entry, so a direct nav/refresh on `/extract` 404'd even on a fresh deploy (the SPA still boots and renders correctly client-side via `dist/404.html`'s fallback, just with the wrong HTTP status). Added `/extract  /_index  200` alongside the other SPA-route entries. Merged to `main` (commit `fc786e8`).

---

## 🗓️ SESSION LOG 2026-06-24 — Map bug fixes: search dropdown stacking + geolocation zoom race (SHIPPED, merged to main)

User-reported on the Maps view: (1) the map's place-search autocomplete dropdown rendered *behind* the map toolbar, and (2) zoom never landed correctly after granting browser location permission.

**Root causes found in `apps/frontend/src/components/map/MapViewWrapper.jsx` and `apps/frontend/src/pages/SearchPortal.jsx`:**
- Search dropdown container was `z-20`; the map's toolbar (`TruegleMap.jsx`) is `z-40` non-fullscreen / `z-50` fullscreen — dropdown was always underneath. Fixed: raised to `z-[60]`.
- Two independent, uncoordinated `navigator.geolocation.getCurrentPosition` calls fired on map open: SearchPortal's "Enable Location" modal (`handleLocationGranted`) only set local React state and never touched the map, while `MapViewWrapper`'s own silent auto-effect (no timeout, zoom 10) raced it via `actions.flyTo`. Whichever resolved last won, so the explicit "Allow Location" click visually did nothing while the silent background fetch — capped at zoom 10 — sometimes hung indefinitely (no timeout set).
- Fix: wired SearchPortal's modal grant handler to `actions.flyTo(location, 15)` + `actions.addMarker(...)` (mirrors the working pattern already used in `TruegleMap.jsx`'s own location handler), and aligned `MapViewWrapper`'s silent effect to the same zoom level/marker/`{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }` options so both paths converge on the same result instead of fighting.
- Verified via production build (`vite build`) + ESLint clean on both files. **Not visually verified in a real browser** — this remote container has no display, no Mapbox token configured, and no browser-automation tooling installed.

---

## 🗓️ SESSION LOG 2026-06-23 — Extractor tool · UX fixes · SEO indexing · AI provider hardening

### Content Extractor — `/extract` (SHIPPED, branch merged to main)
New freemium tool at `truegle.info/extract` targeting content creators and developers.

**Backend — `apps/backend/routes/extract.js` (mounted at `/api/extract`):**
- `POST /api/extract/transcript` — accepts any YouTube URL, extracts full caption transcript via `youtube-transcript` npm package. Returns `{ transcript, wordCount, segmentCount, videoId }`. Only YouTube supported (no video download = no DMCA risk). Error if captions disabled/age-restricted.
- `POST /api/extract/images` — accepts any public URL, scrapes `og:image`, `twitter:image`, and all `<img>` src tags. Returns up to 24 resolved absolute image URLs.
- Both endpoints use `rateLimitSearch` middleware. New dep: `youtube-transcript` (installed in backend).

**Frontend — `apps/frontend/src/pages/ExtractPage.jsx` (route `/extract`):**
- URL input + mode toggle (Transcript / Images).
- **Spin system** (localStorage, no auth required): 3 free extractions per 24-hour rolling window. State keys: `truegle_extract_spins` → `{ remaining, resetAt, adUsed }`.
- **Ad gate modal**: when spins hit 0, a modal offers "Watch a short ad." Ad is a 5-second countdown stub (no real ad SDK yet — wire in a real rewarded format when ad network is approved). Grants 3 more spins on claim.
- **Watermark**: every copy/download appends `\n\n---\nExtracted via Truegle · truegle.info` to transcript text. Visible footer on image results too.
- **Premium CTA** shown in result footer: "Remove watermark with Premium."
- Image results render as a responsive grid; broken images hide via `onError`.
- Added to `App.jsx` router at `/extract`.

**Yellow "Transcribe URL" button:**
- Added to the SearchBar action row (same row as Search + Feeling Biased) via the existing `customActionButtons` prop.
- Wired in both `UniversalSearch.jsx` and `LandingPage.jsx`.
- All search modes (biased, OSINT, deep-dive) inherit it automatically — they all route through `UniversalSearch`.

**Future upgrade path:** Groq offers a free Whisper API (`whisper-large-v3-turbo`) at `POST https://api.groq.com/openai/v1/audio/transcriptions`. Wire it as a fallback for non-YouTube URLs once audio upload UX is built.

---

### UX improvements — search page (SHIPPED)
- **Loading indicator on search bar**: wired `isLoading={searchLoading}` to `<SearchBar>` in `UniversalSearch.jsx`. The built-in spinner activates the moment the user hits Enter (SearchBar already had this prop; it just wasn't connected).
- **Quick Answer card front-and-center**: `QuickResultCard` (business/place/weather/navigational) and the Prominent Question Answer card both now render *above* the AI summary section — no scroll required. The Question Answer card auto-shows for question-phrased queries with a mode-aware themed border and a "Finding your answer…" loading state while AI resolves.

---

### New 404 page (SHIPPED)
Replaced the old GameBoy moon-landing Easter egg with a clean branded placeholder:
- `apps/frontend/src/pages/NotFound.jsx` — black backdrop, `TruegleLogo` (animated), large `404?!` in white with cyan `?!`, "Page Not Found" subtitle, white "Return to Truegle" button.
- **TODO**: user will design a custom background animation to match brand identity. The current page is intentionally minimal as a placeholder.

---

### AI provider hardening (SHIPPED)
- **Gemini model fix**: `gemini-1.5-flash` was deprecated → changed default to `gemini-2.0-flash` in `GeminiService.js`. Configurable via `GEMINI_MODEL` env var on Vercel.
- **Groq key rotation**: `GroqService.js` fully rewritten. Supports `GROQ_API_KEY` through `GROQ_API_KEY_5` (5 keys = 5× free quota). Auto-rotates on 429 (rate limit) or 401 (bad key) using a do-while loop. `healthCheck()` now reports `activeKeyIndex` and `totalKeys`. Keys 2–3 already set on Vercel (`GROQ_API_KEY_2`, `GROQ_API_KEY_3`).
- **Ollama remote auth**: `OllamaService.js` now accepts `OLLAMA_AUTH_TOKEN` env var. Remote (non-localhost) hosts require the token; adds `Authorization: Bearer <token>` header to all requests. `isAvailable()` returns false for remote hosts without a token set.
- **OpenAI key removed**: user never signed up with OpenAI (against Truegle's mission). Malformed key with embedded newline was causing "Invalid character in header content" errors. Removed via `vercel env rm`.
- **Anthropic**: API key added but Evaluation plan requires paid credits — effectively unavailable at $0 budget. Key is set but will always fail until credits are loaded.

---

### SEO / Indexing (SHIPPED)
- **llms.txt** (`apps/frontend/public/llms.txt`): AI crawler guidance file describing Truegle's mission, features, and page URLs. Referenced in `index.html` via `<link rel="alternate" type="text/plain" href="/llms.txt">`. Makes Truegle discoverable by Perplexity, ChatGPT Search, etc.
- **IndexNow**: key file `11aa6a4fa968d5abec8df44c8e8c35c0.txt` at root, `<meta name="indexnow-key">` in `index.html`, `<meta name="msvalidate.01">` for Bing Webmaster verification.
- **robots.txt**: added explicit `Allow` rules for GPTBot, PerplexityBot, ClaudeBot, anthropic-ai.
- **Sitemap**: all 7 URLs now have `<lastmod>2026-06-23</lastmod>`.
- **Bing Webmaster Tools**: imported from Google Search Console (one click). 5 URLs submitted via URL Submission (covers Bing, Yahoo, DuckDuckGo). Sitemap submitted.

---

### Share-for-Premium referral tag (SHIPPED, commit `fa3ac23`)
`ShareForPremiumButton.jsx`: share URL changed from `https://truegle.com` to `` `https://truegle.com/?ref=share_${platform.id}` ``. Each platform (Twitter, WhatsApp, etc.) gets its own `ref` tag so analytics can attribute which platform's shares convert.

---

### Deployment note — CLI vs. truegle.info
`vercel --prod` CLI deploys alias to `frontend-drab-ten-41.vercel.app`, **not** `truegle.info`. The `truegle.info` custom domain follows the Git-connected main branch. **Always merge to main to update truegle.info.** (The CLI deploy URL is useful to preview changes before merging.)

Backend CLI deploy fails with path-doubling error when run from `apps/backend/` because Vercel project has `rootDirectory=apps/backend` set. Workaround: `VERCEL_ORG_ID=team_OyHR5YLtUy6gIs8HmvhXKSsj VERCEL_PROJECT_ID=prj_4JvIr3WaQ9HiKghZrGwWaAmf61oI vercel deploy --prod <repo_root>` from the TruegleSearch root.

---

This doc is written so it can be handed to **Claude in the web browser** to walk through
the remaining **dashboard/browser activation steps**. Everything that requires code or a
computer has already been done and deployed (see "Done this session").

> 🛑 **MONETAG + ADSTERRA HAVE BEEN REMOVED (2026-06-15 night) — DO NOT RE-ADD THEM.**
> `truegle.info` was caught in a **Palo Alto Networks threat-intel DNS sinkhole**
> (`truegle.info → sinkhole.paloaltonetworks.com`), i.e. the domain was classified as
> **malicious** and is being **blocked for every user on a Palo-Alto-protected network**
> (corporate / school / enterprise). Root cause = the Monetag service worker we shipped loads
> `3nbf4.com`, a known **adware/malvertising** host; Adsterra (`highperformanceformat.com` /
> `profitablecpmrate.com`) is the same instant-approval malvertising class. **All of it was
> ripped out.** Monetize ONLY with reputable networks (Google AdSense, Ezoic/Mediavine/Raptive
> tier). See ["AD STRATEGY — what to avoid"](#ad-strategy--what-happened--what-to-avoid). The
> remaining browser steps below are still valid **except the old "STEP A" (now void)**.
>
> ✅ **UPDATE 2026-06-21 — domain reputation cleared, verified clean:** Palo Alto's
> urlfiltering.paloaltonetworks.com lookup now shows `truegle.info` as
> `Computer-and-Internet-Info`, **Low-Risk** (the only other tag is `Newly-Registered-Domain`,
> which is benign and ages off automatically ~32 days post-registration — no action possible or
> needed). Google Safe Browsing transparency report shows **"No unsafe content found."** DNS
> resolves to real Cloudflare IPs (not the sinkhole) and the site returns HTTP 200. The
> un-sinkhole task is **done** — see STILL TO ADDRESS #1, now closed.

---

## 🗓️ SESSION LOG 2026-06-20 — SearXNG promoted to primary + Search ranking + AI chat fix + Ad URLs

### SearXNG promoted to primary search provider — AWS Elastic IP (SHIPPED, commits `a24dee3`→`9763e62`)
**Outcome:** the self-hosted SearXNG metasearch instance is now the **primary** search provider in
production — verified live, real queries return `"source":"searxng"` results (aggregated via
Google/Startpage/etc. engines) before the paid API providers ever fire.
- SearXNG is now running on a **persistent AWS host with a permanent Elastic IP** (previous notes
  referenced an ngrok tunnel / "your iMac, a VPS" as placeholders — that's superseded). `SEARXNG_URL`
  on Vercel backend points at that Elastic IP.
- Set `SEARXNG_PRIMARY=true` on the Vercel backend → `SearchService` now queries SearXNG first;
  Google/Bing/Brave only run as fallback when SearXNG is offline or returns fewer than
  `SEARXNG_PRIMARY_MIN` (default 5) web results (`SearchService.js` line ~129, pre-existing code from
  an earlier session — this was the first time it was actually turned on).
- Backend redeployed to pick up the new env vars (commits `a24dee3`, `ce5c912`, `9763e62` are empty
  marker commits — the actual changes were env vars set directly on the Vercel dashboard, not code).
- **Verified live this session:** `POST /api/search` for both a synthetic query and a real query
  (`weather forecast new york`) returns `source:"searxng"` results mixed with YouTube/news as
  supplementary providers. The paid Google/Brave APIs are no longer doing the bulk of the work.
- **Known gap:** `GET /api/search/health` does **not** report a `searxng` field —
  `SearchService.getHealthStatus()` (`SearchService.js` ~line 1709) only has cases for
  google/bing/news/youtube. Not a functional problem (confirmed working via real queries above), just
  a monitoring blind spot — add a `searxng` case calling `performSearXNGSearch` if you want parity.
- This closes out the former "Step 7 — (Optional) SearXNG as primary" — see the REMAINING BROWSER
  STEPS section below, now marked done.

### Search result quality — navigational intent + instant answers (SHIPPED, commits `ade45c6`→`69aa3d8`)
**Problem:** brand-name queries like "AWS" returned aws.amazon.com at position #7 behind social media / jobs pages. No quick-answer cards appeared even though the backend was already building `instantAnswer` objects.

**Fix — backend (`SearchService.js` + `routes/search.js`):**
- Added `isNavigationalQuery(query)` — returns true for ≤3-word queries without question prefixes (what/how/why/when/who/etc).
- Added `calculateNavigationalScore(query, result)` — scores URL officiality: subdomain-match + homepage = 1.0; contains query + homepage = 0.9; social media domains (Instagram, LinkedIn, Twitter, etc.) = 0.25× penalty.
- Modified `rankResults()`: when query is navigational, blends `finalScore * 0.3 + navScore * 0.7` so the official homepage floats to #1.
- Expanded `APP_NAMES` in `detectQueryType()` from ~15 to ~45 entries (added aws, azure, gcp, stripe, redis, mongodb, supabase, firebase, etc.) and added `navigational` as catch-all type for short brand queries not in the list.
- `buildInstantAnswer()` now handles `type === 'navigational'` — finds best official result (heavy social penalty) and returns `{ type:'navigational', name, url, snippet, domain, favicon }`.

**Fix — frontend (`SearchPortal.jsx` + `QuickResultCard.jsx`):**
- Wired `data.instantAnswer` from API response to `instantAnswer` state in `SearchPortal.jsx`.
- Added `NavigationalCard` component to `QuickResultCard.jsx` — compact "Official site" card with favicon, domain badge, title, snippet, and external link icon.
- `QuickResultCard` now renders above search results when `instantAnswer` is present.

### Google API key — fixed 403 on Custom Search + YouTube (DONE)
- Root cause: project had only an OAuth 2.0 Client ID, not an API Key. Created a proper **API Key** in Google Cloud Console restricted to Custom Search API + YouTube Data API v3. Updated `GOOGLE_API_KEY` on Vercel via `vercel env rm` + `vercel env add`.

### AI chat — Groq added as primary free provider (SHIPPED, commit `ade45c6`)
- **OpenRouter billing failed** → AI chat was dead.
- Added `services/GroqService.js` (OpenAI-compatible, `api.groq.com/openai/v1`, model `llama-3.1-8b-instant`). Free tier, no credit card required — get key at console.groq.com.
- `GROQ_API_KEY` set on Vercel.
- New failover order: **groq → gemini → nvidia → openai → anthropic → ollama**.
- Switched Gemini default model from `gemini-1.5-pro-latest` → `gemini-1.5-flash` (free tier: 1M tokens/day vs. tiny pro quota).
- Ollama cannot run on Vercel serverless (no persistent process, no GPU, no disk for model weights). Self-host option only — set `OLLAMA_BASE_URL` to a public URL (e.g. Oracle Cloud Always Free ARM VM) if you want it live.

### House ads — OpenOcchio and BriccD now link to live previews (SHIPPED, commits `3605a42` + `69aa3d8`)
- Both ads previously linked to GitHub repos. Updated `houseAds.js`:
  - OpenOcchio → `https://ae5d4d0b.openocchio.pages.dev/` · CTA: "Try it free"
  - BriccD → `https://briccd.o87enterprises.workers.dev/` · CTA: "Try the demo"
  - BriccD description updated: *"Design a LEGO world in 3D, then step inside it life-size with Meta AR glasses."* · Title: *"BriccD — Build it. Live in it."*

---

## 🗓️ SESSION LOG 2026-06-18 (newest first) — CI/CD + Videos-tab fix + CSP

### Videos tab returned nothing — FIXED (commit `a074357`, verified live)
**Symptom:** the Videos tab showed "No video results found" for every query (console empty, API 200).
**Root cause (found via `vercel logs`):**
- The backend reads filters **nested** (`req.body.filters`); for `filters.category === 'videos'` the web
  providers (Brave/Google) do NOT run — the only video source is the YouTube Data API.
- The **`YOUTUBE_API_KEY` is configured but ERRORS (403/quota)** — same Google project whose Custom Search
  also 403s. The error is swallowed by `Promise.allSettled`, so the Videos tab came back empty. (The quotes
  in the user's `"grown shit" mac dre` query were a red herring — even unquoted was empty.)
**Fix:** in `SearchService.js` `searchVideos` block, ALWAYS add a Brave fallback **scoped to
`filters.category === 'videos'`**: `performBraveSearch(`${query} site:youtube.com`, {...filters, perPage:20})`.
youtube.com links are tagged `videos` by `detectCategory` and kept by the category filter. Now Videos tab
returns ~12-20 real YouTube results (verified: `mac dre`→20, `"grown shit" mac dre`→12). Scoped to the
Videos tab so the mixed `all` feed isn't flooded + no extra Brave call per all-search.
- **Brave gotcha:** `site:youtube.com OR site:vimeo.com` (OR of two `site:`) returns **0** from Brave; a
  SINGLE `site:youtube.com` works. Also added a general quote-broaden (commit `e4ab351`): quoted queries
  (`/["']/`) with `<12` results re-run de-quoted + merge.
- **Still open (optional, non-blocking):** the YouTube Data API key 403s. To restore the proper video
  source (durations/view-counts), enable **YouTube Data API v3** on that Google Cloud project (same one as
  the CSE) or check its quota. The Brave fallback means this is now a quality upgrade, not a blocker.
- **Debug lessons:** `vercel pull` does NOT decrypt **Sensitive** env vars — they show as `KEY=""` locally
  even though set in prod, so you can't read real keys / repro provider calls locally. Use
  `vercel logs https://<deployment-url> --token=$TOKEN` (url from `/v6/deployments`) to see backend logs.
  Windows Python: read API responses with `io.open(f, encoding='utf-8')` (cp1252 chokes on emoji/titles).

### CSP blocked Cloudflare Web Analytics beacon — FIXED (commit `77bd3e6`, verified live)
Cloudflare Pages auto-injects `static.cloudflareinsights.com/beacon.min.js`, which the CSP (added 2026-06-17)
was blocking. Added `https://static.cloudflareinsights.com` to `script-src` and `https://cloudflareinsights.com`
to `connect-src` in `apps/frontend/public/_headers`. Verified live on `truegle.info`. (The other console
noise — "Speech Recognition not supported" in Firefox, and `OpaqueResponseBlocking` — are benign/separate.)

### `git push origin main` → auto-deploys GitHub + Cloudflare + Vercel (DONE & verified live)
**Outcome:** committing and pushing to `main` now builds and deploys **all three platforms with zero
manual steps** — no more hand-running `wrangler` / `vercel deploy`. Verified end-to-end on commit
`c7e3659` (backend health 200, frontend 200).

- **Synced + deployed this session:** merged the newest commit `1bb0511` ("Fix search filters, AI
  summary bias, ranking, and image sourcing") from branch `claude/search-filters-ai-summary-1b8sns`
  into `main` (fast-forward), pushed, then deployed both halves manually once (Cloudflare frontend +
  Vercel backend) to get the new code live before wiring up auto-deploy.

- **Frontend → Cloudflare Pages = native git, already working.** Despite older notes saying CF git was
  disconnected, the `truegle-search` Pages project **is** connected and auto-builds on every push to
  `main` (confirmed multiple green builds this session). Nothing to do — frontend self-deploys.

- **GitHub Actions = NOT usable here, don't try again.** The repo `o87enterprises-ai/TruegleSearch` is
  **private** and the free-tier Actions minutes are exhausted → every workflow run dies in ~1s with
  `startup_failure` (even a manual `workflow_dispatch`, even on valid YAML). I added a deploy workflow,
  proved it's blocked, and **removed it** so it won't spam red ❌ on commits. Only revisit if you enable
  Actions billing OR make the repo public (public = free unlimited Actions, **but** scrub git history
  for leaked env keys first — risky given the security audit).

- **Backend → Vercel = native git, fixed in 3 steps:**
  1. **Connect (browser, done by you):** Vercel dashboard → project `backend` → Settings → Git → connected
     `o87enterprises-ai/TruegleSearch`. (The `vercel git connect` CLI path FAILS — the GitHub-App install
     is browser-only.) Production branch = `main`.
  2. **Root Directory was empty** → git deploys would build from the repo root, not the backend. Fixed via
     Vercel REST API (no browser): `PATCH /v9/projects/backend?teamId=<TEAM>` body `{"rootDirectory":"apps/backend"}`.
  3. **Deploys came back `BLOCKED` (`seatBlock: TEAM_ACCESS_REQUIRED`)** — Vercel checks the **commit
     AUTHOR**, not the pusher, against team membership. Commits were authored as
     `Truegle <truegleai@proton.me>`, which GitHub attributes to the **`TruegleAi`** account (not on the
     Vercel team). The team-member account is **`o87enterprises-ai` / o87enterprises@gmail.com**. Fixed with
     `git config user.email o87enterprises@gmail.com` (kept `user.name "Truegle"` so the author still reads
     as Truegle). After that, the next push deployed READY and auto-promoted to `target:production`,
     aliased to `backend-seven-khaki-60.vercel.app`.

- **⚠️ RULE going forward:** commits to this repo **must be authored with `o87enterprises@gmail.com`** or
  Vercel will `BLOCK` the git deploy again. It's set locally in this repo; if you ever commit from another
  machine, run the same `git config`. (To revert to your proton email you'd have to add the `TruegleAi`
  GitHub account to the Vercel team instead.)

- **Manual fallback (still works if ever needed):** frontend `cd apps/frontend && NODE_OPTIONS='--max-old-space-size=4096' npx vite build && wrangler pages deploy dist --project-name=truegle-search --branch=main`;
  backend `cd apps/backend && vercel deploy --prod --yes`.

- **IDs for reference:** Vercel teamId `team_OyHR5YLtUy6gIs8HmvhXKSsj`, projectId
  `prj_4JvIr3WaQ9HiKghZrGwWaAmf61oI`; Cloudflare accountId `1052be08b0c9382768667a9254936f9c`.

---

## 🗓️ SESSION LOG 2026-06-16 → 2026-06-17 (newest first; supersedes older AdSense/ad notes)

### Security headers / CSP added (2026-06-17) — fixes Aikido "CSP header not set" (risk 91)
- **Root cause:** Cloudflare Pages was serving the frontend with **no security headers at all**
  (no Content-Security-Policy, HSTS, etc.). Aikido flagged it on `https://truegle.info`.
- **Fix:** added **`apps/frontend/public/_headers`** (Cloudflare Pages reads `_headers` from the
  deploy root; living in `public/` means Vite copies it to `dist/_headers` on every build — no
  build-config change needed). Applies to all routes (`/*`):
  - **Content-Security-Policy** — `script-src 'self' 'wasm-unsafe-eval'` (the XSS lock; the only
    `eval`/`new Function` in the bundle is the `new Function("return this")` global polyfill,
    wrapped in try/catch with a fallback, so blocking it is harmless), `object-src 'none'`,
    `base-uri`/`form-action`/`frame-ancestors 'self'`.
  - **`connect-src` is an EXPLICIT allowlist** of the only origins the browser calls directly:
    `'self'` + backend `https://backend-seven-khaki-60.vercel.app` (search/AI/weather/radar/
    cameras are all proxied through it) + `https://*.mapbox.com` + `https://api.tomtom.com`
    (sat tiles) + `https://nominatim.openstreetmap.org` (geocode) + `https://router.project-osrm.org`
    (directions) + `https://gibs.earthdata.nasa.gov` (NASA imagery) + `https://api-inference.huggingface.co`
    + `blob:`. **If a direct-call host moves (e.g. custom backend domain) or a new client-side API
    is added, append it here or the call will be CSP-blocked.**
  - **`img-src`/`media-src` left as `https:`** on purpose — live traffic-camera feeds, image-search
    results, YouTube thumbnails and map tiles come from arbitrary domains rendered as `<img>`/
    `<video>`; locking these would break image search + cameras. `frame-src` is an explicit
    allowlist (YouTube + Vimeo embeds only).
  - **Also set:** HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Content-Type-Options:
    nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`,
    `Cross-Origin-Opener-Policy: same-origin`, and `Permissions-Policy` keeping
    `geolocation/camera/microphone=(self)` (app uses `getUserMedia` + `navigator.geolocation`)
    while disabling `payment/usb/interest-cohort`.
- **Deployed & verified live (2026-06-17):** rebuilt frontend, `wrangler pages deploy dist
  --project-name=truegle-search`; `curl -sI https://truegle.info` now returns the full CSP +
  all security headers. Build note: on Windows the npm `build` script's inline `NODE_OPTIONS=`
  fails under `cmd.exe` — run `NODE_OPTIONS='--max-old-space-size=4096' npx vite build` from a
  bash shell instead (or just `npx vite build`). **TODO (deal with later):** make `npm run build`
  cross-platform by switching the `build`/`vercel-build` scripts in `apps/frontend/package.json`
  to `cross-env NODE_OPTIONS=--max-old-space-size=4096 vite build` (add `cross-env` as a devDep).

### Monetization pivot — Google AdSense REMOVED, first-party ad network IN
- **AdSense fully removed.** Google rejected `truegle.info` with *"Google-served ads on screens
  without publisher-content"* (you cannot put standard display AdSense on search-results pages —
  that's a separate Programmable-Search product). Deleted `components/ui/AdSenseAd.jsx`, removed
  the global `adsbygoogle.js` `<script>` from `index.html`, swapped every `<AdSenseAd>` → the
  first-party `<AdSlot>` in `UniversalSearch` (+ dead `BiasedResults`/`SearchPortal`). Verified
  live: no `googlesyndication` served. (CSP allowlist entry left in backend `server.js`, harmless.)
- **First-party house-ad system built** (no external scripts → can't get the domain flagged):
  `config/houseAds.js` (`HOUSE_ADS` + `AFFILIATE_OFFERS` + `AD_ZONES` + `pickHouseAd()` /
  `getAdById()`), `components/ui/HouseAd.jsx` (rel="sponsored", privacy-safe local impression/
  click counts), `components/AdSlot.jsx` upgraded to render house ads. New **`/advertise`**
  media-kit page + footer link.
- **House-ad layout (search page pinned slots):** top banner = **advertise-cta**, middle =
  **OpenOcchio** (git), sidebar = **BriccD** (git); added **github-profile** ad; removed Orchestra.
  AI-chat-box mock ads (`ui/AdBanner`, rewritten to serve house ads): top = github-profile,
  bottom = advertise-cta.
- **Advertiser contact = plain MAILTO** to `truegleai@proton.me` (`AdvertiseContactModal`, opened
  by any `action:'contact'` ad). User chose mailto over Resend (no extra key). Offer fine print:
  *first month free; placements ~~$99/mo~~ **50% OFF $49.99/mo limited time**; any paid placement
  includes Truegle Premium free.* (Numbers live in `houseAds.js` advertise-cta + the modal — adjust freely.)
  Backend `POST /api/contact/advertise` route exists but is now UNUSED (harmless).
- **Affiliate network = Impact.com.** Verification meta tag live in `index.html`
  (`impact-site-verification`). `AFFILIATE_OFFERS` seeded (Proton VPN, Incogni, generic VPN) with
  **placeholder URLs** — paste your real Impact tracked links after approval, then redeploy.
  **🛑 2026-06-21: Marketplace application DECLINED** ("you currently do not qualify for access
  to impact.com's Marketplace"). Per Impact's own help docs, declines are caused by one of:
  unverifiable identity, unverifiable/low-quality media properties, insufficient traffic/audience,
  or an MPA (policy) violation. The likely cause here was the second one — at decline time the
  site shipped pure client-rendered HTML (empty `<div id="root">` to anything that doesn't run JS)
  plus soft-404s on every unmatched path, so an automated content-quality screen would have seen
  no real content. **That root cause is already fixed** (commit `8df0535`, 2026-06-19 — build-time
  prerendering for `/`, `/about`, `/privacy`, `/terms`, `/advertise`, real `_redirects`-based 404s,
  `robots.txt`, `sitemap.xml`) and **verified live in production 2026-06-21** via `curl`:
  `truegle.info/` now serves real prerendered text in the initial HTML, `/about` (and the other
  static routes) serve the full styled page at HTTP 200, and an unmatched path returns a genuine
  404 instead of the old soft-404. **Ready to reapply** — `tools/ad-distributor-cli` (`info impact`)
  has the full pre-reapply checklist (Impact-side profile fields to fill in, no documented waiting
  period, traffic stats to have on hand since there's no published minimum, and where to resubmit
  if there's no self-serve button). Do not create a new Impact account — the existing one already
  carries the live verification tag for this domain.

### Features / fixes
- **OSINT Email + Phone intel (free, no key):** `GET /api/osint/email-intel` (syntax, role/
  disposable flags, live MX, Gravatar) + `GET /api/osint/phone-intel` (validity/line-type/country/
  formats via new dep `libphonenumber-js`). Wired into `OSINTToolsPanel`. Deployed + verified.
- **AI provider swapped to NVIDIA NIM** (replaces OpenRouter; **Ollama kept**). New
  `services/NvidiaService.js` (OpenAI-compatible, `integrate.api.nvidia.com`, model
  `nvidia/nemotron-3-ultra-550b-a55b`, `enable_thinking:false` for clean output). `NVIDIA_API_KEY`
  set on Vercel + verified. `getProviderOrder` now always includes code-registered providers
  (nvidia/ollama) even though they aren't rows in the `ai_providers` DB table.
- **🩹 Backend-wide crash fixed.** Adding the contact route made `EmailService` load at startup;
  its constructor did `config.email.resend.apiKey` and threw → **every** route 500'd
  (FUNCTION_INVOCATION_FAILED). Hardened with optional chaining. **Lesson: singleton services
  (`module.exports = new X()`) must never throw in their constructor.**
- **🎤 Voice/audio search fixed.** `VoiceRecognition` only captured *interim* results and dropped
  *final* ones (garbled dictation). Now accumulates finals correctly + defaults to the browser
  language (helps international users); accepts a `lang` prop.
- **"Make default search engine" + "Add to Home Screen" added** (were missing): `public/opensearch.xml`
  + `<link rel="search">`, and `public/manifest.webmanifest` + apple-touch/theme-color meta in `index.html`.
- **OAuth callback bug fixed:** `auth.js` used per-deploy `VERCEL_URL` (changes every deploy →
  never matches Google's registered redirect) → now prefers stable `BACKEND_URL`.

### Deploy note
- Build the frontend with the **project-local vite binary** (`node_modules\.bin\vite.cmd`), **NOT
  `npx vite`** (npx was pulling a wrong/rolldown version that fails the build).

---

## 🔜 STILL TO ADDRESS (outstanding tasks)

1. ~~**🛑 Un-sinkhole `truegle.info`**~~ ✅ **DONE, verified 2026-06-21.** Palo Alto category
   lookup shows `Computer-and-Internet-Info` / Low-Risk (no malware/sinkhole tag); Google Safe
   Browsing shows "No unsafe content found"; DNS resolves to real Cloudflare IPs; site returns
   HTTP 200. No further action needed.
2. **OAuth — finish setup** (code callback already fixed): create a Google OAuth **Web** client
   (consent screen: external, scopes email/profile/openid, app domain `truegle.info`); set
   **redirect URI** `https://backend-seven-khaki-60.vercel.app/api/auth/google/callback`; on Vercel
   set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BACKEND_URL=https://backend-seven-khaki-60.vercel.app`,
   `FRONTEND_URL=https://truegle.info` → redeploy backend; then flip **`OAUTH_ENABLED=true`** in
   `apps/frontend/src/config/access.js` → redeploy frontend.
3. **AI chat end-to-end** — ✅ Groq is now primary (free, live). Failover chain: groq→gemini→nvidia→openai→anthropic→ollama. Verify chat works live in the browser (backend auth-gates expensive endpoints; confirm it works under `FREE_ACCESS_MODE`).
   **SearXNG is now primary for web search** (✅ done — AWS Elastic IP host, `SEARXNG_PRIMARY=true`,
   verified live). Optional follow-up: add a `searxng` case to `SearchService.getHealthStatus()` so
   `/api/search/health` reports it instead of being silent on it.
4. **Impact affiliates** — get approved, paste real tracked links into `AFFILIATE_OFFERS`
   (`houseAds.js`), redeploy. (Currently placeholder URLs = $0.)
5. **Get indexed (SEO)** — Google Search Console + Bing: add property, verify via Cloudflare DNS
   TXT, submit `https://truegle.info/sitemap.xml`, request indexing for `/` and `/search`.
6. **`/advertise` page** — replace placeholder pricing (use the $49.99 promo) + real audience/traffic numbers.
7. **PWA icons** — add proper 192×192 + 512×512 icons (manifest currently reuses `og-image.png`).
8. **Location filter (optional)** — auto-detect already threads country/language to providers; add a
   visible country/region dropdown if you want user override.
9. Carry-overs: Google CSE 403 (optional — Brave covers search), Stripe live keys (when charging),
   re-enable real auth later (`FREE_ACCESS_MODE` + 12-char password fix). ~~reconnect
   Cloudflare↔GitHub auto-deploy~~ ✅ **DONE 2026-06-26 (PR #15 — lockfile sync).**
   **`RESEND_API_KEY` no longer needed** (advertiser contact is mailto now).

---

## ✅ DONE THIS SESSION (all live + verified)

**Earlier today**
- **Search outage FIXED** (stale backend → redeployed; CORS allowlist already had truegle.info).
- **Legal pages SHIPPED + live:** `/privacy`, `/terms`, `/about` (HTTP 200) — unblock OAuth + AdSense.
- **Down-for-repairs modal** (after 2 consecutive search failures) + **browser-synced multilingual search**.

**This session (pre-production hardening + monetization)**
- 🩹 **WHITE-SCREEN CRASH FIXED.** The whole site was down with `useLayoutEffect of undefined` —
  a circular Vite chunk dependency (React split into its own chunk while mapbox/three/vendor
  cross-imported). Rewrote `manualChunks` to a strictly **acyclic** graph. (`7e46b72`)
- 🛡️ **3-LAYER CRASH PROTECTION so a white screen can NEVER happen again:** (1) a
  framework-agnostic global safety net in `main.jsx` that recovers stale-chunk loads and shows
  a friendly fallback if the app fails to even mount; (2) a **RootErrorBoundary** around the
  whole app; (3) a **RouteBoundary** around every page so one crash can't kill the site. (`ff1509f`)
- 🔒 **SECURITY: removed a client-side admin auth-bypass backdoor** on the sign-in page (it
  minted a fake admin/premium session via Ctrl+Shift+A / triple-click / hidden button). (`c0a9b1a`)
- 🚪 **FREE-ACCESS MODE (reversible).** OAuth bypassed, all paywalls/token-gates/login-walls
  removed so every feature is usable without signing in (one flag: `src/config/access.js`).
  Expensive AI/OSINT endpoints stay backend-protected (cost control) but now degrade to a
  friendly message instead of a broken login bounce. (`ff1509f`)
- 📣 **EARLY-ACCESS UX.** Dismissible "you're a pre-production user, things may break, send
  feedback" banner (→ truegleai@proton.me) + a transient error bar on breaking errors +
  friendly "search failed / no results" messaging instead of a blank page. (`ff1509f`)
- ⚠️→🗑️ **AD MONETIZATION (Monetag + Adsterra) BUILT EARLIER (`c0ee1de`) THEN FULLY REMOVED
  (night).** Shipping the Monetag service worker (`/sw.js` → loads `3nbf4.com`) got
  `truegle.info` **flagged as malicious and DNS-sinkholed by Palo Alto Networks**. Removed the
  `sw.js`, the script loaders (`utils/adNetworks.js`), the Adsterra banner
  (`components/ui/AdSlot.jsx`), the rewarded button (`RewardedAdButton.jsx`), the config
  (`config/ads.js`), and every reference in `App.jsx` / `UniversalSearch.jsx`. **Google AdSense
  (`AdSenseAd.jsx`) is untouched** — it's the only ad code left, and it's reputable. Rebuilt +
  redeployed clean. See ["AD STRATEGY"](#ad-strategy--what-happened--what-to-avoid).

**Git:** `origin/main` = ad-removal commit (see latest). Frontend deployed via wrangler from this.

> ⚠️ **Tell your users to hard-refresh (Ctrl+Shift+R)** — older browser caches may still hold
> the pre-fix bundle (with the white screen / old admin code). The live server is clean.

---

## ⚡ CURRENT STATE

### Infrastructure
| Item | Status | Notes |
|------|--------|-------|
| `truegle.info` / `www.truegle.info` | ✅ Live + SSL | Cloudflare Pages custom domains |
| `trumpafi.online` | ✅ Live | 301 → `truegle.info` |
| `truegle-search-15k.pages.dev` | ✅ Live | Pages default domain |
| Backend | ✅ Live | `https://backend-seven-khaki-60.vercel.app` |
| Search on truegle.info | ✅ Working | Fixed this session |
| DNS | ✅ Complete | Cloudflare nameservers active on IONOS |

### Known operational notes
- ~~**package-lock.json is out of sync** … Cloudflare Pages auto-build disconnected, deploys
  manual via wrangler.~~ ✅ **FIXED 2026-06-26 (PR #15).** The missing dep was
  `youtube-transcript` (not passport); regenerated the lockfile so `npm ci` passes again.
  Cloudflare's GitHub auto-build now succeeds and **auto-deploys on push to `main`** — no more
  manual wrangler deploys.
- **Vercel CLI token** expired once this session; re-auth via `vercel login` device flow
  (can be approved from a phone already logged into Vercel).

---

## 🗂️ THIRD-PARTY SERVICE STATUS

| Service | Status | Notes |
|---------|--------|-------|
| Cloudflare DNS | ✅ Complete | `truegle.info` zone active |
| 301 Redirect | ✅ Active | trumpafi.online → truegle.info |
| Legal pages (/privacy /terms /about) | ✅ Live | Prereq for OAuth + AdSense — now satisfied |
| **Monetag** | 🛑 **PERMANENTLY REMOVED** | Caused Palo Alto DNS sinkhole via `3nbf4.com` malvertising. Never re-add. |
| **Adsterra** | ✅ **LIVE (re-integrated 2026-06-28)** | Re-added cleanly: popunder + social bar via `AdScriptLoader.jsx`, banners via `AdsterraBanner.jsx`. No service workers, no `3nbf4.com`. ~30 impressions live. Fires unconditionally for CPM revenue. Third-party cookies (`effectivecpmnetwork.com`) are Adsterra's own — Truegle sets zero cookies. |
| **Domain reputation** | ✅ **Clean — verified 2026-06-21** | Palo Alto category lookup: `Computer-and-Internet-Info`, Low-Risk (no malware/sinkhole tag; the residual `Newly-Registered-Domain` tag is benign and self-clears ~32 days post-registration). Google Safe Browsing: "No unsafe content found." DNS resolves to real Cloudflare IPs, site returns HTTP 200. |
| **Google Custom Search API** | ⚠️ **403 / likely quota** | Free tier = 100 queries/day, blown by current traffic; also a project/account access issue (key 403s even tested directly). Search still works — `Promise.allSettled` drops Google and Brave fills in. See Step 1. Ad revenue (Step A) can fund CSE billing. |
| Google OAuth | 🚫 **Bypassed (intentional)** | Hidden via `OAUTH_ENABLED=false` while in free-access mode; sign-in not required. Re-enable later (Steps 2–3) once auth is fixed. Registration also has a **12-char min-password** mismatch to fix then. |
| OAuth Branding | ⚠️ Needs fix | Wrong authorized domain `truegle-search.pages.dev` → should be `truegle-search-15k.pages.dev`; also add `truegle.info` + `trumpafi.online`; fill home/privacy/terms URLs. See Step 3. |
| Google AdSense | 🛑 **REMOVED 2026-06-17** | Google rejected it ("ads on screens without publisher-content" — display AdSense isn't allowed on search results). All AdSense code/script removed; replaced by the first-party house-ad + Impact-affiliate system. Don't re-add to the search UI. See session log. |
| Impact.com (affiliates) | 🔴 **CLOSED — do not revisit** | Declined twice. **Reason: traffic sub-50K/month** (not a tech/content issue). No fix until monthly traffic exceeds 50K. See the hard-stop note at the top of this document. |
| NVIDIA NIM (AI) | ✅ **Live (backup)** | `NVIDIA_API_KEY` set on Vercel. Now 3rd in failover (after Groq + Gemini). |
| **Groq (AI)** | ✅ **Live — primary** | Free tier, no CC required. Keys `GROQ_API_KEY` + `GROQ_API_KEY_2` + `GROQ_API_KEY_3` set on Vercel (supports up to `_5`). Auto-rotates on 429/401. Model: `llama-3.1-8b-instant`. Failover: groq→gemini→nvidia→openai→anthropic→ollama. |
| **Gemini (AI)** | ✅ **Live (secondary)** | `GEMINI_API_KEY` on Vercel. Model: `gemini-2.0-flash` (was `gemini-1.5-flash` — deprecated, caused 404s, fixed 2026-06-23). Configurable via `GEMINI_MODEL` env var. |
| **SearXNG (self-hosted search)** | ✅ **Live — primary** | Hosted on a persistent AWS host with a permanent Elastic IP. `SEARXNG_URL` + `SEARXNG_PRIMARY=true` set on Vercel backend; redeployed and verified live (real queries return `source:"searxng"`). Paid API providers (Google/Bing/Brave) now only fire as fallback. `/api/search/health` doesn't report it yet (cosmetic gap, not functional). |
| Search Console | ⏸️ Not started | See Step 5. |
| Bing Webmaster | ⏸️ Not started | See Step 5. |
| Stripe | ✅ Verified | Live keys NOT yet swapped on Vercel. See Step 6. |

---

## 🚦 REMAINING BROWSER STEPS (each is self-contained)

> Reference values you'll need are in the QUICK REFERENCE table at the bottom.

### AD STRATEGY — what happened & what to avoid
**The old "STEP A — Activate Monetag/Adsterra" is VOID. Do not do it. Do not re-add those env
vars or any of their scripts.**

**What happened (2026-06-15):** to monetize fast we added Monetag (instant-approval) and
shipped its service worker at `https://truegle.info/sw.js`, which loads
`https://3nbf4.com/act/files/service-worker.min.js`. `3nbf4.com` is a Monetag adware/push host
on enterprise threat-intel blocklists. Result: **Palo Alto Networks DNS-sinkholed
`truegle.info`** (`truegle.info CNAME → sinkhole.paloaltonetworks.com`) — the domain is now
classified as **malicious** and silently unreachable for anyone behind a Palo Alto firewall
(huge share of corporate/school/enterprise traffic). This also endangers Google Safe Browsing
status, the pending AdSense review, and SEO/domain reputation.

**❌ NEVER use these (they will re-flag the domain):**
- **Monetag** — domains `3nbf4.com`, `libtl.com`, `*.monetag.com` push/multitag.
- **Adsterra** — `highperformanceformat.com`, `profitablecpmrate.com` (Social Bar / popunder).
- Any "instant-approval" push/popunder/popunder-redirect network. Easy approval = low
  reputation = blocklists. Not worth a sinkholed domain.

**✅ Safe monetization path:**
1. **Google AdSense** — already integrated (`AdSenseAd.jsx`, `pub-9542137900411519`), in
   review (Step 4). Reputable; renders automatically once approved. This is the primary plan.
2. When traffic justifies it, apply to a **reputable ad-management network** with real review
   (Ezoic → then Mediavine/Raptive at scale). These vet advertisers and won't blocklist you.
3. **Direct sponsorships / affiliate** (privacy-tool, VPN affiliates) — on-brand, zero
   malvertising risk.

**🧹 Cleanup — ✅ DONE, verified 2026-06-21:**
- **truegle.info reclassified.** Palo Alto's URL filtering lookup (urlfiltering.paloaltonetworks.com)
  now shows `Computer-and-Internet-Info`, Low-Risk — no malware/adware tag.
- **Google Safe Browsing** checked: `https://transparencyreport.google.com/safe-browsing/search?url=truegle.info`
  → "No unsafe content found."
- **DNS confirmed** resolving to real Cloudflare IPs (not the sinkhole); site returns HTTP 200.

### Step 1 — Fix Google Custom Search API 403  ✅ no redeploy needed
The key itself is being rejected with *"This project does not have access to Custom Search
JSON API."* — even when tested directly. The usual cause with multiple Google accounts is
that the API was enabled in the wrong account/project.
1. Go to **console.cloud.google.com**. In the **top-right avatar**, confirm you are signed
   into the account that owns project **`truegle-search` (project number `1004953436750`)**.
2. Top-left project picker → select **`truegle-search`** (confirm the number `1004953436750`).
3. **APIs & Services → Enabled APIs & services** → look for **"Custom Search API"**.
   - If it's NOT listed: **+ Enable APIs and Services** → search **"Custom Search API"** →
     **Enable**.
   - If it IS listed as enabled but search still 403s, wait ~5 min for propagation, then retest.
4. **Test it** (any browser), replacing `THE_KEY` with the value from
   **APIs & Services → Credentials → `Truegle Custom Search API Key` → Show key**:
   ```
   https://www.googleapis.com/customsearch/v1?key=THE_KEY&cx=54cdc3626cf504531&q=test
   ```
   - JSON with `"items": [...]` → fixed. (No redeploy needed; backend uses the same key.)
   - Still 403 → you're still in the wrong account/project, or it hasn't propagated.
5. (Optional) **programmablesearchengine.google.com** → engine `54cdc3626cf504531` → turn on
   **"Search the entire web"** for broader coverage.

### Step 2 — Publish Google OAuth consent screen
Legal pages now exist, so this is unblocked.
1. **console.cloud.google.com** → project `truegle-search` → **APIs & Services → OAuth
   consent screen**.
2. Under **Audience** (or **Publishing status**) → **Publish App** → confirm. Keep basic
   scopes (email, profile, openid) and **no logo** to avoid Google's verification review.
3. (Optional) Or, if you'd rather stay in Testing, add tester emails under **Test users**.

### Step 3 — Fix OAuth Branding
Same OAuth consent screen → **Branding**:
- ❌ Remove `truegle-search.pages.dev` (wrong).
- ✅ Add authorized domains: `truegle-search-15k.pages.dev`, `truegle.info`, `trumpafi.online`.
- Fill: **Home page** `https://truegle.info`, **Privacy** `https://truegle.info/privacy`,
  **Terms** `https://truegle.info/terms`.
- **Credentials → OAuth client `Truegle Search`** → confirm **Authorized redirect URI**
  `https://backend-seven-khaki-60.vercel.app/api/auth/google/callback`; add **JavaScript
  origins** `https://truegle.info` and `https://trumpafi.online`. Save.
- NOTE: the Google sign-in button stays hidden in the app until the frontend env
  `VITE_SOCIAL_AUTH_ENABLED=true` is set and the frontend is redeployed (ask Claude Code to
  do that once OAuth is published).

### Step 4 — AdSense review  ✅ ownership verified, ⏳ now in content review
DONE 2026-06-15: ownership verified (ads.txt + `<head>` snippet both live), **review
requested** — site shows "Getting ready". Nothing to do but **wait for Google's email**
(days–2 wk). Do NOT re-request repeatedly. If it later flips to "Low value content," that's a
content/crawlability problem → see Post-Prod #5 (content hub + SPA prerender), not ads.txt.

### Step 5 — Search Console + Bing Webmaster
**Google Search Console** (search.google.com/search-console):
1. **Add property** → `https://truegle.info`.
2. Verify via **DNS TXT** — add the TXT record in **Cloudflare → truegle.info → DNS**.
3. **Submit sitemap:** `https://truegle.info/sitemap.xml`.
4. **URL Inspection** → Request indexing for `/` and `/search`.

**Bing Webmaster** (bing.com/webmasters):
1. **Add site** → `truegle.info` → **Import from Google Search Console** (one click) or verify
   via DNS TXT.
2. Submit sitemap `https://truegle.info/sitemap.xml`.

### Step 6 — Swap Stripe to live keys (only when ready to charge real users)
**Vercel → project `backend` → Settings → Environment Variables:**
- `STRIPE_SECRET_KEY` → `sk_live_...` (Stripe → Developers → API Keys)
- `STRIPE_PUBLISHABLE_KEY` → `pk_live_...`
- `STRIPE_WEBHOOK_SECRET` → `whsec_...` (Stripe → Webhooks → `TruegleVercelWebhook`)
- Then **redeploy backend** (ask Claude Code, or `cd apps/backend && vercel deploy --prod --yes`).

### Step 7 — SearXNG as primary  ✅ DONE (2026-06-20)
SearXNG now runs on a persistent AWS host with a permanent Elastic IP. `SEARXNG_URL` set on the
Vercel backend, `SEARXNG_PRIMARY=true`, backend redeployed. Verified live: real search queries
return `source:"searxng"` results ahead of the paid API providers. See the SearXNG session-log
entry above for the verification details and the one known gap (`/api/search/health` doesn't
report a `searxng` field yet — cosmetic, not functional).

---

## 🛠️ DEPLOY TOPOLOGY & COMMANDS (for Claude Code / a computer)

**Frontend (Cloudflare Pages, project `truegle-search`):**
```
cd apps/frontend
NODE_OPTIONS='--max-old-space-size=4096' node ../../node_modules/vite/dist/node/cli.js build
wrangler pages deploy dist --project-name=truegle-search --branch=main --commit-dirty=true
```
**Backend (Vercel, project `backend`):**
```
cd apps/backend && vercel deploy --prod --yes
```
**Verify:**
```
curl https://truegle.info/            # 200
curl https://truegle.info/ads.txt     # valid
curl https://backend-seven-khaki-60.vercel.app/api/health          # {"status":"OK"}
curl https://backend-seven-khaki-60.vercel.app/api/search/health   # per-provider
```
CLIs authenticated: wrangler (o87enterprises@gmail.com), vercel (o87enterprises),
gh (o87enterprises-ai).

---

## 🏗️ PROJECT SHAPE & GOTCHAS

- **Monorepo:** `apps/frontend` (React 18 + Vite SPA, port 5173) + `apps/backend`
  (Node/Express, port 3001). DB: Neon PostgreSQL (`ep-spring-star-afnjwpg6-pooler`, us-west-2).
- **Live search page:** `apps/frontend/src/pages/UniversalSearch.jsx` (`/search`). Modes:
  Blue (standard), Green (Blue + AI-content-domain filter), Red (inverted mainstream),
  Purple (strict perspective filter), Ocean (OSINT only).
- **Language plumbing:** FE `SettingsContext` (`detectBrowserLanguage/Country`) →
  `filters.language/country` in the search POST → backend `validateFilters` →
  `performGoogleSearch` (lr/hl/gl) / `performBraveSearch` (search_lang/country) / News.
- **Repairs modal:** `components/ui/RepairsModal.jsx`, driven by `consecutiveFailuresRef`
  in `UniversalSearch.handleSearch` (threshold 2).
- **Gotchas:**
  - `services/WeatherService.js` exports a **singleton** — never `new` it.
  - If a fix "doesn't work live," suspect a **stale deploy** first; redeploy.
  - `.env*` is gitignored; `vite.config.js` hardcodes the live Vercel backend as the prod
    default so fresh clones build correctly.
  - Correct Pages domain is `truegle-search-15k.pages.dev` (NOT `truegle-search.pages.dev`).
  - Dead/legacy files safe to delete: `OSINTMode.jsx`, `SearchResults.jsx`, `SearchPortal*`,
    `BiasedResults.jsx`, `ResultsPage.jsx`, `components/SearchResults.jsx`,
    `components/ui/SearchResultsContainer.jsx`.

---

## 🏭 PRODUCTION TASKS (launch-critical — no particular order)
_Things needed to be fully "launched." Most are the browser steps above; a couple are code._
- [x] **GET truegle.info UN-SINKHOLED** — ✅ done, verified 2026-06-21. Palo Alto category is
      clean (`Computer-and-Internet-Info`, Low-Risk), Google Safe Browsing shows no issues, DNS
      resolves to Cloudflare. See "AD STRATEGY → Cleanup".
- [ ] **Monetize the RIGHT way** — AdSense (in review) + later a reputable network
      (Ezoic/Mediavine/Raptive) or direct/affiliate. **Never** Monetag/Adsterra/instant-approval
      push-popunder again (they caused the sinkhole). See "AD STRATEGY".
- [ ] **Google Custom Search API 403/quota** — fix under correct account + enable billing
      (Browser Step 1).
- [ ] **Re-enable real auth (later)** — fix the registration **12-char password** mismatch, flip
      `FREE_ACCESS_MODE=false` + `OAUTH_ENABLED=true`, publish OAuth + fix branding (Steps 2–3),
      set `VITE_SOCIAL_AUTH_ENABLED=true`, redeploy. (Deferred — site is intentionally free now.)
- [ ] **AdSense** — in review; monitor email (Browser Step 4). Stacks with Monetag/Adsterra.
- [ ] **Search Console + Bing Webmaster** — add property, verify, submit sitemap (Browser Step 5).
- [ ] **Stripe live keys** — swap on Vercel + redeploy when ready to charge (Browser Step 6).
- [ ] **Reconnect Cloudflare Pages ↔ GitHub** — lockfile is fixed (`b6defba`), so re-enable
      auto-deploy: Pages → `truegle-search` → Settings → Git → Connect (build/output settings in
      "Known operational notes").
- [x] **`SEARXNG` persistent host** — ✅ done 2026-06-20. AWS Elastic IP host, `SEARXNG_PRIMARY=true`,
      verified live. Optional follow-up: add `searxng` to `SearchService.getHealthStatus()`.

---

## 🚀 POST-PRODUCTION TASKS (optimization & hardening — no particular order, EXCEPT #1 first)

> _Site is ~32,440 monthly requests. Current est. $100–$400/mo. Target $500–$1,500+/mo._

### ⭐ 1. AD MONETIZATION (REPUTABLE ONLY)  ← un-sinkhole the domain first
**The Monetag/Adsterra base was removed** (it sinkholed the domain — see "AD STRATEGY"). The
only ad code left is **Google AdSense** (`AdSenseAd.jsx`, sidebar). Rebuild monetization on
reputable rails only:

**Order of operations:**
1. ~~Un-sinkhole `truegle.info` first~~ ✅ **done, verified 2026-06-21** (clean Palo Alto category +
   Safe Browsing) — no longer a blocker for ad work.
2. **Get AdSense approved** (Step 4) — primary revenue. Then add AdSense units to high-value
   slots: a **Hero slot** below the AI summary (highest CPM), **in-SERP** after every 3rd
   result, and a **sticky 300×600** desktop sidebar — all via `<AdSenseAd>` (reuse the existing
   component; do NOT introduce other networks' scripts).
3. **At scale, apply to a vetted ad-management network** (Ezoic → Mediavine/Raptive). These do
   real review and won't blocklist the domain; they can run header bidding with AdSense.
4. **Direct sponsorships / privacy-tool affiliates** — on-brand, zero malvertising risk.

**CPM optimizations (AdSense-safe):** `<link rel="preconnect" href="https://pagead2.googlesyndication.com">`
in `<head>`; lazy-load slots via `IntersectionObserver`; sticky sidebar via
`position: sticky; top: 20px`. **Avoid** auto-refresh/popunder/push patterns that violate
AdSense policy.

**❌ Do NOT re-introduce** Monetag (`3nbf4.com`/`libtl.com`), Adsterra
(`highperformanceformat.com`/`profitablecpmrate.com`), or any instant-approval push/popunder
network — that is what got the domain sinkholed.

**Rewarded-tokens note:** the backend rewarded endpoints still exist
(`/api/tokens/ad-session` + `/earn/ad`, 25s min, 6/hr cap) but the FE button + its Monetag SDK
were removed. If you ever want rewarded ads back, wire them to an **AdSense-approved rewarded
format** or a vetted network — never Monetag.

### 2. SECURITY AUDIT
Full defensive review before/with real users. Scope: authn/authz (JWT issuance + the
`tokenDenylist` revocation, session handling), input validation on all `/api/*` routes,
injection (SQL via Neon queries, SSRF in OSINT/proxy + `osint-proxy.js`, command/eval in the
`calculation` instant-answer), rate limiting, CORS/Helmet/CSP headers (`middleware/security.js`),
secrets handling (all keys are Vercel env — confirm none leak to the client bundle), payment
webhook signature verification, and dependency CVEs (`npm audit`). Produce a findings list +
severity, then patch.

### 3. THOROUGH CODE REVIEW
End-to-end quality pass (separate from security). Hotspots: oversized pages
(`UniversalSearch` ~1k lines, `BiasedResults` ~1.15k) → extract sub-components; error handling
+ retries in `SearchService` provider calls; dead/legacy file deletion; consistent env config;
test coverage for the search pipeline + token/payment flows. Consider running `/code-review`
(or `/code-review ultra`) on the branch.

### 4. PENETRATION TESTING (own agents) + patch vulnerabilities
Authorized pentest of the live stack with your own agents — probe auth bypass, token/freemium
abuse (earning tokens without watching ads, replaying ad-sessions), OSINT endpoint abuse/SSRF,
IDOR on account/payment routes, rate-limit evasion, XSS via search results/AI summary
rendering, and the Stripe webhook. Triage findings with #2, then patch any unnoticed vulns.

### 5. ADSENSE APPROVAL-READINESS — content + crawlability
If/when the review returns "Low value content": (a) **Content hub "The Bias Report"**
(`/bias-report`) — original case studies of search-engine bias (on-brand, AI-citation bait);
(b) **SPA prerendering** (react-snap / vite-plugin-ssg) for `/`, `/search`, `/privacy`,
`/terms`, `/about` so crawlers see real text, not an empty `<div id="root">`.

### 6. SEO / AEO / GEO
`WebSite` + `SearchAction` JSON-LD on home; `FAQPage` schema wrapping the quick-result cards;
prerender (shared with #5). Goal = eligibility for AI Overviews / AI citation.

### 7. FEATURE BACKLOG (post-launch, abridged)
Listings modal (clickable phone/email/hours) · turn-by-turn nav · podcasts category ·
multi-country/auto-translate result cards · "Take a tour" onboarding · set-as-default-search /
homepage · Share-for-Premium (24 hr access) · AI-summary follow-up input · social category
expansion (YT/FB/TikTok/IG in-app viewer) · remember-me auth · neutral-tier collapsed by
default. (Full list in prior email handoff.)

### 8. CLEANUP
Delete dead files (`OSINTMode.jsx`, `SearchResults.jsx`, `SearchPortal*`, `BiasedResults.jsx`,
`ResultsPage.jsx`, `components/SearchResults.jsx`, `components/ui/SearchResultsContainer.jsx`);
resolve `npm audit` advisories.

---

## 📋 QUICK REFERENCE
| Item | Value |
|------|-------|
| Frontend URL | `https://truegle.info` |
| Backend URL | `https://backend-seven-khaki-60.vercel.app` |
| Cloudflare Pages project | `truegle-search` |
| Pages default domain | `truegle-search-15k.pages.dev` |
| GitHub repo | `o87enterprises-ai/TruegleSearch` |
| Google Cloud project | `truegle-search` (number `1004953436750`) |
| Google OAuth client | `Truegle Search`, ID starts `1004953436750-0a1ni3p4...` |
| OAuth callback | `https://backend-seven-khaki-60.vercel.app/api/auth/google/callback` |
| Custom Search Engine ID (cx) | `54cdc3626cf504531` |
| GCP API key name | `Truegle Custom Search API Key` |
| AdSense publisher | `pub-9542137900411519` — ⚠️ **AdSense REMOVED 2026-06-17** (rejected; first-party ads now). |
| Ads (current) | First-party house ads (`config/houseAds.js` + `HouseAd`/`AdSlot`) + Impact affiliates + `/advertise` direct-sell. Advertiser contact = mailto `truegleai@proton.me`. |
| NVIDIA AI key | `NVIDIA_API_KEY` (Vercel) · model `nvidia/nemotron-3-ultra-550b-a55b` · base `https://integrate.api.nvidia.com/v1` |
| Impact verification | `<meta name="impact-site-verification" value="ccda0e8a-fd60-4ba7-a741-c4f9f625aa7f">` (live in `index.html`) |
| Ad env vars (Cloudflare Prod) | 🛑 **DELETE if present** — `VITE_MONETAG_ZONE` · `VITE_MONETAG_REWARDED_ZONE` · `VITE_ADSTERRA_SOCIALBAR_SRC` · `VITE_ADSTERRA_BANNER_KEY` (Monetag/Adsterra removed; signal intent to re-add). First-party ads need no env var. |
| Free-access flags (code) | `apps/frontend/src/config/access.js` → `FREE_ACCESS_MODE`, `OAUTH_ENABLED` |
| Stripe webhook | `TruegleVercelWebhook` → `/api/payment/webhook` (8 events) |
| Neon DB | `ep-spring-star-afnjwpg6-pooler` (us-west-2) |
| Cloudflare nameservers | `journey.ns.cloudflare.com` + `newt.ns.cloudflare.com` |
| IONOS / Cloudflare / Vercel / GitHub accounts | `o87enterprises@gmail.com` · same · `o87enterprises` · `o87enterprises-ai` |
| Sitemap | `https://truegle.info/sitemap.xml` |
