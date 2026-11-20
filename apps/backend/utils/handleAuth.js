/**
 * Proof that a request comes from the device that owns a handle.
 *
 * The device signs a short string with its ECDSA P-256 private key (WebCrypto, never exported) and
 * sends it in the Authorization header:
 *
 *   Authorization: TG-Sig handle=<handle>,ts=<unix ms>,sig=<base64url IEEE-P1363 signature>
 *
 * The signed message is `${ts}\n${METHOD}\n${path}` where `path` is the request path without the
 * query string. A timestamp more than 5 minutes off is refused, which bounds replays. No account,
 * cookie or session is involved: the key IS the identity.
 */
const crypto = require('crypto');

const MAX_SKEW_MS = 5 * 60 * 1000;
const HEADER_RE = /^TG-Sig handle=([a-z0-9-]{3,24}),ts=(\d{10,15}),sig=([A-Za-z0-9_-]{80,120})$/;

const HANDLE_RE = /^(?=.{3,24}$)[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const RESERVED = new Set([
  'admin', 'administrator', 'root', 'support', 'help', 'truegle', 'team', 'staff', 'official',
  'moderator', 'system', 'null', 'undefined', 'anonymous', 'everyone', 'all',
]);

const validHandle = (h) => typeof h === 'string' && HANDLE_RE.test(h) && !RESERVED.has(h);

/** Checks a JWK is a well-formed P-256 public key; returns the canonical JSON string or null. */
function canonicalPublicJwk(jwk) {
  try {
    if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || typeof jwk.x !== 'string' || typeof jwk.y !== 'string') return null;
    const clean = { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
    crypto.createPublicKey({ key: clean, format: 'jwk' }); // throws if the point is not on the curve
    return JSON.stringify(clean);
  } catch { return null; }
}

/** @returns {{handle: string, ts: number, sig: Buffer} | null} */
function parseAuth(header) {
  const m = HEADER_RE.exec(String(header || ''));
  if (!m) return null;
  return { handle: m[1], ts: Number(m[2]), sig: Buffer.from(m[3], 'base64url') };
}

/** Verifies the signature for `req` against the stored sign_pub JSON. */
function verifySignature(req, auth, signPubJson, now = Date.now()) {
  try {
    if (!auth || Math.abs(now - auth.ts) > MAX_SKEW_MS) return false;
    const key = crypto.createPublicKey({ key: JSON.parse(signPubJson), format: 'jwk' });
    const path = (req.baseUrl || '') + (req.path || '');
    const msg = Buffer.from(`${auth.ts}\n${req.method}\n${path}`);
    return crypto.verify('sha256', msg, { key, dsaEncoding: 'ieee-p1363' }, auth.sig);
  } catch { return false; }
}

/**
 * Express middleware factory. Looks the handle up, verifies the signature and sets req.handle =
 * { handle, ecdh_pub, sign_pub }. `getRow(handle)` is injected so routes share one DB accessor.
 */
function requireHandle(getRow) {
  return async (req, res, next) => {
    const auth = parseAuth(req.get('authorization'));
    if (!auth) return res.status(401).json({ error: 'Signature required.' });
    let row;
    try { row = await getRow(auth.handle); } catch { return res.status(503).json({ error: 'Unavailable right now.' }); }
    if (!row || !verifySignature(req, auth, row.sign_pub)) return res.status(401).json({ error: 'Bad signature.' });
    req.handle = row;
    return next();
  };
}

module.exports = { validHandle, canonicalPublicJwk, parseAuth, verifySignature, requireHandle, HANDLE_RE, RESERVED, MAX_SKEW_MS };
