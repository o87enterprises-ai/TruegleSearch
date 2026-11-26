/**
 * Regression tests for the 2026-11 security review. Each block pins a hole that
 * was real: if one of these goes red, a vulnerability has been re-opened.
 */
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'test-secret-for-jest-0123456789abcdef';
process.env.JWT_SECRET = SECRET;

const mockProvider = {
  refund: jest.fn().mockResolvedValue({ refundId: 're_1', status: 'succeeded' }),
  verifyWebhook: jest.fn(),
  confirmPayment: jest.fn(),
  createPaymentIntent: jest.fn().mockResolvedValue({ clientSecret: 'x', paymentIntentId: 'pi_1' }),
  getFrontendConfig: jest.fn(),
};
jest.mock('../services/payment/index', () => ({ createProvider: () => mockProvider }));
const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
jest.mock('../db/connection', () => ({ query: (...a) => mockQuery(...a) }));
jest.mock('../services/SpeechToTextService', () => ({ isConfigured: () => false, transcribe: jest.fn() }));
jest.mock('../services/ShoppingService', () => ({ clearCache: jest.fn().mockResolvedValue({ cleared: 1 }) }));

const config = require('../config/env');
const token = (role) => jwt.sign({ userId: 7, email: 'u@example.com', role }, config.jwtSecret, { algorithm: 'HS256' });

const makeApp = () => {
  const app = express();
  app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());
  app.use('/api/payment', require('../routes/payment'));
  app.use('/api/voice', require('../routes/voice'));
  app.use('/api/shopping', require('../routes/shopping'));
  app.use('/api/extract', require('../routes/extract'));
  app.use('/api/paypal', require('../routes/paypal'));
  return app;
};

describe('SSRF guard (utils/safeFetch)', () => {
  const { checkUrl } = require('../utils/safeFetch');
  const refused = [
    'http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/',
    'http://[::127.0.0.1]/',            // IPv4-compatible IPv6
    'http://[::ffff:7f00:1]/',          // IPv4-mapped (hex form)
    'http://[2002:7f00:1::]/',          // 6to4 embedding 127.0.0.1
    'http://[fec0::1]/',                // deprecated site-local
    'http://localhost./', 'http://app.localhost./', 'http://db.internal./',
    'http://2130706433/', 'http://0x7f.1/', 'http://10.0.0.5/',
  ];
  it.each(refused)('refuses %s', (u) => { expect(() => checkUrl(u)).toThrow(); });
  it.each(['https://example.com/', 'http://93.184.216.34/', 'https://[2606:4700:4700::1111]/'])(
    'allows public %s', (u) => { expect(() => checkUrl(u)).not.toThrow(); });
});

describe('payment routes', () => {
  const app = makeApp();
  beforeEach(() => { mockProvider.refund.mockClear(); });

  it('refund: anonymous is 401', async () => {
    const r = await request(app).post('/api/payment/refund').send({ paymentIntentId: 'pi_1' });
    expect(r.status).toBe(401);
  });
  it('refund: an ordinary signed-in user is 403 and nothing is refunded', async () => {
    const r = await request(app).post('/api/payment/refund')
      .set('Authorization', `Bearer ${token('user')}`).send({ paymentIntentId: 'pi_1' });
    expect(r.status).toBe(403);
    expect(mockProvider.refund).not.toHaveBeenCalled();
  });
  it('refund: an admin can refund', async () => {
    const r = await request(app).post('/api/payment/refund')
      .set('Authorization', `Bearer ${token('admin')}`).send({ paymentIntentId: 'pi_1' });
    expect(r.status).toBe(200);
    expect(mockProvider.refund).toHaveBeenCalledTimes(1);
  });
  it('create-intent: client metadata can never set userId', async () => {
    await request(app).post('/api/payment/create-intent')
      .set('Authorization', `Bearer ${token('user')}`)
      .send({ amount: 999, metadata: { userId: '1', note: 'hi' } });
    const meta = mockProvider.createPaymentIntent.mock.calls.pop()[0].metadata;
    expect(meta.userId).toBe('7');
    expect(meta.note).toBe('hi');
  });

  describe('webhook', () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    const fire = async (event) => {
      mockProvider.verifyWebhook.mockReturnValue(event);
      mockQuery.mockClear();
      await request(app).post('/api/payment/webhook').set('Content-Type', 'application/json').send('{}');
      await new Promise((r) => setImmediate(r));
    };
    const granted = () => mockQuery.mock.calls.some(([sql]) => /subscription_tier = 'premium'/.test(sql));

    it('a 1-cent payment does NOT unlock premium', async () => {
      await fire({ type: 'payment_intent.succeeded', data: { object: { id: 'pi', amount: 1, amount_received: 1, metadata: { userId: '7' } } } });
      expect(granted()).toBe(false);
    });
    it('a full-price payment does', async () => {
      await fire({ type: 'payment_intent.succeeded', data: { object: { id: 'pi', amount: 999, amount_received: 999, metadata: { userId: '7' } } } });
      expect(granted()).toBe(true);
    });
    it('the +100 token bonus is conditional on the free->premium transition', async () => {
      await fire({ type: 'customer.subscription.updated', data: { object: { id: 's', status: 'active', metadata: { userId: '7' } } } });
      const [sql] = mockQuery.mock.calls.find(([q]) => /subscription_tier = 'premium'/.test(q));
      expect(sql).toMatch(/CASE WHEN subscription_tier IS DISTINCT FROM 'premium' THEN 100 ELSE 0 END/);
    });
  });
});

describe('formerly-open routes now require auth', () => {
  const app = makeApp();
  it.each([
    ['get', '/api/voice/account'],
    ['post', '/api/voice/transcribe-url'],
    ['post', '/api/voice/transcribe'],
    ['post', '/api/voice/analyze-sentiment'],
    ['post', '/api/shopping/clear-cache'],
  ])('%s %s -> 401 anonymous', async (method, path) => {
    const r = await request(app)[method](path).send({ query: 'x', audioUrl: 'https://example.com/a.mp3' });
    expect(r.status).toBe(401);
  });
  it('voice/account and clear-cache are 403 for a non-admin', async () => {
    const h = { Authorization: `Bearer ${token('user')}` };
    expect((await request(app).get('/api/voice/account').set(h)).status).toBe(403);
    expect((await request(app).post('/api/shopping/clear-cache').set(h).send({ query: 'x' })).status).toBe(403);
  });
});

describe('POST /api/extract/images is not an SSRF gadget', () => {
  const app = makeApp();
  it.each(['http://127.0.0.1:8080/', 'http://169.254.169.254/latest/meta-data/', 'localhost'])(
    'refuses %s without connecting', async (url) => {
      const r = await request(app).post('/api/extract/images').send({ url });
      expect(r.status).toBe(422);
      expect(r.body.images).toBeUndefined();
    });
});

describe('paypal id/redirect validation', () => {
  const app = makeApp();
  const h = () => ({ Authorization: `Bearer ${token('user')}` });
  it('rejects path-traversal payment ids', async () => {
    const r = await request(app).get('/api/paypal/payment/..%2F..%2Fv1%2Fidentity%2Foauth2%2Luserinfo').set(h());
    expect(r.status).toBe(400);
  });
  it('rejects attacker-controlled redirect hosts (any *.vercel.app used to pass)', async () => {
    const r = await request(app).post('/api/paypal/create-payment').set(h())
      .send({ amount: 5, returnUrl: 'https://evil.vercel.app/x', cancelUrl: 'https://evil.vercel.app/y' });
    expect(r.status).toBe(400);
  });
});

describe('JWT algorithm pinning', () => {
  const { authenticate } = require('../middleware/auth');
  it('rejects an HS512-signed token', () => {
    const bad = jwt.sign({ userId: 1, role: 'admin' }, config.jwtSecret, { algorithm: 'HS512' });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    authenticate({ headers: { authorization: `Bearer ${bad}` } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('logger redaction', () => {
  const { scrub } = require('../utils/logger');
  it('strips credentials from a raw axios-style error but keeps the debugging fields', () => {
    const { AxiosError } = require('axios');
    const e = new AxiosError('boom', 'ECONNREFUSED',
      { headers: { Authorization: 'Token SUPERSECRET' }, url: 'https://x/?key=ABC' }, {}, { status: 401, data: { echo: 'SUPERSECRET' } });
    const out = JSON.stringify(scrub({ error: e, token: 'abc', nested: { password: 'pw', ok: 1 } }));
    expect(out).not.toMatch(/SUPERSECRET|key=ABC|"abc"|"pw"/);
    expect(out).toMatch(/ECONNREFUSED/);
    expect(out).toMatch(/"ok":1/);
  });
});
