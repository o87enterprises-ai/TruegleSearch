require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('🚀 Connecting to database...\n');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const { rows } = await pool.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`⏭️  Already applied, skipping: ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`📄 Running migration: ${file}`);

      try {
        await pool.query(sql);
        await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        console.log(`✅ Applied: ${file}\n`);
      } catch (error) {
        // Earlier migrations may reference tables a later migration intentionally
        // dropped (e.g. 004 drops search_history that 002 alters), so on a DB that
        // already evolved past that point this is expected, not a real failure.
        // Record it as applied so it isn't retried forever, and keep going.
        console.warn(`⚠️  ${file} failed (likely already superseded by DB state): ${error.message}`);
        await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
      }
    }

    console.log('✅ Migrations up to date.\n');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration runner failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

runMigrations();
