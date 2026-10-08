const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// In-memory fake of the two tables the passwordless flow touches, so this
// test exercises the real route logic (bcrypt hash/compare, code matching,
// rate limiting) end to end without needing a live Postgres instance.
// Jest hoists jest.mock() factories above other module code and forbids them
// from closing over ordinary out-of-scope variables — names prefixed with
// "mock" are the documented exception, hence the naming here.
let mockUsers;
let mockLoginCodes;
let mockNextUserId;
let mockNextCodeId;
const mockSentEmails = [];

function mockResetFakeDb() {
  mockUsers = [];
  mockLoginCodes = [];
  mockNextUserId = 1;
  mockNextCodeId = 1;
  mockSentEmails.length = 0;
}

function mockFakeQuery(sql, params) {
  const s = sql.replace(/\s+/g, ' ').trim();

  if (s.startsWith('SELECT id FROM login_codes WHERE email = $1 AND created_at >')) {
    return { rows: [] }; // rate-limit check always passes in tests
  }
  if (s.startsWith('SELECT id, is_pending FROM users WHERE email = $1 LIMIT 1')) {
    const u = mockUsers.find((u) => u.email === params[0]);
    return { rows: u ? [{ id: u.id, is_pending: u.is_pending }] : [] };
  }
  if (s.startsWith('UPDATE users SET is_pending = false')) {
    const u = mockUsers.find((u) => u.id === params[0]);
    if (u) u.is_pending = false;
    return { rows: [] };
  }
  if (s.startsWith('INSERT INTO users (email, username, registration_method, is_pending')) {
    const u = { id: mockNextUserId++, email: params[0], username: params[1], is_pending: false };
    mockUsers.push(u);
    return { rows: [{ id: u.id }] };
  }
  if (s.startsWith('INSERT INTO login_codes (email, code_hash, expires_at)')) {
    mockLoginCodes.push({
      id: mockNextCodeId++,
      email: params[0],
      code_hash: params[1],
      used: false,
      expires_at: Date.now() + 15 * 60 * 1000,
    });
    return { rows: [] };
  }
  if (s.startsWith('SELECT id, email, username, role, account_code_hash FROM users WHERE email = $1 AND is_pending = false')) {
    const u = mockUsers.find((u) => u.email === params[0] && !u.is_pending);
    return { rows: u ? [{ id: u.id, email: u.email, username: u.username, role: 'user', account_code_hash: u.account_code_hash || null }] : [] };
  }
  if (s.startsWith('UPDATE users SET account_code_hash = $1')) {
    const u = mockUsers.find((u) => u.id === params[1]);
    if (u) u.account_code_hash = params[0];
    return { rows: [] };
  }
  if (s.startsWith('SELECT id, code_hash FROM premium_access_codes')) {
    return { rows: [] }; // no premium codes in this test suite
  }
  if (s.startsWith('SELECT id, code_hash FROM login_codes WHERE email = $1 AND used = false')) {
    return {
      rows: mockLoginCodes
        .filter((c) => c.email === params[0] && !c.used && c.expires_at > Date.now())
        .map((c) => ({ id: c.id, code_hash: c.code_hash })),
    };
  }
  if (s.startsWith('UPDATE login_codes SET used = true')) {
    const c = mockLoginCodes.find((c) => c.id === params[0]);
    if (c) c.used = true;
    return { rows: [] };
  }

  throw new Error(`mockFakeQuery: unhandled SQL in test — ${s}`);
}

jest.mock('../db/connection', () => ({
  query: jest.fn((sql, params = []) => mockFakeQuery(sql, params)),
}));

jest.mock('../services/TokenService', () => ({
  getBalance: jest.fn().mockResolvedValue({ balance: 10, isPremium: false }),
  initializeNewUser: jest.fn().mockResolvedValue(true),
}));

jest.mock('../services/EmailService', () => ({
  sendLoginCode: jest.fn((email, code) => {
    mockSentEmails.push({ email, code });
    return Promise.resolve({ success: true });
  }),
}));

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../routes/auth'));
  return app;
};

describe('Passwordless auth integration (request-code -> verify-access-code)', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    mockResetFakeDb();
  });

  it('creates a free account on first code request', async () => {
    const response = await request(app)
      .post('/api/auth/request-code')
      .send({ email: 'newuser@example.com' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockUsers.some((u) => u.email === 'newuser@example.com')).toBe(true);
    expect(mockSentEmails).toHaveLength(1);
    expect(mockSentEmails[0].email).toBe('newuser@example.com');
    expect(mockSentEmails[0].code).toMatch(/^\d{6}$/);
  });

  it('signs the user in with the emailed code and issues a JWT', async () => {
    await request(app).post('/api/auth/request-code').send({ email: 'roundtrip@example.com' });
    const { code } = mockSentEmails[0];

    const response = await request(app)
      .post('/api/auth/verify-access-code')
      .send({ email: 'roundtrip@example.com', code , adult: true });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.email).toBe('roundtrip@example.com');

    const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
    expect(decoded.email).toBe('roundtrip@example.com');
  });

  it('rejects a code that was already used once', async () => {
    await request(app).post('/api/auth/request-code').send({ email: 'onceonly@example.com' });
    const { code } = mockSentEmails[0];

    const first = await request(app)
      .post('/api/auth/verify-access-code')
      .send({ email: 'onceonly@example.com', code , adult: true });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/auth/verify-access-code')
      .send({ email: 'onceonly@example.com', code , adult: true });
    expect(second.status).toBe(401);
  });

  it('rejects a wrong code', async () => {
    await request(app).post('/api/auth/request-code').send({ email: 'wrongcode@example.com' });

    const response = await request(app)
      .post('/api/auth/verify-access-code')
      .send({ email: 'wrongcode@example.com', code: '000000' , adult: true });

    expect(response.status).toBe(401);
  });

  it('reveals a durable account code on first sign-in and reuses it', async () => {
    await request(app).post('/api/auth/request-code').send({ email: 'durable@example.com' });
    const { code } = mockSentEmails[0];

    const first = await request(app)
      .post('/api/auth/verify-access-code')
      .send({ email: 'durable@example.com', code , adult: true });
    expect(first.status).toBe(200);
    expect(first.body.accountCode).toMatch(/^[A-Z2-9]{10}$/); // shown once

    const accountCode = first.body.accountCode;

    // Reusable: the same account code signs in again with no emailed code.
    const second = await request(app)
      .post('/api/auth/verify-access-code')
      .send({ email: 'durable@example.com', code: accountCode , adult: true });
    expect(second.status).toBe(200);
    expect(second.body.accountCode).toBeNull(); // only revealed the first time

    // And again — it's durable, not one-time.
    const third = await request(app)
      .post('/api/auth/verify-access-code')
      .send({ email: 'durable@example.com', code: accountCode , adult: true });
    expect(third.status).toBe(200);
  });
});
