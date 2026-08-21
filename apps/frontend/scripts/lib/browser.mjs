import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

// Launching Chromium, on whichever machine is running the verifier.
//
// The scripts used to hardcode `executablePath: '/opt/pw-browsers/chromium'`.
// That path is real inside the cloud dev container, where a browser is
// pre-installed there and PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD stops npm fetching
// another. On a developer's own machine it does not exist, and Playwright does
// not fall back — it fails with "executable doesn't exist", which is what
// happens on Windows and on any normal Linux or macOS checkout.
//
// So: use that browser when it is actually there, and otherwise say nothing and
// let Playwright resolve the one it installed itself.

const PREINSTALLED = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium';

/**
 * @param {import('playwright').LaunchOptions} [options]
 * @returns {Promise<import('playwright').Browser>}
 */
export async function launchChromium(options = {}) {
  const launch = existsSync(PREINSTALLED)
    ? { executablePath: PREINSTALLED, ...options }
    : options;

  try {
    return await chromium.launch(launch);
  } catch (error) {
    // The most common cause by far is a checkout that has never run
    // `playwright install`. The raw error does not say that, so it gets
    // several minutes of confusion it does not deserve.
    if (/executable doesn't exist|Executable doesn't exist/i.test(error.message)) {
      throw new Error(
        'No Chromium available for Playwright.\n'
        + '  Install one:  npx playwright install chromium\n'
        + '  Or point at an existing browser:  PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium\n'
        + `\nOriginal error: ${error.message}`,
      );
    }
    throw error;
  }
}

export default launchChromium;

// ── WAITING FOR THE APP INSTEAD OF SLEEPING THROUGH IT ──────────────────────
//
// The browser suites carried sixty `waitForTimeout` calls between them — two
// solid minutes of guessing. Every one of those numbers is a bet: too short and
// the suite fails on a slow machine for no reason, too long and everybody waits
// for the worst case on every run. Both failure modes look like "the browser
// tests are flaky and slow", and neither is the browser's fault.
//
// The helpers below wait for the thing itself. A test that says what it is
// waiting for finishes as soon as that happens, and when it does time out it
// says what never arrived rather than failing an assertion three lines later.

/** How long a wait may take before it is a genuine failure. */
const DEFAULT_TIMEOUT_MS = 15000;

/**
 * Poll until `fn` returns something truthy.
 *
 * The replacement for `await page.waitForTimeout(2000)` followed by a check:
 * same intent, but it returns the moment the condition holds, and its timeout
 * message names the condition instead of leaving a bare `false` behind.
 *
 * @param {() => unknown | Promise<unknown>} fn
 * @param {{ timeout?: number, interval?: number, what?: string }} [opts]
 */
export async function until(fn, { timeout = DEFAULT_TIMEOUT_MS, interval = 100, what = 'condition' } = {}) {
  const deadline = Date.now() + timeout;
  let last;
  for (;;) {
    try {
      last = await fn();
      if (last) return last;
    } catch (e) {
      last = e.message;   // a selector that is not there yet throws; keep going
    }
    if (Date.now() > deadline) {
      throw new Error(`Timed out after ${timeout}ms waiting for ${what}`
        + (typeof last === 'string' ? ` — last error: ${last}` : ''));
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}

/**
 * Open a page of the app and wait until it has actually rendered.
 *
 * `domcontentloaded` fires long before React has mounted anything, which is
 * exactly why the suites followed every goto with a three-to-four second sleep.
 * This waits for the root to have real content instead.
 *
 * It also stops every animation. Framer Motion and CSS transitions are the
 * reason a fixed sleep felt necessary at all — an element is in the DOM but
 * still sliding into place, so a measurement taken too early is wrong rather
 * than merely absent. With durations zeroed, the final state IS the first
 * state, and there is nothing left to wait out.
 */
export async function openApp(page, url, { timeout = DEFAULT_TIMEOUT_MS, ready } = {}) {
  await page.addStyleTag({ content: STILL }).catch(() => { /* no document yet */ });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: STILL }).catch(() => { /* navigated away */ });
  await until(
    // Evaluated INSIDE the page, where `document` exists. eslint lints this file
    // as node, so the browser globals are named through the string form rather
    // than closed over — same code, no lie about where it runs.
    async () => page.evaluate(
      '(() => { const r = document.getElementById("root") || document.body;'
      + ' return !!r && r.childElementCount > 0 && r.innerText.trim().length > 0; })()',
    ),
    { timeout, what: `${url} to render` },
  );
  if (ready) await until(() => page.locator(ready).count().then((n) => n > 0), { timeout, what: ready });
  return page;
}

// Applied on every page the helpers open. `!important` on both the duration and
// the delay, because a delayed animation is just a slower one.
const STILL = `*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  scroll-behavior: auto !important;
}`;

/**
 * A context with the settings that make a suite deterministic.
 *
 * `reducedMotion` is belt and braces alongside STILL: the stylesheet handles
 * anything driven by CSS, and this handles anything that asks the media query
 * itself and takes a different code path.
 */
export async function testContext(browser, opts = {}) {
  return browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
    ...opts,
  });
}
