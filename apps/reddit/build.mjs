/*
 * Two bundles, two very different rules.
 *
 * SERVER: must be CommonJS. The Devvit Web runtime does not load ES modules,
 * and the failure is a runtime "cannot use import statement outside a module"
 * inside Reddit's infrastructure rather than a build error here — which is a
 * miserable thing to debug, so it is pinned in one place with a comment.
 *
 * CLIENT: an ordinary browser bundle plus the two static files. Nothing is
 * fetched from a CDN, because a Devvit web view cannot reach one.
 */
import { build, context } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

const watch = process.argv.includes('--watch');

await rm('dist', { recursive: true, force: true });
await mkdir('dist/client', { recursive: true });

const serverOpts = {
  entryPoints: ['src/server/index.js'],
  outfile: 'dist/server/index.cjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  // CJS. See the note above — this line is the whole reason the file has one.
  format: 'cjs',
  sourcemap: false,
  logLevel: 'info',
};

const clientOpts = {
  entryPoints: ['src/client/main.js'],
  outfile: 'dist/client/main.js',
  bundle: true,
  platform: 'browser',
  target: ['es2022'],
  format: 'esm',
  minify: !watch,
  logLevel: 'info',
};

const statics = async () => {
  await cp('src/client/index.html', 'dist/client/index.html');
  await cp('src/client/styles.css', 'dist/client/styles.css');
};

if (watch) {
  const [s, c] = await Promise.all([context(serverOpts), context(clientOpts)]);
  await Promise.all([s.watch(), c.watch()]);
  await statics();
  console.log('watching — html and css are copied once, restart if you edit them');
} else {
  await Promise.all([build(serverOpts), build(clientOpts)]);
  await statics();
  console.log('built dist/client and dist/server');
}
