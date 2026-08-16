import { spawnSync } from 'node:child_process';

// The production build, on any operating system.
//
// The npm script used to be:
//
//   NODE_OPTIONS='--max-old-space-size=4096' vite build && node scripts/prerender.mjs
//
// `VAR=value command` is POSIX shell syntax. npm runs scripts through cmd.exe on
// Windows, which reads it as a command called `NODE_OPTIONS` and fails with
// "'NODE_OPTIONS' is not recognized as an internal or external command" — so the
// build was impossible on Windows while working everywhere else, including on
// Vercel. Setting the variable from inside Node avoids the shell entirely
// rather than adding a dependency to paper over it.
//
// The heap bump is not decorative: this bundle includes three.js, mapbox-gl and
// echarts, and the default heap is not enough to build it.

const HEAP = '--max-old-space-size=4096';

const env = {
  ...process.env,
  // Appended, so an existing NODE_OPTIONS from CI is not discarded.
  NODE_OPTIONS: [process.env.NODE_OPTIONS, HEAP].filter(Boolean).join(' '),
};

/** npm ships `vite` and friends as .cmd shims on Windows, which need a shell to
 *  execute; on everything else a shell is unnecessary and best avoided. */
const run = (command, args) => {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  if (result.error) {
    console.error(`Failed to start ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run('npx', ['vite', 'build']);
run(process.execPath, ['scripts/prerender.mjs']);
