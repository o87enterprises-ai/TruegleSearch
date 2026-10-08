// Safe Search in the Feed (owner, 2026-10-08). Each platform's own adult mark
// is kept, and those posts stay out unless Safe Search is OFF and signed in.
jest.mock('axios');
const axios = require('axios');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret-for-feed';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-only';
process.env.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'test-only';
process.env.GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID || 'test-only';
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use('/api/social', require('../routes/social'));
const config = require('../config/env');

beforeEach(() => {
  axios.get.mockImplementation((url) => {
    if (url.includes('reddit.com')) {
      return Promise.resolve({ data: { data: { after: null, children: [
        { data: { id: 'ok', title: 'An ordinary post', permalink: '/r/x/comments/ok/', created_utc: 1700000000 } },
        { data: { id: 'adult', title: 'An adult post', permalink: '/r/x/comments/adult/', created_utc: 1700000001, over_18: true } },
      ] } } });
    }
    return Promise.reject(new Error('not in this test'));
  });
});

const ask = (body, token) => {
  const r = request(app).post('/api/social/feed').send({ query: 'anything', platforms: ['reddit'], ...body });
  return token ? r.set('Authorization', `Bearer ${token}`) : r;
};
const ids = (res) => res.body.results.map((r) => r.id);

describe('adult posts in the feed', () => {
  it('stay out by default', async () => {
    expect(ids(await ask({}))).toEqual(['ok']);
  });
  it('stay out when Safe Search "off" is asked for but nobody is signed in', async () => {
    expect(ids(await ask({ safeSearch: 'off' }))).toEqual(['ok']);
  });
  it('come through for a signed-in adult with Safe Search off — and are marked', async () => {
    const token = jwt.sign({ userId: 7 }, config.jwtSecret, { expiresIn: '1h' });
    const res = await ask({ safeSearch: 'off' }, token);
    expect(ids(res).sort()).toEqual(['adult', 'ok']);
    expect(res.body.results.find((r) => r.id === 'adult').nsfw).toBe(true);
  });
});
