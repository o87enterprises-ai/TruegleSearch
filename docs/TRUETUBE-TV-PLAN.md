# True Tube on the TV — action plan

Status: **planning only. Nothing gets built until this is settled.**
Owner decisions needed are marked **[DECIDE]**.

---

## 1. The one question that decides the whole shape

**Can a Truegle TV app play YouTube videos?**

No — not the way the web player does.

The YouTube iframe embed is a *browser* product. YouTube's terms don't permit
it on TV platforms, the platforms' own review teams reject apps that try it,
and the certified "YouTube on TV" experiences are partner integrations with
Google, not something a small app opts into. Assume this stays true.

That kills the obvious idea (ship the web player on a TV) and leaves three
honest options:

| Option | What it is | Verdict |
|---|---|---|
| **A. Hand off** | TrueTube on the TV is discovery, search, queue and remote. When you press play on a YouTube item it **launches the TV's own YouTube app** at that video (every TV platform supports this deep link). | **Recommended.** Legal, free, and works on day one. |
| **B. Play only what we may** | Direct audio/video files, and creator content where the creator has given us the rights. No YouTube. | Real, but the catalogue is thin. Good as the *second half* of A, not on its own. |
| **C. Become a YouTube partner** | Apply for a certified TV integration. | Not available to us at this size. Revisit at scale. |

**Plan: A + B.** TrueTube on TV is the *place you decide what to watch*, and it
plays directly whatever it legitimately can. **[DECIDE]** — confirm before any
build; everything below assumes it.

---

## 2. Which TVs, and what it costs

Our app is a React/Vite SPA. Two TV platforms take HTML apps directly, which
makes them enormously cheaper for us than the rest.

| Platform | Tech | Dev account | Reuses our code? |
|---|---|---|---|
| **Samsung (Tizen)** | packaged web app | free | yes — most of it |
| **LG (webOS)** | packaged web app | free | yes — most of it |
| **Amazon Fire TV** | HTML5 web app | free | yes, with caveats |
| Android TV / Google TV | native (Kotlin) | **$25 one-time** | no |
| Apple TV (tvOS) | native (Swift), no web apps | **$99/year** | no |
| Roku | BrightScript/SceneGraph, no HTML | free to publish | no — full rewrite |

**Budget flag:** Tizen, webOS and Fire TV are **$0**. Android TV is a one-time
**$25**; Apple TV is **$99/year** and a separate codebase. Per the standing $0
budget, phases 1–3 below spend nothing; anything past that needs your sign-off.

**Start with Samsung + LG.** Same web tech, free, and between them a large
installed base. Fire TV next. Roku and Apple TV are separate products, not
ports — treat them as their own decision later.

---

## 3. What v1 actually is

A ten-foot version of Tube, not a port of the website.

1. **Browse** — the creator rows we already have (`CREATORS` + their latest
   uploads via the existing free RSS/Data-API proxy), plus community media.
2. **Search** — the same query logic (`playerQuery.js`, the @handle rule, the
   scope chips) against the same backend.
3. **Queue** — the same model as the web player: current, up-next, play modes.
4. **Play**:
   - direct media and anything we may host → plays **in** the app;
   - YouTube → **launches the TV's YouTube app** at that video, with a clear
     "Opening in YouTube" beat so it never feels like a bug.
5. **Phone as remote** — pair the TV to a phone with a short code; search and
   queue from the phone, watch on the TV.

That last one matters more than it sounds: **typing on a TV remote is the worst
part of every TV app**, and we already have the phone side built.

**Explicitly not in v1:** accounts/sign-in, ads, recommendations, Shorts feed,
downloads, casting *from* the phone's video player.

---

## 4. What has to be built that we don't have

- **Focus/D-pad navigation.** No pointer, no hover. Every surface needs a focus
  model and spatial arrow-key movement. This is the single biggest UI cost and
  it touches every component we'd reuse.
- **Ten-foot layout.** Read at 3 metres: far larger type, fewer items per
  screen, high contrast. Our current density is wrong for it.
- **A TV shell.** Separate entry point and route tree — the search page, pills,
  ads and footer have no place on a TV.
- **Deep-link launcher.** Per-platform "open YouTube at this video" calls.
- **Pairing service.** Short code → session, phone pushes queue actions to the
  TV. Small backend addition; reuses the player queue shape.
- **Packaging + store submission** per platform (icons, manifests, age rating,
  privacy policy, review cycles measured in weeks).

---

## 5. Phases

| Phase | Outcome | Cost |
|---|---|---|
| **0. Decide** | Confirm option A+B, and Samsung/LG first. Register the free dev accounts. | $0 |
| **1. Prototype** | TV shell + D-pad navigation + creator rows, running in the Tizen emulator. Answers "does our stack feel right on a TV" before anything else is built. | $0 |
| **2. Playback** | Direct media plays in-app; YouTube deep-links out. Queue and play modes working. | $0 |
| **3. Pairing** | Phone-as-remote, search from the phone. | $0 |
| **4. Ship one** | Samsung store submission, review, fixes. | $0 |
| **5. Second platform** | LG (small delta), then Fire TV. | $0 |
| **6. Reconsider** | Android TV ($25) / Roku (rewrite) / Apple TV ($99/yr) on evidence from 4–5. | needs sign-off |

Phase 1 is the real go/no-go. If D-pad navigation over our components is
miserable, better to learn that in a week than after a store submission.

---

## 6. Risks, honestly

- **The catalogue problem.** If most of what people want is YouTube, a TV app
  that hands YouTube off may not feel worth installing. Phase 1 should test the
  *feeling* of that hand-off with real people before we build phases 2–5.
- **Store review.** TV stores are stricter than the web. An app that mostly
  points at another app can be rejected as "not enough original content" —
  which is another reason phase 2 (things we play ourselves) matters.
- **Maintenance surface.** Each platform is its own release, its own bugs, its
  own review queue, on top of the web app.
- **No ad revenue on TV at first.** The web model doesn't transfer; TV ad
  formats are a separate business conversation.

---

## 7. Open questions **[DECIDE]**

1. Confirm option **A + B** (hand off YouTube, play what we may)?
2. Samsung + LG first, or is there a device you actually use that should lead?
3. Is the phone-as-remote a v1 feature or a phase-3 nicety?
4. Is any spend acceptable later ($25 Android TV, $99/yr Apple TV), or is $0 a
   hard ceiling for this too?
5. What does "done" look like for v1 — in a store, or running on your own TV in
   developer mode?

Answer these and the next step is a phase-1 spec, not code.
