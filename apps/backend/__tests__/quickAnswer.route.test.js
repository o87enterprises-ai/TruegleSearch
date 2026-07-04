/**
 * Route tests for POST /api/ai/quick-answer (DuckDuckGo-style answer box).
 * The AI provider is mocked so these run offline and deterministically.
 */
const request = require('supertest');
const express = require('express');
const UnifiedAIService = require('../services/UnifiedAIService');
const aiRouter = require('../routes/ai');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/ai', aiRouter);
  return app;
}

const wallResults = [
  {
    title: 'Great Wall of China — length',
    snippet: 'The Great Wall of China is approximately 21,196 km long.',
    url: 'https://en.wikipedia.org/wiki/Great_Wall_of_China',
    domain: 'en.wikipedia.org',
  },
  { title: 'Travel blog', snippet: 'My trip to the wall', url: 'https://blog.example.com/x', domain: 'blog.example.com' },
];

describe('POST /api/ai/quick-answer', () => {
  afterEach(() => jest.restoreAllMocks());

  it('short-circuits a non-answerable query without calling the AI', async () => {
    const spy = jest.spyOn(UnifiedAIService, 'chat');
    const res = await request(makeApp())
      .post('/api/ai/quick-answer')
      .send({ query: 'nike running shoes', results: wallResults });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBeNull();
    expect(res.body.reason).toBe('not_answerable');
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns a grounded answer with sources mapped back to real results', async () => {
    jest.spyOn(UnifiedAIService, 'chat').mockResolvedValue({
      content: JSON.stringify({ answer: 'The Great Wall of China is about 21,196 km long.', sources: [0] }),
      provider: 'test',
    });
    const res = await request(makeApp())
      .post('/api/ai/quick-answer')
      .send({ query: 'length of the great wall of china', results: wallResults });

    expect(res.status).toBe(200);
    expect(res.body.answer).toMatch(/21,196/);
    expect(res.body.sources).toHaveLength(1);
    expect(res.body.sources[0]).toMatchObject({
      url: 'https://en.wikipedia.org/wiki/Great_Wall_of_China',
      domain: 'en.wikipedia.org',
    });
  });

  it('hides the card when the AI replies NO_ANSWER', async () => {
    jest.spyOn(UnifiedAIService, 'chat').mockResolvedValue({ content: 'NO_ANSWER', provider: 'test' });
    const res = await request(makeApp())
      .post('/api/ai/quick-answer')
      .send({ query: 'what is the meaning of life', results: wallResults });

    expect(res.body.answer).toBeNull();
    expect(res.body.reason).toBe('no_answer');
  });

  it('never errors the client when the AI provider throws', async () => {
    jest.spyOn(UnifiedAIService, 'chat').mockRejectedValue(new Error('provider down'));
    const res = await request(makeApp())
      .post('/api/ai/quick-answer')
      .send({ query: 'what is the capital of france', results: wallResults });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBeNull();
    expect(res.body.reason).toBe('error');
  });

  it('rejects a missing query with 400', async () => {
    const res = await request(makeApp()).post('/api/ai/quick-answer').send({ results: wallResults });
    expect(res.status).toBe(400);
  });
});
