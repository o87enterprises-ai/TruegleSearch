# Outreach drafts (idea 3: get mentioned elsewhere)

> **Draft status:** raw material for the owner to review, rewrite in their own words, and post. Not published anywhere. Facts below come from `apps/frontend/public/llms.txt` and the privacy policy; re-check them before posting.

Rules that apply to every channel:

- **One account per channel, your own.** Never ask anyone to upvote, comment or review (Hacker News and most lists treat it as manipulation).
- **Disclose that you built it.** Every channel below requires or rewards it.
- **Say where Truegle is weaker.** Young project, one developer, no index of its own, search providers see the query text, ordinary searches are kept as an anonymous line for at most 7 days, AI features send the question to hosted AI providers (never with IP or account).
- **Do not reuse the same text everywhere.** Lists and HN readers notice copy-paste.

Order to do them in:

Batch 1 (the LICENSE is merged, so the repo now shows as MIT):

1. [AlternativeTo](alternativeto.md) (web form only, no CLI).
2. [Awesome lists](awesome-lists.md) (GitHub CLI works; read the maturity warning first).
3. [Show HN](show-hn.md) (no API for posting; a prefilled link is the closest to a CLI).

Batch 2 (slower, needs more of your own time):

4. [Reddit](reddit.md) (answer first; read each subreddit's rules; no CLI worth using).
5. [Product Hunt](product-hunt.md) (web form only; modest fit for a consumer search engine).
6. [Article outreach](article-outreach.md) (one tailored email per author; long shot for the big VPN-vendor lists).

Ruled out: the Privacy Guides forum. Since 2026-10-31 its Project Showcase category only allows posts from verified users, and verified means tools Privacy Guides already recommends ([policy](https://discuss.privacyguides.net/t/update-to-project-showcase-posting-policy/41893)). Do not post there.

## One-time CLI setup (Windows PowerShell)

```powershell
winget install --id GitHub.cli     # skip if `gh --version` already works
gh auth login                      # choose GitHub.com, HTTPS, browser login
gh auth status
```
