const mockRows = new Map();
jest.mock('../db/connection', () => ({
  query: jest.fn(async (sql, params) => {
    const s = sql.trim();
    if (/^SELECT/i.test(s)) return { rows: mockRows.has(params[0]) ? [{ blob: mockRows.get(params[0]) }] : [] };
    if (/^INSERT/i.test(s)) mockRows.set(params[0], params[1]);
    if (/^DELETE FROM move_links WHERE id/i.test(s)) mockRows.delete(params[0]);
    return { rows: [] };
  }),
}));
const express = require('express');
const request = require('supertest');

const app = () => { const a = express(); a.use(express.json({ limit: '10mb' })); a.use('/api/move', require('../routes/moveLists')); return a; };

describe('move-lists short links', () => {
  test('store, fetch, delete round trip', async () => {
    const a = app();
    const post = await request(a).post('/api/move').send({ blob: 'abcDEF123_-' });
    expect(post.status).toBe(200);
    expect(post.body.id).toMatch(/^[A-Za-z0-9_-]{12}$/);
    const get = await request(a).get(`/api/move/${post.body.id}`);
    expect(get.body).toEqual({ blob: 'abcDEF123_-' });
    expect(get.headers['cache-control']).toBe('no-store');
    await request(a).delete(`/api/move/${post.body.id}`).expect(204);
    await request(a).get(`/api/move/${post.body.id}`).expect(404);
  });
  test('rejects bad payloads and bad ids', async () => {
    const a = app();
    await request(a).post('/api/move').send({ blob: 'has spaces!' }).expect(400);
    await request(a).post('/api/move').send({}).expect(400);
    await request(a).post('/api/move').send({ blob: 'a'.repeat(200001) }).expect(400);
    await request(a).get('/api/move/short').expect(404);
  });
});
