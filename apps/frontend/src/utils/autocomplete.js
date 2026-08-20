// Inline completion from what this browser has searched before.
//
// THE COMPLAINT: "I've had to fully type in the same query too many times."
// The suggestions dropdown already listed matching history, but reaching it
// meant taking a hand off the keyboard or arrowing down a list that also
// contained trending topics and generated phrases — so retyping was quicker,
// and people retyped.
//
// This is the other half: the rest of the query appears ahead of the caret as
// you type, and one key takes it.
//
// ONLY FROM YOUR OWN HISTORY. Never from trending, never from the generated
// "<query> explained / facts / analysis" phrases. A completion is a claim that
// this is the thing you meant, and the only evidence strong enough for that is
// that you have searched it before. Everything else stays in the dropdown,
// where it is offered rather than asserted.

/** Longest common prefix of two strings, compared case-insensitively. */
const sharedPrefix = (a, b) => {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i].toLowerCase() === b[i].toLowerCase()) i += 1;
  return i;
};

/**
 * What to show ahead of the caret, given what has been typed.
 *
 * Returns `{ match, completion }` — the whole history entry and just the tail
 * that has not been typed yet — or null when nothing should be offered.
 *
 * @param {string[]} history  recent searches, newest first
 * @param {string}   typed    the current input value
 * @param {number}   minChars how much has to be typed before offering anything
 */
export function completeFrom(history, typed, minChars = 2) {
  if (!Array.isArray(history) || typeof typed !== 'string') return null;
  // Leading space is not the start of a word; trailing space IS meaningful
  // (you are about to type the next word), so only the front is trimmed.
  const head = typed.replace(/^\s+/, '');
  if (head.length < minChars) return null;

  const lower = head.toLowerCase();
  for (const entry of history) {
    if (typeof entry !== 'string') continue;
    // A prefix match, not a substring one. Completing "tides" into "how do
    // tides work" would mean silently rewriting the front of what somebody is
    // typing, which is not a completion.
    if (entry.length <= head.length) continue;
    if (!entry.toLowerCase().startsWith(lower)) continue;
    // The typed portion is echoed back from the ENTRY, not from the input, so
    // the ghost lines up when the two differ only in case: typing "how" against
    // "How do tides work" must not render "howHow do tides work".
    return { match: entry, completion: entry.slice(sharedPrefix(entry, head)) };
  }
  return null;
}

export default completeFrom;
