# Show HN

Hacker News has no posting API (the official API is read-only), so there is no true CLI route. Closest option: a prefilled submit link that opens the submit form with the URL and title filled in. You still click Submit while logged in.

Rules ([Show HN guidelines](https://news.ycombinator.com/showhn.html)): it must be something people can try now (Truegle is), do not ask anyone to upvote or comment, do not delete and repost, and use one account. A brand-new account with no history may be treated with suspicion; use an account that has taken part in discussions.

## Title (limit 80 characters)

```
Show HN: Truegle – private metasearch that labels each result's source
```

## Prefilled link

```
https://news.ycombinator.com/submitlink?u=https%3A%2F%2Ftruegle.info&t=Show%20HN%3A%20Truegle%20%E2%80%93%20private%20metasearch%20that%20labels%20each%20result%27s%20source
```

PowerShell: `Start-Process "<the link above>"`

## First comment (post it yourself right after submitting; edit freely)

> I'm the developer. Truegle is a search engine that combines several providers (Brave among them) through a self-hosted SearXNG layer, so you get results from more than one backend and each result is labeled with where it came from. You can switch "lenses" to see the same query framed differently (mainstream, independent, privacy/OSINT, or a zero-AI mode that calls no model at all). No ads, no cookies.
>
> What it is not: it doesn't have its own index, so it depends on the providers it combines, and they do see the query text (not your IP or an account). Ordinary searches are kept as an anonymous line for up to 7 days to show what's trending. The AI summary features send the question to hosted AI providers, again without your IP or account. It's a one-person project from 2025, so expect rough edges.
>
> Source is on GitHub (MIT): https://github.com/o87enterprises-ai/TruegleSearch . The privacy policy spells out exactly what's stored: https://truegle.info/privacy/
>
> I'd like feedback most on the source labeling: is it useful, or noise?

## After posting

- Answer questions honestly and fast for the first few hours; do not argue.
- Do not link the post to friends or ask for votes.
- If it gets no traction, leave it. Do not repost.
