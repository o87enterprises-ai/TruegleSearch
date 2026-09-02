# Feed / Tube Rehaul — Product Spec

Status: **DRAFT — captured from user dictation 2026-09-02, awaiting confirmation.**
Branch: `claude/reddit-api-auth-qhk7m4`

This is the aggregated-feed rehaul. Tube stops being a standalone page and becomes
one *category* inside a unified feed, while the legacy `/tube` player survives
untouched for keepsakes.

---

## 1. Routes

| Route | What it is | Status |
|---|---|---|
| `/tube` | Legacy player. Stays as-is. Gains FM radio, open-band scanner channels (fire/med/police), and traffic cams as searchable categories. | exists (`UniversalSearch lockedTube`) |
| `/feed` | The aggregated vertical feed. Home. | exists (`FeedPage.jsx`, 309 lines) |
| `/feed/tube` | Tube content rendered in the NEW feed layout. | new |

---

## 2. `/feed/tube` — layout

Modelled on the YouTube homepage, in Truegle brand style, with all aggregated
feeds in one place.

Top to bottom:

1. Logo
2. Pill
3. Source selector (tube / feed)
4. Filters
5. Search bar **/ large player** — the player collapses when the user types
6. 4-unit scrollable video feed
7. Transport **or** touch controller

### Touch controller

Trades most transport chrome for a small touch/click surface:

- double tap → play / pause
- swipe up / down → next / last
- hold centre screen → stop, reloads the video feed in the container
- shake → shuffle
- double tap far left / far right → rewind / fast-forward
- single tap → show telemetry: title, channel/artist, estimated time, scrub
  control with thumbs, playback mode, volume
- next / last / more suggestions with thumbnails where available
- **all embed URLs cached to the DB** for free recall
- volume control stays open for 5s after last contact or motion in the slider area

Page behaves normally, popped out, and docked.

---

## 3. `/feed` — the aggregated feed

1. Logo
2. Pill
3. Source (feed)
4. **Servers** — user picks which sources feed the timeline from a dropdown.
   **Default: all.**

### Servers (sources)

- Reddit
- X
- GitHub
- Hacker News
- Live news feed
- Stock / crypto HUD — simple bar graph with hourly candles; user watches
  3 crypto / stock tickers
- Music
- Tube (native tube feed: YouTube, Rumble, Dailymotion, X, Reddit, TikTok)
- Anonymously user-submitted
- Sports, weather, entertainment — any free open feed

### Timeline behaviour

Top posts from every selected service are **randomized** onto one scroll
timeline. The feed actively retrieves a new post from *one of every selected
service at a time*, constantly showcasing new posts and **never repeating**
unless the user returns to their history.

### In-feed behaviour

- Videos in feed posts render in their container; autoplay, pause on scroll past
- Like / dislike to train
- Anonymous comments
- **Carry-along player:** to bring a video or song while scrolling, the player
  pops out as a 9x16 portrait player docked bottom-right. Has popout transport
  or touch-controller controls, full screen, and a search bar.
- Links state clearly which service they came from. Containers are **two-toned,
  matching the provider logo's colours.**
- Each web link result gets an **"open in feed"** button — opens the video or
  link inside the feed, enabling sharing, playlisting, etc.

### Search

- In `/feed`, the search bar searches **all feeds, not the internet.**
- To surf the internet the user is returned to the tube page.
- Below the search bar: a **search mode selector** — `feed | tube | web | chat`.
  Clicking one loads that mode's search-bar components (e.g. tube and web get
  scrollable search categories; chat gets scrollable chat categories).

---

## 4. Browse (formerly "categories")

Modular, stacked one row on top of the other, each row a **horizontal
scrollable preview**. Click a category to open it as a vertical feed; back
returns home.

- **Home** — the randomized vertical feed
- **Soc** — social media provider feeds
- **Tube** — the current videos feed, rendered in the new feed layout
- **Live** — news / financial / weather, user-configurable choice of provider
  for channels or stations
- **Music**
- **Entertainment (creators)**

---

## 5. Legacy `/tube` additions

Kept as the easy player. Add as searchable categories:

- FM radio
- Open-band frequency channels (fire, medical, police)
- Traffic cams

---

## Open questions

1. Which sources are actually reachable on a $0 budget? (see cost note below)
2. Where does "history" live given the no-tracking policy — client-side only?
3. Does "like/dislike to train" feed a model, or only re-rank locally?
4. Anonymous comments need moderation + storage design.

## Cost note (financial skill)

The $0 budget rules out paid aggregators. Reddit's **official OAuth is free**;
third-party Reddit REST adapters (e.g. redditapis.com at $0.002/read) are not.
X/Twitter has no free API tier. TikTok and Rumble have no free public API.
Free and reachable today: Reddit (OAuth app), Hacker News (Firebase API, no
auth), GitHub (REST, no auth for public), RSS news, CoinGecko (crypto),
YouTube (existing `YouTubeGateway`), Dailymotion.
