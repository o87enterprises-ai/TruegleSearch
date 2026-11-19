// Voice notes for Nearby: record a few seconds of low-bitrate audio, cut it into Bluetooth-sized
// frames, and put it back together on the other phone. All on-device; nothing goes to a server.
//
// Frame (binary, <= 180 bytes):  [0x01][mime][fp 8][id 4][index u16][total u16][audio bytes...]
import { b64ToBytes, bytesToB64 } from './native';

export const MAX_VOICE_MS = 8000;
export const MAX_VOICE_BYTES = 9000;      // ~56 frames: a few seconds over Bluetooth
const HEADER = 18;
const DATA_PER_FRAME = 180 - HEADER;
export const KEEP_VOICE = 15;             // audio kept on this phone for the last N voice notes
const MIMES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];

const hexToBytes = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)));
const bytesToHex = (u8) => Array.from(u8, (x) => x.toString(16).padStart(2, '0')).join('');
export const newVoiceId = () => bytesToHex(crypto.getRandomValues(new Uint8Array(4)));

export function frameVoice(fp, id, mimeIdx, audio) {
  const total = Math.max(1, Math.ceil(audio.length / DATA_PER_FRAME));
  const out = [];
  for (let i = 0; i < total; i += 1) {
    const part = audio.subarray(i * DATA_PER_FRAME, (i + 1) * DATA_PER_FRAME);
    const f = new Uint8Array(HEADER + part.length);
    f[0] = 0x01; f[1] = mimeIdx;
    f.set(hexToBytes(fp), 2);
    f.set(hexToBytes(id), 10);
    f[14] = i >> 8; f[15] = i & 255; f[16] = total >> 8; f[17] = total & 255;
    f.set(part, HEADER);
    out.push(f);
  }
  return out;
}

export const isVoiceFrame = (u8) => u8 && u8.length > HEADER && u8[0] === 0x01;

// Collects frames per (sender, id); returns the finished note once every frame has arrived.
export function makeAssembler() {
  const parts = new Map();
  return (u8) => {
    const fp = bytesToHex(u8.subarray(2, 10));
    const id = bytesToHex(u8.subarray(10, 14));
    const idx = (u8[14] << 8) | u8[15];
    const total = (u8[16] << 8) | u8[17];
    if (!total || total > 200 || idx >= total) return null;
    const key = `${fp}:${id}`;
    const now = Date.now();
    for (const [k, v] of parts) if (now - v.t > 60000) parts.delete(k); // drop stale partials
    const e = parts.get(key) || { total, got: new Map(), t: now, mime: u8[1] };
    e.t = now;
    e.got.set(idx, u8.slice(HEADER));
    parts.set(key, e);
    if (e.got.size < e.total) return null;
    parts.delete(key);
    const chunks = Array.from({ length: e.total }, (_, i) => e.got.get(i));
    const audio = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let o = 0;
    chunks.forEach((c) => { audio.set(c, o); o += c.length; });
    return { fp, id, mime: e.mime, audio };
  };
}

export const mimeFor = (idx) => MIMES[idx] || MIMES[0];
export const audioToUrl = (b64, idx) => URL.createObjectURL(new Blob([b64ToBytes(b64)], { type: mimeFor(idx) }));
export { bytesToB64 };

export const canRecord = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

// Starts recording. Resolves { stop(), cancel(), done } where `done` resolves { audio, mime, ms }.
export async function startRecording(onTick) {
  const mimeIdx = MIMES.findIndex((m) => MediaRecorder.isTypeSupported(m));
  if (mimeIdx < 0) throw new Error('This phone cannot record voice notes');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  const rec = new MediaRecorder(stream, { mimeType: MIMES[mimeIdx], audioBitsPerSecond: 8000 });
  const chunks = [];
  const t0 = Date.now();
  let cancelled = false;
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const tick = setInterval(() => { const ms = Date.now() - t0; onTick?.(ms); if (ms >= MAX_VOICE_MS) rec.state !== 'inactive' && rec.stop(); }, 200);
  const done = new Promise((resolve, reject) => {
    rec.onstop = async () => {
      clearInterval(tick);
      stream.getTracks().forEach((t) => t.stop());
      if (cancelled) { resolve(null); return; }
      const audio = new Uint8Array(await new Blob(chunks).arrayBuffer());
      if (audio.length === 0) reject(new Error('Nothing was recorded'));
      else if (audio.length > MAX_VOICE_BYTES) reject(new Error('That note is too long to send over Bluetooth — keep it under 8 seconds'));
      else resolve({ audio, mime: mimeIdx, ms: Math.min(Date.now() - t0, MAX_VOICE_MS) });
    };
    rec.onerror = () => { clearInterval(tick); reject(new Error('Recording failed')); };
  });
  rec.start();
  return {
    stop: () => { if (rec.state !== 'inactive') rec.stop(); },
    cancel: () => { cancelled = true; if (rec.state !== 'inactive') rec.stop(); },
    done,
  };
}
