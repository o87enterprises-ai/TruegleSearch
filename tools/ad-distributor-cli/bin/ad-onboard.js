#!/usr/bin/env node
import { Command } from 'commander';
import { NETWORKS, BLOCKED_NETWORKS } from '../src/networks.js';
import { getNetworkState, markApplied, setCreds, statePath } from '../src/store.js';

const SAFETY_NOTE =
  'This tool never auto-fills or auto-submits a signup form. Every network here requires\n' +
  'a human to apply and pass manual review — that is a ToS-bound step, not a bug to fix.';

function pad(str, len) {
  return String(str).padEnd(len);
}

function statusLabel(status) {
  switch (status) {
    case 'available':
      return 'not started';
    case 'in_progress':
      return 'in progress';
    default:
      return status;
  }
}

function networkOrExit(id) {
  const net = NETWORKS[id];
  if (!net) {
    if (BLOCKED_NETWORKS[id]) {
      console.error(
        `\n"${id}" (${BLOCKED_NETWORKS[id].name}) is blocked, not available to apply to.\n` +
          `Reason: ${BLOCKED_NETWORKS[id].reason}\n\nRun "ad-onboard blocked" for the full list.\n`
      );
    } else {
      console.error(
        `\nUnknown network "${id}". Run "ad-onboard list" to see valid network IDs.\n`
      );
    }
    process.exitCode = 1;
    return null;
  }
  return net;
}

const program = new Command();

program
  .name('ad-onboard')
  .description(
    "Onboarding checklist for Truegle Search's ad-distributor signups.\n\n" + SAFETY_NOTE
  )
  .version('1.0.0');

program
  .command('list')
  .alias('ls')
  .description('List every network under consideration and your local progress')
  .action(() => {
    console.log('\nAvailable / in-progress networks:\n');
    console.log(pad('ID', 12) + pad('NAME', 16) + pad('KIND', 12) + pad('NETWORK STATUS', 16) + 'YOUR PROGRESS');
    for (const [id, net] of Object.entries(NETWORKS)) {
      const local = getNetworkState(id);
      const progress = local.applied
        ? `applied ${local.applied.slice(0, 10)}${Object.keys(local.creds).length ? `, ${Object.keys(local.creds).length} cred(s) stored` : ''}`
        : 'not applied yet';
      console.log(
        pad(id, 12) + pad(net.name, 16) + pad(net.kind, 12) + pad(statusLabel(net.status), 16) + progress
      );
    }
    console.log(`\n${Object.keys(BLOCKED_NETWORKS).length} network(s) are blocked — run "ad-onboard blocked" to see why.\n`);
  });

program
  .command('blocked')
  .description('List networks that must NOT be re-added, and why')
  .action(() => {
    console.log('\nBlocked — do not apply without first fixing the underlying reason:\n');
    for (const [id, net] of Object.entries(BLOCKED_NETWORKS)) {
      console.log(`  ${id} (${net.name})`);
      console.log(`    ${net.reason}`);
      console.log(`    source: ${net.source}\n`);
    }
  });

program
  .command('info <network>')
  .description('Show the requirements checklist, application URL, and review timeline for a network')
  .action((id) => {
    const net = networkOrExit(id);
    if (!net) return;
    const local = getNetworkState(id);
    console.log(`\n${net.name}  (${id})`);
    console.log(`Kind: ${net.kind}    Status: ${statusLabel(net.status)}    Review time: ${net.reviewTime}`);
    console.log(`Apply at: ${net.applyUrl}`);
    console.log('\nBefore you apply, make sure you have:');
    for (const req of net.requirements) console.log(`  - ${req}`);
    console.log(`\nAfter approval: ${net.notes}`);
    console.log(`Credential fields this tool can store: ${net.credentialFields.join(', ')}`);
    console.log(`Goes into: ${net.envTarget}`);
    if (local.applied) {
      console.log(`\nYour local record: applied ${local.applied}`);
      if (Object.keys(local.creds).length) {
        console.log(`Stored credential keys: ${Object.keys(local.creds).join(', ')}`);
      }
    }
    console.log('');
  });

program
  .command('apply <network>')
  .description("Print the network's real application URL and open it in your browser")
  .option('--no-open', 'Print the URL only; do not try to launch a browser')
  .action(async (id, opts) => {
    const net = networkOrExit(id);
    if (!net) return;
    console.log(`\n${SAFETY_NOTE}\n`);
    console.log(`${net.name} application page:\n  ${net.applyUrl}\n`);
    console.log('Checklist before you submit anything:');
    for (const req of net.requirements) console.log(`  - ${req}`);
    console.log('');
    if (opts.open !== false) {
      try {
        const open = (await import('open')).default;
        await open(net.applyUrl);
        console.log('(opened in your default browser)\n');
      } catch (err) {
        console.log(`(could not open a browser automatically: ${err.message} — use the URL above)\n`);
      }
    }
    markApplied(id);
    console.log(`Marked "${id}" as applied in your local progress file (${statePath()}).`);
    console.log('Once the network approves you, store the credential with:');
    console.log(`  ad-onboard creds set ${id} ${net.credentialFields[0]}=<value>\n`);
  });

const creds = program.command('creds').description('Manage credentials stored locally after a network approves you');

creds
  .command('set <network> <pairs...>')
  .description('Store one or more KEY=VALUE credential pairs for a network (local file only, never transmitted)')
  .action((id, pairs) => {
    const net = networkOrExit(id);
    if (!net) return;
    const kv = {};
    for (const pair of pairs) {
      const idx = pair.indexOf('=');
      if (idx === -1) {
        console.error(`\nIgnoring "${pair}" — expected KEY=VALUE.\n`);
        continue;
      }
      kv[pair.slice(0, idx)] = pair.slice(idx + 1);
    }
    if (Object.keys(kv).length === 0) {
      console.error('\nNo valid KEY=VALUE pairs given.\n');
      process.exitCode = 1;
      return;
    }
    setCreds(id, kv);
    console.log(`\nStored ${Object.keys(kv).join(', ')} for ${net.name} in ${statePath()}.`);
    console.log(`Recommended next step: ${net.envTarget}\n`);
  });

creds
  .command('list [network]')
  .description('Show which credential keys are stored (values are masked)')
  .action((id) => {
    const ids = id ? [id] : Object.keys(NETWORKS);
    console.log('');
    for (const networkId of ids) {
      const net = NETWORKS[networkId];
      if (!net) continue;
      const local = getNetworkState(networkId);
      const keys = Object.keys(local.creds || {});
      console.log(`${net.name} (${networkId}): ${keys.length ? keys.map((k) => `${k}=****`).join(', ') : 'none stored'}`);
    }
    console.log('');
  });

program
  .command('status [network]')
  .description('Overview of your local onboarding progress across all networks')
  .action((id) => {
    const ids = id ? [id] : Object.keys(NETWORKS);
    console.log('');
    for (const networkId of ids) {
      const net = NETWORKS[networkId];
      if (!net) continue;
      const local = getNetworkState(networkId);
      console.log(`${net.name} (${networkId})`);
      console.log(`  Network status: ${statusLabel(net.status)}`);
      console.log(`  Applied: ${local.applied || 'not yet'}`);
      console.log(`  Credentials stored: ${Object.keys(local.creds || {}).length}`);
      console.log('');
    }
  });

program.parse();
