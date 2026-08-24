# Browser tasks — things only you can do

**Updated 2026-08-24.** Task 1 is done. Three left, ~20 minutes.

Task 4 is new and matters most: it decides whether the search work that just
shipped actually does anything.

---

## ~~1 — Cloudflare Web Analytics~~ ✅ DONE

Confirmed live. The Core Web Vitals and element-level data in your dashboard can
only come from the browser beacon, so the token took and the site rebuilt.
Nothing more to do here.

---

## 2 — Google Search Console (and Bing)

The only authoritative source for how you actually rank: real impressions,
clicks, the queries people use, average position, and Coverage — Google's own
technical audit of the site.

1. **search.google.com/search-console**
2. **Add property** → pick the **Domain** option (left-hand box, not URL prefix).
   Enter `truegle.info`.
3. Google shows a **TXT record**. Copy its value.
4. New tab → **dash.cloudflare.com** → `truegle.info` → **DNS** → **Records** →
   **Add record**:
   - Type `TXT` · Name `@` · Content: the value from Google → **Save**
5. Back in Search Console → **Verify**. *(If it fails, wait 5 minutes for DNS and
   retry — normal.)*
6. **Sitemaps** → enter `sitemap.xml` → **Submit**. *(29 URLs.)*
7. **URL Inspection** → `https://truegle.info/` → **Request indexing**.
   Repeat for `https://truegle.info/search`.

**Then Bing:** **bing.com/webmasters** → **Import from Google Search Console** →
authorise. One click, and it covers Bing, Yahoo and DuckDuckGo.

**Expect nothing for 2–3 days.** Search Console backfills slowly; an empty
dashboard tomorrow means nothing is wrong.

---

## 3 — Does search actually look fixed?

Three things shipped. Open `truegle.info` and search something ordinary —
`how do solar panels work` works well.

**a. Fuller pages.** Results used to cap at five whenever SearXNG answered first.
You should now get a full page.

**b. Modes differ.** Run the **same query** in blue, then in red / rabbit-hole.
The lists should now be **visibly different sites in a different order**. This is
the one that matters — they used to be identical.

**c. No ads anywhere.** No banners, no "Sponsored" boxes, no cookie-consent popup.
If you see any of those, the frontend deploy is stale.

Tell me what you see, especially for (b).

---

## 4 — Which engines does your SearXNG actually have? ⭐ NEW

**Why this matters:** red-pill mode now queries `mojeek, brave, marginalia,
mwmbl, duckduckgo` instead of Google and Bing — that is the entire reason the
rabbit hole can return anything the other modes can't. But those names only work
if your instance has those engines **enabled**. If it doesn't, the code silently
falls back to the default engines and red-pill goes back to looking like blue.

So if task 3(b) shows the modes still looking similar, this is almost certainly why.

**How to check** — open this in a browser:

```
http://44.236.219.63:8888/config
```

*(If that doesn't load, use whatever URL `SEARXNG_URL` is set to on the Vercel
backend — Vercel dashboard → project `backend` → Settings → Environment
Variables.)*

It returns JSON. Use your browser's find (Ctrl-F / Cmd-F) and tell me
**yes or no for each**:

- `mojeek`
- `marginalia`
- `mwmbl`
- `brave`
- `duckduckgo`

You're looking for each name with `"enabled": true` nearby. If the page is huge,
searching for just the engine name and telling me whether it appears at all is
enough to start.

**If some are missing**, that's fine and expected — I'll point the mode at
engines you do have. There's an env var per mode (`SEARXNG_ENGINES_RED_PILL`)
so it's a settings change, not a code change.

---

## What I'll do with the answers

- **Task 3(b) + task 4** → confirm red-pill genuinely diverges, or repoint it at
  engines your instance has.
- Then the performance work: search-box responsiveness (INP), layout shift on the
  results grid (CLS), and the YouTube-thumbnail load tail (LCP).

## Not needed from you

Nothing on the home PC. The search-index project waits on persistence and there's
no rush. No spend on any of the above.
