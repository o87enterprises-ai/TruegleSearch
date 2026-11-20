const mockHandles = new Map();
jest.mock('../db/connection', () => ({
  query: jest.fn(async (sql, p) => {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (/^SELECT handle, ecdh_pub/i.test(s)) return { rows: mockHandles.has(p[0]) ? [mockHandles.get(p[0])] : [] };
    if (/^SELECT handle FROM handles WHERE searchable/i.test(s)) {
      const pre = p[0].replace(/%$/, '');
      return { rows: [...mockHandles.values()].filter((r) => r.searchable && r.handle.startsWith(pre)).map((r) => ({ handle: r.handle })) };
    }
    if (/^INSERT INTO handles/i.test(s)) {
      if (mockHandles.has(p[0])) return { rows: [] };
      mockHandles.set(p[0], { handle: p[0], ecdh_pub: p[1], sign_pub: p[2], searchable: p[3] });
      return { rows: [{ handle: p[0] }] };
    }
    if (/^UPDATE handles/i.test(s)) {
      const r = mockHandles.get(p[0]);
      if (r) {
        if (p[1] !== null) r.searchable = p[1];
        if (p[2] !== null) r.ecdh_pub = p[2];
        if (p[3] !== null) r.sign_pub = p[3];
      }
      return { rows: [] };
    }
    if (/^DELETE FROM handles/i.test(s)) { mockHandles.delete(p[0]); return { rows: [] }; }
    return { rows: [] };
  }),
}));

const crypto = require('crypto');
const express = require('express');
const request = require('supertest');

const app = () => {
  const a = express();
  a.use(express.json());
  a.use('/api/handles', require('../routes/handles'));
  return a;
};
const keypair = () => crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pub = (k) => { const j = k.publicKey.export({ format: 'jwk' }); return { kty: j.kty, crv: j.crv, x: j.x, y: j.y }; };
const sign = (key, handle, method, path, ts = Date.now()) => {
  const sig = crypto.sign('sha256', Buffer.from(`${ts}\n${method}\n${path}`), { key: key.privateKey, dsaEncoding: 'ieee-p1363' });
  return `TG-Sig handle=${handle},ts=${ts},sig=${sig.toString('base64url')}`;
};

beforeEach(() => mockHandles.clear());

async function claim(a, handle, searchable = false) {
  const ecdh = keypair(); const sgn = keypair();
  const r = await request(a).post('/api/handles').send({ handle, ecdh: pub(ecdh), sign: pub(sgn), searchable });
  return { r, ecdh, sgn };
}

describe('handles', () => {
  test('claim, look up exactly, and the keys come back as public JWKs only', async () => {
    const a = app();
    const { r, ecdh } = await claim(a, 'calm-otter-4821');
    expect(r.status).toBe(201);
    const got = await request(a).get('/api/handles/calm-otter-4821');
    expect(got.status).toBe(200);
    expect(got.body.ecdh.x).toBe(pub(ecdh).x);
    expect(JSON.stringify(got.body)).not.toMatch(/"d"/); // never a private component
    expect(got.headers['cache-control']).toBe('no-store');
  });

  test('a taken handle is refused, an invalid or reserved one too', async () => {
    const a = app();
    await claim(a, 'calm-otter-4821');
    expect((await claim(a, 'calm-otter-4821')).r.status).toBe(409);
    expect((await claim(a, 'Ab')).r.status).toBe(400);
    expect((await claim(a, 'admin')).r.status).toBe(400);
    expect((await claim(a, 'two--hyphens')).r.status).toBe(400);
    expect((await claim(a, '9starts-with-digit')).r.status).toBe(400);
  });

  test('rejects keys that are not valid P-256 public keys', async () => {
    const a = app();
    const good = pub(keypair());
    await request(a).post('/api/handles').send({ handle: 'valid-name', ecdh: { ...good, x: 'AAAA' }, sign: good }).expect(400);
    await request(a).post('/api/handles').send({ handle: 'valid-name', sign: good }).expect(400);
  });

  test('availability check', async () => {
    const a = app();
    await claim(a, 'taken-name');
    expect((await request(a).get('/api/handles/available/taken-name')).body).toEqual({ valid: true, available: false });
    expect((await request(a).get('/api/handles/available/free-name')).body).toEqual({ valid: true, available: true });
    expect((await request(a).get('/api/handles/available/x')).body).toEqual({ valid: false, available: false });
  });

  test('prefix search lists only people who opted in, and needs 3+ letters', async () => {
    const a = app();
    await claim(a, 'findable-fox', true);
    await claim(a, 'findable-hidden', false);
    const res = await request(a).get('/api/handles/search?q=findable');
    expect(res.body.results).toEqual(['findable-fox']);
    await request(a).get('/api/handles/search?q=fi').expect(400);
  });

  test('only the key holder can change or delete a handle', async () => {
    const a = app();
    const { sgn } = await claim(a, 'mine-only');
    const path = '/api/handles/mine-only';
    await request(a).patch(path).send({ searchable: true }).expect(401); // unsigned
    const stranger = keypair();
    await request(a).patch(path).set('Authorization', sign(stranger, 'mine-only', 'PATCH', path)).send({ searchable: true }).expect(401);
    await request(a).patch(path).set('Authorization', sign(sgn, 'mine-only', 'PATCH', path)).send({ searchable: true }).expect(200);
    expect(mockHandles.get('mine-only').searchable).toBe(true);
    // a signature for GET cannot be replayed as DELETE
    await request(a).delete(path).set('Authorization', sign(sgn, 'mine-only', 'GET', path)).expect(401);
    await request(a).delete(path).set('Authorization', sign(sgn, 'mine-only', 'DELETE', path)).expect(204);
    expect(mockHandles.has('mine-only')).toBe(false);
  });

  test('a stale signature is refused', async () => {
    const a = app();
    const { sgn } = await claim(a, 'stale-one');
    const path = '/api/handles/stale-one';
    const old = Date.now() - 10 * 60 * 1000;
    await request(a).delete(path).set('Authorization', sign(sgn, 'stale-one', 'DELETE', path, old)).expect(401);
  });

  test("one handle's key cannot act on another handle", async () => {
    const a = app();
    await claim(a, 'victim-one');
    const { sgn: attacker } = await claim(a, 'attacker-one');
    const path = '/api/handles/victim-one';
    await request(a).delete(path).set('Authorization', sign(attacker, 'attacker-one', 'DELETE', path)).expect(403);
    expect(mockHandles.has('victim-one')).toBe(true);
  });
});
