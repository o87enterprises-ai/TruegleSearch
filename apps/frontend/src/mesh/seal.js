// END-TO-END ENVELOPES for Nearby and the relay — pure WebCrypto, no storage, no network.
//
//   seal()  : only the recipient can read it, and it proves who sent it
//   open()  : decrypts, checks the sender's signature, checks it was meant for you
//
// Scheme (ECIES + signature):
//   • a fresh ECDH P-256 key pair is made for EVERY message; its shared secret with the
//     recipient's public key goes through HKDF-SHA256 into an AES-256-GCM key, so nobody who
//     carries the envelope (a relay phone, our mailbox server) can read it, and past messages do
//     not depend on any long-term sender secret;
//   • the plaintext carries the sender handle, recipient handle, time and id, signed with the
//     sender's ECDSA key — a relay cannot forge, re-address or alter a message.
//
// Wire format (then base64url):  [1 byte version=1][65 byte ephemeral public key][12 byte iv][AES-GCM ciphertext+tag]

const VERSION = 1;
const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;

export const b64u = (bytes) => {
  let s = '';
  const u = new Uint8Array(bytes);
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const unb64u = (str) => {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const ECDH = { name: 'ECDH', namedCurve: 'P-256' };
const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' };

/** Two key pairs per device: ECDH (others encrypt to it) and ECDSA (it signs). Private keys are non-extractable. */
export async function generateIdentityKeys() {
  const ecdh = await subtle().generateKey(ECDH, false, ['deriveBits']);
  const sign = await subtle().generateKey(ECDSA, false, ['sign', 'verify']);
  return { ecdh, sign };
}

/** Public half as a plain JWK ({kty,crv,x,y}) — what the server stores and others fetch. */
export async function publicJwk(key) {
  const { kty, crv, x, y } = await subtle().exportKey('jwk', key);
  return { kty, crv, x, y };
}

const importPublic = (jwk, algo, usages) => subtle().importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, ext: true }, algo, true, usages);

async function aesKey(privateKey, publicKey, usage) {
  const bits = await subtle().deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
  const hk = await subtle().importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode('truegle-seal-v1') },
    hk, { name: 'AES-GCM', length: 256 }, false, [usage],
  );
}

const signedText = (m) => `${m.f}|${m.to}|${m.t}|${m.id}|${m.x}`;
export const newMessageId = () => b64u(globalThis.crypto.getRandomValues(new Uint8Array(9)));

/**
 * @param {object} p
 * @param {string} p.text         message text
 * @param {string} p.from         sender handle
 * @param {string} p.to           recipient handle
 * @param {CryptoKey} p.signPrivate  sender's ECDSA private key
 * @param {object} p.toEcdh       recipient's public ECDH JWK
 * @returns {Promise<{envelope: string, id: string}>}
 */
export async function seal({ text, from, to, signPrivate, toEcdh, id = newMessageId(), now = Date.now() }) {
  const m = { f: from, to, t: now, id, x: String(text) };
  const sig = await subtle().sign({ name: 'ECDSA', hash: 'SHA-256' }, signPrivate, enc.encode(signedText(m)));
  const plain = enc.encode(JSON.stringify({ ...m, s: b64u(sig) }));

  const eph = await subtle().generateKey(ECDH, true, ['deriveBits']);
  const key = await aesKey(eph.privateKey, await importPublic(toEcdh, ECDH, []), 'encrypt');
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, plain));
  const rawEph = new Uint8Array(await subtle().exportKey('raw', eph.publicKey)); // 65 bytes

  const out = new Uint8Array(1 + rawEph.length + iv.length + ct.length);
  out[0] = VERSION;
  out.set(rawEph, 1);
  out.set(iv, 1 + rawEph.length);
  out.set(ct, 1 + rawEph.length + iv.length);
  return { envelope: b64u(out), id };
}

/**
 * @param {string} envelope
 * @param {object} p
 * @param {CryptoKey} p.ecdhPrivate   my ECDH private key
 * @param {string} p.me               my handle
 * @param {(handle: string) => Promise<object|null>} p.lookupSign  → the sender's public ECDSA JWK
 * @returns {Promise<{from: string, text: string, at: number, id: string}>}
 */
export async function open(envelope, { ecdhPrivate, me, lookupSign }) {
  const raw = unb64u(envelope);
  if (raw[0] !== VERSION || raw.length < 1 + 65 + 12 + 16) throw new Error('bad envelope');
  const eph = await subtle().importKey('raw', raw.slice(1, 66), ECDH, true, []);
  const iv = raw.slice(66, 78);
  const key = await aesKey(ecdhPrivate, eph, 'decrypt');
  let m;
  try { m = JSON.parse(dec.decode(await subtle().decrypt({ name: 'AES-GCM', iv }, key, raw.slice(78)))); }
  catch { throw new Error('cannot decrypt'); }
  if (!m || typeof m.f !== 'string' || typeof m.to !== 'string' || typeof m.x !== 'string' || typeof m.s !== 'string') throw new Error('bad message');
  if (m.to !== me) throw new Error('not for me');
  const senderJwk = await lookupSign(m.f);
  if (!senderJwk) throw new Error('unknown sender');
  const ok = await subtle().verify(
    { name: 'ECDSA', hash: 'SHA-256' }, await importPublic(senderJwk, ECDSA, ['verify']), unb64u(m.s), enc.encode(signedText(m)),
  );
  if (!ok) throw new Error('bad signature');
  return { from: m.f, text: m.x, at: m.t, id: m.id };
}

/** Authorization header proving this request comes from the handle's owner (see backend utils/handleAuth.js). */
export async function authHeader({ handle, signPrivate, method, path, now = Date.now() }) {
  const sig = await subtle().sign({ name: 'ECDSA', hash: 'SHA-256' }, signPrivate, enc.encode(`${now}\n${method.toUpperCase()}\n${path}`));
  return `TG-Sig handle=${handle},ts=${now},sig=${b64u(sig)}`;
}

// ── Handles ──────────────────────────────────────────────────────────────────────────────

const ADJ = ['calm', 'brave', 'quiet', 'swift', 'gentle', 'bright', 'wild', 'warm', 'clever', 'steady', 'lucky', 'noble', 'sunny', 'misty', 'bold', 'kind'];
const NOUN = ['otter', 'falcon', 'maple', 'comet', 'river', 'fox', 'pine', 'heron', 'ember', 'lark', 'willow', 'badger', 'cedar', 'finch', 'harbor', 'moth'];

/** A random, readable, anonymous handle like "calm-otter-4821". */
export function generateHandle(rand = (n) => globalThis.crypto.getRandomValues(new Uint32Array(1))[0] % n) {
  return `${ADJ[rand(ADJ.length)]}-${NOUN[rand(NOUN.length)]}-${String(rand(10000)).padStart(4, '0')}`;
}

/** Same rule the server enforces: 3-24 chars, a-z 0-9 and single hyphens, starting with a letter. */
export const HANDLE_RE = /^(?=.{3,24}$)[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export const cleanHandle = (s) => String(s || '').trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
