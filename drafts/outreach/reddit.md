# Reddit (answers first, mentions second)

> **Draft status:** guidance and starting points for the owner. I could not retrieve the current rules of r/privacy or r/SearchEngines. **Read each subreddit's sidebar and rules page yourself before posting anything**, and message the mods if a rule is unclear. Rules differ per subreddit and are stricter than site-wide ones.

## Approach

- **There is no CLI route worth using.** Reddit's API needs an app registration and automated posting is exactly what gets accounts banned. Post by hand.
- **Participate first.** The usual guideline (secondhand, not from Reddit's wiki) is about 90% genuine participation and at most 10% self-promotion. Use an account that already has real history in these communities. A new account that only mentions Truegle will be removed.
- **Answer the question that was asked.** Mention Truegle only when it actually fits, say you built it, and name its limits in the same comment.
- **Never** ask for upvotes, use more than one account, or post the same text in several subreddits.

## Where to look (check each one's rules first)

- r/privacy (large; strict moderation, many promotional posts are removed)
- r/SearchEngines (smaller; posts with a self-promotion flair exist, but confirm the rule)
- r/degoogle, r/privacytoolsIO-style communities, r/selfhosted (only relevant if you point at the open-source code, not the hosted site)

Search each for threads like "alternatives to Google/DuckDuckGo", "search engine that shows sources", "how do I escape the filter bubble". These match the questions your AI Dash tracks, and a helpful, honest answer there can be read by people and by AI tools that browse Reddit.

## Disclosure line (use in every comment that mentions Truegle)

> Disclosure: I built Truegle, so take this with that in mind.

## Starting-point answers (edit heavily; write them in your own voice)

**"Search engine that shows where each result comes from?"**

> A few options: MetaGer and SearXNG (self-hostable) are metasearch engines that combine several backends. I built one called Truegle that also labels each result by source, with lenses to compare mainstream and independent sources. Limits: it's a one-person project from 2025, it has no index of its own, and the providers it queries see the query text (not your IP). Disclosure: I built it. https://truegle.info

**"How do I avoid filter bubbles?"**

> Turning off personalization (DuckDuckGo, Startpage and Brave Search all do) removes the profile, but one ranked list is still one editor's choice. Deliberately comparing a mainstream and an independent source on the same question helps most. Truegle, which I built, has lenses for exactly that; the "why multiple perspectives matter" post explains the method without needing the tool: https://truegle.info/blog/why-multiple-perspectives-matter

**"Is DuckDuckGo really private?"**

> Private in the sense of no personal search profile, yes; anonymous, no (your IP still reaches them, and results come largely from Bing). I wrote an honest breakdown here: https://truegle.info/blog/is-duckduckgo-really-private . Disclosure: I run a competing search engine.

Swap in your own wording; copy-pasted answers are easy to spot.

## After posting

- Reply to every follow-up honestly, including criticism.
- If a mod removes a comment, don't repost or argue; read the rule and adjust.
