# Truegle Games — action plan

Status: **planning only. Nothing gets built until this is settled.**
Owner decisions are marked **[DECIDE]**.

---

## 1. The three games you named cannot be done

Words with Friends, Monopoly and Clash of Clans are **native mobile apps**,
owned by Zynga, Hasbro and Supercell. There is no web build, no embed API, and
no licensing path at our size. The Facebook versions people remember ran on
**Meta Instant Games**, which is Meta-only and gated behind their app review —
the same wall that already blocks us from Instagram and Facebook Reels.

This is not a technical obstacle to route around. Embedding them would mean
either scraping a game client we have no licence to, or shipping a clone using
their trademarks. Both end the same way.

**What IS achievable** is the *thing underneath the request*: a page where
people play familiar casual games against each other without leaving Truegle.
A Words-with-Friends-**like** is entirely buildable. Words With Friends is not.

---

## 2. Two ways to get games, and they are very different

| Route | What it is | Cost | Catch |
|---|---|---|---|
| **A. Third-party HTML5 network** | GameDistribution / CrazyGames / Poki: thousands of ready games, dropped in as an iframe, revenue share back to us. | $0 to join | **Collides with AD-POLICY** — see §3. Also: not our content, can vanish, and the quality floor is low. |
| **B. We host our own** | Open-source and public-domain games we ship ourselves: chess, checkers, 2048, Sudoku, solitaire, minesweeper, Connect 4, dominoes, backgammon, a word game. | $0 | Slower to build. But it is ours, it carries no third-party JavaScript, and it cannot be turned off by somebody else. |

**Recommendation: B, and only B, for v1.** Not because A is unusable, but
because A's economics are the *entire* reason to pick it, and §3 shows those
economics are the part we can't have.

---

## 3. 🔴 The AD-POLICY collision — this is the real decision

`docs/AD-POLICY.md` Rule 2 bans, on every page, from every network, forever:

> Popunder / popup · Social Bar / in-page push · Browser push · **Interstitial /
> full-page** · Top-window redirect

**Every HTML5 game network monetises with exactly those formats.** Their SDKs
serve a full-page interstitial between levels and rewarded video before a
retry. That is the product. A network game with its ads disabled earns nothing,
and most partner agreements forbid disabling them.

Three ways this can go:

1. **Keep the policy, build our own games (recommended).** Games earn nothing
   directly; they earn *session time*, and the in-content native banner already
   permitted on non-landing pages runs beside them. Slower, smaller catalogue,
   zero risk.
2. **Carve out an exception** — "interstitials are permitted *inside* a
   sandboxed game iframe, never on a Truegle page." Defensible, since the
   sandbox already prevents top-navigation. But the 2026-08-01 hijack came
   through an ad iframe we thought was contained, and Rule 2 exists because of
   it. If you want this, it must be written into AD-POLICY.md as a named
   exception with its own `check:ads` rule — not left as an understanding.
3. **Network games with no ad SDK.** Some catalogues offer ad-free embeds at a
   lower revenue share or none. Real, but then we are carrying somebody else's
   games for no money, which is strictly worse than option 1.

**[DECIDE] — 1, 2, or 3.** Everything below assumes 1.

---

## 4. What v1 is

A `/games` page. Familiar, turn-based, playable solo or against a friend.

1. **Browse** — a grid of games. Same page furniture as the rest of the site.
2. **Search** — filter by name/type. The existing search bar pattern, no new
   backend.
3. **Play solo** — every game works immediately, no account, no opponent.
4. **Play a friend** — start a match, get a Truegle link, send it. They open it
   and it is their turn. No sign-up for either side.
5. **Resume** — a match survives closing the tab.

**Explicitly not in v1:** real-time/action games, voice or video chat,
leaderboards, ranking, tournaments, in-game purchases, ads inside games.

### The starting six
Chosen because each is turn-based (see §5), well understood, and has a clean
open-source or public-domain rules implementation:

| Game | Solo | Vs. friend | Notes |
|---|---|---|---|
| Chess | vs. a weak built-in engine | ✅ | `chess.js` handles all rules; MIT |
| Checkers | ✅ | ✅ | Rules are small enough to write |
| Connect 4 | ✅ | ✅ | Trivial, good first vertical slice |
| Dominoes | ✅ | ✅ | The social one people actually play |
| Word duel *(the WWF-shaped one)* | ✅ | ✅ | Needs a dictionary — see §6 risk |
| 2048 / Sudoku / Minesweeper | ✅ | — | Solo filler, near-zero build cost |

---

## 5. Why turn-based only — the constraint that shapes everything

Vercel serverless **cannot hold a WebSocket**. There is no persistent
connection, so there is no free real-time channel. That is not a preference,
it is the hosting.

What we *do* have is Postgres. A turn-based match is a row: whose turn, the
board state, the move list. The opponent polls every few seconds and sees the
move. For chess, checkers, dominoes and word games that is **indistinguishable
from real-time**, because a human takes longer to think than the poll interval.

For anything action-based — a Clash-of-Clans-like, anything with a tick rate —
it is useless. Which is the second, independent reason those three games are
off the table.

Polling cost is real but small: one lightweight row read per player per few
seconds, only while a match is open, and it stops when the tab closes.
**[DECIDE]** if you would rather start with solo-only and add friend matches in
phase 3 — it halves v1.

---

## 6. What has to be built

- **Game shell.** One board container, one turn indicator, one move list, one
  resign/rematch control — shared by every game, the way `TrueglePlayer` is
  shared by all three player presentations. Getting this right once is most of
  the work; each additional game is then just rules + a board.
- **Match store.** A `games_matches` table (id, game, state JSONB, turn,
  players, updated_at) plus create/read/move endpoints. Mirrors the existing
  `community_media` shape closely enough to copy.
- **Invite links.** A short code → match id. `buildShareLink()` already does
  exactly this shape for the player; reuse it rather than inventing a second
  link format.
- **Anonymous players.** No account. A per-browser id in localStorage, same
  pattern as the taste profile — a game you can play without signing in is the
  point, and it matches the privacy stance.
- **Move validation ON THE SERVER.** A client-authoritative board is a
  cheat-by-devtools game. Rules run server-side; the client renders.
- **The route.** `/games` needs BOTH `public/_redirects` and `public/_headers`
  entries — the standing SPA rule.

---

## 7. Phases

| Phase | Outcome | Cost |
|---|---|---|
| **0. Decide** | §3 ad question, and solo-only vs. friend-matches in v1. | $0 |
| **1. Vertical slice** | `/games` page + shell + **Connect 4**, solo only. Proves the shell before six games are built on it. | $0 |
| **2. Multiplayer** | Match table, invite links, polling, server-side validation — still just Connect 4. Proves the hard part on the easy game. | $0 |
| **3. The catalogue** | Chess, checkers, dominoes, and the solo fillers on the proven shell. | $0 |
| **4. Word duel** | Last, because the dictionary is the only unsolved dependency (§8). | $0 |
| **5. Revisit** | Network games, if §3 went another way. | needs sign-off |

Phase 1 is the go/no-go. If the shell doesn't feel good with one game, six
won't fix it.

---

## 8. Risks, honestly

- **The word list.** A Scrabble-style game needs a dictionary, and the good
  ones (TWL, SOWPODS) are **copyrighted by Hasbro and Collins**. Free
  alternatives exist — ENABLE, and dwyl/english-words — and are public domain,
  but they are noisier: they accept words people will dispute and miss some
  they expect. This is why word duel is phase 4, not phase 1.
- **Trademark discipline.** "Word duel", not "Words with Friends". No board
  that looks like a Monopoly board. This has to hold in the copy, the icons and
  the OG images, not just the code.
- **Cheating.** Server-side validation stops board tampering. It does not stop
  someone running an engine beside a chess game. Acceptable for a casual page
  with no ranking — and a reason not to add leaderboards in v1.
- **Empty-lobby problem.** Friend matches need a friend. Every game must be
  fully playable solo on day one or the page reads as broken to the first
  visitor, exactly like the empty player viewport did.
- **Scope.** Six games is six times the surface of one. The shell is what makes
  that survivable; if phase 1 shows it isn't, cut to three.

---

## 9. Open questions **[DECIDE]**

1. **The ad question in §3** — keep AD-POLICY intact and build our own (1),
   write a sandboxed-iframe exception (2), or ad-free network games (3)?
2. Solo-only v1, or friend-matches in v1?
3. Is the starting six right, or is there a specific game you actually want
   people playing?
4. Accounts: anonymous-only (recommended), or do matches attach to a Truegle
   account so they follow you between devices?
5. Does `/games` get a pill in the mode row, or live in the BrandBar only?

Answer these and the next step is a phase-1 spec, not code.
