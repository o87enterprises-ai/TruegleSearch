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

    const migrationFile = path.join(
      __dirname,
      '../migrations/001_initial_schema.sql'
    );

    if (!fs.existsSync(migrationFile)) {
      console.error('❌ Migration file not found:', migrationFile);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('📄 Running migration: 001_initial_schema.sql\n');
    await pool.query(sql);

    console.log('✅ Migration completed successfully!\n');

    // Test connection
    const result = await pool.query('SELECT COUNT(*) FROM users');
    console.log('📊 Database ready. Tables created.\n');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

runMigrations();
