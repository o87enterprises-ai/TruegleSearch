# Truegle on the home screen — what's possible and what isn't

## The hard limit

**A website cannot create a home-screen widget.** Not a small one, not a
player, not a search box. Those are native surfaces:

| Platform | What a widget requires |
|---|---|
| Android | An APK containing an `AppWidgetProvider`, remote views, and a widget XML — Java/Kotlin, shipped through Play |
| iOS | A WidgetKit extension in Swift, inside an app shipped through the App Store |
| Windows 11 | The one exception: the `widgets` manifest member feeds the Widgets Board. Not a home screen, and desktop only. |

There is no web API for either home screen. A PWA cannot get one by being
installed, by asking for permission, or by any manifest field. If a widget is
genuinely the goal, that is a native app, and it is the same conversation as
`TRUETUBE-TV-PLAN.md`: a separate codebase, a store account, and review.

**Also impossible from a web page:** background voice capture. The microphone
is released when the tab is backgrounded, on every mobile browser, deliberately
— a page that could listen while you were elsewhere is exactly what that rule
exists to prevent. "Hey Truegle" from a locked phone needs a native app with a
foreground service.

## What ships instead

Everything below is live and costs nothing.

### 1. Install to the home screen
Manifest + HTTPS. The icon sits with the native apps and opens in `standalone`
display — no browser chrome, so it reads as an app.

### 2. Long-press shortcuts (`manifest.shortcuts`)
The closest real thing to widget buttons. Long-press the Truegle icon:

| Shortcut | Goes to | What it does |
|---|---|---|
| **Talk to Truegle** | `/search?voice=1` | Opens **already recording** — tap, speak, done |
| **True Tube** | `/tube` | The player, with whatever was queued still there |
| **Chat with TrueGLE** | `/chat` | Straight to the AI |
| **Search** | `/search` | Type a search |

Two taps from a locked phone to a spoken search. `?voice=1` is consumed once so
back-navigation and re-renders can't re-open the mic.

### 3. Share INTO Truegle (`manifest.share_target`)
Once installed, Truegle appears in the phone's own share sheet. Share a video
from YouTube, Reddit or a browser and it lands in the player and starts.

Android is inconsistent about where it puts the link — some apps fill `url`,
most stuff it into `text` beside the title — so both are read and a URL is dug
out of the text when that's all there is. An unplayable link gets the honest
"we can't play that provider" message rather than a blank screen.

### 4. Lock-screen controls (already shipped)
`MiniPlayer` sets Media Session metadata and play/pause/next/prev handlers, so
native audio and video show real transport controls on the lock screen and in
the notification shade. **This is the closest thing to a player widget that
exists on the web** — and it is the one thing here that genuinely looks like a
widget.

Its limit: Media Session only describes media *the page itself plays*. A
cross-origin YouTube embed's audio belongs to the iframe, so YouTube's own
notification appears instead of ours, and we can't relabel it. Nothing to fix —
that is the sandbox working.

## Background playback, honestly

Native `<audio>`/`<video>` keeps playing when the tab is backgrounded, with the
lock-screen controls above. **Cross-origin embeds do not** — mobile browsers
suspend an iframe's media when the page is hidden, which is why a YouTube video
stops when you switch apps. That is a platform rule, not a bug in the player,
and no amount of manifest or service-worker work changes it.

## If a real widget is wanted later

The cheapest honest path is a thin native shell:

- Android: a Kotlin app whose only job is a WebView on truegle.info plus an
  `AppWidgetProvider` — a search box, mic button, and now-playing row that
  deep-link into the WebView. **$25 one-time** for the Play account.
- iOS: the same shape with WidgetKit. **$99/year**, and Apple is stricter about
  WebView-wrapper apps than Google is.

Both are the same decision the TV plan is parked on: a second codebase and a
store relationship. **[DECIDE]** — not started, not costed beyond the account
fees, and firmly behind the $0 rule.
