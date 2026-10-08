// Remember me (owner, 2026-10-08: "so that users don't have to sign in every time").
const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

jest.mock('../models/User', () => ({ findById: jest.fn() }));
jest.mock('../services/TokenService', () => ({ getBalance: jest.fn().mockResolvedValue({ balance: 0, isPremium: false }) }));
jest.mock('../services/EmailService', () => ({ sendLoginCode: jest.fn() }));
const mockQuery = jest.fn();
jest.mock('../db/connection', () => ({ query: (...a) => mockQuery(...a) }));

const User = require('../models/User');
const config = require('../config/env');

const app = express();
app.use(express.json());
app.use('/api/auth', require('../routes/auth'));

const USER = { id: 7, email: 'a@b.co', username: 'a', role: 'user', account_code_hash: 'x' };
const DAY = 24 * 60 * 60;
const life = (token) => { const d = jwt.decode(token); return (d.exp - d.iat) / DAY; };

async function signIn(body) {
  const hash = await bcrypt.hash('ABC123', 4);
  mockQuery.mockReset()
    .mockResolvedValueOnce({ rows: [USER] })                 // user
    .mockResolvedValueOnce({ rows: [] })                     // premium codes
    .mockResolvedValueOnce({ rows: [{ id: 1, code_hash: hash }] }) // login codes
    .mockResolvedValue({ rows: [] });
  return request(app).post('/api/auth/verify-access-code').send({ email: 'a@b.co', code: 'abc123', ...body });
}

describe('remember me', () => {
  beforeEach(() => { User.findById.mockResolvedValue({ id: 7, email: 'a@b.co', role: 'user' }); });

  it('remembers by default: a 90-day sign-in', async () => {
    const res = await signIn({});
    expect(res.status).toBe(200);
    expect(life(res.body.token)).toBe(90);
    expect(jwt.decode(res.body.token).rem).toBe(1);
  });

  it('unticked: a short, session-only sign-in', async () => {
    const res = await signIn({ remember: false });
    expect(life(res.body.token)).toBe(1);
    expect(jwt.decode(res.body.token).rem).toBeUndefined();
  });

  it('a remembered sign-in older than a day is renewed when checked', async () => {
    const old = jwt.sign({ userId: 7, email: 'a@b.co', role: 'user', rem: 1, iat: Math.floor(Date.now() / 1000) - 3 * DAY }, config.jwtSecret, { expiresIn: '90d' });
    const res = await request(app).get('/api/auth/validate').set('Authorization', `Bearer ${old}`);
    expect(res.body.valid).toBe(true);
    expect(res.body.token).toBeTruthy();
    expect(jwt.decode(res.body.token).exp).toBeGreaterThan(jwt.decode(old).exp);
  });

  it('a fresh one is not reissued, and a session-only one never is', async () => {
    const fresh = jwt.sign({ userId: 7, rem: 1 }, config.jwtSecret, { expiresIn: '90d' });
    const sess = jwt.sign({ userId: 7, iat: Math.floor(Date.now() / 1000) - 3 * 3600 }, config.jwtSecret, { expiresIn: '1d' });
    for (const t of [fresh, sess]) {
      const res = await request(app).get('/api/auth/validate').set('Authorization', `Bearer ${t}`);
      expect(res.body.valid).toBe(true);
      expect(res.body.token).toBeUndefined();
    }
  });
});
