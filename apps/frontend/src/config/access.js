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

// The freemium meter — the "⚡ 10/10 · N searches today · Upgrade" strip pinned
// across the bottom of every page.
//
// It measured nothing. consumeFreemiumSearch() in TokenContext has no call
// sites, and FREE_ACCESS_MODE bypasses every gate anyway, so the bar sat at
// 10/10 forever: a permanent claim of a limit that does not exist, occupying a
// strip of screen the player and the map both need. Off until metering is real
// — the context, the counter and the component all stay, so turning it back on
// is this one flag.
export const SHOW_TOKEN_METER = false;

// When true, show the dismissible "early access / pre-production" banner so
// users understand the site isn't open to the world yet and are invited to
// report bugs.
export const PREPRODUCTION_MODE = true;

// Where bug reports / suggestions go.
export const FEEDBACK_EMAIL = 'truegleai@proton.me';
