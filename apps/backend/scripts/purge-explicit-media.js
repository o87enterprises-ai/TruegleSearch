#!/usr/bin/env node
// Remove adult titles that were stored in the shared catalog before they stopped
// being stored (owner, 2026-10-13: "I don't want the adult titles indexed").
//
//   node scripts/purge-explicit-media.js           DRY RUN — prints what it would remove
//   node scripts/purge-explicit-media.js --apply   actually removes it
//
// Needs DATABASE_URL (the production one, to clean production). Run the dry run
// first and read the sample: the filter is a title heuristic, so it is worth a
// look before anything is deleted. Rows with "broken" reports are scrubbed, not
// deleted, so the global dead-video list keeps working.
require('dotenv').config();
const { MediaService } = require('../services/MediaService');

(async () => {
  const apply = process.argv.includes('--apply');
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set — nothing to connect to.');
    process.exit(1);
  }
  const r = await MediaService.purgeExplicit({ apply });
  console.log(`${apply ? 'REMOVED' : 'WOULD REMOVE (dry run)'}:`);
  console.log(`  pool rows deleted      : ${r.signals}`);
  console.log(`  pool rows scrubbed     : ${r.scrubbed}  (kept: they carry "broken" reports)`);
  console.log(`  submitted links        : ${r.media}`);
  console.log(`  submitted reels        : ${r.reels}`);
  console.log('  sample titles:'); r.sample.forEach((t) => console.log(`    - ${t}`));
  if (!apply) console.log('\nNothing was changed. Re-run with --apply to remove them.');
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
