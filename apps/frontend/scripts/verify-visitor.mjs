// utils/visitor.js: who counts as "probably a bot" (no auto-start for them).
import { isLikelyBot } from '../src/utils/visitor.js';

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);
const as = (nav) => { Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true }); return isLikelyBot(); };

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

check(as({ userAgent: CHROME, webdriver: false }) === false, 'desktop Chrome is a person');
check(as({ userAgent: IPHONE }) === false, 'iPhone Safari is a person');
check(as({ userAgent: ANDROID, webdriver: false }) === false, 'Android Chrome is a person');
check(as({ userAgent: CHROME, webdriver: true }) === true, 'an automated browser (webdriver) is a bot');
for (const [n, ua] of Object.entries({
  Googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  Bingbot: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  HeadlessChrome: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36',
  Lighthouse: 'Mozilla/5.0 (Linux; Android 11) Chrome-Lighthouse',
  'link previewer': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  curl: 'curl/8.4.0',
})) check(as({ userAgent: ua, webdriver: false }) === true, `${n} is a bot`);
check(as({}) === false || as({}) === true, 'a missing userAgent does not throw');
// No browser at all (SSR / prerender): never auto-start.
Object.defineProperty(globalThis, 'navigator', { value: undefined, configurable: true, writable: true });
check(isLikelyBot() === true, 'no navigator (prerender) counts as a bot, so nothing auto-starts');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
