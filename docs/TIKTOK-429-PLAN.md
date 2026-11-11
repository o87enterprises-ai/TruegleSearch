# TikTok "429 Too Many Requests" in the player — what it is, and the plan

Owner report, 2026-11-10 (phone and desktop): playing a TikTok from the Feed shows
an endless spinner, then TikTok's own error page inside the player:
*"The server at www.tiktok.com sent back an error: 429 Too Many Requests."*

## What it is (and is not)

- **It is TikTok refusing to serve its embed player to the browser.** The request
  that fails is `www.tiktok.com/player/v1/<id>` (and its fallback,
  `www.tiktok.com/embed/v2/<id>`), made by the visitor's browser. It is not our
  feed servers, and server-side caching cannot change it.
- **Measured from the sandbox, 2026-11-11:** the same player URL answered 429 on
  25 of 28 requests; pacing requests 5 s apart made no difference; TikTok's
  oEmbed (`/oembed`, title + thumbnail) kept answering 200. At the start of that
  same session the same URL answered 200. So it is an intermittent standing limit
  on TikTok's side, not something a visitor can trigger by clicking too fast.
- **Our own traffic to TikTok is small:** the Feed shows thumbnails only; hold-to-
  preview loads YouTube/Vimeo only (`PlayerBrowse.previewSrc`). TikTok's player is
  requested only when someone presses Play, plus one automatic second request (the
  card fallback) 10 s later.
- **What the player does today when TikTok answers 429:** the error page loads
  without ever saying "ready", so after `TIKTOK_READY_MS` (10 s) it swaps to the
  card player (a second request that is usually refused the same way), then stays
  on TikTok's raw error page forever. The next TikTok in a Stream repeats this.

We cannot stop TikTok throttling. We can stop making it worse and stop showing a
raw browser error.

## Plan (all free; in order of value)

**Built 2026-11-11 (steps 1-3):**

1. **Treat "loaded but silent" as blocked, fast.** Once the full player's frame has
   loaded, it has 4 s (`TIKTOK_SILENT_AFTER_LOAD_MS`) to say it is ready, not 10 s
   from mount. A player error counts the same. (`hooks/useEmbedPlayback.js`)
2. **Remember it, per tab, for 10 minutes.** The next TikToks start in the card
   with NO request for the full player (one request per clip, not two). A full
   player that says "ready" clears it. (`utils/tiktokBlock.js`, sessionStorage only)
3. **A quiet strip, not TikTok's error page.** In the card, after 3 s: "Not playing?
   TikTok may be limiting playback right now." with **Open on TikTok**, **Try the
   full player** (at most once per 30 s) and **Next** (moves on without calling the
   clip broken). (`components/player/TikTokHelp.jsx`)

   *A limit on what is possible:* TikTok's card cannot report back, so we cannot
   tell a playing card from TikTok's error page inside it. Silence is also what a
   private window looks like (the full player needs third-party storage), where
   the card works. So the answer to silence is the card plus a way out — not an
   error message, and not skipping the clip. The strip says "may".

**Built 2026-11-11 (steps 4-6):**

4. **Streams keep moving.** In a run that continues (a feed run, a saved list or a
   queue) the strip counts down — "Moving on in 12s" — and the run moves on by
   itself after 15 s. The card cannot say whether it is playing, so the PERSON is the
   signal: **"It's playing — stay"** stops the countdown and remembers, for the tab,
   that the card works here (a private window, say); after that nothing is ever
   auto-skipped. The countdown only runs while the tab is visible and the player is
   not paused, and a lone clip with nothing after it never moves on.
5. **Counted, anonymously.** Three events through the existing player-diagnostics
   beacon (`utils/playerDiagnostics.js` -> `/api/player/diagnostics`; no user, session
   or IP; accepted by `PlayerHealthService.REASONS`), one per clip:
   `tiktok_silent` (the full player loaded and never said ready, or errored),
   `tiktok_linkout` (the clip showed the Open on TikTok panel) and `tiktok_recovered`
   (the full player said ready after failing). Read them with
   `GET /api/admin/player-health?reason=tiktok_silent` (or `scripts/player-health.mjs`):
   many `tiktok_silent` and no `tiktok_recovered` means it is constant.
6. **Open on TikTok by default when it is constant.** After the full player has failed
   on three clips in 30 minutes (and nobody pressed Stay) TikToks stop loading in the
   player: no frame, no request to TikTok, no raw error page — an Open on TikTok panel
   (`components/player/TikTokBlockedPanel.jsx`) stands in, with **Try anyway** (this clip
   only, once per 30 s). In a run the panel moves on after 5 s. The failures age out after
   30 minutes, so the player tries again by itself; a "ready" forgets them at once.

   Where the numbers live: `utils/tiktokBlock.js` (`TIKTOK_LINKOUT_AFTER`,
   `TIKTOK_LINKOUT_WINDOW_MS`, `TIKTOK_AUTO_ADVANCE_MS`, `TIKTOK_LINKOUT_ADVANCE_MS`).

**Not done / worth watching:** the thresholds are judgement calls with no data behind
them yet; the `tiktok_silent` / `tiktok_recovered` counts are what should tune them.
If TikTok's limit lifts permanently, nothing needs removing: a working player clears
all of it by itself.

Tests: `npm run tiktokblock:test` (78 checks: the 4 s rule, the 10-minute memory,
the strip and its buttons, retry waits 30 s, recovery, blocked storage; stream countdown
and Stay; link-out and Try anyway; the three anonymous events; single clips) and the existing `npm run tiktok:test` (35, unchanged).

## Related, done 2026-11-11: stricter caching for the individual feed servers

Separate from the player error, but it keeps our own upstream traffic down so
the feed itself does not hit the same kind of limit. `services/feed/ServerGuard.js`
sits in front of every feed server: fresh answers reused (10-20 min per server),
concurrent readers share one call, the last good page covers a failure for up to
6 h, and a server that answers 429/5xx/timeout is left alone for 1-15 min
(doubling). Permanent refusals (403/422) are remembered for 5 min per request. The
9 AM job now also pre-builds each network's pill, so a pill click is a cache hit.
