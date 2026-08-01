#!/usr/bin/env node
/**
 * Citation engine entrypoint (run by .github/workflows/citation-engine.yml,
 * or by hand: `node apps/backend/services/optimization/run.js [generate|pulse] [--dry-run]`).
 *
 * generate: pick a topic → draft → gate → publish to the 3 static files →
 *   log it. Prints a result and, in CI, writes step outputs so the workflow
 *   only opens a PR when a page was actually published. "Nothing to publish"
 *   (gate failed / providers exhausted / backlog empty) is a clean exit 0, not
 *   a failure — the engine simply tries again next run.
 */

const fs = require('fs');
const log = require('./log');

function setOutput(key, value) {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${String(value).replace(/\r?\n/g, ' ')}\n`);
  }
}

async function doGenerate(dryRun) {
  const { generate } = require('./orchestrator');
  const publisher = require('./publisher');
  const citationLog = require('./citationLog');

  const result = await generate();
  if (!result.ok) {
    log.warn(`nothing published: ${result.reason}`);
    setOutput('published', 'false');
    return 0;
  }

  const { post, source, demand } = result;
  const applied = publisher.apply(post, { dryRun });
  if (!dryRun) {
    await citationLog.record(post, { source, demand, provider: post._meta.provider });
  }

  log.ok(`READY: "${post.title}" (/blog/${post.slug}) — ${post.readingTime}, source=${source}, via ${post._meta.provider}`);
  setOutput('published', dryRun ? 'false' : 'true');
  setOutput('slug', post.slug);
  setOutput('title', post.title);
  setOutput('source', source);
  if (dryRun) log.info(`\n--- blogPosts.jsx entry preview ---\n${applied.entry}\n`);
  return 0;
}

async function doPulse() {
  const { pulse } = require('./pulse');
  const status = await pulse();
  console.log(JSON.stringify(status, null, 2));
  return 0;
}

(async () => {
  const cmd = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'generate';
  const dryRun = process.argv.includes('--dry-run');
  try {
    const code = cmd === 'pulse' ? await doPulse() : await doGenerate(dryRun);
    process.exit(code);
  } catch (e) {
    log.error(e.stack || e.message);
    setOutput('published', 'false');
    process.exit(1);
  }
})();
