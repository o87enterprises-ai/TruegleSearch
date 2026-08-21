# Browser tests: wait for the thing, don't sleep through it

The verifier suites carried **sixty `waitForTimeout` calls — two minutes of
guessing.** Every one of those numbers was a bet. Too short and the suite fails
on a slow machine for no reason; too long and everybody pays for the worst case
on every run. Both look like "the browser tests are flaky and slow", and neither
is the browser's fault.

## The helpers

```js
import { launchChromium, testContext, openApp, until } from './lib/browser.mjs';
```

**`openApp(page, url, { ready })`** — navigate and wait until the app has
actually rendered. `domcontentloaded` fires long before React has mounted
anything, which is exactly why every `goto` used to be followed by a
three-to-four second sleep. It also **stops every animation** (durations and
delays zeroed): Framer Motion and CSS transitions are the real reason a sleep
felt necessary, because an element can be in the DOM and still sliding into
place, so a measurement taken early is *wrong* rather than merely absent.

**`until(fn, { what, timeout })`** — poll until `fn` is truthy. Returns the
moment it holds, and on timeout says what never arrived instead of leaving a
bare `false` for an assertion three lines below to trip over.

**`testContext(browser, opts)`** — a context with the settings that make a run
deterministic, including `reducedMotion: 'reduce'` for anything that asks the
media query rather than being driven by CSS.

## The rule that matters

**Wait for what the assertion reads, not for something earlier in the chain.**

Both regressions found while converting these suites were this exact mistake:

- waiting for the *feed request* when the assertion read the *rendered error
  panel* — failed about one run in three;
- waiting for the *places request* when the assertion read the *rendered
  suggestion* — failed every run.

The old sleeps hid both by being longer than the whole round trip. That is what
a fixed sleep buys you: not correctness, just a delay before you find out.

## The one honest sleep

Asserting something does **not** happen. There is no event for "nothing is going
to arrive", so the only way to test a negative is to allow enough time for it to
have arrived and then look. Keep it short, and say in a comment that it is
deliberate — otherwise it gets copied as the house style.

```js
// THE ONE HONEST SLEEP. This asserts a request does NOT happen …
await page.waitForTimeout(1200);
check(calls.filter(c => c.path === '/api/social/feed').length === 0, '…');
```

## Result so far

| suite | before | after | sleeps |
|---|---|---|---|
| `feedpage:test` | 117s | 82s | 13 → 1 |
| `mapui:test` | 71s | 48s | 16 → 12 |

Verified stable across repeated runs, which is the point — a suite that is fast
and occasionally wrong is worse than one that is slow.

Remaining suites still on sleeps: `vault-browser`, `trail-browser`,
`trail-page`, `chat-map`, `camera-view`, `autocomplete-ui`. Same conversion,
same rule.

## What about swapping the browser engine?

Looked at [Obscura](https://github.com/h4ckf0r0day/obscura) (Rust, CDP,
drop-in for Playwright). It is genuinely faster to start and much lighter —
~30 MB against Chromium's 200+. But **the time here was never Chromium's
startup**, it was the two minutes of sleeping, and no engine fixes that. Its
headline feature is anti-detect, which is worth nothing when the thing under
test is our own dev server on localhost.

Where it *would* earn its place is server-side page fetching on the 1 GB EC2
box, where 30 MB against 200+ MB is the difference between working and swapping.
That is a separate decision, and it comes with a caveat worth stating out loud:
evading bot detection is the same category of thing as routing around Reddit's
IP block, which we declined to do. Using it because it is small is fine. Using
it to get past sites that have said no is not.
