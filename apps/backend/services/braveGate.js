/**
 * One Brave request at a time, a second apart.
 *
 * Brave's free plan allows ONE request per second. A single search can make
 * four — the main query, a site-scoped boost, an acronym expansion, a
 * site:youtube.com video query — all at once, so all but one were refused
 * with 429 (251 of them in the logs by 2026-10-01). When the refused one was
 * the main query, the page came back thin and half-relevant.
 *
 * Calls go in the order they were made (the main query is made first), each
 * at least SPACING_MS after the last. A call that would wait longer than
 * MAX_WAIT_MS is dropped at once instead of holding the whole page up — those
 * are the extras. A 429 is retried once, in its own later slot.
 *
 * Per process. On serverless every warm instance has its own gate, so this
 * cannot stop two visitors' searches colliding; it stops one search from
 * colliding with itself, which is the common case.
 */
const SPACING_MS = 1050;
const MAX_WAIT_MS = 2200;

function createGate({ spacing = SPACING_MS, maxWait = MAX_WAIT_MS, now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let nextSlot = 0;
  /** Run fn in the next free slot, or throw 'Brave queue full' if that is too far off. */
  return async function run(fn, { retry = true } = {}) {
    const t = now();
    const slot = Math.max(t, nextSlot);
    if (slot - t > maxWait) throw new Error('Brave queue full');
    nextSlot = slot + spacing;
    if (slot > t) await sleep(slot - t);
    try {
      return await fn();
    } catch (err) {
      const limited = err?.response?.status === 429 || /rate limit/i.test(err?.message || '');
      if (retry && limited) return run(fn, { retry: false });
      throw err;
    }
  };
}

// The one gate every Brave caller shares — two gates would each think they
// own the second.
const braveGate = createGate();

module.exports = { createGate, braveGate, SPACING_MS, MAX_WAIT_MS };
