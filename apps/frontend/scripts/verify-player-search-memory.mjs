/* The player search bar's memory: last query kept until erased, last 5
 * searches, top 5 searches. Pure localStorage logic, no browser needed.
 *
 * Run it:  npm run searchmemory:test
 */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const { lastQuery, setLastQuery, recordSearch, searchMemory, clearSearchMemory } = await import('../src/utils/playerSearchMemory.js');

const ok = []; const bad = [];
const check = (c, l, e = '') => (c ? ok : bad).push(`${c ? 'PASS' : 'FAIL'} ${l}${e ? ` — ${e}` : ''}`);

setLastQuery('lofi beats');
check(lastQuery() === 'lofi beats', 'the last query is kept');
setLastQuery('');
check(lastQuery() === '', 'erasing it forgets it');

for (const q of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6']) recordSearch(q);
let m = searchMemory();
check(m.recent.join() === 'f6,e5,d4,c3,b2', 'recent keeps the last five, newest first', m.recent.join());
recordSearch('c3'); recordSearch('c3'); recordSearch('  C3 ');
m = searchMemory();
check(m.recent[0] === 'C3' && m.recent.filter((q) => q.toLowerCase() === 'c3').length === 1, 'a repeat moves to the front once, not twice', m.recent.join());
check(m.top[0].toLowerCase() === 'c3', 'the most-searched ranks first in top', m.top.join());
check(m.top.length === 5, 'top is capped at five', String(m.top.length));
recordSearch('x');
check(!searchMemory().recent.includes('x'), 'one-letter noise is not remembered');
clearSearchMemory();
m = searchMemory();
check(!m.recent.length && !m.top.length, 'clearing empties both lists');

console.log([...ok, ...bad].join('\n'));
console.log(`\n${ok.length} passed, ${bad.length} failed`);
process.exit(bad.length ? 1 : 0);
