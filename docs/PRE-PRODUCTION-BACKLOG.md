# Pre-production backlog — the last list before the checklist

Captured 2026-08-07. Every item from the final review pass, triaged honestly:
what it costs, whether it is possible at all, and what I recommend.

Legend: **P1** ships before pre-production · **P2** ships during · **P3** after
launch · **✗** not possible as described.

---

## 0. The headline question: aggregating the social feeds

> "One global anonymous user-submitted social feed eliminating the need to sign
> in and use multiple apps for creators and fans alike. That is the entire goal."

**Reading other people's social feeds through official APIs is not purchasable
at any price.** This is not a budget problem, so it will not go away when there
is money. Per platform, as of now:

| Platform | Read a user's feed? | Cost | Reality |
|---|---|---|---|
| **Reddit** | ✅ Yes | **free** OAuth app | The one that genuinely works. 100 queries/min. |
| **X / Twitter** | ⚠️ Partial | **$200/mo** minimum for meaningful read | Free tier is effectively write-only. |
| **TikTok** | ⚠️ Own content only | free + app review | Display API returns *the logged-in user's own* videos. Not a feed. |
| **Instagram** | ✗ | — | Basic Display API **shut down Dec 2024**. Graph API needs a Professional account + linked FB Page + review, and still won't hand over a home feed. |
| **Facebook** | ✗ | — | `user_posts` and friends' content are not granted to non-partners. |
| **Snapchat** | ✗ | — | Login Kit is identity + Bitmoji. **There is no feed read API.** |

So "log in once, see all your feeds" cannot be built. Every aggregator that
appears to do it is either scraping (breaks constantly, gets sued, and would
require us to hold user credentials — the opposite of Truegle's whole pitch) or
is a partner with a signed deal.

### But the thing you actually described IS buildable — and half of it exists

Re-read your own sentence: *"one global **anonymous user-submitted** social
feed."* That is not account aggregation. That is **people posting links into a
shared pool**, and it needs no OAuth from anybody.

`community_media` already does exactly this: one person adds a link, it becomes
findable and playable for everyone, attributed, with no sign-in to view. The
👍/👎 platform pool (migration 019) already ranks it. The share target already
lets someone push a link in from any app on their phone.

**The pivot: don't aggregate accounts, aggregate links.** A creator posts their
own TikTok/IG/YT link once; fans see it in Truegle without an account on any of
those platforms. That is legal, free, on-brand, and mostly built.

What it still needs (P2): a feed *view* over `community_media` (chronological +
ranked), per-creator submission so a creator's pool is their channel, and the
"who submitted this" attribution surfaced.

### DECIDED 2026-08-07 — per-user login, own feeds, one place

The owner's call, and the framing above was too broad. The design is **not**
reading other people's feeds: each visitor signs in to the platforms *they*
already use, and Truegle shows **their own feeds together in one place**. That
is a materially different and more achievable proposition:

- **Reddit** — full home feed, free OAuth. Build first.
- **TikTok / Instagram (Business or Creator)** — the user's own posts, free,
  behind app review.
- **Facebook** — own posts, needs `user_posts` review.
- **X** — works, but the $200/mo app tier is unavoidable. Revenue-gated.
- **Snapchat** — still genuinely impossible: Login Kit is identity and Bitmoji,
  there is no content read endpoint to call.

The anonymous submission path stays alongside it, not instead of it. Per the
owner it is a deliberate stance, not a fallback: no digital ID required to
post or to read, so participation never depends on being identifiable.

Order of work: Reddit OAuth → anonymous feed view over `community_media` →
TikTok/IG review submissions → X when revenue allows.

---

## 1. Bugs — P1

| # | Item | Assessment |
|---|---|---|
| 1.1 | **Clipboard pastes a stale clip** — copy sometimes yields a previous, no-longer-queued item | Real. Multiple components call `clipboard.writeText`; the player's share writes the queue link at click time, but a failed/denied write leaves the OS clipboard holding the previous value and we still show "copied". Fix: await the write, only show success on resolve, and rebuild the link at press time rather than from a memoised value. |
| 1.2 | **Tube docked + list open → text input off screen** | Real, and a regression of the geometry work. The docked frame is capped against `100svh - slot.top`, but the *list* grows inside it and pushes the header above the fold. Fix: the input must stay pinned (`sticky top-0`) inside the docked frame the same way it already is in the popped-out frame. |
| 1.3 | **Player buttons get cut off when shrunk** | Real — visible in the screenshot: 11 controls in a fixed-width row. Fix: let the transport wrap/scroll and drop to icon-only below a width threshold, driven by a container measurement rather than a viewport breakpoint (the popped-out frame is resizable, so viewport width is the wrong signal). |
| 1.4 | **SoundCloud search broken** | Test data supplied: profile *Duck E Duck*, EP *Side A "Once you go quack…"*, tracks *Duck Pt. 1 / knees / Rubber / Riot*. Almost certainly the same class of bug as Reddit: SoundCloud is asked via the `videos` index, which has no SoundCloud engine. Needs the `web` category and `site:soundcloud.com`, then verification **against the live backend** — which I cannot reach from here. |

## 2. Search bar behaviour — P1

> "On search = one continuous line, follow the cursor. On chat = multiline box,
> thinner font — the bar should physically shift so it instinctively indicates
> a chat is about to happen."

Good instinct and cheap to do: `SearchBar` already has a `variant="chat"` path
and `singleLine`. The work is (a) making the single-line case scroll to follow
the caret past the right edge, and (b) driving the shape change off `pillMode`
so the box visibly morphs when the pill says Chat — pill above and modes below
stay exactly where they are.

## 3. Quick-answer cards → business-panel format — P2

Match the Google local panel: name, rating + count, category, open/closed,
photos strip, Call / Directions / Website / Share actions, address, hours,
phone. **We already have the data sources** (`BusinessEnrichmentService`,
Mapbox/TomTom, `LocationDetailsPanel`). This is a presentation component plus a
"is this a place?" trigger, not new plumbing. Only render it when the query
resolves to a real place — a half-filled panel is worse than a normal card.

## 4. Lock the player UI — ✅ DONE 2026-08-08

Decided: lock the **UI**, not the lock-screen controls (those already exist via
Media Session for native media).

A padlock on the transport covers the whole player with a sheet that swallows
every pointer event, so a pocket cannot skip, pause, dislike or close. The media
is not unmounted — the sheet is a sibling, so playback continues untouched.

**Unlocking is a 700ms hold**, not a tap: one tap is exactly what a pocket
produces, so a tap-to-unlock lock is not a lock. A filling ring makes the hold
discoverable, because the failure mode of a hidden long-press is "the button is
broken". Full-screen swipe navigation is disabled while locked too — otherwise
the sheet would stop the buttons and let the gestures straight through.

The lock **survives a reload on purpose**: you locked it deliberately, and
having it quietly release when the tab is recycled is the exact failure it
exists to prevent.

## 5. Remove /shorts, fold into the player — P2

Agreed, and consistent with everything else this session: one player, one
surface. Shorts are already handled (`vertical` sources letterbox correctly, the
browse deck is a vertical swipe feed). Delete the route, keep `_redirects`
pointing `/shorts → /tube` so shared links survive.

**Transcript extraction (`/extract`)**: **DECIDED — keep the route.** Fold the
*capability* into the player as a transcript panel beside the queue, and let
both call one `TranscriptService`. `/extract` also serves pasted URLs with no
video, so deleting it would remove a working feature to save a menu entry.

## 6. TrueGLE hallucination — a prompt router, not a bigger prompt — P1

You are right about the cause. Prompts are DB-backed and interpolated with the
query, the context, the search results and a perspective on **every** call, so
the model gets a wall of instructions before it sees the question.

One correction on naming: **there is no "Obsidian" model brain.** Obsidian is a
notes app; there is an unrelated `Obsidian` vision model from Nous Research.
What you are describing is a **router**, and it is the right idea:

1. A tiny **intent classifier** (few-shot, ~200 tokens, or plain heuristics for
   the obvious cases) picks a flow: `lookup · investigate · deep-investigate ·
   compute · alternative-views · vs · simple`.
2. Each flow owns a **short, specific** prompt — 3–6 lines, not a page.
3. A single shared **base prompt** carries only the constant: unbiased,
   transparent, helpful, genuinely investigates the user's topic, no pushback,
   no opinion.

Cheaper per call, far less to contradict, and each flow becomes independently
tunable. Fits the existing `PromptService` — flows are rows, the router picks
the row. **Recommended P1**, because hallucination undermines the product's
entire claim.

## 7. OSINT — give the agent real tools — P2

> "It shouldn't be telling users to look up a source it can look up itself."

Correct, and the fix is tool-calling, not a better prompt. The repo you mean is
almost certainly **OSINT Framework** / `awesome-osint`.

Honest scoping: **most of that index cannot be curl'd.** A large share are
browser-only apps, need their own key, or block datacenter IPs (the same wall
Reddit's JSON API puts up). What *is* scriptable, free, and keyless:

- email → breach/format checks, MX and domain records
- username → presence checks across sites that answer plain HTTP (the sherlock
  approach)
- phone → carrier/region via `libphonenumber` (offline, no calls at all)
- domain/IP → WHOIS, DNS, certificate transparency (crt.sh), robots/headers
- image → reverse-search *links* (the engines themselves need a browser)

Build it as a **tool registry** the router can call, each entry declaring its
input type, its request, and its parser. Start with five that provably work
rather than wrapping two hundred that mostly don't. Rate-limit and cache — these
endpoints ban fast.

## 8. 8-bit game on the 404 page — P3

Better than the games page, and it moots most of `TRUEGLE-GAMES-PLAN.md`'s ad
problem: nothing third-party, nothing to monetise, no store. One small canvas
game, MIT-licensed or written from scratch, lazy-loaded so it costs nothing on
a normal 404. **The games plan stays parked** — this replaces its v1.

---

## Suggested order

1. **P1 bugs** 1.1–1.3 (contained, visible, low risk)
2. **P1** the prompt router (§6) — biggest quality win available
3. **P1** search-bar behaviour (§2)
4. **1.4 SoundCloud** — needs live-backend access to verify, see below
5. **P2** business cards, lock toggle, shorts fold-in, OSINT tools
6. **P3** 404 game
7. **[DECIDE]** the social pivot (§0) before anything is built for it

## The standing blocker

I cannot reach `truegle.info` or the backend from this environment — the proxy
403s both. Anything that depends on what the live search index actually returns
(SoundCloud, Reddit, quick answers) is **reasoning plus mocks, not proof**. The
Reddit fix took three rounds for exactly this reason. Before pre-production,
either give the agent a reachable staging endpoint or plan to verify these on
device with the in-UI diagnostic line (`asked: social 12→0 · web 0→0`).
