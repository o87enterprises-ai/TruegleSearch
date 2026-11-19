// Bridge to the native TruegleMesh (BLE) plugin that ships only in the Android app.
// On web / PWA this module reports "unavailable" and nothing else runs.
// See openspec/changes/add-offline-mesh-chat.

const plugin = () => (typeof window !== 'undefined' ? window.Capacitor?.Plugins?.TruegleMesh : undefined);

export function meshAvailable() {
  try {
    return !!window.Capacitor?.isNativePlatform?.() && !!plugin();
  } catch {
    return false;
  }
}

export const meshStatus = () => plugin().status();
export const meshStart = () => plugin().start();
export const meshStop = () => plugin().stop();

// Spike payloads are opaque bytes (<=180). Strings are UTF-8 -> base64 for the bridge.
const toB64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const fromB64 = (b) => new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)));

export const meshSendText = (peer, text) => plugin().send({ peer, data: toB64(text) });

// Returns an unsubscribe function.
export async function meshOn(event, cb) {
  const h = await plugin().addListener(event, (e) => cb(event === 'data' ? { ...e, text: fromB64(e.data) } : e));
  return () => h.remove();
}
