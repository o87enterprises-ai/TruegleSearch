/* Four different ways of not knowing where you are, told apart.
 *
 * THE BUG. Every geolocation failure was reported as a denied permission.
 * Switch the location toggle off on an Android phone and Truegle said
 * "Location permission denied. Please enable location access in your browser
 * settings" — pointing at a setting that was already correct, for a problem
 * somewhere else entirely. A slow GPS fix said the same thing.
 *
 * WHY THE ERROR CODE ALONE CANNOT ANSWER IT. The browser reports
 * POSITION_UNAVAILABLE (code 2) for two unrelated situations: the OS location
 * services are off, and the device just cannot get a fix. Same code, different
 * fix, and no way to choose between them from the error object.
 *
 * The Permissions API is the second input that separates them. Permission
 * `granted` plus code 2 means the browser is not the obstacle — something
 * below it is. That pairing is what the tests below actually pin; a test that
 * only checked the error code would pass on the bug.
 *
 * Run it:  npm run geo:test
 */
import { createServer } from 'vite';
import { launchChromium } from './lib/browser.mjs';

let passed = 0;
let failed = 0;
const ok = (label, cond, detail = '') => {
  if (cond) { passed++; console.log(`PASS ${label}${detail ? ` — ${detail}` : ''}`); }
  else { failed++; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};

const server = await createServer({ server: { port: 5200, strictPort: true }, logLevel: 'error' });
await server.listen();
const BASE = 'http://localhost:5200';
const browser = await launchChromium();

/**
 * A page with geolocation forced into a given shape.
 * `permission` is what navigator.permissions reports; `errorCode` is what
 * getCurrentPosition fails with (0 = succeed).
 */
async function pageWith({ permission = 'prompt', errorCode = 0, noGeo = false }) {
  const ctx = await browser.newContext();
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage();
  await page.addInitScript(({ permission: perm, errorCode: code, noGeo: none }) => {
    if (none) {
      // NOT `delete navigator.geolocation` — that is a no-op. geolocation is
      // an accessor on Navigator.prototype rather than an own property, so the
      // delete quietly succeeds and leaves the REAL API in place. It then ran
      // with the browser default timeout of Infinity and hung the run.
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
    } else {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (success, fail) => {
            if (!code) {
              success({ coords: { latitude: 43.79, longitude: -123.05, accuracy: 20 } });
            } else {
              fail({ code, message: `stub error ${code}`, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 });
            }
          },
          watchPosition: () => 0,
          clearWatch: () => {},
        },
      });
    }
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: async () => ({ state: perm }) },
    });
  }, { permission, errorCode, noGeo });
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  return { ctx, page };
}

const ask = (page) => page.evaluate(async () => {
  const mod = await import('/src/utils/geolocation.js');
  const r = await mod.requestPosition();
  return { ok: r.ok, kind: r.kind, title: r.title, message: r.message, position: r.position, canRetry: r.canRetry };
});

// ── The reported case: device location off, permission already granted ─────
{
  const { ctx, page } = await pageWith({ permission: 'granted', errorCode: 2 });
  const r = await ask(page);
  ok('a switched-off device is NOT reported as a denied permission',
    r.kind === 'device-off', r.kind);
  ok('…the heading names the device, not the browser',
    /device/i.test(r.title) && !/permission denied/i.test(r.title), r.title);
  ok('…and the advice says the browser side is already correct',
    /already correct/i.test(r.message), r.message.slice(0, 70));
  await ctx.close();
}

// ── The same error code, but the browser never allowed it ──────────────────
// Identical code 2. Only the permission state distinguishes them, which is
// the whole reason the Permissions API is consulted.
{
  const { ctx, page } = await pageWith({ permission: 'prompt', errorCode: 2 });
  const r = await ask(page);
  ok('code 2 without a granted permission is NOT blamed on the device',
    r.kind === 'no-fix', r.kind);
  await ctx.close();
}

// ── A genuine browser refusal ──────────────────────────────────────────────
{
  const { ctx, page } = await pageWith({ permission: 'denied', errorCode: 1 });
  const r = await ask(page);
  ok('a real refusal is named as one', r.kind === 'browser-denied', r.kind);
  ok('…and this is the one case that points at browser settings',
    /site settings|address bar/i.test(r.message), r.message.slice(0, 70));
  await ctx.close();
}

// ── A timeout is not a refusal ─────────────────────────────────────────────
{
  const { ctx, page } = await pageWith({ permission: 'granted', errorCode: 3 });
  const r = await ask(page);
  ok('a timeout is its own thing, not a denial', r.kind === 'timeout', r.kind);
  ok('…and never mentions permission', !/permission|denied/i.test(r.message),
    r.message.slice(0, 70));
  await ctx.close();
}

// ── Success still works ────────────────────────────────────────────────────
{
  const { ctx, page } = await pageWith({ permission: 'granted', errorCode: 0 });
  const r = await ask(page);
  ok('a granted position comes back', r.ok === true && r.position?.lat === 43.79,
    JSON.stringify(r.position));
  await ctx.close();
}

// ── No geolocation API at all ──────────────────────────────────────────────
{
  const { ctx, page } = await pageWith({ noGeo: true });
  const r = await ask(page);
  ok('an unsupported browser is told so, not blamed', r.kind === 'unsupported', r.kind);
  ok('…and is not offered a pointless retry', r.canRetry !== true, String(r.canRetry));
  await ctx.close();
}

// ── No Permissions API (older Safari) ──────────────────────────────────────
// Missing permissions must never READ as a denial — that would turn every
// Safari user into a "you blocked us" message.
{
  const ctx = await browser.newContext();
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (s, f) => f({ code: 2, message: 'nope' }),
        watchPosition: () => 0,
        clearWatch: () => {},
      },
    });
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: undefined });
  });
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  const state = await page.evaluate(async () => {
    const mod = await import('/src/utils/geolocation.js');
    return mod.permissionState();
  });
  ok('a missing Permissions API reports unknown, never denied', state === 'unknown', state);
  const r = await ask(page);
  ok('…and its failure is not attributed to the device either',
    r.kind === 'no-fix', r.kind);
  await ctx.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
await browser.close();
await server.close();
process.exit(failed === 0 ? 0 : 1);
