/* Does this device have WebGL, and is the question asked correctly?
 *
 * WHY THIS EXISTS. Every map surface needs a WebGL context — MapLibre (the
 * standard map) as much as Globe3D and AzimuthalFlat. On a phone that cannot
 * give one, MapLibre does not throw anything React can catch: its Map
 * constructor calls _setupPainter, the context request fails, and it logs
 *
 *   Failed to create WebGL context: ... Exhausted GL driver options.
 *
 * repeatedly while the user looks at an empty rectangle. WebGLErrorBoundary
 * wrapped only the two 3D views and its fallback text promised to "switch to
 * the standard map" — which is MapLibre, which needs the very thing that had
 * just failed. So the question has to be asked BEFORE anything mounts.
 *
 * These assert the probe's contract: the right answer, the driver's own
 * reason, one probe per page, and no context left held.
 *
 * Run it:  npm run webgl:test
 */
const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

// A canvas that answers however the test needs it to.
function stubDocument({ context, creationError = null }) {
  let getContextCalls = 0;
  let contextReleased = false;
  const canvas = {
    listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    getContext() {
      getContextCalls += 1;
      if (creationError && this.listeners.webglcontextcreationerror) {
        this.listeners.webglcontextcreationerror({ statusMessage: creationError });
      }
      if (!context) return null;
      return {
        getExtension: (name) => (name === 'WEBGL_lose_context'
          ? { loseContext: () => { contextReleased = true; } }
          : null),
      };
    },
  };
  globalThis.document = { createElement: () => canvas };
  return { get calls() { return getContextCalls; }, get released() { return contextReleased; } };
}

const load = async () => {
  const mod = await import(`../src/utils/webgl.js?v=${Math.random()}`);
  return mod;
};

// ── 1. a working device ─────────────────────────────────────────────────────
let probe = stubDocument({ context: true });
let { hasWebGL, webglFailureReason } = await load();
check(hasWebGL() === true, 'a device with a context reports WebGL available');
check(webglFailureReason() === '', 'no reason is given when nothing failed', webglFailureReason());
check(probe.released, 'the probe hands its context straight back');

// ── 2. asked once, not once per render ──────────────────────────────────────
hasWebGL(); hasWebGL(); hasWebGL();
check(probe.calls === 1, 'the probe runs once and caches', `ran ${probe.calls}x`);

// ── 3. a device that refuses, with the driver's own words ───────────────────
probe = stubDocument({
  context: false,
  creationError: 'WebGL creation failed: * tryANGLE (FEATURE_FAILURE_EGL_NO_CONFIG)',
});
({ hasWebGL, webglFailureReason } = await load());
check(hasWebGL() === false, 'a device with no context reports WebGL unavailable');
check(/tryANGLE/.test(webglFailureReason()),
  "the driver's own explanation is kept, not swallowed", webglFailureReason());

// ── 4. refused with no explanation still says something usable ──────────────
stubDocument({ context: false });
({ hasWebGL, webglFailureReason } = await load());
check(hasWebGL() === false, 'a silent refusal is still a refusal');
check(webglFailureReason().length > 0, 'a silent refusal still produces a reason', webglFailureReason());

// ── 5. a throwing canvas must not take the page with it ─────────────────────
globalThis.document = { createElement: () => { throw new Error('canvas is unavailable'); } };
({ hasWebGL, webglFailureReason } = await load());
let threw = false;
try { check(hasWebGL() === false, 'a throwing canvas reports unavailable, not an exception'); }
catch { threw = true; }
check(!threw, 'the probe never throws at its caller');
check(/canvas is unavailable/.test(webglFailureReason()), 'the thrown message is reported', webglFailureReason());

for (const line of [...ok, ...bad]) console.log(line);
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
