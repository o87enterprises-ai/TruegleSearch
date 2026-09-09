/**
 * What actually went wrong with an AI turn, and what to say about it.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * The AI routes classified failures by string-matching the error message, and
 * the strings they matched are not the strings the stack produces:
 *
 *   `error.message.includes('Rate limit')`   ← never true
 *   `error.message.includes('API key')`      ← true for the rate-limit case
 *
 * When every Groq org is cooling down, GroqService throws "All Groq API keys
 * are rate-limited" (GroqService.js). That contains no "Rate limit" — capital
 * R, no hyphen — so the 429 branch was unreachable. It DOES contain "API
 * key", so a service that was merely out of quota reported "temporarily
 * unavailable due to configuration issues": a 500, no Retry-After, and an
 * operator sent to check config that was never wrong. The one branch that was
 * supposed to catch the most common free-tier failure was dead code, and the
 * branch that caught it instead pointed at the wrong cause.
 *
 * That is a honesty problem as much as a routing one — TrueGLE's second
 * mandate is to never mislead, and an error message is still a message.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 *
 * Match on what the code actually throws, most specific first, and carry a
 * machine-readable `code` so logs and dashboards can count causes without
 * re-parsing prose. The user-facing sentence stays free of internals: which
 * provider, which key and which model are operational details, not the
 * visitor's business.
 *
 * Every pattern below is anchored to a real throw site. Keep it that way — a
 * pattern with no thrower is the dead branch this file exists to remove.
 */

/** "All Groq API keys are rate-limited" (GroqService), "Rate limit exceeded"
 *  (provider SDKs), and any 429 that reached us as text. */
const RATE_LIMITED = /rate[\s-]?limit|429|quota exceeded|too many requests/i;

/** Nothing is configured or everything is disabled: "All Groq API keys
 *  exhausted" (every key 401/403'd), "No AI providers available" and
 *  "Provider not available: x" (UnifiedAIService), "not configured"
 *  (individual services). Ours to fix, and retrying will not. */
const NO_CAPACITY = /keys exhausted|no ai providers available|provider not available|unknown provider|not configured|api key not configured/i;

/** "Groq returned no content: … spent the whole N-token budget reasoning"
 *  (GroqService). A real answer was attempted and the budget ran out — a
 *  different thing from an outage, and shortening the question genuinely
 *  helps. */
const NO_CONTENT = /returned no content/i;

/** The upstream was reached and misbehaved: timeouts, dropped sockets, 5xx.
 *  Transient by nature, so this is the one class where "try again" is honest
 *  advice rather than a brush-off. */
const UPSTREAM = /timeout|etimedout|econnreset|econnaborted|socket hang up|network error|status code 5\d\d|bad gateway|service unavailable/i;

/** Seconds to wait, when the error carried a number we can stand behind.
 *  Absent rather than guessed: a made-up Retry-After is worse than none,
 *  because clients obey it. */
function retryAfterSeconds(error) {
  const header = error?.response?.headers?.['retry-after'];
  if (header == null) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(Math.ceil(seconds), 3600);
  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) {
    const delta = Math.ceil((asDate - Date.now()) / 1000);
    return delta > 0 ? Math.min(delta, 3600) : null;
  }
  return null;
}

/**
 * @param {Error} error whatever the AI stack threw
 * @param {object} [opts]
 * @param {string} [opts.fallbackMessage] what to say when nothing matches —
 *   per-route, because "analysis" and "request" read differently to a visitor.
 * @returns {{status:number, retryAfter:number|null, body:object}}
 */
function classifyAiFailure(error, { fallbackMessage } = {}) {
  const message = String(error?.message || '');

  // Order is deliberate and load-bearing. Rate limiting is checked FIRST
  // because its message mentions API keys and would otherwise be swallowed by
  // NO_CAPACITY — which is exactly the bug this file was written to fix.
  if (RATE_LIMITED.test(message)) {
    return {
      status: 429,
      retryAfter: retryAfterSeconds(error),
      body: {
        error: 'Rate limit exceeded',
        code: 'ai_rate_limited',
        message: 'TrueGLE is at its request limit right now. Please try again in a few minutes.',
      },
    };
  }

  if (NO_CAPACITY.test(message)) {
    return {
      status: 503,
      retryAfter: null,
      body: {
        error: 'AI service unavailable',
        code: 'ai_no_capacity',
        // Honest about whose problem it is. "Try again" is withheld on
        // purpose: nothing the visitor does will change this one.
        message: 'TrueGLE is not reachable right now. This is a problem at our end, not with your question.',
      },
    };
  }

  if (NO_CONTENT.test(message)) {
    return {
      status: 503,
      retryAfter: null,
      body: {
        error: 'AI produced no answer',
        code: 'ai_no_content',
        message: 'TrueGLE ran out of room to answer that one. A shorter question usually gets through.',
      },
    };
  }

  if (UPSTREAM.test(message)) {
    return {
      status: 503,
      retryAfter: null,
      body: {
        error: 'AI service unavailable',
        code: 'ai_upstream',
        message: 'TrueGLE did not answer in time. Please try again.',
      },
    };
  }

  return {
    status: 500,
    retryAfter: null,
    body: {
      error: 'AI request failed',
      code: 'ai_failed',
      message: fallbackMessage || 'Unable to process AI request at this time. Please try again.',
    },
  };
}

/** Send it. Sets Retry-After only where there is a real number behind it. */
function sendAiFailure(res, error, opts) {
  const { status, retryAfter, body } = classifyAiFailure(error, opts);
  if (retryAfter) res.set('Retry-After', String(retryAfter));
  return res.status(status).json(body);
}

module.exports = { classifyAiFailure, sendAiFailure };
