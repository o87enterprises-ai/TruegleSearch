// The account code, kept on THIS device per email address, so signing in
// again is "type your email" — the code fills itself in and no new email has
// to be sent and approved (owner, 2026-10-08).
//
// What this is: a saved password, in this browser's storage only. It is kept
// only when the person ticked "Keep me signed in", is never sent anywhere but
// Truegle's own sign-in, and the Nuclear Option erases it with everything else.
const KEY = 'truegle_saved_codes';

const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
};
const norm = (email) => String(email || '').trim().toLowerCase();

export function savedCodeFor(email) {
  const e = norm(email);
  return e ? read()[e] || null : null;
}

export function saveCode(email, code) {
  const e = norm(email);
  if (!e || !code) return;
  try { localStorage.setItem(KEY, JSON.stringify({ ...read(), [e]: String(code).toUpperCase() })); } catch { /* private mode */ }
}

export function forgetCode(email) {
  const all = read();
  delete all[norm(email)];
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* private mode */ }
}
