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

**Still to do:**

4. **Streams keep moving:** a TikTok that is probably blocked is skipped to the next
   playable item instead of stalling the queue (needs a rule for when to skip,
   since the card cannot say).
5. **Count it, anonymously.** A `tiktok-blocked` event through the existing
   player-diagnostics beacon (`utils/playerDiagnostics.js` → `/api/player/diagnostics`,
   no user, session or IP), so `/api/admin/player-health` shows whether this is
   rare or constant.
6. **If it stays constant:** make "Open on TikTok" the default for TikTok items and
   say so in the UI. There is no keyless alternative player.

Tests: `npm run tiktokblock:test` (33 checks: the 4 s rule, the 10-minute memory,
the strip and its three buttons, retry waits 30 s, recovery clears the memory,
blocked storage) and the existing `npm run tiktok:test` (35, unchanged).

## Related, done 2026-11-11: stricter caching for the individual feed servers

Separate from the player error, but it keeps our own upstream traffic down so
the feed itself does not hit the same kind of limit. `services/feed/ServerGuard.js`
sits in front of every feed server: fresh answers reused (10-20 min per server),
concurrent readers share one call, the last good page covers a failure for up to
6 h, and a server that answers 429/5xx/timeout is left alone for 1-15 min
(doubling). Permanent refusals (403/422) are remembered for 5 min per request. The
9 AM job now also pre-builds each network's pill, so a pill click is a cache hit.
