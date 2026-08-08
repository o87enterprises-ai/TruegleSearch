// Copy that either works or admits it didn't.
//
// THE BUG THIS FIXES: every copy path called
// `navigator.clipboard.writeText(x).then(showTick)` with no `.catch()`. That
// promise REJECTS more often than people expect — Android and Firefox refuse
// it whenever the document isn't focused, which is exactly what a closing
// menu or a just-dismissed share sheet causes. On rejection nothing happened,
// no tick, no error… and the OS clipboard kept whatever was in it before. The
// user pasted and got the PREVIOUS link — a clip that was no longer even
// queued.
//
// So: try the async API, fall back to the old execCommand path (which works
// without focus because it acts on a selection we control), and return whether
// it actually landed so the caller can stop claiming success it didn't have.
export async function copyText(text) {
  const value = String(text ?? '');
  if (!value) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch { /* not focused, insecure context, or denied — fall through */ }

  // The pre-async fallback. Deprecated, still implemented everywhere, and the
  // only one that works when the document has lost focus.
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    // Off-screen but still selectable; `readOnly` stops the mobile keyboard.
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export default copyText;
