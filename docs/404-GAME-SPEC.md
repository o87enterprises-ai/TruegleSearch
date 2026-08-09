# The 404 game — asset & content contract

Owner designs, agent programs. This is the interface between the two, so
design work lands without rework and engineering doesn't guess.

**Concept (owner, 2026-08-09):** post-apocalyptic Oregon Trail. One continuous
play cycle, **single life**, no saves, no checkpoints. You die, it's over, you
start again. Lives on the 404 page alongside the hidden survival-guide PDFs.

---

## The one thing that changes your design

`public/sw.js` today is a **self-destructing kill switch**, not an offline
cache. It was put there on 2026-06-15 to clean up after a rogue third-party ad
service worker: it claims control, deletes every cache, unregisters itself and
reloads the tab. The app never calls `navigator.serviceWorker.register()`.

So **nothing is cached offline right now**, and both the game and the survival
PDFs need that. The kill switch has been in place ~8 weeks, which is the
"weeks" its own comment asked for, so the plan is to replace it with a real
precaching worker scoped to the 404 payload only. Nothing else about the site
starts being cached — that would change behaviour everywhere for one page.

Design consequence: **assets must fit an offline budget.** See below.

---

## Fixed technical decisions

| | |
|---|---|
| Engine | None. Plain `<canvas>` 2D, no dependency, no npm package. |
| Delivery | Lazy-loaded chunk. A normal 404 downloads none of it. |
| Logical resolution | **320 × 180**, integer-scaled to fit, letterboxed. Classic 16:9 pixel canvas. |
| Scaling | Nearest-neighbour. Never fractional — fractional scaling is what makes pixel art look muddy. |
| Input | Keyboard **and** touch. It will be opened on a phone more often than not. |
| Offline | Service-worker precached, so it plays with no service. |
| Cost | $0. Nothing third-party, no fonts from a CDN, no analytics, no store. |

---

## Asset budget

**≤ 400 KB total, all assets combined.** This is precached, so every byte is
downloaded by people who never open the 404 page.

PNG, indexed colour where possible. Run everything through `oxipng`/`pngquant`
before handing it over — pixel art usually drops 60–80% with no visible change.

---

## Sprite sheets

One sheet per category, power-of-two width, transparent background, **no
padding between frames** (a fixed grid is what lets the code slice it without
a metadata file).

| Sheet | Cell | Notes |
|---|---|---|
| `party.png` | 32 × 32 | The travelling group / vehicle. Frames laid out left→right: idle, walk ×N, damaged, dead. |
| `hazards.png` | 16 × 16 | One cell per hazard type. |
| `items.png` | 16 × 16 | Supplies: water, fuel, food, meds, ammo, parts. |
| `ui.png` | 8 × 8 | Icons, gauge segments, cursor. |
| `backdrop-*.png` | 320 × 180 | Full-frame scene backgrounds, one per biome. |
| `parallax-*.png` | 640 × 180 | Horizontally tiling strips (double width so they loop seamlessly). |

Tell me the frame counts per row and I'll wire them; don't hand-write an atlas
JSON, the grid is enough.

## Palette

Pick **one palette of ≤ 16 colours** and hold every asset to it. This matters
more than any individual sprite: assets generated from separate prompts will
not look like one game unless the palette is fixed up front. Any established
pixel palette works (DB16, Endesga, your own) — send me the hex list and I'll
add a build check that fails if an asset uses a colour outside it.

## Type

A **bitmap font sheet** is preferred over a web font: it stays crisp at integer
scales, and it is a few KB rather than tens. `font.png`, fixed cell (suggest
6 × 8), ASCII 32–126 in order. If you'd rather not, say so and I'll use the
system monospace at integer sizes.

---

## Content you write, not code

Everything below is JSON in `src/games/trail/content/`. Write as much or as
little as you like; the game reads whatever is there.

```
events.json      the random encounters — text, choices, outcomes
biomes.json      the stretches of road, their hazards and their odds
items.json       supply names, weights, what they cure
endings.json     the death screens, and the rare one that isn't death
```

Event shape, so you can write them before any code exists:

```json
{
  "id": "raider-toll",
  "biome": "highway",
  "weight": 3,
  "text": "Three of them across the road. One is holding a stop sign like a shield.",
  "choices": [
    { "label": "Pay the toll",  "cost": { "fuel": 2 },       "text": "They wave you through." },
    { "label": "Run it",        "risk": 0.4, "fail": { "hp": -2 }, "text": "Metal on metal." },
    { "label": "Talk",          "risk": 0.7, "fail": { "hp": -1 }, "win": { "morale": 1 } }
  ]
}
```

---

## Decisions I still need (not blocking — answer when you've designed)

1. **What kills you.** One HP pool, or Oregon Trail's model where each party
   member is tracked separately and the run ends when the last one dies?
2. **What "continuous" means.** Endless road with rising difficulty, or a fixed
   destination you can actually reach? A single-life game with no win state is
   a bleaker thing than one with a rare ending — both are valid, they're just
   different games.
3. **Resources.** Which of fuel / water / food / meds / ammo / morale actually
   exist? Fewer is better; four is plenty for something people find by
   mistyping a URL.
4. **Does anything persist?** Single-life says no saves, but a local
   best-distance counter is a different thing from a save. Your call. (If yes:
   localStorage only, nothing leaves the browser — same rule as everything else
   here.)
5. **Palette hex list**, once you've picked it.

## What I'll do while you design

Nothing on the game — you asked to pause, and building a loop before the
mechanics exist just means throwing it away. The survival-guide easter egg is
separable and I can build its hiding + offline plumbing independently, since
that work is the same whatever the game turns out to be.
