/* Who gets the survival guide, and how much of it.
 *
 * REPORTED: "make the trail game provide the survival guide after ANY game
 * completion, win or lose."
 *
 * It only unlocked on arrival, which had it exactly backwards: the people most
 * likely to want a survival guide — the ones who ran out of water two hundred
 * miles short — were the ones told nothing at all. Any completed run opens it
 * now. Arriving still means something; it opens the fuller edition.
 *
 * The migration is the part that could quietly hurt somebody: the original
 * flag was the string '1', and under the original rules the only way to write
 * one was by winning. Anybody carrying one must keep the full tier rather than
 * being demoted by this change.
 *
 * Run it:  npm run vaulttier:test
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';

const require_ = createRequire(import.meta.url);
const OUT = 'dev/.build/vaulttier-test.mjs';
mkdirSync('dev/.build', { recursive: true });

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

execFileSync(require_.resolve('esbuild/bin/esbuild'), [
  'src/utils/vault.js', '--bundle', '--format=esm', '--platform=node',
  `--outfile=${OUT}`, '--log-level=error',
], { stdio: 'inherit' });

const { vaultFound, vaultComplete, vaultTier, findVault } = await import(`../${OUT}`);

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);
const reset = () => store.clear();
const KEY = 'truegle_vault_v1';

// ── 1. nothing until something ──────────────────────────────────────────────
reset();
check(!vaultFound() && !vaultComplete() && vaultTier() === null,
  'a browser that has never played holds nothing', String(vaultTier()));

// ── 2. losing earns the guide — the whole point of the change ───────────────
reset();
findVault('guide');
check(vaultFound(), 'dying two hundred miles short still opens the guide');
check(!vaultComplete(), '…but not the fuller edition');
check(vaultTier() === 'guide', '…and it says which', String(vaultTier()));

// ── 3. arriving earns both ──────────────────────────────────────────────────
reset();
findVault('full');
check(vaultFound() && vaultComplete(), 'arriving opens everything', String(vaultTier()));

// ── 4. it never goes backwards ──────────────────────────────────────────────
// Somebody who won and then lost a later run must not be demoted for playing
// again — the reward was earned, not rented.
reset();
findVault('full');
findVault('guide');
check(vaultComplete(), 'winning then losing keeps what was won', String(vaultTier()));
// …and the other direction still upgrades.
reset();
findVault('guide');
findVault('full');
check(vaultComplete(), 'losing then winning upgrades', String(vaultTier()));

// ── 5. the migration ────────────────────────────────────────────────────────
// '1' is the ORIGINAL flag, and it could only ever have been written by
// arriving. Reading it as the base tier would silently take the fuller edition
// away from everybody who had already earned it.
reset();
store.set(KEY, '1');
check(vaultFound(), 'an existing unlock is still an unlock');
check(vaultComplete(), '…and it is the full one, because winning was the only way to get it');

// ── 6. junk in storage is not an unlock ─────────────────────────────────────
for (const junk of ['', 'true', '0', 'yes', '{}', 'FULL']) {
  reset();
  store.set(KEY, junk);
  check(!vaultFound(), `a hand-edited "${junk}" does not open the library`, String(vaultTier()));
}

// ── 7. an unknown tier degrades to the safe one, never up ───────────────────
reset();
findVault('everything');
check(vaultTier() === 'guide',
  'an unrecognised tier grants the base one rather than the best one', String(vaultTier()));
reset();
findVault();
check(vaultTier() === 'guide', 'and the default is the base one too', String(vaultTier()));

rmSync(OUT, { force: true });
console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
