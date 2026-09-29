/**
 * A guard, not a unit test: no server log line may print what a person typed.
 *
 * The privacy policy says searches are not retained; a console.log of the query
 * lands in the host's runtime logs and quietly makes that false. This scans
 * every console./logger. call in routes, services, middleware and utils and
 * fails on one that passes a variable that holds user text. It is a heuristic —
 * it looks at the code of the call with string literals removed — so it catches
 * the mistake being made again, not every possible spelling of it.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIRS = ['routes', 'services', 'middleware', 'utils'];
// Variables that hold what someone typed or asked.
const USER_TEXT = /(?<![.\w])(query|rawQuery|trimmedQuery|searchTerm|broadened|expanded|userMessage)\b(?!\s*:)/;
// Fine: reading a property of it, or the standard `error.message`.
const CALL = /(console\.(?:log|info|warn|error|debug)|logger\.(?:info|warn|error|debug))\(([\s\S]*?)\);/g;

const stripStrings = (code) => code
  .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
  .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
  // template literals: keep only the ${…} expressions
  .replace(/`((?:[^`\\]|\\.)*)`/g, (_, body) => [...body.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]).join(' '));

function offenders() {
  const found = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); return; }
    if (!e.name.endsWith('.js')) return;
    const src = fs.readFileSync(p, 'utf8');
    for (const m of src.matchAll(CALL)) {
      const code = stripStrings(m[2])
        .replace(/\b(error|err|e|broadenErr|enrichErr|promptError|result|r)\.(message|reason)\b/g, '')
        // Only the LENGTH of what was typed may be logged.
        .replace(/String\([^)]*\)\.length/g, '')
        .replace(/\b\w+\.length\b/g, '')
        .replace(/\bquery:\s*\$1\b/g, '');
      if (USER_TEXT.test(code)) {
        found.push(`${path.relative(ROOT, p)}:${src.slice(0, m.index).split('\n').length}  ${m[1]}(${m[2].replace(/\s+/g, ' ').slice(0, 80)})`);
      }
    }
  });
  DIRS.forEach((d) => walk(path.join(ROOT, d)));
  return found;
}

describe('server logs never print what a person typed', () => {
  it('finds no console/logger call that passes a query or a message body', () => {
    expect(offenders()).toEqual([]);
  });
});
