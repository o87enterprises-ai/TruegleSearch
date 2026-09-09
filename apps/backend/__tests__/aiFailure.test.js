/**
 * Every case here is an error string the stack ACTUALLY throws, quoted from
 * its throw site. That is the whole point: the branches this replaced matched
 * invented strings ('Rate limit') that nothing produced, so the tests to write
 * are the ones that would have caught that — real messages in, right status
 * out.
 */
const { classifyAiFailure } = require('../utils/aiFailure');

// The wrapper UnifiedAIService.js:259 puts around whatever failed last.
const wrapped = (last) => new Error(`All AI providers failed. Last error: ${last}`);

describe('classifyAiFailure', () => {
  describe('rate limiting — the case the old code could never reach', () => {
    // GroqService.js: thrown when every org is cooling down. It mentions API
    // KEYS, which is why the old `includes('API key')` branch swallowed it and
    // reported a configuration error for a service that was merely out of quota.
    it('reads "All Groq API keys are rate-limited" as a rate limit, not a config error', () => {
      const r = classifyAiFailure(wrapped('All Groq API keys are rate-limited'));
      expect(r.status).toBe(429);
      expect(r.body.code).toBe('ai_rate_limited');
    });

    it('does not tell the visitor it is a configuration problem', () => {
      const r = classifyAiFailure(wrapped('All Groq API keys are rate-limited'));
      expect(r.body.message).not.toMatch(/configuration/i);
    });

    it('still catches the plainly-worded ones', () => {
      for (const m of ['Rate limit exceeded', 'rate limit reached', 'Too Many Requests', 'quota exceeded']) {
        expect(classifyAiFailure(new Error(m)).status).toBe(429);
      }
    });

    it('passes through a Retry-After the provider actually sent', () => {
      const err = new Error('Rate limit exceeded');
      err.response = { headers: { 'retry-after': '42' } };
      expect(classifyAiFailure(err).retryAfter).toBe(42);
    });

    it('invents no Retry-After when none was sent — clients obey it', () => {
      expect(classifyAiFailure(new Error('Rate limit exceeded')).retryAfter).toBeNull();
    });

    it('ignores a Retry-After already in the past rather than sending zero', () => {
      const err = new Error('Rate limit exceeded');
      err.response = { headers: { 'retry-after': new Date(Date.now() - 60_000).toUTCString() } };
      expect(classifyAiFailure(err).retryAfter).toBeNull();
    });
  });

  describe('no capacity — ours to fix, and retrying will not', () => {
    // GroqService.js, when every key has been 401/403'd out of the pool.
    it('reads "All Groq API keys exhausted" as unavailable', () => {
      const r = classifyAiFailure(wrapped('All Groq API keys exhausted'));
      expect(r.status).toBe(503);
      expect(r.body.code).toBe('ai_no_capacity');
    });

    // UnifiedAIService.js:517 — nothing configured at all.
    it('reads "No AI providers available" the same way', () => {
      expect(classifyAiFailure(new Error('No AI providers available')).body.code).toBe('ai_no_capacity');
    });

    it('does not promise that trying again will help', () => {
      const r = classifyAiFailure(new Error('No AI providers available'));
      expect(r.body.message).not.toMatch(/try again/i);
    });
  });

  describe('the rest', () => {
    // GroqService.js — a reasoning model that spent its whole budget thinking.
    it('separates an empty completion from an outage, and says what helps', () => {
      const r = classifyAiFailure(wrapped(
        'Groq returned no content: openai/gpt-oss-120b spent the whole 1024-token budget reasoning. '
        + 'Raise max_tokens or lower GROQ_REASONING_EFFORT.'));
      expect(r.status).toBe(503);
      expect(r.body.code).toBe('ai_no_content');
      expect(r.body.message).toMatch(/shorter/i);
    });

    it('treats timeouts and upstream 5xx as transient', () => {
      for (const m of [
        'Groq service error: timeout of 30000ms exceeded',
        'Groq service error: Request failed with status code 503',
        'Groq service error: socket hang up',
      ]) {
        const r = classifyAiFailure(wrapped(m));
        expect(r.status).toBe(503);
        expect(r.body.code).toBe('ai_upstream');
      }
    });

    it('falls back to 500 for anything unrecognised', () => {
      const r = classifyAiFailure(new Error('something nobody predicted'));
      expect(r.status).toBe(500);
      expect(r.body.code).toBe('ai_failed');
    });

    it('lets a route word its own fallback', () => {
      const r = classifyAiFailure(new Error('???'), { fallbackMessage: 'Unable to process AI analysis at this time. Please try again.' });
      expect(r.body.message).toMatch(/analysis/);
    });

    it('survives a thrown non-Error without adding a second failure', () => {
      expect(classifyAiFailure(undefined).status).toBe(500);
      expect(classifyAiFailure({}).status).toBe(500);
    });
  });

  describe('nothing leaks', () => {
    it('never names the provider, model or key in what the visitor is shown', () => {
      const messages = [
        wrapped('All Groq API keys are rate-limited'),
        wrapped('All Groq API keys exhausted'),
        wrapped('Groq returned no content: openai/gpt-oss-120b spent the whole budget'),
        wrapped('Groq service error: timeout of 30000ms exceeded'),
      ].map((e) => classifyAiFailure(e).body.message);
      for (const m of messages) {
        expect(m).not.toMatch(/groq|gpt-oss|api[\s-]?key|token budget/i);
      }
    });
  });
});
