# Blog expansion drafts — for review

These are **drafts only**. Nothing here is live. The live blog content in
`apps/frontend/src/content/blogPosts.jsx` is unchanged. Once you approve a
draft, the developer ports it into that file (as JSX) and it goes live on the
next build.

Each draft expands one post flagged in `docs/marketing/BLOG-CONTENT-AUDIT.md`
to 800+ words, preserving the original title and URL slug, adding H2/H3
subheadings, at least one internal link to the `/privacy-resource-hub` pillar,
and a **Summary** block.

| Order | File | Slug (URL unchanged) | Was | Target |
|-------|------|----------------------|-----|--------|
| A | `01-why-multiple-perspectives-matter.md` | `why-multiple-perspectives-matter` | 206 | 800+ |
| B | `02-how-to-search-privately.md` | `how-to-search-privately` | 230 | 800+ |
| C | `03-what-is-a-filter-bubble.md` | `what-is-a-filter-bubble` | 236 | 800+ |
| D | `04-search-without-tracking.md` | `search-without-tracking-alternative-to-google` | 277 | 800+ |
| E | `05-bias-free-perspective-modes.md` | `bias-free-search-results-perspective-modes` | 320 | 800+ |
| F | `06-unbiased-search-how-truegle-works.md` | `unbiased-search-engine-how-truegle-works` | 358 | 800+ |
| G | `07-understanding-ad-color-system.md` | `understanding-our-ad-color-system` | 462 | 800+ |

## ⚠️ Accuracy flag on Post G (ad color system)

The current live version of the ad-color post still describes the **old**
"Watch & Earn" rewards model (earn by viewing an ad, measured with
IntersectionObserver, `/rewards` dashboard). That model was replaced with the
**offer/conversion-based** rewards program, and the rewards UI is currently
**disabled** (no S2S postback support from Adsterra). Draft G rewrites that
section to match current reality and removes the dead `/rewards` link. Please
confirm you're happy with the corrected wording before it ships.
