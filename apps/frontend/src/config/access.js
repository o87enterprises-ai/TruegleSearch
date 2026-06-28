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

// OAuth disabled: social sign-in (Google/Apple) is preventing users from reaching
// gated features. Direct email/phone + payment registration is being implemented
// to replace it. Flip back to true once the OAuth callback flow is re-verified.
export const OAUTH_ENABLED = false;

// When true, show the dismissible "early access / pre-production" banner so
// users understand the site isn't open to the world yet and are invited to
// report bugs.
export const PREPRODUCTION_MODE = true;

// Where bug reports / suggestions go.
export const FEEDBACK_EMAIL = 'truegleai@proton.me';
