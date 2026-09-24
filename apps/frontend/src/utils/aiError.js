// What to tell somebody when an AI turn fails.
//
// EVERY FAILURE USED TO READ THE SAME. The chat's catch produced one sentence —
// "Sorry, I couldn't reach the AI just now — try again in a moment." — for a
// rate limit, a missing API key, an oversized image, a request the server
// rejected, a dropped connection and a provider outage alike. It is a fine
// sentence for exactly one of those and misleading for the rest: it tells
// somebody to try again in a moment when the answer might be "the image is too
// big" or "you are offline", neither of which a moment will fix.
//
// Worse, it also gets SAVED. A shared thread is a snapshot of its messages, so
// a failed turn becomes a permanent link that says nothing about why — which is
// how one arrived as a bug report with nothing in it to act on.
//
// The backend already distinguishes these (routes/ai.js returns 429 / 413 /
// 402 / 400 / 500 with a `message`). This just stops discarding that.

/** The server's own explanation, when it gave one worth showing. */
const serverMessage = (err) => {
  const d = err?.response?.data;
  if (!d) return '';
  const m = typeof d.message === 'string' ? d.message.trim() : '';
  // `error` is a machine code on most of these routes ('Rate limit exceeded',
  // 'invalid'), so it is only used when there is no human sentence beside it.
  const e = typeof d.error === 'string' ? d.error.trim() : '';
  return m || (e.includes(' ') ? e : '');
};

/**
 * @param {unknown} err whatever the request threw
 * @returns {string} something true, and specific enough to act on
 */
export function aiErrorMessage(err) {
  const status = err?.response?.status;
  const fromServer = serverMessage(err);

  // NO RESPONSE AT ALL. Offline, DNS, a blocked request, the backend down.
  // Distinguished first because it is the one case where the advice is
  // completely different — nothing about the question is wrong.
  if (!status) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'You appear to be offline — Truegle could not send that.';
    }
    // Only used by chat, where there are no "search results above" to point
    // at. No status also covers the server being cut off mid-answer, which
    // one retry usually clears — so say that, not "check your connection".
    return "Truegle's AI could not be reached that time. Send it again — it usually goes through on a second try.";
  }

  if (status === 429) {
    return fromServer || 'The AI is being asked for a lot right now. Give it a minute and try again.';
  }
  if (status === 413) {
    return fromServer || 'That image is too large to send. Try a smaller one.';
  }
  if (status === 402) {
    return fromServer || 'That request needs tokens this account does not have.';
  }
  if (status === 400) {
    return fromServer || 'The AI could not read that request.';
  }
  if (status === 401 || status === 403) {
    return fromServer || 'That request was refused. Signing in again may help.';
  }
  if (status >= 500) {
    // A configuration error is OURS, and saying "try again in a moment" about
    // it is a small lie — a missing key does not fix itself in a moment.
    return fromServer || 'The AI service is having trouble at our end. This is not something retrying will fix quickly.';
  }
  return fromServer || "Sorry, I couldn't reach the AI just now — try again in a moment.";
}

export default aiErrorMessage;
