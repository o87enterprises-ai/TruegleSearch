// Ask Truegle's server to look at a link before it is opened inside the app.
// See backend services/LinkInspector.js for exactly what that can and cannot
// prove. The URL goes to OUR server only — never to a third-party reputation
// service (see hooks/useLinkSafety.js for why).
//
// Never throws: a failure is a normal answer ({ ok:false }), and the caller
// treats "could not check" as "do not open in-app", never as "probably fine".
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export async function inspectLink(url, { signal } = {}) {
  try {
    const res = await fetch(`${BACKEND}/api/link/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal,
    });
    if (!res.ok) return { ok: false, reason: res.status === 429 ? 'busy' : 'unreachable' };
    return await res.json();
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
}

export default inspectLink;
