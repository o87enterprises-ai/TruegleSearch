# TRAIL — design brief

**A hidden game on Truegle's 404 page.**
Working title: *Trail*. Rename it whatever you like — nothing in code depends
on the name.

This document is self-contained. Hand it to a design tool or a designer with
no other context. It states what is fixed, what is open, and exactly what
needs to come back for programming to start.

---

## 1. What this is

A small game nobody is sent to. It lives on the **404 page** — the page you
land on when you mistype a URL — so every player found it by accident. That
framing drives several decisions below and is worth holding on to: it should
feel like something left behind rather than something marketed.

**Concept:** post-apocalyptic *Oregon Trail*. You are travelling. Things go
wrong. Supplies run out.

**Play cycle:** one continuous run, **single life**. No saves, no checkpoints,
no continues. You die and it is over.

Alongside the game, the same page hides a set of offline survival-guide PDFs —
so the page is worth having even with no internet. The game and the documents
share one offline cache; that is why the size budget below is strict.

---

## 2. Hard constraints

These are fixed. They are not preferences, and changing one after assets exist
means redrawing everything, so they are stated first with the reason attached.

| Constraint | Value | Why |
|---|---|---|
| Renderer | Plain HTML canvas, 2D | No game engine, no library, no npm package. The page must not carry a framework for an easter egg. |
| Logical resolution | **320 × 180** | 16:9, so it fills a phone in landscape and a desktop window without letterbox bars on the long axis. |
| Scaling | Integer only, nearest-neighbour | ×2, ×3, ×4… Fractional scaling smears pixel art. This is the single biggest determinant of whether it looks intentional. |
| Colour | **One palette, ≤ 16 colours**, every asset | See §4. The most important rule in this document. |
| Total asset weight | **≤ 400 KB** | It is precached for offline use, so it downloads for everyone — including the vast majority who never see a 404. |
| Input | Keyboard **and** touch, both complete | It will be opened on a phone more often than on a desktop. A keyboard-only game is broken for most players. |
| Sound | Optional, ≤ 60 KB of the budget, **never autoplays** | Browsers block it anyway, and a 404 page that starts making noise is hostile. Sound only after a deliberate press. |
| Licensing | Original or verifiably free for commercial use | This ships on a public site. Anything with unclear provenance cannot be used. |

**Also fixed:** the game is lazy-loaded. Someone who hits a 404 and leaves
downloads none of it.

---

## 3. Asset manifest

PNG, transparent background, **no padding between frames**. Frames sit on a
fixed grid, which is what lets the code slice a sheet without an accompanying
atlas file — so no atlas JSON is needed, just tell us the frame count per row.

| File | Cell size | Contents |
|---|---|---|
| `party.png` | 32 × 32 | The traveller / group / vehicle. Row order: idle, walk cycle, hurt, dead. |
| `hazards.png` | 16 × 16 | One cell per hazard type. |
| `items.png` | 16 × 16 | Supplies — one cell each. |
| `ui.png` | 8 × 8 | Icons, gauge segments, cursor, button glyphs. |
| `backdrop-<biome>.png` | 320 × 180 | One full-frame scene per biome. |
| `parallax-<biome>-<layer>.png` | 640 × 180 | Horizontally tiling strips. Double width so the loop is seamless. |
| `font.png` | 6 × 8 cells | ASCII 32–126 in order, left to right. See §5. |

Return with the manifest: **frame count for every row of every sheet.** That is
the only metadata programming needs.

**Compression:** run every PNG through `pngquant` then `oxipng`. Pixel art
typically drops 60–80% with no visible change, and the budget is real.

---

## 4. Palette — the rule that matters most

Pick **one palette of 16 colours or fewer** and hold every single asset to it.

Assets produced from separate prompts or separate sittings will not look like
one game unless the palette is fixed in advance. This is the difference between
"a game" and "a folder of pictures", and it cannot be repaired afterwards
without repainting.

Any established pixel palette is fine — DB16, Endesga-16, Sweetie-16, or one of
your own. **Return the hex list.** A build check will be added that fails if
any asset contains a colour outside it, so the rule holds after everyone has
stopped paying attention.

Two practical notes:

- Include a true black and a near-white; a palette with no anchors at the ends
  makes UI text hard to read at 320 × 180.
- Reserve one colour as the UI colour and do not use it in art. Legibility over
  a busy backdrop is otherwise a fight you have on every screen.

---

## 5. Type

A **bitmap font sheet** is strongly preferred: crisp at every integer scale,
and a few kilobytes instead of tens.

`font.png`, fixed **6 × 8** cells, ASCII 32–126 in order. Uppercase-only is
acceptable and period-appropriate; if so, map lowercase to the same glyphs.

If you would rather not draw one, say so and the system monospace will be used
at integer sizes. It will look less deliberate but it will work.

---

## 6. Content — written, not coded

All game text and tuning lives in JSON files that you can write directly. No
programming is involved and nothing here needs to wait for code.

```
events.json    random encounters — text, choices, outcomes
biomes.json    the stretches of road, their hazards, their odds
items.json     supplies: names, weights, effects
endings.json   death screens, and any ending that is not death
```

### Event shape

```json
{
  "id": "raider-toll",
  "biome": "highway",
  "weight": 3,
  "text": "Three of them across the road. One is holding a stop sign like a shield.",
  "choices": [
    { "label": "Pay the toll", "cost": { "fuel": 2 }, "text": "They wave you through." },
    { "label": "Run it",       "risk": 0.4, "fail": { "hp": -2 }, "text": "Metal on metal." },
    { "label": "Talk",         "risk": 0.7, "fail": { "hp": -1 }, "win": { "morale": 1 } }
  ]
}
```

`weight` is relative frequency. `risk` is the chance of the `fail` branch,
0–1. Omit any key that does not apply.

### Biome shape

```json
{
  "id": "highway",
  "label": "Cracked Highway",
  "distance": 120,
  "hazards": ["raiders", "breakdown", "storm"],
  "drain": { "fuel": 0.4, "water": 0.2 }
}
```

`drain` is per unit of distance travelled.

**Write text at 320 × 180.** Roughly **40 characters per line, 5 lines** of
comfortable body space at 6 × 8 type. Longer event text will need paging, which
is fine, but it changes the pacing — worth feeling out early.

---

## 7. Decisions to return

Fill in `404-game-decisions.template.json` (supplied alongside this brief) and
send it back. Every field changes the code, so nothing starts until they are
settled.

1. **Death model.** One health pool, or *Oregon Trail*'s model where each party
   member is tracked individually and the run ends with the last of them?
2. **Endless or a destination.** Rising difficulty forever, or somewhere you
   can actually arrive? A single-life game with no win state is a bleaker thing
   than one with a rare ending. Both are valid; they are different games, and
   they need different pacing curves.
3. **Resources.** Which actually exist? Four is plenty for something people
   find by mistyping a URL; six starts to need a tutorial, and there is nowhere
   to put one.
4. **Persistence.** Single life implies no saves — but a local best-distance
   counter is a different thing from a save. If yes, it stays in the browser;
   nothing about a player ever leaves their device.
5. **Palette hex list.**
6. **Frame counts** for every sheet row.
7. **Title**, if not *Trail*.

## 8. Delivery

A single folder or zip:

```
art/      the PNGs from §3
content/  the JSON from §6
sound/    optional, ≤ 60 KB total
DECISIONS.json
PALETTE.txt   the hex list, one per line
```

Anything missing simply will not appear in the build — the game reads what is
there. Partial deliveries are workable, so send what is ready rather than
holding everything for the last sprite.
