/**
 * GET /api/search/trending is ADMIN-ONLY.
 *
 * 2026-11-08: it was public, and it returned the raw top searches of the last
 * 24 hours to anyone. The search log stores no person, so it counts searches,
 * not people — one person repeating a query topped the list, and it was a
 * private individual's name. Nothing public reads it any more (the landing
 * page's search pills were replaced by the news and posts feed), so it stays
 * only for the owner's analysis, behind a login.
 *
 * The real requireAdmin guard is used; only the token check in front of it is
 * stood in for, so what is tested is that THIS ROUTE is wired to the guard.
 */
jest.mock('axios');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-only';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'test-only';
process.env.GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || 'test-only';

const mockQuery = jest.fn(async () => ({ rows: [{ query: 'a query', count: 3, top_mode: 'blue-pill' }] }));
jest.mock('../db/connection', () => ({ query: (...a) => mockQuery(...a) }));

jest.mock('../middleware/auth', () => {
  const actual = jest.requireActual('../middleware/auth');
  return {
    ...actual,
    // Stand-in for the JWT check: no header = not signed in; otherwise the
    // header names the role the signed-in user has.
    authenticate: (req, res, next) => {
      const role = req.headers['x-test-role'];
      if (!role) return res.status(401).json({ error: 'Authentication required' });
      req.user = { userId: 'u1', role, isAuthenticated: true };
      return next();
    },
  };
});

const express = require('express');
const request = require('supertest');

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/search', require('../routes/search'));
  return a;
}

beforeEach(() => mockQuery.mockClear());

describe('GET /api/search/trending', () => {
  test('a visitor who is not signed in gets nothing, and the log is not read', async () => {
    const res = await request(app()).get('/api/search/trending');
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toMatch(/a query/);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('an ordinary signed-in user is refused too, and the log is not read', async () => {
    const res = await request(app()).get('/api/search/trending').set('x-test-role', 'user');
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toMatch(/a query/);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('an admin still gets the list, for the owner\'s own analysis', async () => {
    const res = await request(app()).get('/api/search/trending').set('x-test-role', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.trending[0]).toMatchObject({ query: 'a query', count: 3 });
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});
