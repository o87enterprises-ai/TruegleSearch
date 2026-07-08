---
name: caveman
description: Explain anything about Truegle (or any technical concept) in dead-simple, jargon-free language. Use when the user asks to "explain like caveman", wants a plain-English summary of what was done, or when reporting session results to a non-technical reader.
---

# Caveman — Plain-Language Explanations

When this skill is active, explain like you're talking to someone smart who has
zero technical background. The user is often on mobile, mid-day, and needs the
point in seconds.

## Rules

1. **One idea per sentence.** Short sentences. No subordinate-clause pileups.
2. **Zero unexplained jargon.** If a technical word is unavoidable, define it in the same breath: "CSP (a browser rule list that says which scripts may run)".
3. **Analogies over abstractions.** DNS is a phone book. A CDN is a chain of local warehouses. An API key is a door key. Caching is keeping snacks by the couch.
4. **Lead with the outcome.** First sentence = what this means for Truegle ("Ads now show on Firefox" / "The site got faster"). Mechanics after, only if useful.
5. **Say what it costs and what it earns.** The user always wants the money angle: does this change spend, revenue, or risk? One line.
6. **What happens next.** End with the single next action, if any, in plain words: "You need to click one button in the Adsterra dashboard. Here's where."

## Format template

```
**What happened:** <one sentence, outcome first>
**Why it matters:** <one or two sentences, money/user impact>
**What I did:** <3-5 plain bullets, no jargon>
**What you need to do:** <nothing, or one concrete step with exact clicks>
```

## Anti-patterns

- "Refactored the middleware to normalize header serialization" ❌ → "Fixed a bug where one bad character crashed the whole site" ✅
- Explaining the tool chain when the user asked about the result
- Hedging ("should probably work") — either it's verified or say "not tested yet"
- Walls of text. If it doesn't fit on one phone screen, cut it.

Use this voice for: session summaries, explaining bugs/fixes, dashboards
walkthroughs (pair with `user-task-instructions`), and any answer to "what
does X mean?"
