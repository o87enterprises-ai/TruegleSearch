process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-only';
jest.mock('../services/YouTubeGateway', () => ({
  captionList: jest.fn(async (id) => (id === 'esAudio0001' ? { data: { captions: [{ label: 'Spanish (auto-generated)', languageCode: 'es' }] } } : { data: { captions: [] } })),
}));
const express = require('express');
const request = require('supertest');
const app = () => { const a = express(); a.use(express.json()); a.use('/api/lang', require('../routes/lang')); return a; };

test('POST /api/lang/classify gives each Tube result a verdict, in order, spoken language first', async () => {
  const r = await request(app()).post('/api/lang/classify').send({ lang: 'en-US', items: [
    { url: 'https://www.youtube.com/watch?v=esAudio0001', title: 'The best clips of the week you have to watch' },
    { url: 'https://example.com/a', title: 'The best clips of the week you have to watch' },
    { url: 'https://example.com/b', title: 'Los mejores momentos de la semana' },
    { url: 'https://example.com/c', title: 'PART 2 viral clip highlights' },
  ] });
  expect(r.status).toBe(200);
  expect(r.body.items.map((i) => i.verdict)).toEqual(['other', 'match', 'other', 'unknown']);
  expect(r.body.items[0]).toMatchObject({ lang: 'en', audioLang: 'es' });
});

test('junk input is bounded and harmless', async () => {
  const r = await request(app()).post('/api/lang/classify').send({ lang: 42, items: Array.from({ length: 500 }, () => ({ url: {}, title: 7 })) });
  expect(r.status).toBe(200);
  expect(r.body.items).toHaveLength(60);
  expect(r.body.items.every((i) => i.verdict === 'unknown')).toBe(true);
});
