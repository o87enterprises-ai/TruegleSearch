// ONE PLACE THAT TURNS "something went wrong with playback" INTO A REPORT A
// PERSON CAN ACTUALLY SEND.
//
// Built first for ShareGate's safety net (2026-10-23: a tester's Play tap
// opened nothing, not reproducible here), then pulled out for the player
// itself (2026-10-23, same day: "add a debug state and an auto report
// system any time a video fails to play — that's the best answer I can
// give you" after an Android report with no way to get more detail).
// Real playback cannot be reproduced in this environment at all — YouTube
// refuses embeds from here outright, and the owner has no second device to
// hand a bug to — so every stuck state the player can detect now carries
// its own technical reason to a Report button, instead of needing someone
// to describe it from memory.
//
// A mailto: link, same as ShareGate's original: nothing is sent unless the
// person presses send, which is the only kind of "report a bug" that fits
// a site that sets zero cookies and tracks nothing.

const REPORT_TO = 'truegleai@proton.me';

/**
 * @param {object} opts
 * @param {string} opts.subject   the email subject
 * @param {string} opts.summary   one line: what the person saw
 * @param {Record<string, unknown>} [opts.context]  label -> value, rendered
 *   in the order given. A value that is null, undefined or '' is dropped —
 *   a report should never say "Error code: undefined".
 * @returns {string} a mailto: URL
 */
export function reportHref({ subject, summary, context = {} }) {
  const lines = Object.entries(context)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${v}`);
  const body = [summary, '', '---', `Page: ${typeof location !== 'undefined' ? location.href : ''}`, ...lines].join('\n');
  return `mailto:${REPORT_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.slice(0, 1800))}`;
}

// The two fields almost every player report wants, factored out so a caller
// never forgets one: the browser (UA) and, where the browser exposes it,
// the connection class — "why didn't this load" is a different question on
// a 4g connection than a 2g one.
export function envContext() {
  if (typeof navigator === 'undefined') return {};
  return {
    Browser: navigator.userAgent,
    Connection: navigator.connection?.effectiveType || undefined,
  };
}
