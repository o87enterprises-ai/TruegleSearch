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
