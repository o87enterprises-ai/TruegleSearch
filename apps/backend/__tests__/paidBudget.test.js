/**
 * Permission to spend money.
 *
 * REPORTED: "I keep getting emails from SERP api saying my searches are
 * exhausted. I thought we were using SearXNG unlimited because we hosted it?"
 *
 * Both halves were true at once, which is why it was confusing. SearXNG IS
 * primary for web search. SerpApi was ALSO being called — automatically, on
 * any query where the free providers returned fewer than five web results,
 * with no cap, no counter, and nothing in a log. On a self-hosted metasearch
 * that is often cold, "fewer than five results" is not an edge case, so the
 * paid tap ran most of the time and the first anyone heard of it was the
 * vendor's email.
 *
 * The rule these pin down: HOLDING A KEY IS NOT AUTHORISING SPEND. Under a $0
 * budget the default has to be zero calls, and going above zero has to be a
 * deliberate number somebody wrote down.
 */
const budget = require('../services/PaidProviderBudget');

beforeEach(() => budget._reset());

describe('paid provider budget', () => {
  it('refuses by default — a configured key is not a blank cheque', () => {
    const v = budget.check('serpapi', 0);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/no daily budget/i);
  });

  it.each([undefined, null, '', NaN, -5, 'lots'])('…and %p is not a budget either', (limit) => {
    expect(budget.check('serpapi', limit).ok).toBe(false);
  });

  it('allows exactly the number of calls it was given, and not one more', () => {
    expect(budget.claim('serpapi', 3).ok).toBe(true);
    expect(budget.claim('serpapi', 3).ok).toBe(true);
    expect(budget.claim('serpapi', 3).ok).toBe(true);
    const over = budget.claim('serpapi', 3);
    expect(over.ok).toBe(false);
    expect(over.reason).toMatch(/spent \(3\/3\)/);
  });

  it('counts providers separately', () => {
    budget.claim('serpapi', 1);
    expect(budget.claim('serpapi', 1).ok).toBe(false);
    // A different vendor has its own bill.
    expect(budget.claim('someoneelse', 1).ok).toBe(true);
  });

  it('does not spend a slot on a refused call', () => {
    budget.claim('serpapi', 1);
    budget.claim('serpapi', 1);   // refused
    budget.claim('serpapi', 1);   // refused
    // Raising the cap later must reflect ONE call made, not three attempts.
    expect(budget.claim('serpapi', 2).ok).toBe(true);
    expect(budget.report().serpapi).toBe(2);
  });

  it('reports what has actually been spent today', () => {
    expect(budget.report()).toEqual({});
    budget.claim('serpapi', 5);
    budget.claim('serpapi', 5);
    expect(budget.report()).toEqual({ serpapi: 2 });
  });

  it('rolls over at the UTC day boundary', () => {
    budget.claim('serpapi', 1);
    expect(budget.claim('serpapi', 1).ok).toBe(false);
    // Tomorrow is a new bill.
    const real = Date.now;
    Date.now = () => real() + 24 * 60 * 60 * 1000;
    try {
      expect(budget.claim('serpapi', 1).ok).toBe(true);
      expect(budget.report().serpapi).toBe(1);
    } finally {
      Date.now = real;
    }
  });
});
