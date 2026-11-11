/* Keyboard controls for the Game Boy player (Games category).
 *
 * Owner, 2026-11-11: "please add arrow controls / wasd for desktop users of the games
 * category as well as a space bar (b) enter (a) controls as well so the desktop users
 * can easily play the gameboy". Pinned:
 *   - arrows AND WASD are the d-pad, Space is B, Enter is A (plus E = Start, Q = Select,
 *     which the request did not name but most games cannot start without)
 *   - a key held down repeats keydown; the emulator is told once
 *   - two keys for one button (ArrowLeft + A) keep it down until BOTH are up
 *   - Ctrl/Cmd/Alt + a key, and typing in a field, are never game presses
 *   - Enter and Space on a focused button or link still press THAT (so the Close button
 *     works from the keyboard); arrows and WASD there are still the game's
 *   - a release is always honoured; window blur and closing release everything
 *   - in the real Games panel: the keys light the on-screen buttons, scroll nothing,
 *     leave other keys alone, and the legend shows on a desktop only
 *
 * Run it:  npm run gameboykeys:test
 */
import { createServer } from 'vite';
import { launchChromium, until, testContext } from './lib/browser.mjs';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const PORT = 5321;
const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
await server.listen();
const { createGameboyKeys, GAMEBOY_KEYS } = await server.ssrLoadModule('/src/utils/gameboyKeys.js');
const { GAMEBOY_LIBRARY } = await server.ssrLoadModule('/src/data/gameboyLibrary.js');

// ── the rules, without a browser ────────────────────────────────────────────
const plain = { closest: () => null };                       // a div: nothing pressable
const button = { closest: (sel) => (/button/.test(sel) ? {} : null) };
const ev = (code, extra = {}) => ({ code, target: plain, ctrlKey: false, metaKey: false, altKey: false, ...extra });
const rig = () => {
  const calls = [];
  const keys = createGameboyKeys((b, p) => calls.push(`${b}:${p ? 'down' : 'up'}`));
  return { keys, calls };
};

for (const [code, want] of [
  ['ArrowUp', 'up'], ['KeyW', 'up'], ['ArrowDown', 'down'], ['KeyS', 'down'],
  ['ArrowLeft', 'left'], ['KeyA', 'left'], ['ArrowRight', 'right'], ['KeyD', 'right'],
  ['Space', 'b'], ['Enter', 'a'], ['NumpadEnter', 'a'], ['KeyE', 'start'], ['KeyQ', 'select'],
]) {
  const { keys, calls } = rig();
  const handled = keys.keydown(ev(code)); keys.keyup(ev(code));
  check(handled && calls.join() === `${want}:down,${want}:up`, `[rules] ${code} is ${want}`, calls.join());
}
check(['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'].every((b) => GAMEBOY_KEYS.some((k) => k.button === b)), '[rules] every Game Boy button has a key');

{ const { keys, calls } = rig();
  check(keys.keydown(ev('KeyZ')) === false && keys.keydown(ev('Tab')) === false && keys.keydown(ev('Escape')) === false && calls.length === 0, '[rules] other keys are left alone (not handled, so not preventDefault-ed)'); }
{ const { keys, calls } = rig();
  keys.keydown(ev('Space')); keys.keydown(ev('Space')); keys.keydown(ev('Space'));
  check(calls.join() === 'b:down', '[rules] a held key\'s repeats tell the emulator once', calls.join()); }
{ const { keys, calls } = rig();
  keys.keydown(ev('ArrowLeft')); keys.keydown(ev('KeyA'));
  keys.keyup(ev('ArrowLeft'));
  check(calls.join() === 'left:down', '[rules] ArrowLeft + A: letting go of one keeps Left down', calls.join());
  keys.keyup(ev('KeyA'));
  check(calls.join() === 'left:down,left:up', '[rules] ...and letting go of both releases it', calls.join()); }
{ const { keys, calls } = rig();
  keys.keydown(ev('ArrowUp')); keys.keydown(ev('ArrowRight')); keys.keydown(ev('Space'));
  check(calls.join() === 'up:down,right:down,b:down', '[rules] several buttons at once (up + right + B)', calls.join()); }
for (const mod of ['ctrlKey', 'metaKey', 'altKey']) {
  const { keys, calls } = rig();
  check(keys.keydown(ev('KeyS', { [mod]: true })) === false && calls.length === 0, `[rules] ${mod} + S is a browser shortcut, not Down`);
}
for (const target of [{ tagName: 'INPUT' }, { tagName: 'TEXTAREA' }, { tagName: 'SELECT' }, { isContentEditable: true }]) {
  const { keys, calls } = rig();
  check(keys.keydown(ev('KeyW', { target })) === false && keys.keydown(ev('Space', { target })) === false && calls.length === 0, `[rules] typing in ${target.tagName || 'a contenteditable'}: every key belongs to the text`);
}
{ const { keys, calls } = rig();
  check(keys.keydown(ev('Enter', { target: button })) === false && keys.keydown(ev('Space', { target: button })) === false && calls.length === 0, '[rules] Enter and Space on a focused button press THAT button, not the game');
  check(keys.keydown(ev('ArrowUp', { target: button })) === true && keys.keydown(ev('KeyD', { target: button })) === true, '[rules] ...but arrows and WASD there are still the game\'s'); }
{ const { keys, calls } = rig();
  keys.keydown(ev('Space'));
  check(keys.keyup(ev('Space', { ctrlKey: true, target: { tagName: 'INPUT' } })) === true && calls.join() === 'b:down,b:up', '[rules] a release is honoured even if a modifier is held or focus moved (no stuck button)', calls.join()); }
{ const { keys, calls } = rig();
  check(keys.keyup(ev('Space')) === false && calls.length === 0, '[rules] a release for a key we never saw go down is ignored'); }
{ const { keys, calls } = rig();
  keys.keydown(ev('ArrowLeft')); keys.keydown(ev('KeyA')); keys.keydown(ev('Enter'));
  keys.releaseAll();
  check(calls.join() === 'left:down,a:down,left:up,a:up' || calls.join() === 'left:down,a:down,a:up,left:up', '[rules] releaseAll lets go of every held button exactly once', calls.join());
  check(keys.keyup(ev('Enter')) === false, '[rules] ...and a later keyup is ignored'); }

// ── the real Games panel, on a desktop ─────────────────────────────────────
const browser = await launchChromium();
const game = GAMEBOY_LIBRARY[0];

async function open(opts) {
  const ctx = await testContext(browser, opts);
  await ctx.addInitScript("localStorage.setItem('truegle_install_dismissed_at', String(Date.now()));");
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, results: [], data: [] }) }));
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://localhost:${PORT}/search?q=gameboy&category=games`, { waitUntil: 'load' });
  const card = page.locator('button').filter({ hasText: game.name }).first();
  await until(() => card.count(), { what: 'the Games panel', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500); // the results page re-renders once as its URL settles
  return { ctx, page, card, errs };
}
const lit = (page, b) => page.locator(`[data-gb-button="${b}"]`).first().getAttribute('data-pressed');

{
  const { ctx, page, card, errs } = await open({ viewport: { width: 1366, height: 900 } });
  // Open it from the KEYBOARD, so focus starts on the card — the hard case for Enter/Space.
  await card.focus();
  await page.keyboard.press('Enter');
  await until(() => page.locator('[role="dialog"]').count(), { what: 'the player', timeout: 8000 }).catch(() => {});
  check(await page.locator('[role="dialog"]').count() === 1, '[panel] Enter on a game\'s card opens its player');
  check(await page.evaluate(() => document.activeElement?.getAttribute('role') === 'dialog'), '[panel] focus moves into the player (so Enter/Space do not press the card behind it)');

  await page.keyboard.down('Enter');
  check(await lit(page, 'a') === 'true', '[panel] Enter lights the A button');
  check(await page.locator('[role="dialog"]').count() === 1, '[panel] ...and does not reopen or close anything');
  await page.keyboard.up('Enter');
  check(await lit(page, 'a') === null, '[panel] ...and lets go when released');

  await page.keyboard.down(' ');
  check(await lit(page, 'b') === 'true', '[panel] Space lights the B button');
  await page.keyboard.up(' ');
  for (const [key, b] of [['ArrowUp', 'up'], ['ArrowDown', 'down'], ['ArrowLeft', 'left'], ['ArrowRight', 'right'], ['w', 'up'], ['s', 'down'], ['a', 'left'], ['d', 'right'], ['e', 'start'], ['q', 'select']]) {
    await page.keyboard.down(key);
    const on = await lit(page, b);
    await page.keyboard.up(key);
    check(on === 'true' && await lit(page, b) === null, `[panel] ${key === ' ' ? 'Space' : key} presses ${b} and lets go`);
  }

  // Two keys, one button.
  await page.keyboard.down('ArrowLeft'); await page.keyboard.down('a'); await page.keyboard.up('ArrowLeft');
  check(await lit(page, 'left') === 'true', '[panel] ArrowLeft + A: after letting go of one, Left is still down');
  await page.keyboard.up('a');
  check(await lit(page, 'left') === null, '[panel] ...and up when both are');

  // The page behind must not scroll, and other keys are left alone.
  const probe = await page.evaluate(() => {
    const fire = (init) => { const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }); window.dispatchEvent(e); return e.defaultPrevented; };
    const out = { space: fire({ code: 'Space', key: ' ' }), down: fire({ code: 'ArrowDown', key: 'ArrowDown' }), z: fire({ code: 'KeyZ', key: 'z' }), ctrlS: fire({ code: 'KeyS', key: 's', ctrlKey: true }) };
    ['Space', 'ArrowDown'].forEach((code) => window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })));
    return out;
  });
  check(probe.space && probe.down, '[panel] Space and the arrows are stopped from scrolling the page behind the game', JSON.stringify(probe));
  check(!probe.z && !probe.ctrlS, '[panel] other keys, and Ctrl+S, are left to the browser', JSON.stringify(probe));

  // The legend.
  const legend = await page.locator('[data-gameboy-keys]').innerText().catch(() => '');
  check(['Arrows / WASD', 'Space = B', 'Enter = A', 'E = Start', 'Q = Select'].every((t) => legend.includes(t)), '[panel] the key legend is shown on a desktop', legend);

  // Alt-tab with a key down must not leave the button stuck.
  await page.keyboard.down('ArrowRight');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  check(await lit(page, 'right') === null, '[panel] the window losing focus lets go of every key');
  await page.keyboard.up('ArrowRight');

  // Enter on a focused button still presses THAT button: the keyboard can close the player.
  await page.locator('button[title="Close"]').focus();
  await page.keyboard.press('Enter');
  await until(async () => (await page.locator('[role="dialog"]').count()) === 0, { what: 'the player to close', timeout: 4000 }).catch(() => {});
  check(await page.locator('[role="dialog"]').count() === 0, '[panel] Enter on the focused Close button closes the player (the keyboard is not hijacked)');
  check(errs.length === 0, '[panel] nothing threw', errs.join(' | ') || 'clean');
  await ctx.close();
}
{
  const { ctx, page, card } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await card.click();
  await until(() => page.locator('[role="dialog"]').count(), { what: 'the player', timeout: 8000 }).catch(() => {});
  check(await page.locator('[role="dialog"]').count() === 1 && await page.locator('[data-gameboy-keys]').count() === 0, '[phone] no key legend on a phone (it has no keyboard to tell about); the touch pad is unchanged');
  await ctx.close();
}

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
await browser.close();
await server.close();
process.exit(bad.length ? 1 : 0);
