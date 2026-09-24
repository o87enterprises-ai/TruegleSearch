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

/**
 * Why chat fell over for weeks: the system prompt went out TWICE (~10K tokens
 * against an 8K free-tier cap), so every real chat got a 413 while the tiny
 * health ping stayed green. And a single retired model could take Groq down.
 */
describe('GroqService free-tier fallback plan', () => {
  const pool = require('../services/GroqKeyPool');
  let svc;
  const httpError = (status, error = {}) => Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { error }, headers: {} },
  });
  const sent = (n = 0) => axios.post.mock.calls[n][1];

  beforeEach(() => {
    jest.clearAllMocks();
    pool.orgs.forEach((o) => { o.cooldowns = {}; o.disabled = o.disabled.map(() => false); });
    svc = new GroqService();
  });

  it('sends the system prompt once when it arrives both in messages and as `system`', async () => {
    axios.post.mockResolvedValue(reply('ok'));
    const system = 'You are TrueGLE.';
    await svc.chat([{ role: 'system', content: system }, { role: 'user', content: 'hi' }], { system });
    expect(sent().messages.filter((m) => m.role === 'system')).toHaveLength(1);
  });

  it('still adds `system` when the messages carry none', async () => {
    axios.post.mockResolvedValue(reply('ok'));
    await svc.chat('hi', { system: 'You are TrueGLE.' });
    expect(sent().messages[0]).toEqual({ role: 'system', content: 'You are TrueGLE.' });
  });

  it('shrinks the reply reservation so prompt + max_tokens fits the 8K cap', async () => {
    axios.post.mockResolvedValue(reply('ok'));
    const big = 'x'.repeat(5000 * 3.5); // ~5K tokens of system prompt
    await svc.chat([{ role: 'system', content: big }, { role: 'user', content: 'hi' }], { max_tokens: 4000 });
    const body = sent();
    expect(svc.estimateTokens(body.messages) + body.max_tokens).toBeLessThanOrEqual(8000);
    expect(body.max_tokens).toBeGreaterThanOrEqual(600);
  });

  it('drops the oldest history before it would drop below a usable reply budget', async () => {
    axios.post.mockResolvedValue(reply('ok'));
    const turn = 'y'.repeat(1500 * 3.5); // ~1.5K tokens each: 5K + 3K no longer fits
    const msgs = [
      { role: 'system', content: 'z'.repeat(5000 * 3.5) },
      { role: 'user', content: `old ${turn}` }, { role: 'assistant', content: turn },
      { role: 'user', content: 'the actual question' },
    ];
    await svc.chat(msgs, { max_tokens: 2000 });
    const out = sent().messages;
    expect(out[0].role).toBe('system');
    expect(out[out.length - 1].content).toBe('the actual question');
    expect(out.some((m) => String(m.content).startsWith('old '))).toBe(false);
  });

  it('fails over without calling Groq when even the bare prompt is over the cap', async () => {
    await expect(svc.chat([{ role: 'system', content: 'z'.repeat(9000 * 3.5) }, { role: 'user', content: 'q' }]))
      .rejects.toThrow(/over the 8000-token cap/);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('falls back to the next model when Groq says one is retired, and remembers it', async () => {
    axios.post
      .mockRejectedValueOnce(httpError(404, { code: 'model_not_found', message: 'The model does not exist' }))
      .mockResolvedValue(reply('from fallback'));
    await expect(svc.chat('hi')).resolves.toMatchObject({ content: 'from fallback' });
    expect(sent(0).model).toBe('openai/gpt-oss-120b');
    expect(sent(1).model).toBe('qwen/qwen3.8-27b');

    await svc.chat('again');
    expect(sent(2).model).toBe('qwen/qwen3.8-27b'); // the dead one is not retried
  });

  it('moves to the next model on a 429 — Groq meters each model separately', async () => {
    axios.post
      .mockRejectedValueOnce(httpError(429, { message: 'Rate limit reached' }))
      .mockResolvedValue(reply('other model'));
    await expect(svc.chat('hi')).resolves.toMatchObject({ content: 'other model' });
    expect(sent(1).model).not.toBe(sent(0).model);
    // ...and the cooled model stays cooled while the others remain leasable.
    expect(pool.acquire(new Set(), 'openai/gpt-oss-120b')).toBeNull();
    expect(pool.acquire(new Set(), 'qwen/qwen3.8-27b')).not.toBeNull();
  });

  it("puts Groq's own explanation in the error instead of a bare status", async () => {
    axios.post.mockRejectedValue(httpError(413, { message: 'Request too large on tokens per minute (TPM): Limit 8000, Requested 12100' }));
    await expect(svc.chat('hi')).rejects.toThrow(/HTTP 413\): Request too large/);
  });

  it('never swaps an explicitly requested (vision) model for a text fallback', async () => {
    axios.post.mockRejectedValue(httpError(404, { code: 'model_not_found' }));
    await expect(svc.chat('hi', { model: 'qwen/qwen3.6-27b' })).rejects.toThrow();
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
});

describe('GroqService vision fallback', () => {
  const pool = require('../services/GroqKeyPool');
  beforeEach(() => { jest.clearAllMocks(); pool.orgs.forEach((o) => { o.cooldowns = {}; }); });

  it('walks vision-capable models only when the first vision model is gone', async () => {
    const svc = new GroqService();
    axios.post
      .mockRejectedValueOnce(Object.assign(new Error('404'), { response: { status: 404, data: { error: { code: 'model_not_found' } }, headers: {} } }))
      .mockResolvedValue(reply('a red pixel'));
    await expect(svc.chat('what is this', { model: 'qwen/qwen3.6-27b', vision: true })).resolves.toMatchObject({ content: 'a red pixel' });
    const models = axios.post.mock.calls.map((c) => c[1].model);
    expect(models).toEqual(['qwen/qwen3.6-27b', 'qwen/qwen3.8-27b']);
    expect(models).not.toContain('openai/gpt-oss-120b');
  });
});
