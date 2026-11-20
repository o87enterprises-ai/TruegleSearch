const mockHandles = new Map();
let mockBox = [];
let mockSeq = 0;
jest.mock('../db/connection', () => ({
  query: jest.fn(async (sql, p) => {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (/^SELECT handle, ecdh_pub/i.test(s)) return { rows: mockHandles.has(p[0]) ? [mockHandles.get(p[0])] : [] };
    if (/^DELETE FROM mailbox WHERE created_at/i.test(s)) return { rows: [] };
    if (/^SELECT count\(\*\)/i.test(s)) return { rows: [{ n: mockBox.filter((m) => m.recipient === p[0]).length }] };
    if (/^SELECT msg_id, blob/i.test(s)) {
      return { rows: mockBox.filter((m) => m.recipient === p[0]).map((m) => ({ msg_id: m.msg_id, blob: m.blob, created_at: m.created_at })) };
    }
    if (/^INSERT INTO mailbox/i.test(s)) {
      if (mockBox.some((m) => m.recipient === p[0] && m.msg_id === p[1])) return { rows: [] };
      mockBox.push({ id: ++mockSeq, recipient: p[0], msg_id: p[1], blob: p[2], created_at: new Date().toISOString() });
      return { rows: [{ msg_id: p[1] }] };
    }
    if (/^DELETE FROM mailbox WHERE recipient/i.test(s)) {
      mockBox = mockBox.filter((m) => !(m.recipient === p[0] && p[1].includes(m.msg_id)));
      return { rows: [] };
    }
    return { rows: [] };
  }),
}));

const http = require('http');
const crypto = require('crypto');
const express = require('express');
const request = require('supertest');

const app = () => {
  const a = express();
  a.use(express.json());
  a.use('/api/mailbox', require('../routes/mailbox'));
  return a;
};
const keypair = () => crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pub = (k) => { const j = k.publicKey.export({ format: 'jwk' }); return JSON.stringify({ kty: j.kty, crv: j.crv, x: j.x, y: j.y }); };
const sig = (key, handle, method, path, ts = Date.now()) => {
  const s = crypto.sign('sha256', Buffer.from(`${ts}\n${method}\n${path}`), { key: key.privateKey, dsaEncoding: 'ieee-p1363' });
  return `TG-Sig handle=${handle},ts=${ts},sig=${s.toString('base64url')}`;
};
const addUser = (handle) => {
  const sign = keypair();
  mockHandles.set(handle, { handle, ecdh_pub: '{}', sign_pub: pub(sign), searchable: false });
  return sign;
};
const BLOB = 'QUJDREVGR0hJSktMTU5PUA_-';

beforeEach(() => { mockHandles.clear(); mockBox = []; mockSeq = 0; });

describe('mailbox', () => {
  test('drop → recipient reads it → acknowledges → it is gone', async () => {
    const a = app();
    const bob = addUser('bob-b');
    await request(a).post('/api/mailbox/bob-b').send({ id: 'msg-000001', blob: BLOB }).expect(201);

    const got = await request(a).get('/api/mailbox').set('Authorization', sig(bob, 'bob-b', 'GET', '/api/mailbox'));
    expect(got.status).toBe(200);
    expect(got.body.messages).toHaveLength(1);
    expect(got.body.messages[0]).toMatchObject({ id: 'msg-000001', blob: BLOB });
    expect(got.headers['cache-control']).toBe('no-store');

    // reading does not delete (a lost response must not lose the message)
    const again = await request(a).get('/api/mailbox').set('Authorization', sig(bob, 'bob-b', 'GET', '/api/mailbox'));
    expect(again.body.messages).toHaveLength(1);

    await request(a).delete('/api/mailbox').set('Authorization', sig(bob, 'bob-b', 'DELETE', '/api/mailbox')).send({ ids: ['msg-000001'] }).expect(204);
    const empty = await request(a).get('/api/mailbox').set('Authorization', sig(bob, 'bob-b', 'GET', '/api/mailbox'));
    expect(empty.body.messages).toEqual([]);
  });

  test('the stored row is the opaque blob and nothing identifying', async () => {
    const a = app();
    addUser('bob-b');
    await request(a).post('/api/mailbox/bob-b').send({ id: 'msg-000002', blob: BLOB }).expect(201);
    expect(Object.keys(mockBox[0]).sort()).toEqual(['blob', 'created_at', 'id', 'msg_id', 'recipient']);
  });

  test('retrying the same message id is a safe no-op', async () => {
    const a = app();
    addUser('bob-b');
    await request(a).post('/api/mailbox/bob-b').send({ id: 'msg-000003', blob: BLOB }).expect(201);
    await request(a).post('/api/mailbox/bob-b').send({ id: 'msg-000003', blob: BLOB }).expect(200);
    expect(mockBox).toHaveLength(1);
  });

  test('only the recipient can read or acknowledge', async () => {
    const a = app();
    addUser('bob-b');
    const eve = addUser('eve-e');
    await request(a).post('/api/mailbox/bob-b').send({ id: 'msg-000004', blob: BLOB }).expect(201);
    await request(a).get('/api/mailbox').expect(401);
    // eve signs as herself: she only sees HER box (empty), never bob's
    const evesBox = await request(a).get('/api/mailbox').set('Authorization', sig(eve, 'eve-e', 'GET', '/api/mailbox'));
    expect(evesBox.body.messages).toEqual([]);
    // eve signing as bob with her key is refused
    await request(a).get('/api/mailbox').set('Authorization', sig(eve, 'bob-b', 'GET', '/api/mailbox')).expect(401);
    // eve cannot delete bob's message
    await request(a).delete('/api/mailbox').set('Authorization', sig(eve, 'eve-e', 'DELETE', '/api/mailbox')).send({ ids: ['msg-000004'] }).expect(204);
    expect(mockBox).toHaveLength(1);
  });

  test('refuses unknown handles, bad ids and bad blobs', async () => {
    const a = app();
    addUser('bob-b');
    await request(a).post('/api/mailbox/nobody-here').send({ id: 'msg-000005', blob: BLOB }).expect(404);
    await request(a).post('/api/mailbox/bob-b').send({ id: 'x', blob: BLOB }).expect(400);
    await request(a).post('/api/mailbox/bob-b').send({ id: 'msg-000005', blob: 'has spaces' }).expect(400);
    await request(a).post('/api/mailbox/bob-b').send({ id: 'msg-000005', blob: 'A'.repeat(12001) }).expect(400);
  });

  test('a mailbox holds at most 200 envelopes', async () => {
    const a = app();
    addUser('bob-b');
    for (let i = 0; i < 200; i += 1) mockBox.push({ id: i, recipient: 'bob-b', msg_id: `fill-${String(i).padStart(6, '0')}`, blob: BLOB, created_at: 'x' });
    await request(a).post('/api/mailbox/bob-b').send({ id: 'msg-overflow', blob: BLOB }).expect(429);
  });

  test('live stream pushes a new envelope the moment it is dropped', async () => {
    const a = app();
    const bob = addUser('bob-b');
    const server = await new Promise((r) => { const s = a.listen(0, () => r(s)); });
    const port = server.address().port;
    try {
      const events = await new Promise((resolve, reject) => {
        let buf = '';
        const req = http.request({
          port, path: '/api/mailbox/stream', method: 'GET', headers: { Authorization: sig(bob, 'bob-b', 'GET', '/api/mailbox/stream') },
        }, (res) => {
          res.setEncoding('utf8');
          res.on('data', (d) => {
            buf += d;
            if (buf.includes('event: ready') && !buf.includes('event: msg')) {
              request(a).post('/api/mailbox/bob-b').send({ id: 'msg-live-01', blob: BLOB }).then(() => {}, reject);
            }
            if (buf.includes('event: msg')) { req.destroy(); resolve(buf); }
          });
        });
        req.on('error', (e) => { if (e.code !== 'ECONNRESET') reject(e); });
        req.end();
        setTimeout(() => reject(new Error('stream timeout')), 4000);
      });
      expect(events).toContain('"id":"msg-live-01"');
    } finally { server.close(); }
  });
});
