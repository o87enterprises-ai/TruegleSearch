// Whether this browser has found the encyclopedia yet, and how much of it.
//
// Discovery is EARNED ONCE and access is PERMANENT, and the split matters.
// Making somebody win a 500-mile survival game every time they want to look up
// how to purify water would be a joke at their expense — the whole premise is
// that this is worth something on a bad day. So finishing is how you learn the
// thing exists; after that it is simply on the page.
//
// FINISHING, NOT WINNING. It used to unlock only on arrival, which meant the
// people most likely to need a survival guide — the ones who ran out of water
// two hundred miles short — were the ones told nothing. Any completed run
// opens it now. Winning still means something: it opens the fuller version.
//
//   'guide' — you finished a run, however it ended.
//   'full'  — you made it to the settlement.
//
// Kept in localStorage and nowhere else. A hidden library on a 404 page is the
// last thing that should be reporting who opened it.

const KEY = 'truegle_vault_v1';

const TIERS = { guide: 1, full: 2 };

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    // '1' is the ORIGINAL value, and under the original rules the only way to
    // write it was arriving — so anybody carrying one won, and keeps the full
    // tier rather than being quietly demoted by this change.
    if (raw === '1') return 'full';
    return raw === 'guide' || raw === 'full' ? raw : null;
  } catch {
    return null;
  }
}

/** Has this browser unlocked the encyclopedia at all? */
export function vaultFound() {
  return read() !== null;
}

/** Did they actually make it — i.e. do they get the fuller version? */
export function vaultComplete() {
  return read() === 'full';
}

/** What they hold: 'guide', 'full', or null. */
export const vaultTier = read;

/**
 * Unlock it. Never downgrades: somebody who won and then lost a later run
 * keeps what they earned.
 *
 * @param {'guide'|'full'} [tier='guide']
 */
export function findVault(tier = 'guide') {
  const next = TIERS[tier] ? tier : 'guide';
  const held = read();
  if (held && TIERS[held] >= TIERS[next]) return;
  try { localStorage.setItem(KEY, next); } catch { /* private mode — this session still works */ }
}
