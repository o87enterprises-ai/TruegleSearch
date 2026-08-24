# Building Truegle's own SERP on an open-source backbone

**Status:** research document, 2026-08-24. Nothing here is built.
**Verification caveat:** this session's network egress is policy-blocked, so no
link below was fetched or re-checked live. Project facts come from knowledge
current to ~May 2026. **Re-verify version numbers, licences, hardware figures
and "is it still alive" before committing to anything.** Every claim that drives
a build decision is marked ⚠️ where it most needs re-checking.

---

## 0. The correction you asked for

You said you were under the impression that the SearXNG cloud setup gave full
internet access without gatekept API keys, and that I told you otherwise. Half of
that needs correcting, and the important half does not.

**SearXNG does not need API keys.** That is plainly true in this codebase:
`config/env.js:158` says "SearXNG self-hosted instance URL (no API key
required)", `SearchService.js:70` says "no API key needed", and
`performSearXNGSearch()` (`SearchService.js:1213`) sends only `q`, `format`,
`pageno` and `safesearch`. No key, no credential. It is currently **primary** —
`SEARXNG_PRIMARY=true`, and the paid providers only run when SearXNG returns
fewer than `SEARXNG_PRIMARY_MIN` (default 5) results.

**But SearXNG has no index of its own.** It is a *metasearch* proxy: it forwards
your query to other engines, scrapes their result pages, and merges what comes
back. Notably, our request sends **no `engines` parameter**, so the instance uses
whatever its `settings.yml` enables — by default Google, Bing, DuckDuckGo, Brave,
Startpage, Qwant, Wikipedia and friends.

So the accurate statement is narrower than "it needs API keys" and worse than
"we have full access to the internet":

> Truegle reaches the web **without paying for keys**, but every result still
> originates from Google, Bing, or a handful of others. We removed the toll
> booth, not the gatekeeper. Their index, their crawl, their ranking, their
> decisions about what exists.

That is the real ceiling, and it is exactly why your results look the way they
do. It is also why "build our own SERP" is the only thing that actually changes
it. Two further consequences worth naming:

- **Rate limits and CAPTCHAs, not billing, are the failure mode.** Google and
  Bing actively block datacenter IPs. The AWS host will get CAPTCHA-walled
  under load — the same class of problem already documented for YouTube in
  `docs/YOUTUBE-ACCESS.md`. Free does not mean reliable.
- **`GOOGLE_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID` are still `.required()` at
  boot** (`config/env.js:17-22`). The backend refuses to start without them even
  though SearXNG serves the traffic. That is a leftover from before SearXNG went
  primary and should be relaxed to `.optional()` — it currently forces a
  credential for a provider that is 403ing anyway.

---

## 1. What "our own SERP" actually means

Three tiers, increasing independence and cost. Be honest about which one you
want, because the jump from 2 to 3 is enormous.

| Tier | What it is | Independence | Realistic cost |
| --- | --- | --- | --- |
| **1. Metasearch** (today) | Proxy other engines' results | None — their index | $0, but rate-limited |
| **2. Own index, scoped** | You crawl and index a curated slice of the web | Real, bounded | Low hundreds $/yr, one box |
| **3. Own index, general** | You crawl and index the open web broadly | Full | $10k+/yr minimum, realistically much more |

**Tier 3 at Google's scale is not achievable** — Google's index is widely
estimated in the hundreds of billions of pages, backed by custom datacenters. No
open-source project matches it and none will. Anyone selling you otherwise is
selling something.

**Tier 2 is genuinely achievable by one person**, and there is direct proof:
Marginalia Search (below) is a single-developer open-source engine with its own
crawler and index, running on self-hosted consumer hardware. It is the existence
proof that the interesting version of this is real.

---

## 2. The pipeline you would have to build

Every general search engine is the same six stages. You need all six; skipping
one just means someone else does it for you (which is Tier 1).

```
   ┌──────────┐   ┌─────────┐   ┌──────────┐   ┌───────┐   ┌─────────┐   ┌───────┐
   │ 1 FRONTIER│──▶│ 2 FETCH │──▶│ 3 EXTRACT│──▶│ 4 INDEX│──▶│ 5 RANK  │──▶│6 SERVE│
   │ URL queue │   │ polite  │   │ text +   │   │inverted│   │relevance│   │  API  │
   │ + dedup   │   │ robots  │   │ links    │   │ index  │   │ + signals│  │  + UI │
   └──────────┘   └─────────┘   └──────────┘   └───────┘   └─────────┘   └───────┘
        ▲                             │
        └─────── discovered links ────┘
```

### Stage 1–2 — Crawl (frontier + fetcher)

You need a URL frontier, politeness (per-host rate limiting), `robots.txt`
compliance, retry/backoff, and dedup by URL and content hash.

| Option | Language | Licence ⚠️ | Notes |
| --- | --- | --- | --- |
| **Common Crawl** | — (data) | Open data | **Not a crawler — an existing corpus.** Skips stages 1–2 entirely. See §3. |
| **Apache Nutch** | Java | Apache-2.0 | The classic. Hadoop-oriented, heavyweight, mature. |
| **StormCrawler** | Java | Apache-2.0 | Apache Storm-based, lower latency than Nutch, actively used. |
| **Heritrix** | Java | Apache-2.0 | Internet Archive's crawler. Archival-grade, WARC-native. |
| **Scrapy** (+ Frontera) | Python | BSD-3 | Easy to start, needs work to scale politely. |
| **Crawlee** | Node/Python | Apache-2.0 | Modern, good browser-rendering story. |

**The hard part is not the code — it is politeness and IP reputation.** Crawling
from a datacenter IP gets you blocked or reported. You must honour `robots.txt`,
set an identifying User-Agent with a contact URL, rate-limit per host, and be
prepared for abuse complaints to your provider.

### Stage 3 — Extraction

HTML → clean main text + links + metadata. Boilerplate removal matters enormously
for quality.

- **trafilatura** (Python, Apache-2.0 ⚠️) — best-in-class main-content extraction.
- **Mozilla Readability** (JS, MPL-2.0) — what Firefox Reader Mode uses.
- **resiliparse** / **jusText** / **Dragnet** — boilerplate removal.
- **warcio** (Python) / **jwarc** (Java) — read/write WARC archives.
- Language ID: **CLD3**, **fastText lid**, **lingua**.

### Stage 4 — Index

An inverted index with BM25 is the baseline. This is the most mature part of the
stack — you have excellent choices.

| Engine | Language | Licence ⚠️ | Fit for a web index |
| --- | --- | --- | --- |
| **Apache Lucene** | Java | Apache-2.0 | The foundation under most of the others. Maximum control. |
| **Apache Solr** | Java | Apache-2.0 | Lucene + server. Battle-tested, self-hostable. |
| **OpenSearch** | Java | Apache-2.0 | Elasticsearch fork; **stayed Apache-2.0** when ES went SSPL. Prefer this over ES for licence sanity. |
| **Vespa** | Java/C++ | Apache-2.0 | Yahoo's. Best-in-class for hybrid text+vector ranking at scale. Steep. |
| **Tantivy** | Rust | MIT | Lucene-like, very fast, low resource. Good single-box choice. |
| **Quickwit** | Rust | AGPL-3.0 ⚠️ | Tantivy-based, object-storage-native (index on S3/R2 — cheap storage). |
| **Manticore** | C++ | GPL-2.0 | Sphinx successor, very fast, low memory. |
| **Meilisearch / Typesense** | Rust / C++ | MIT / GPL-3.0 | Superb for site search; **not designed for a general web index**. Don't. |

**Recommendation for Truegle: Tantivy or OpenSearch.** Tantivy if you want one
efficient box and are willing to write Rust glue; OpenSearch if you want batteries
included and operational familiarity.

### Stage 5 — Ranking

BM25 gets you a usable baseline for free (built into every engine above). Beyond
that:

- **Link graph** — PageRank / HITS over the crawled link structure. This is what
  made Google Google. Computable with `networkx` (small), **Apache Spark GraphX**
  or **igraph** (large).
- **Host quality signals** — spam classification, ad density, template-to-text
  ratio, domain age. Marginalia's whole differentiator is aggressively
  down-ranking commercial/SEO-optimised pages.
- **Semantic / vector retrieval** — sentence embeddings (`bge-*`, `e5-*`,
  `all-MiniLM` via **sentence-transformers**, Apache-2.0 ⚠️) in **FAISS**
  (MIT), **hnswlib**, **Qdrant** (Apache-2.0) or Vespa. Hybrid BM25 + vector
  ("reciprocal rank fusion") is the current standard for quality.
- **Learning to rank** — needs click data you don't have yet. Later.

### Stage 6 — Serve

You already have this: `SearchService` → `/api/search` → the React frontend.
Swapping the backend from SearXNG to your own index is a provider change inside
`SearchService`, not a rewrite. That is a genuinely good position to be in.

---

## 3. The shortcut that changes the economics: Common Crawl

⚠️ **Verify current size, cadence and access terms before planning around this.**

**Common Crawl** (commoncrawl.org) publishes a free, openly-licensed crawl of the
web — roughly monthly, on the order of **~2.5–3 billion pages per crawl**, hosted
as WARC/WAT/WET files in a public S3 bucket. It is the single most important fact
in this document, because **it removes stages 1–2 entirely.**

You do not have to crawl the web to have a web index. You can index someone
else's legally-shared crawl.

- **WET files** are pre-extracted plain text — they skip stage 3 too.
- **Columnar index** (Parquet) lets you filter by domain/language/status before
  downloading anything.
- Data is free; **egress and compute are not.** Processing a full crawl in AWS
  means either paying for compute in-region, or paying egress to pull it out.

**This is the realistic path to a genuine Truegle index**: filter Common Crawl to
a defensible slice (say English + a curated domain set, or everything *except*
the SEO-farm long tail), index that with Tantivy/OpenSearch, rank with BM25 +
your own quality signals. That is Tier 2, and it is reachable.

---

## 4. Prior art — read these before writing any code

These are the projects that have actually done it. ⚠️ Confirm each is still
maintained.

| Project | What it proves | Licence ⚠️ |
| --- | --- | --- |
| **Marginalia Search** (search.marginalia.nu) | **The key reference.** One developer, own crawler, own index, self-hosted consumer hardware, deliberately ranks *against* SEO-optimised commercial content. Open source (AGPL-3.0). Its philosophy is close to Truegle's stated mission. | AGPL-3.0 |
| **Mwmbl** (mwmbl.org) | Non-profit, open-source, community-powered crawl + index, deliberately tiny resource footprint. | AGPL-3.0 |
| **Stract** (stract.com) | Open-source Rust search engine with its own crawler and index; exposes ranking controls to the user. | AGPL-3.0 |
| **OpenWebSearch.eu** | EU-funded initiative building a shared **Open Web Index** as public infrastructure, explicitly to break the Google/Bing duopoly. Potentially the highest-leverage thing to track. | Varies |
| **YaCy** | Fully peer-to-peer, decentralised index. Long-lived. Quality is the known weak point. | GPL-2.0 |
| **SearXNG** | What you run today — metasearch, no index. | AGPL-3.0 |

**Independent indexes with APIs** (still someone else's index, but *not*
Google/Bing — genuine diversity for a metasearch blend):

- **Mojeek** — UK, own crawler and index, has an API. ⚠️ Check current free tier.
- **Brave Search** — own index (from the Tailcat acquisition); already in this
  codebase as `BraveSearchService`. Free tier exists. ⚠️ Check quota.
- **Right Dao**, **Gigablast** ⚠️ (may be defunct), **Teclis/Wiby** (small,
  curated, non-commercial web).

---

## 5. Three concrete paths for Truegle

### Path A — "Fix what you have" · $0 · days
Not your own SERP, but it removes the Google/Bing monoculture and is by far the
best effort-to-quality ratio available right now.

1. Set an explicit `engines` list in the SearXNG request instead of the instance
   default — deliberately include **Mojeek**, **Brave**, **Marginalia** (SearXNG
   ships engine modules for these ⚠️ verify) alongside the majors.
2. Blend Mojeek + Brave directly as providers in `SearchService`.
3. Fix the ranking problems in §6 below, which are costing you more result
   quality than the index choice is.

### Path B — "Curated own index" · ~$5–20/mo · weeks
The honest version of independence at your scale.

1. Pick a scope: a curated seed list of a few thousand high-quality domains
   (independent media, primary sources, academic, technical) — the anti-SEO web.
2. Crawl with **Crawlee** or **StormCrawler**, extract with **trafilatura**,
   store as WARC.
3. Index into **Tantivy** (single box) — a few million documents fits on
   commodity hardware comfortably.
4. Serve as a new provider in `SearchService`, blended with metasearch.
5. Rank with BM25 + your own quality signals.

**This is the recommended path.** It produces something no other engine has,
matches the mission, and is operable by one person. A curated index of 1–5M
genuinely good pages beats a bad index of 500M.

### Path C — "Common Crawl general index" · $100s–1000s/mo · months
Tier 3-lite. Only if Path B works and you want to scale.

1. Filter the Common Crawl columnar index to your target slice.
2. Process WET/WARC with Spark, or stream-process incrementally.
3. Index into **Quickwit** (object-storage-native — index lives on R2/S3, which
   is the cheap way to hold something this size).
4. Compute a link graph and PageRank over the WAT link data.
5. Hybrid BM25 + vector retrieval.

⚠️ Storage and compute dominate cost here and will break a $0 budget. Do not
start Path C without a funding answer.

---

## 6. Before any of that: your ranking is broken in a way that looks like an index problem

This is the answer to "why does one query across all the different pages pull
mainly the same results in the same order," and it is **not** an index problem.
A new index would not fix it. Details and proof are in the session notes; the
short version:

1. **Every mode retrieves the identical candidate set.** Modes are post-processing
   over one shared result list, not different searches. Same query string, same
   providers.
2. **The bias classifier knows 115 hardcoded domains**
   (`SearchService.detectBias`, ~line 1766). Everything else falls through to
   `'neutral'` unless the title/snippet happens to contain politically-charged
   keywords.
3. **Therefore red-pill's re-ranking is mathematically a no-op on ordinary
   queries.** `boostAlternative` computes
   `finalScore = finalScore * 0.6 + biasTierWeight(bias) * 0.4`. When every
   result is `'neutral'`, `biasTierWeight` is a constant 0.5, so the transform is
   `0.6x + 0.2` — strictly increasing, applied uniformly. **Sort order cannot
   change.** Verified empirically: identical ordering, scores shifted by exactly
   that affine transform.
4. Purple filters to a bias set that is usually empty; green only strips
   AI-content domains; blue only pins the official result on brand queries.

So on any non-political query — which is most queries — all modes return the same
list in the same order, by construction.

**Fix this first.** It is cheap and it is the actual complaint. Options, in order
of value:

- **Retrieve differently per mode, don't just re-sort.** Send different queries
  or different engine sets per mode. This is the real fix — a "perspective" that
  only reorders a Google-derived list is still Google's worldview.
- **Replace the 115-domain map** with a real source-characteristics dataset, or a
  classifier over page content, so labels actually populate.
- **Make `neutral` not equal the default.** Right now unlabelled and explicitly-
  neutral are indistinguishable (both 0.5) — you cannot tell "we assessed this as
  centrist" from "we have no idea."
- **Feed `engines` per mode to SearXNG.** Free, immediate diversity.

---

## 7. Sources

⚠️ None fetched this session (egress blocked). Verify before relying on any.

**Data & corpora**
- Common Crawl — https://commoncrawl.org
- Internet Archive — https://archive.org
- OpenWebSearch.eu — https://openwebsearch.eu

**Crawlers**
- Apache Nutch — https://nutch.apache.org
- StormCrawler — https://stormcrawler.net
- Heritrix — https://github.com/internetarchive/heritrix3
- Scrapy — https://scrapy.org
- Crawlee — https://crawlee.dev

**Extraction**
- trafilatura — https://trafilatura.readthedocs.io
- Readability — https://github.com/mozilla/readability
- warcio — https://github.com/webrecorder/warcio

**Index & search**
- Apache Lucene — https://lucene.apache.org
- Apache Solr — https://solr.apache.org
- OpenSearch — https://opensearch.org
- Vespa — https://vespa.ai
- Tantivy — https://github.com/quickwit-oss/tantivy
- Quickwit — https://quickwit.io
- Manticore — https://manticoresearch.com

**Ranking / vectors**
- sentence-transformers — https://sbert.net
- FAISS — https://github.com/facebookresearch/faiss
- Qdrant — https://qdrant.tech

**Engines to learn from**
- Marginalia — https://search.marginalia.nu · https://github.com/MarginaliaSearch
- Mwmbl — https://mwmbl.org
- Stract — https://stract.com
- YaCy — https://yacy.net
- SearXNG — https://docs.searxng.org
- Mojeek — https://www.mojeek.com

---

## 8. Recommendation

Do **§6 first** — it is days of work, costs nothing, and fixes the thing you
actually noticed. Then **Path A** for immediate source diversity. Then **Path B**
if you still want a real index, using Marginalia as the template.

Do not start with Path C. The index is not what is wrong right now.
