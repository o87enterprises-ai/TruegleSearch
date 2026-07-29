# Long-tail post template (copy per keyword)

Fill this in for each keyword from `long-tail-keywords.md`. Target **800+ words**
of genuine value (no filler). Then port into `apps/frontend/src/content/blogPosts.jsx`
as a JSX object — the shape maps 1:1 to the fields below.

---

## Metadata (maps to the blogPosts.jsx object)

- **slug:** `<from the keyword table>`
- **title:** `<Question, rephrased as a compelling H1 with the keyword near the front>`
- **description:** `<150–160 chars, includes the keyword, states the payoff>`
- **date:** `<YYYY-MM-DD>`
- **readingTime:** `<'6 min read' etc.>`
- **faq:** 2–3 `{ q, a }` pairs — the primary question + 1–2 "people also ask" follow-ups. (Renders as visible Q&A + FAQPage JSON-LD automatically via the BlogPost template.)

## Body structure (H2/H3 via `<LegalSection heading="…">`)

1. **Direct answer up top (2–3 sentences).** Answer the question in the first paragraph — this is what wins featured snippets and AI-Overview citations. Don't bury it.
2. **The context / why it matters** — one short section framing the problem.
3. **The how-to or the breakdown** — the meat: a numbered list of steps, a comparison, or a myth-vs-fact table. This is where the unique value lives.
4. **A concrete example or use case** — one real scenario so it isn't abstract.
5. **Where Truegle fits (honest, ≤1 short section).** Tie the answer back to a Truegle feature only where it genuinely applies — no forced pitch.
6. **Summary** — a `<LegalSection heading="Summary">` with 3–4 bullets recapping.

## Required internal links

- **Up to the pillar:** `<a href="/privacy-resource-hub" …>The Ultimate Digital Privacy &amp; OSINT Resource Hub</a>` (at least once, ideally in the how-to or summary).
- **Sideways to ≥1 sibling** from the "Links to" column in the keyword table.
- Use the house link style: `className="text-blue-400 hover:text-blue-300"`.

## JSX skeleton to paste into blogPosts.jsx

```jsx
{
  slug: 'REPLACE-slug',
  title: 'REPLACE — Title With Keyword',
  description: 'REPLACE — 150–160 char meta description with the keyword.',
  date: '2026-08-01',
  readingTime: '6 min read',
  faq: [
    { q: 'REPLACE primary question?', a: 'REPLACE direct answer.' },
    { q: 'REPLACE follow-up?', a: 'REPLACE answer.' },
  ],
  body: (
    <>
      <p>REPLACE — direct answer in the first 2–3 sentences.</p>
      <LegalSection heading="Why this matters">
        <p>REPLACE.</p>
      </LegalSection>
      <LegalSection heading="REPLACE — the how-to / breakdown">
        <ol className="list-decimal pl-6 space-y-2">
          <li>REPLACE step.</li>
        </ol>
      </LegalSection>
      <LegalSection heading="REPLACE — example">
        <p>REPLACE concrete scenario.</p>
      </LegalSection>
      <LegalSection heading="How Truegle fits">
        <p>
          REPLACE — one honest tie-in, and link up to{' '}
          <a href="/privacy-resource-hub" className="text-blue-400 hover:text-blue-300">The Ultimate Digital Privacy &amp; OSINT Resource Hub</a>.
        </p>
      </LegalSection>
      <LegalSection heading="Summary">
        <ul className="list-disc pl-6 space-y-2">
          <li>REPLACE recap bullet.</li>
        </ul>
      </LegalSection>
    </>
  ),
},
```

## Pre-publish checklist

- [ ] Direct answer is in the first paragraph.
- [ ] 800+ words of genuine content (checked with the audit script).
- [ ] `faq` present (2–3 pairs).
- [ ] Links up to the pillar + ≥1 sibling.
- [ ] Title + description contain the keyword, description ≤160 chars.
- [ ] Added to `apps/frontend/public/sitemap.xml` (blog section).
- [ ] `npm run build:frontend` passes and the post prerenders.
