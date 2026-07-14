# TrueGLE — Final UI/UX & Brand Direction (source of truth)

> Captured from the founder's final-direction brief. This is the authoritative
> spec for the redesign; build against it in phases (see "Build sequence" at the
> bottom). Update this doc as decisions firm up.

## Brand

- **Tagline:** _"TrueGLE. For the questions most search engines won't answer."_
  (blank = "search engines"; keep the format flexible for A/B later.)
- Core principles, always shown: **No bias · No tracking · No censorship.**
- Footer: `Truegle Co. ™ 2026`.

## Core UX thesis

Chat is the **default**; search is the power-user path. A query + ENTER with no
mode selected → TrueGLE answers directly (mainstream). Over time users trust the
chat to search for them; researchers/students can still use the manual search
pages. "Robust chatbot with multiple response classes AND a search engine with
similar manual function."

## Pill / mode → page → color map

| Pill | Mode | Page | Color |
|------|------|------|-------|
| Black | **Chat default** (vs. TrueGLE off) | landing/chat | black |
| Blue | Mainstream | /search | blue |
| Green | Simplified | (green) | green |
| Red | **Rabbit Hole** (was Alternative) | /red | red |
| Purple | Perspectives | /biased | purple |
| Ocean | OSINT | /osint | teal |
| Orange | Rewards | /rewards | orange |
| Yellow | Transcripts/Extract | /extract | yellow |

Two extra toggles on a row **below** the mode pills:
- **vs. TrueGLE** (Grand Logic Equation / dual-audit mode) — **black**.
- **Verbose / Deep Dive / "Feeling chat-e?"** — **white**.

## Landing page (now the default chat entry)

Keep the pyramid background + existing design language. Minimized content, top→bottom:
1. Logo
2. Pill / safe-search
3. Search bar (vertically expands line-by-line as you type; page content slides down)
4. Chat mode selection row (mainstream blue, rabbit hole red, …) — **directly below the search bar** (where scrollable categories used to be)
5. Row: **vs. TrueGLE** (black) · **Verbose/Deep Dive** (white)
6. Share-for-premium → Learn more → the three principles (no bias/tracking/censorship)
7. Three cards:
   - **TrueGLE Chat** — unbiased / no preconceived opinions / self-hosted local model for privacy + transparency
   - **TrueGLE "vs." mode — Grand Logic Equation** — probability of a theory vs. statistical possibility; if the odds don't match the results, find the circumstances that produce odds that do
   - **Chat / Search** — chat for full investigations, or search for classic web result links
8. CTA: _"Get paid for the ads you see"_ → Sign up / No thanks (triggers cookies notice explaining procedure + options)
9. Links · Ad · `Truegle Co. ™ 2026`

**No search buttons below the search bar** anywhere.

## Chat page (`/chat`) — silent destination after first chat on landing

- Pill mode row, then the native chat box.
- Chat box lives below the "claim this space" ad (which is below the chat
  response-mode selections), extending down to just above the footer ad banner.
- Box expands vertically with the query.
- On send: input box **disappears** → loading animation → response loads →
  input box **reappears directly below the finalized links/info**, with a pill
  mode switch **directly above** it for quick page switching.
- **Footer order fix:** chat input box bottom = head of the feedback banner,
  THEN the token meter. (Currently the token meter overlaps the input after a
  reply — this is the bug to fix.)

## Search page (`/search`) — layout

1. Logo
2. Filters / pill modes / safe search
3. Search bar
4. Scrollable categories (return on the search pages; absent in chat)
5. Quick-results card / map pop-up
6. "Claim this spot" / "Get paid for the ads you see"
7. Box below the search-bar categories
8. AI summary
9. Results
10. Footer banner ad

**Uniform rule:** ALL search pages share the SAME search-bar components + UI
design, tinted to the page color; only the background animation varies per page.
Clicking a pill returns the search-bar components stripped for chat and shifts
the UI to that colored page.

## OSINT page (`/osint`) — the one exception to the uniform layout

1. Logo
2. Filters / pill mode / safe search
3. Search bar **stripped of search categories**, replaced with a scrollable,
   **multi-selectable** row of OSINT investigation classes (user can pick >1)
4. AI summary
5. Claim this spot
6. Investigative links
7. Footer ad
8. Feedback

## Rewards page (`/rewards`) — orange pill

- Same UI layout as search pages, but: blank background, **orange glassmorphism**
  cards/components; a **live hovering rewards-total widget**.
- One of **each** Adsterra ad zone rendered NATIVE through the page, **always
  active even with 0 query**.
- Footer (where the token meter was): **live $ totals estimate meter**, a
  **"Watch an ad now"** button (rewarded video on demand), and an **ad-refresh**
  button that cycles ad zones without changing current results.
- Opt-in to the rewards modal → immediately navigate to rewards email/payment
  signup flow → stay on rewards after successful auth.
- **OPEN QUESTION (discuss):** whole-background = a constantly-running rewards ad
  the user must X-out (escape) to get credit + start a new ad. Validity TBD.

## Extract / Transcripts page (`/extract`) — yellow pill

- Match the finalized `/search` layout but with **no scrollable categories**.
- Ads: remove all except a single **"Claim this spot"** for now.

## Rewards + Transcripts note

Both orange (rewards) and yellow (transcripts) pages: **chat is non-functional**;
AI summaries still sync with the corresponding chat selections elsewhere.

## Global additions

- **Hamburger menu on ALL pages** → Search, Rabbit Hole, Perspectives, OSINT,
  Chat, Extract, Rewards.
- **Ads-rewards modal** minimized to a small pop-up: _"Get paid for the ads you
  see!"_ → click here / no thanks. Also appears as an overlay on first chat OR
  search (with the cookies policy) before execution.
- **Banner ad(s) at the end of every AI response**, count scaling with response
  length (longer response → more print/CPM banners, to offset cost).
- **Learn More page**: selectable examples of each page + mock search results +
  step-by-step visual navigation + feature descriptions + full walkthrough.
  Include a **"Skip all"** button to exit easily.
- **Sticky feedback button** on every footer.

## Bugs / concrete edits

- [ ] **Safesearch 500** (`Internal Server Error / Something went wrong`,
  traceId 2b498ff7c1b06f16) — fix.
- [ ] **Perspectives spam:** the model appends multi-perspective framing to
  EVERY reply. Only invoke it when the query actually warrants it ("where's the
  new Burger King" needs none). — prompt/logic gate.
- [ ] **Mic/speech search:** wire the search-bar mic button to trigger the
  device keyboard's speech-to-text (after permission) and live-stream the
  transcribed text into the vertically-expanding search bar in real time.
- [ ] Remove stock-photo ads on the pics/vids tabs.
- [ ] Extract page: claim-ad only (remove others) + `/search` layout.

## Build sequence (proposed — phased, verify each)

1. **Bugs first** (shippable now, no layout dependency): safesearch 500,
   perspectives-only-when-needed, remove stock-photo ads, sticky feedback footer.
2. **Brand pass:** tagline, "Rabbit Hole" rename (red), principle line, footer mark.
3. **Shared search-bar component:** one uniform, color-tintable search bar +
   components used by every search page (the foundation everything else reuses).
4. **Landing → default chat** conversion + the vs.TrueGLE/verbose row + 3 cards.
5. **Chat page** flow rework (disappearing input, loading, reappear, footer order).
6. **Per-page** application (search/red/purple/osint uniform + osint exception).
7. **Rewards page** (orange) + rewards modal → signup flow + live meters.
8. **Extract page** reskin; **Learn More** page; **hamburger** nav global.
9. **Mic/speech**; **response-end banner ads**.
