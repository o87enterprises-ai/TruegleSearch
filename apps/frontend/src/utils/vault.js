// Whether this browser has found the encyclopedia yet.
//
// Discovery is EARNED ONCE and access is PERMANENT, and the split matters.
// Making somebody win a 500-mile survival game every time they want to look up
// how to purify water would be a joke at their expense — the whole premise is
// that this is worth something on a bad day. So arriving is how you learn the
// thing exists; after that it is simply on the page.
//
// Kept in localStorage and nowhere else. A hidden library on a 404 page is the
// last thing that should be reporting who opened it.

const KEY = 'truegle_vault_v1';

export function vaultFound() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function findVault() {
  try { localStorage.setItem(KEY, '1'); } catch { /* private mode — this session still works */ }
}
