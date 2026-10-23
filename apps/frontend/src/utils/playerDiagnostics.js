// TWO WAYS A PLAYER PROBLEM REACHES THE OWNER.
//
// Built first for ShareGate's safety net (2026-10-23: a tester's Play tap
// opened nothing, not reproducible here), then pulled out for the player
// itself the same day ("add a debug state and an auto report system any
// time a video fails to play — that's the best answer I can give you").
// Real playback cannot be reproduced in this environment at all — YouTube
// refuses embeds from here outright, and the owner has no second device to
// hand a bug to — so every stuck state the player can detect now reports
// itself automatically, rather than waiting on someone to notice, remember
// what happened, and choose to send it.
//
// reportEvent() fires the moment trouble is detected, no tap involved — an
// anonymous beacon to the backend's player-health log, same privacy rule as
// every other counter in this codebase (migrations/025_player_health.sql):
// no user, session, IP or raw User-Agent, ever. reportHref() is the OLDER,
// still-kept mailto: for a person who wants to add their own word about
// what happened; nothing is sent through it unless they press send.

const REPORT_TO = 'truegleai@proton.me';
// Same pattern utils/broken.js and utils/taste.js already use for their own
// anonymous signal bumps — a plain fetch with keepalive, not axios, so this
// never depends on anything player-code-adjacent still being mounted.
const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

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

/**
 * Fire the automatic, no-interaction beacon for a stuck player state. Never
 * awaited by a caller and never throws — this runs off the back of actual
 * playback code, and a lost or failed beacon must never cost anyone a
 * working player. The backend buckets the User-Agent into a coarse platform
 * label and discards the rest; nothing here is a tracking identifier.
 *
 * @param {object} e
 * @param {string} e.reason      'silent' | 'dead_error' | 'alive_override'
 * @param {string} [e.kind]      current.kind — 'youtube', 'vimeo', …
 * @param {string} [e.errorCode] a real platform error code, when there is one
 * @param {boolean} [e.heard]    did the embed ever say anything at all
 * @param {boolean} [e.muted]
 */
export function reportEvent({ reason, kind, errorCode, heard, muted } = {}) {
  try {
    fetch(`${BACKEND}/api/player/diagnostics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        reason, kind, errorCode, heard, muted,
        connection: typeof navigator !== 'undefined' ? navigator.connection?.effectiveType : undefined,
      }),
    }).catch(() => { /* a lost beacon is not an error anyone needs to see */ });
  } catch { /* fetch itself unavailable — nothing to do */ }
}
