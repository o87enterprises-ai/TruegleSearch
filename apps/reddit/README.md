# Truegle Search

A working web search box, inside a Reddit post.

A moderator adds one post to their community. Anyone scrolling past can type a
question into it and get web results back, right there in the thread, without
signing in to anything and without leaving Reddit. Clicking a result opens that
website in a new tab, the same as any other link on Reddit.

**Who it's for:** communities where people are constantly asking each other to
look things up — help subreddits, hobby subreddits, anywhere a "let me find
that for you" reply is common. It saves the round trip.

**What it does not do:** it does not read your Reddit account, it does not know
who you are, it does not store your searches, and it does not ask you to make an
account or install anything. It shows no advertising.

## Critical operational notes

- **One post, unlimited use.** The post never expires and needs no maintenance.
  Searches run against Truegle's live index every time.
- **Nothing personal is sent anywhere.** The app sends the words you typed to
  Truegle's search API and nothing else — no Reddit username, no user ID, no
  post or subreddit ID, no IP forwarding, no cookies. There is no account. The
  app has the Redis permission because Reddit's platform requires it for a
  moderator menu item and for the shared response cache, but it writes nothing
  of its own: the only thing stored is a five-minute cache of public search
  results, keyed on the search text alone.
- **Searches are cached for five minutes, by query text only.** If two people
  search the same words within five minutes, the second gets the first's
  results without a second call upstream. The cache key is the query and
  nothing else, so nothing about who searched can be in it.
- **Results are somebody else's content.** Truegle is a metasearch engine — it
  indexes the open web. The app does not filter results by subreddit rules, and
  moderators should treat it as they would any other link-sharing tool.
- **If search is down**, the post says so in plain words and stays usable; it
  does not break the page.

## How to add it to a community

1. Install the app on your subreddit from its Developer Platform page.
2. Open the subreddit's moderator menu (the three dots) and choose
   **Add a Truegle search post**.
3. The app creates the post. Pin it if you want it to stay findable.

That is the whole setup. There is nothing to configure, no key to paste and no
setting to fill in.

## How to use it

Type a question or some words into the box and press **Search**. Up to twenty
results come back, each showing the site it came from, its title, its date where
one is known, and a short extract. Selecting one opens that site in a new tab
with no referrer attached, so the destination is not told you came from Reddit.

## Fetch Domains

The following domain is requested for this app:

- `api.truegle.info` — Truegle's public search API, documented for anyone at
  <https://truegle.info/developers>. This is the only external call the app
  makes and it is the app's entire purpose: the server posts the visitor's query
  to `POST /api/search` and receives a list of web results (title, URL, extract,
  source, date). The API is open — no key, no account — and the request carries
  no identifying information about the redditor making it. No other endpoint on
  that host is called. The request is made server-side only; the web view can
  reach nothing but this app's own `/api/` routes.

## How it is built

- `src/client` — the web view. Plain HTML, CSS and JavaScript, no framework and
  no external assets, so the post loads instantly in a scrolling feed. It fetches
  only this app's own `/api/search`.
- `src/server` — an Express server on `@devvit/web/server`. It is the only place
  that talks to the outside world, and it is deliberately small enough to read
  in one sitting.
- `devvit.json` — permissions, the moderator menu item and the fetch allow-list.
- `scripts/verify-reddit-app.mjs` — checks the app against the Devvit rules that
  actually get apps rejected, before a submission is made rather than after.

## Before the first playtest: point `api.truegle.info` at the backend

**Do this first.** The fetch domain in `devvit.json` is submitted for review the
moment you run `npm run dev` or `npm run launch`, so it has to be the final
hostname before you run either. It is also the difference between a request
Reddit's policy says it approves and one it says it refuses:

> **Personal domains** (e.g. `personaldomain.com`) — Will not be approved.
> …
> **APIs that provide data or specific services** — These will be approved if
> they have a publicly documented and publicly accessible API for valid use
> cases.

A raw `*.vercel.app` deployment URL is the first kind no matter what it serves.
`api.truegle.info`, documented at <https://truegle.info/developers>, is the
second. Same backend either way.

1. **Vercel** → the backend project → **Settings → Domains** → **Add** →
   `api.truegle.info`. Vercel will show the DNS record it wants. Custom domains
   are included on the current plan — this costs nothing.
2. **Your DNS host for `truegle.info`** → add the record Vercel asked for. It is
   normally a `CNAME` on the name `api` pointing at `cname.vercel-dns.com`.
3. Wait for Vercel to show the domain as **Valid**, then check it yourself:

   ```sh
   curl https://api.truegle.info/api        # the public API index
   curl -X POST https://api.truegle.info/api/search \
     -H 'Content-Type: application/json' -d '{"query":"test"}'
   ```

   The first returns a JSON index pointing at the docs page; the second returns
   search results. If either fails, stop — playtesting now would submit a domain
   request for a host that does not answer.
4. Only then run `npm run dev`.

The Truegle website itself still calls the backend on its original Vercel URL,
deliberately: nothing about the live site changes until the new hostname is
proven, and it can be switched over later at leisure.

## Where this app lives on Reddit

- App page: <https://developers.reddit.com/apps/truegleredd>
- Playtest community: <https://www.reddit.com/r/truegleredd_dev>
- Approved fetch domains, once review completes:
  <https://developers.reddit.com/apps/truegleredd/developer-settings>

The app account is `truegleredd` rather than `truegle-search` — the latter was
unavailable when the app was registered, and `devvit upload` picks a free name
and writes it into `devvit.json`. The name is the app's identity on Reddit and
cannot be changed afterwards without registering a different app, so it stays.

## Developing

```sh
cd apps/reddit
npm install          # this project is intentionally outside the monorepo's workspaces
npm run login        # devvit login — needs a Reddit developer account
npm run dev          # devvit playtest, against the subreddit in devvit.json
npm test             # the rule checks; no network, no Reddit account needed
npm run launch       # devvit publish — submits for Reddit's app review
```

`npm install` here is separate from the repository root on purpose: the Devvit
CLI and its toolchain must not end up in the lockfile that the Truegle website
and API build from.
