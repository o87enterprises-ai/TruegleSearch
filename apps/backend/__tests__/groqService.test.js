/**
 * GroqService — the reasoning-model hazards.
 *
 * gpt-oss thinks before it answers and charges for the thinking, which creates
 * two failure modes the old Llama default never had: a silent empty answer when
 * reasoning eats the token budget, and quota burned on deliberation. These lock
 * in the guards for both.
 */
jest.mock('../config/env', () => ({
  ai: { groq: { model: 'openai/gpt-oss-120b', reasoningEffort: 'low', orgs: [{ label: 'org1', keys: ['k1'] }] } },
}));
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('axios');

const axios = require('axios');
const GroqService = require('../services/GroqService');

const reply = (content, finish_reason = 'stop') => ({
  data: { model: 'openai/gpt-oss-120b', choices: [{ message: { content }, finish_reason }] },
});

describe('GroqService with a reasoning model', () => {
  let svc;
  beforeEach(() => {
    jest.clearAllMocks();
    svc = new GroqService();
  });

  it('sends reasoning_effort to gpt-oss so deliberation does not eat the quota', async () => {
    axios.post.mockResolvedValue(reply('hi'));
    await svc.chat('ping');
    expect(axios.post.mock.calls[0][1]).toMatchObject({ reasoning_effort: 'low' });
  });

  it('withholds reasoning_effort from models that reject it', async () => {
    axios.post.mockResolvedValue(reply('hi'));
    await svc.chat('ping', { model: 'qwen/qwen3.6-27b' });
    expect(axios.post.mock.calls[0][1]).not.toHaveProperty('reasoning_effort');
  });

  it('throws rather than returning a blank answer when reasoning burns the budget', async () => {
    axios.post.mockResolvedValue(reply('', 'length'));
    await expect(svc.chat('ping', { max_tokens: 10 }))
      .rejects.toThrow(/spent the whole 10-token budget reasoning/);
  });

  it('still returns a short answer that legitimately stopped early', async () => {
    axios.post.mockResolvedValue(reply('', 'stop'));
    await expect(svc.chat('ping')).resolves.toMatchObject({ content: '', provider: 'groq' });
  });

  it('gives healthCheck enough budget for a reasoning model to think and answer', async () => {
    axios.post.mockResolvedValue(reply('pong'));
    await svc.healthCheck();
    expect(axios.post.mock.calls[0][1].max_tokens).toBeGreaterThanOrEqual(128);
  });

  it('passes normal content straight through', async () => {
    axios.post.mockResolvedValue(reply('Hello there, nice to meet.'));
    await expect(svc.chat('ping')).resolves.toMatchObject({ content: 'Hello there, nice to meet.' });
  });
});
