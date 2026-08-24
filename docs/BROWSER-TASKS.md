# Browser tasks — things only you can do

Three tasks, ~20 minutes total. Do them in any order. Task 3 is the quickest and
tells you whether the last deploy worked, so it's a reasonable place to start.

**Note on hosting:** `truegle.info` is served by **Cloudflare Pages** (project
`truegle-search`), following the Git-connected `main` branch. Vercel hosts only
the backend API. Frontend environment variables therefore go in **Cloudflare
Pages**, not Vercel.

---

## 1 — Turn on Cloudflare Web Analytics

The analytics code is already deployed but loads **nothing** until this token
exists. Cookieless, no fingerprinting, and it skips anyone sending Do Not Track.

1. Go to **dash.cloudflare.com** → log in.
2. Left sidebar → **Analytics & Logs** → **Web Analytics**.
3. Click **Add a site**. Enter `truegle.info`.
4. Cloudflare shows a JavaScript snippet. You do **not** need the snippet —
   only the token inside it. It looks like:
   `<script ... data-cf-beacon='{"token": "abc123def456..."}'></script>`
   **Copy just the token value** (the `abc123def456...` part, no quotes).
5. Go to **Workers & Pages** → **truegle-search** → **Settings** →
   **Environment variables**.
6. Under **Production**, click **Add variable**:
   - Name: `VITE_CF_BEACON_TOKEN`
   - Value: the token you copied
7. **Save**.
8. Go to the **Deployments** tab → find the latest deployment →
   **⋯** menu → **Retry deployment**.
   *(This is required. The variable is read at build time, so it does nothing
   until the site is rebuilt.)*

**Confirm it worked:** load `truegle.info`, then check Web Analytics in ~5
minutes. You should see at least one page view. If it stays at zero, the token
didn't make it into the build — re-check step 6 was under **Production** and
that you redeployed.

---

## 2 — Set up Google Search Console (and Bing)

This is the only authoritative source for how you actually rank: real
impressions, clicks, the queries people use, and average position. It also gives
you Coverage — Google's own technical audit of the site, which is worth more
than any SEO vendor's screenshot.

### Google Search Console

1. Go to **search.google.com/search-console**.
2. Click **Add property** → choose the **Domain** option (left box, not URL
   prefix). Enter `truegle.info`.
3. Google shows a **TXT record** to add. Copy its value.
4. In a new tab: **dash.cloudflare.com** → select `truegle.info` → **DNS** →
   **Records** → **Add record**:
   - Type: `TXT`
   - Name: `@`
   - Content: the value Google gave you
   - **Save**
5. Back in Search Console, click **Verify**. *(If it fails, wait 5 minutes for
   DNS to propagate and try again — this is normal.)*
6. Once verified: left sidebar → **Sitemaps** → enter `sitemap.xml` → **Submit**.
   *(It contains 29 URLs.)*
7. Left sidebar → **URL Inspection** → paste `https://truegle.info/` →
   **Request indexing**. Repeat for `https://truegle.info/search`.

**Data note:** Search Console shows nothing for the first 2–3 days, and takes
about a week to become useful. That's expected — don't read anything into an
empty dashboard on day one.

### Bing Webmaster Tools

8. Go to **bing.com/webmasters**.
9. Choose **Import from Google Search Console** and authorise it.
   That's the whole task — it carries the property and sitemap across in one
   click, and covers Bing, Yahoo and DuckDuckGo.

---

## 3 — Confirm the last deploy landed

Two search fixes shipped to `main`. I can't reach the live site from my
environment to check, so this needs your eyes.

1. Go to **dash.cloudflare.com** → **Workers & Pages** → **truegle-search** →
   **Deployments**. Confirm the most recent deployment **succeeded** and its
   commit message mentions removing advertising or curated lists.
2. Open `truegle.info` and search for something ordinary — `how do solar panels
   work` is a good test.

**What to look for:**

- **Fuller results.** Pages used to cap at five results when SearXNG answered
  first. You should now see a full page.
- **Modes differ.** Run the *same* query in blue mode, then red/rabbit-hole.
  The result lists should now be **visibly different** — different sites, in a
  different order. Previously they were identical.
- **No ads anywhere.** No banners, no "Sponsored" boxes, no cookie-consent
  popup at the bottom. If you see any of those, the deploy is stale.

Tell me what you see. If modes still look identical, that's useful information
and I'll dig further.

---

## Not needed from you

- Nothing on the home PC tower yet — the search-index project waits on
  persistence, and there's no rush.
- No spend. Everything above is free.
