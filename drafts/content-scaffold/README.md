# Content scaffold — Phase 4 (repurposing) & Phase 6 (long-tail SEO)

Scaffolding only — **no live content here.** These are the templates, keyword
lists, and playbooks to execute the growth plan's remaining phases. Each
long-tail post, when written, gets ported into
`apps/frontend/src/content/blogPosts.jsx` the same way the expansions were.

## Files

| File | Purpose |
|------|---------|
| `long-tail-keywords.md` | 40 low-competition question keywords, grouped by cluster, each with a target slug, search intent, and the pillar/cluster it links to. This is the Phase-6 backlog. |
| `post-template.md` | The reusable structure for a long-tail Q&A post — copy it per keyword. Mirrors the `blogPosts.jsx` object shape (title, description, faq, body, internal links). |
| `repurposing-playbook.md` | Phase-4 templates: turn one pillar/top post into a YouTube script, an X/Twitter thread, a podcast outline, and short-form clips. |

## How to use

1. **Pick a keyword** from `long-tail-keywords.md` (start at the top — ordered by impact-per-effort).
2. **Copy `post-template.md`**, fill it in (800+ words, one FAQ, links to the pillar + one sibling cluster post).
3. Save the draft under `drafts/blog-expansions/` (or a new `drafts/new-posts/`), get it reviewed, then port into `blogPosts.jsx`.
4. For **repurposing**, take a finished pillar/top post and run it through `repurposing-playbook.md`.

## Guardrails (unchanged)

- $0 budget — every tool named (Ubersuggest, AnswerThePublic, Google autocomplete, Spotify for Podcasters, etc.) has a free tier. Flag anything that would cost before using it.
- Don't pad for word count; expand only with genuine value.
- Every post links up to `/privacy-resource-hub` and to at least one sibling, to keep the topic cluster tight.
- Keep OSINT / censorship content lawful and educational (see the pillar's ethics notes).
