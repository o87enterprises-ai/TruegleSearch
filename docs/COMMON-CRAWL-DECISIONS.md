# Common Crawl index — decisions to make

Eight decisions, in the order they constrain each other. #1 and #2 gate
everything else; the rest are reversible.

---

### 1. Budget ceiling
**Options:** strict $0 · up to ~$20/mo · up to ~$100/mo · higher
**Impact:** This decides whether the project is possible at all. Common Crawl's
*data* is free; the compute and storage to process it are not. At strict $0 you
are limited to what one already-paid-for machine can chew through slowly.
**Benefit of deciding first:** every option below collapses to one obvious
answer once this is set.
→ *Recommend: name a real number, even if it's $0. Guessing later wastes work.*

### 2. Where the compute runs
**Options:** AWS in-region (data is in S3) · your own PC · the existing AWS box
**Impact:** In-region means no egress fees but you pay for instance hours.
Pulling data *out* of S3 to your own hardware means egress charges that dwarf
the compute. Your own PC is free but slow and needs to stay on.
**Benefit:** Picking in-region batch processing is usually cheapest per page;
picking your own PC is cheapest per month.
→ *Recommend: your own PC for the first slice, to prove the pipeline before paying anything.*

### 3. How big a slice
**Options:** ~100k pages (proof) · ~1–5M (useful) · ~50M+ (serious) · full crawl (~2.5–3bn)
**Impact:** Drives every downstream cost — download time, processing time, index
size, RAM. A full crawl is out of reach on any budget you'd accept.
**Benefit:** 1–5M well-chosen pages genuinely beats 500M badly-chosen ones for
search quality. Small is not a compromise here.
→ *Recommend: 100k first to prove it works end-to-end, then 1–5M.*

### 4. How you pick which pages
**Options:** curated domain list · language + quality heuristics · whole-slice random
**Impact:** This *is* your product differentiator. A curated list of independent
media, primary sources, academic and technical sites gives you an index nobody
else has. A random slice gives you a worse Google.
**Benefit:** Curation is also the cheapest filter — it cuts the data volume
before you download anything, via Common Crawl's columnar index.
→ *Recommend: curated domain list. It's the whole point.*

### 5. WET or WARC
**Options:** WET (pre-extracted plain text) · WARC (raw HTML)
**Impact:** WET skips the entire extraction stage — no boilerplate removal, no
parsing, far less compute and storage. WARC keeps the HTML so you can extract
links (needed for any PageRank-style ranking) and re-process later.
**Benefit:** WET is dramatically cheaper and faster to a working index. WARC is
the only path to link-graph ranking.
→ *Recommend: WET for the first index. Move to WARC only if you want a link graph.*

### 6. Index engine
**Options:** Tantivy (Rust, one box) · Quickwit (index on object storage) · OpenSearch (batteries included)
**Impact:** Tantivy is fastest and lightest but you write glue code. Quickwit
puts the index on cheap S3/R2 storage, which matters at 50M+ pages. OpenSearch
is the most familiar to operate and the heaviest.
**Benefit:** All three give you BM25 ranking for free out of the box.
→ *Recommend: Tantivy at 1–5M pages. Revisit only if you scale past ~50M.*

### 7. Ranking depth
**Options:** BM25 only · BM25 + quality signals · BM25 + link graph · hybrid with vectors
**Impact:** BM25 alone is a usable search engine. Quality signals (ad density,
template-to-text ratio, domain age) are what make results feel *unlike* Google.
Link graph needs WARC (see #5). Vectors need embedding compute.
**Benefit:** Quality signals are cheap and high-impact; the link graph is
expensive and only pays off at scale.
→ *Recommend: BM25 + quality signals. Skip the link graph for now.*

### 8. How it plugs into Truegle
**Options:** replace SearXNG · blend as another provider · separate opt-in mode
**Impact:** Replacing means your index has to carry every query on day one, and
it won't. Blending means users get your results mixed with metasearch. A
separate mode lets you ship it early and honestly, at zero risk.
**Benefit:** `SearchService` already treats providers as pluggable, so this is a
provider change either way, not a rewrite.
→ *Recommend: separate opt-in mode first, blend once quality holds up.*

---

### If you only decide two things

**#1 (budget)** and **#4 (curated list vs random)**. Everything else follows
from those, and #4 is the one that determines whether you've built something
worth using or just a smaller Google.

### First cheap experiment

Pick ~500 domains you'd want in a search engine. Filter Common Crawl's columnar
index to just those. Pull the WET files. Index with Tantivy on your own PC.
That is a real, working, independent search index — and it costs nothing but
time. If it feels good, scale it. If it doesn't, you've lost a weekend, not a
budget.
