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

export const bytesToB64 = (u8) => {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
};
export const b64ToBytes = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));

// Text packets are UTF-8 -> base64 for the bridge (<= 180 bytes each).
export const meshSendText = (peer, text) => plugin().send({ peer, data: bytesToB64(new TextEncoder().encode(text)) });
// Several binary packets, written in order over a single Bluetooth connection (voice notes).
export const meshSendChunks = (peer, chunks) => plugin().send({ peer, chunks: chunks.map(bytesToB64) });

// Returns an unsubscribe function. 'data' events carry both `bytes` and, for JSON packets, `text`.
export async function meshOn(event, cb) {
  const h = await plugin().addListener(event, (e) => {
    if (event !== 'data') return cb(e);
    const bytes = b64ToBytes(e.data);
    return cb({ ...e, bytes, text: bytes[0] === 0x7b ? new TextDecoder().decode(bytes) : '' });
  });
  return () => h.remove();
}
