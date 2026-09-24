/**
 * One clock for the whole answer. Providers are tried in turn, each with its
 * own long timeout; without a total budget a slow or sleeping fallback could
 * outlast the platform limit, which kills the function with no CORS header —
 * the browser then shows "could not be reached". The service must stop first
 * and fail with a readable timeout error instead.
 */
process.env.AI_CHAT_BUDGET_MS = '5000';
jest.mock('../config/env', () => ({ ai: { groq: { orgs: [] } }, env: 'test' }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../db/connection', () => ({ query: jest.fn().mockRejectedValue(new Error('no db')) }));

const service = require('../services/UnifiedAIService');
const svc = service.default || service.unifiedAIService || service;

const answer = { content: 'Paris.', model: 'fake', provider: 'fast' };
const provider = (impl) => ({ isAvailable: () => true, chat: jest.fn(impl) });

beforeEach(() => {
  svc.cache?.clear?.();
  svc.promptService = { getPromptByContext: jest.fn().mockRejectedValue(new Error('none')), interpolatePrompt: (t) => t };
});

it('gives up on a provider that hangs and still answers from the next one', async () => {
  svc.providers = {
    sleepy: provider(() => new Promise(() => {})), // never answers
    fast: provider(async () => answer),
  };
  svc.getProviderOrder = async () => ['sleepy', 'fast'];
  // sleepy may use at most 60% of the 5s budget, leaving time for fast.
  const t0 = Date.now();
  await expect(svc.chat('q', 'general', { systemOverride: 'sys' })).resolves.toMatchObject({ content: expect.stringContaining('Paris.') });
  expect(Date.now() - t0).toBeLessThan(4000);
});

it('stops with a readable timeout error, inside the budget, when nothing answers', async () => {
  svc.providers = { a: provider(() => new Promise(() => {})), b: provider(() => new Promise(() => {})) };
  svc.getProviderOrder = async () => ['a', 'b'];
  const t0 = Date.now();
  await expect(svc.chat('q3', 'general', { systemOverride: 'sys' })).rejects.toThrow(/timeout/i);
  expect(Date.now() - t0).toBeLessThan(5500);
});

it('answers normally when the first provider is quick', async () => {
  svc.providers = { fast: provider(async () => answer) };
  svc.getProviderOrder = async () => ['fast'];
  await expect(svc.chat('q2', 'general', { systemOverride: 'sys' })).resolves.toMatchObject({ content: expect.stringContaining('Paris.') });
});
