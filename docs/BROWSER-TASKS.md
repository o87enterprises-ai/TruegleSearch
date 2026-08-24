# Browser tasks

**Updated 2026-08-24.** Four tasks, ~12 minutes total. Do them in order.

Everything else is already done in code and deployed.

---

## 1 — Fix www duplicate URLs (5 min) ⭐ biggest SEO win

Search Console shows your homepage indexed as **three separate URLs**:
`https://truegle.info/`, `http://www.truegle.info/`, `https://www.truegle.info/`.
Google splits ranking credit across all three, so each is weaker than one
consolidated page would be.

I fixed the trailing-slash half of this in code. The `www` half can't be fixed
in code — Cloudflare Pages `_redirects` matches on path only, never on hostname.
It needs a dashboard rule.

1. **dash.cloudflare.com** → select `truegle.info`
2. Left sidebar → **Rules** → **Redirect Rules** → **Create rule**
3. Name: `www to apex`
4. **If** → *Custom filter expression* → set:
   - Field: **Hostname** · Operator: **equals** · Value: `www.truegle.info`
5. **Then** → *Dynamic redirect*:
   - Type: **Dynamic**
   - Expression: `concat("https://truegle.info", http.request.uri.path)`
   - Status code: **301**
   - ✅ tick **Preserve query string**
6. **Deploy**

**Check it worked:** open `https://www.truegle.info/about` — the address bar
should land on `https://truegle.info/about`.

---

## 2 — Resubmit the sitemap (1 min)

The sitemap and the canonical tags disagreed on trailing slashes, which is what
made Google index `/about/` and `/about` as two pages. That's fixed and
deployed — Google just needs to re-read it.

1. **search.google.com/search-console** → your property
2. **Sitemaps** → click the existing `sitemap.xml` row → **⋯** → **Remove**
3. Re-enter `sitemap.xml` → **Submit**

*(Removing and re-adding forces a re-crawl rather than waiting for the schedule.)*

---

## 3 — Which engines does your SearXNG have? (2 min)

Your rabbit-hole results were **entirely `mwmbl`** — wallpapers, clip art, and a
page about the wrong ship. Mojeek, Marginalia and Brave contributed nothing, and
mwmbl is the smallest index of the set.

I've fixed the code so one weak engine answering can no longer masquerade as a
full page. But I still need to know what your instance actually has.

Open:

```
http://44.236.219.63:8888/config
```

*(If it doesn't load, get the URL from Vercel → project `backend` → Settings →
Environment Variables → `SEARXNG_URL`.)*

Ctrl-F for each of these and tell me **yes/no**:

- `mojeek`
- `marginalia`
- `mwmbl`
- `brave`
- `duckduckgo`

If some are missing, that's fine — it's an env var change, not code.

---

## 4 — Re-test the search modes (3 min)

Same query in both modes, e.g. `uss abraham lincoln conditions`.

**Blue** — news should now lead. YouTube and Dailymotion were outranking BBC and
NYT; they're now weighted below web results. They should still *appear*, just
lower. If a video is still first, tell me.

**Red** — should return different sites from blue, and should no longer be
100% mwmbl.

---

## Done in code, nothing needed from you

- Ads removed entirely; zero cookies; no consent banner
- Thin result pages (was capping at five results)
- Modes retrieving from different engines, not just re-sorting
- Engine-coverage check so one weak engine can't carry a mode
- Blue-mode ranking: web results lead, platforms weighted below
- Sitemap/canonical trailing-slash mismatch
- Cloudflare Web Analytics (live)
- Search Console + Bing (live)

## About ranking on Google

There is no switch for this, and anyone selling you one is lying.

Your Search Console data says you rank for `truegle.info` and essentially
nothing else — 16 clicks and 84 impressions in three months, no topical query at
all. Tasks 1 and 2 fix the self-inflicted part: you were splitting your own
ranking credit across up to six URLs per page. That's real, and it's worth doing
today.

The rest is not a technical problem. Google ranks pages it has reasons to trust,
and those reasons are links from other sites and content that answers a question
nobody else answers. A search engine's own homepage is a hard thing to rank —
your blog posts are the realistic path, because they can rank for questions
rather than for a brand name. That is a months-long content effort, not a
setting.

One anomaly worth knowing: **desktop CTR is 2.22%, mobile is 38.46%** — despite
desktop ranking *better*. Same content, 17× worse click-through. That usually
means the title or description reads badly at desktop width. Worth a look once
the duplicates are consolidated and the numbers are trustworthy.
