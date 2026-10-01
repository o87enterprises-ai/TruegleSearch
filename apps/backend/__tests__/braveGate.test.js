const { createGate } = require('../services/braveGate');

// A fake clock. Sleeps that start together overlap, as real timers do: each
// wakes at (when it started + ms), and the clock reads that wake time.
function clock() {
  let t = 0;
  return {
    now: () => t,
    sleep: (ms) => { const wake = t + ms; return Promise.resolve().then(() => { t = Math.max(t, wake); }); },
    at: () => t,
  };
}

describe('braveGate — one Brave request a second', () => {
  it('spaces calls at least `spacing` apart, in the order they were made', async () => {
    const waits = [];
    const order = [];
    const run = createGate({ spacing: 1000, maxWait: 5000, now: () => 0, sleep: async (ms) => { waits.push(ms); } });
    await Promise.all([1, 2, 3].map((n) => run(async () => { order.push(n); })));
    expect(waits).toEqual([1000, 2000]);   // the first goes at once
    expect(order).toEqual([1, 2, 3]);
  });

  it('drops a call that would wait too long instead of holding the page up', async () => {
    const c = clock();
    const run = createGate({ spacing: 1000, maxWait: 1500, now: () => 0, sleep: c.sleep });
    const results = await Promise.allSettled([1, 2, 3].map(() => run(async () => 'ok')));
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled', 'rejected']);
    expect(results[2].reason.message).toBe('Brave queue full');
  });

  it('retries a 429 once, in a later slot', async () => {
    const c = clock();
    const run = createGate({ spacing: 1000, maxWait: 5000, now: c.now, sleep: c.sleep });
    let calls = 0;
    const out = await run(async () => {
      calls += 1;
      if (calls === 1) { const e = new Error('Request failed with status code 429'); e.response = { status: 429 }; throw e; }
      return 'second time';
    });
    expect(out).toBe('second time');
    expect(calls).toBe(2);
  });

  it('does not retry other errors', async () => {
    const run = createGate({ now: () => 0, sleep: async () => {} });
    let calls = 0;
    await expect(run(async () => { calls += 1; throw new Error('boom'); })).rejects.toThrow('boom');
    expect(calls).toBe(1);
  });
});
