/* Truegle sets ZERO cookies. This keeps it that way.
 *
 * WHY THIS EXISTS. CLAUDE.md and docs/AD-POLICY.md both state the project sets
 * no cookies at all — that is why there is no consent banner, since there is
 * nothing to consent to. The claim was nonetheless false: noTrackMiddleware
 * sent
 *
 *   Set-Cookie: _truegle_no_track=1; Path=/; HttpOnly; SameSite=Strict; Max-Age=0
 *
 * on EVERY response. Max-Age=0 meant nothing was ever stored, so no tracking
 * happened, but browsers still announced the rejection in the console on every
 * cross-site request — which is how it was found — and res.setHeader replaces
 * rather than appends, so it would have silently dropped any cookie set
 * earlier in the chain.
 *
 * A promise about cookies is worth only as much as the check behind it.
 *
 * Run it:  npm run cookies:test
 */
process.env.JWT_SECRET = 'x'.repeat(32);
process.env.ENCRYPTION_KEY = 'y'.repeat(32);
process.env.NODE_ENV = 'production';

const { default: express } = await import('express');
const { privacyMiddleware, noTrackMiddleware } = await import('../middleware/privacy.js');

const app = express();
// The same order server.js mounts them in.
app.use(privacyMiddleware);
app.use(noTrackMiddleware);
app.get('/anything', (req, res) => res.json({ ok: true }));

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

const server = app.listen(0);
await new Promise((r) => server.once('listening', r));
const res = await fetch(`http://127.0.0.1:${server.address().port}/anything`);

const setCookie = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie')].filter(Boolean);
check(setCookie.length === 0, 'no response carries a Set-Cookie header', setCookie.join(' | '));
check(!/_truegle_no_track/.test(setCookie.join(' ')), 'the _truegle_no_track cookie is gone for good');

// The privacy headers that SHOULD still be there — removing the cookie must
// not have taken the rest of the middleware's job with it.
check(res.headers.get('tk') === 'N', 'the Tk: N tracking-status header still ships', res.headers.get('tk'));
check(res.headers.get('x-content-type-options') === 'nosniff', 'nosniff still ships');

server.close();
for (const line of [...ok, ...bad]) console.log(line);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
