/**
 * Global, framework-agnostic crash safety net.
 *
 * React error boundaries only catch errors thrown *during rendering* of mounted
 * components. They CANNOT catch:
 *   - module-init / bundle-evaluation errors (e.g. the chunk-ordering crash that
 *     white-screened the whole site), which happen before React mounts
 *   - failed dynamic chunk loads after a redeploy (stale index.html -> 404 chunk)
 *   - errors in async callbacks / promises outside React's render path
 *
 * This installs window-level handlers that guarantee the user never stares at a
 * blank page: stale-chunk errors trigger a one-time reload, and if the app root
 * is still empty shortly after load we inject a friendly fallback screen.
 */

const FEEDBACK_EMAIL = 'truegleai@proton.me';
const RELOAD_GUARD_KEY = 'truegle_chunk_reload_at';

function isChunkLoadError(message = '') {
  return /Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed|ChunkLoadError|Failed to fetch dynamically/i.test(
    String(message)
  );
}

// Reload at most once per 30s window so we never get stuck in a reload loop.
function tryRecoverFromStaleChunk() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    if (Date.now() - last > 30_000) {
      sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
      window.location.reload();
      return true;
    }
  } catch {
    /* sessionStorage unavailable (private mode) — fall through to fallback UI */
  }
  return false;
}

let fallbackShown = false;
export function renderEmergencyFallback(message) {
  if (fallbackShown) return;
  const root = document.getElementById('root');
  if (!root) return;
  fallbackShown = true;

  const mailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
    'TruegleSearch bug report'
  )}&body=${encodeURIComponent(
    `What I was doing:\n\n\n---\nPage: ${location.href}\nError: ${message || 'unknown'}\nBrowser: ${navigator.userAgent}`
  )}`;

  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0b14;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;">
      <div style="max-width:440px;text-align:center;">
        <div style="font-size:42px;margin-bottom:12px;">🛠️</div>
        <h1 style="font-size:20px;font-weight:700;margin:0 0 10px;">We hit a snag</h1>
        <p style="color:#a8a8b8;font-size:14px;line-height:1.6;margin:0 0 8px;">
          TruegleSearch is in early access and still under active development —
          you caught a bug before the rest of the world did. Thanks for being here.
        </p>
        <p style="color:#a8a8b8;font-size:14px;line-height:1.6;margin:0 0 22px;">
          A quick reload usually fixes it.
        </p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <button id="truegle-reload" style="cursor:pointer;border:0;border-radius:12px;padding:11px 20px;font-weight:600;font-size:14px;color:#0b0b14;background:linear-gradient(135deg,#22d3ee,#a855f7);">
            Reload
          </button>
          <a href="${mailto}" style="text-decoration:none;border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:11px 20px;font-weight:600;font-size:14px;color:#fff;">
            Report this bug
          </a>
        </div>
      </div>
    </div>`;

  const btn = document.getElementById('truegle-reload');
  if (btn) btn.addEventListener('click', () => window.location.reload());
}

export function installGlobalErrorHandlers() {
  const handle = (message) => {
    if (isChunkLoadError(message)) {
      if (tryRecoverFromStaleChunk()) return; // reloading — bail
    }
    // Let in-app React banner respond if the app is alive.
    try {
      window.dispatchEvent(new CustomEvent('truegle:app-error', { detail: { message } }));
    } catch {
      /* no-op */
    }
    // If the app never mounted, the root is empty → show the static fallback.
    const root = document.getElementById('root');
    if (root && root.childElementCount === 0) {
      renderEmergencyFallback(message);
    }
  };

  window.addEventListener('error', (e) => handle(e?.message || e?.error?.message));
  window.addEventListener('unhandledrejection', (e) =>
    handle(e?.reason?.message || String(e?.reason || ''))
  );

  // White-screen watchdog: if nothing rendered into #root a few seconds after
  // load, assume a fatal init error and show the fallback.
  window.addEventListener('load', () => {
    setTimeout(() => {
      const root = document.getElementById('root');
      if (root && root.childElementCount === 0) {
        renderEmergencyFallback('App failed to start');
      }
    }, 4000);
  });
}
