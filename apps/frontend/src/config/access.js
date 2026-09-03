/**
 * Global access / feature flags.
 *
 * TEMPORARY PRE-PRODUCTION POSTURE (2026-06-15):
 * TruegleSearch is getting real worldwide traffic while still in development.
 * To avoid losing early users to half-finished auth + paywalls, we run in
 * "free access" mode: every feature is usable without signing in, OAuth is
 * hidden, and token/premium gates are bypassed. Flip these back to false (or
 * delete the call sites) once auth + billing are fully working.
 */

// When true, all login walls and token/premium gates are bypassed app-wide.
export const FREE_ACCESS_MODE = true;

// THE FREEMIUM METER IS GONE. It was the "⚡ 10/10 · N searches today ·
// Upgrade" strip pinned across the bottom of every page, and it measured
// nothing: consumeFreemiumSearch() never had a call site and FREE_ACCESS_MODE
// bypassed every gate anyway, so it sat at 10/10 forever — a permanent claim of
// a limit that did not exist, occupying a strip of screen the player and the
// map both need. It was flagged off first; now the bar, the localStorage
// counter and the flag are all deleted rather than left as furniture nobody
// dares remove.
//
// ONE gate survives, below. Everything else on Truegle is free and ungated.

// How many OSINT investigations a signed-out visitor gets before being asked to
// make a (free) account. OSINT is the one expensive surface — each run fans out
// to third-party lookup APIs on free-tier quotas and then to the AI analyst —
// so it is the one place where unlimited anonymous use costs us something real.
//
// This is a product nudge, not a security boundary: the count lives in the
// visitor's own localStorage and clearing it resets them. The backend routes it
// calls are public. If it ever needs teeth, that belongs in
// apps/backend/routes/osint.js, per-IP, not here.
export const OSINT_FREE_INVESTIGATIONS = 1;

// When true, show the dismissible "early access / pre-production" banner so
// users understand the site isn't open to the world yet and are invited to
// report bugs.
export const PREPRODUCTION_MODE = true;

// Where bug reports / suggestions go.
export const FEEDBACK_EMAIL = 'truegleai@proton.me';
