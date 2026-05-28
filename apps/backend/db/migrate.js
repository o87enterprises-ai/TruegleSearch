/**
 * Database Migration Runner
 * Runs SQL migration files
 */

// Load environment variables FIRST
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { query } = require('./connection');
const fs = require('fs');
const path = require('path');

async function runMigration(migrationFile) {
  try {
    console.log(`\n📦 Running migration: ${migrationFile}...`);

    const sqlPath = path.join(__dirname, '..', 'migrations', migrationFile);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Remove line comments but preserve the SQL structure
    const cleanedSql = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    // Smart split that handles $$ delimiters (PostgreSQL functions)
    const statements = [];
    let currentStatement = '';
    let inDollarQuote = false;

    const lines = cleanedSql.split(';');

    for (let line of lines) {
      currentStatement += line;

      // Check for $$ delimiter (PostgreSQL dollar-quoted string)
      const dollarCount = (currentStatement.match(/\$\$/g) || []).length;
      inDollarQuote = dollarCount % 2 !== 0;

      if (!inDollarQuote) {
        // We've completed a statement
        const trimmed = currentStatement.trim();
        if (trimmed.length > 0) {
          statements.push(trimmed);
        }
        currentStatement = '';
      } else {
        // Still inside a dollar-quoted block, add back the semicolon
        currentStatement += ';';
      }
    }

    // Add any remaining statement
    if (currentStatement.trim().length > 0) {
      statements.push(currentStatement.trim());
    }

    console.log(`   Found ${statements.length} SQL statements to execute`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip empty or comment-only statements
      if (!statement || statement.startsWith('--')) continue;

      try {
        await query(statement);

        // Show what type of statement was executed
        const stmtType = statement.substring(0, 50).replace(/\s+/g, ' ');
        console.log(`   ✓ [${i + 1}/${statements.length}] ${stmtType}...`);
      } catch (error) {
        // Handle common non-fatal errors
        const errorMsg = error.message || '';

        // Skip if object already exists
        if (errorMsg.includes('already exists') || error.code === '42P07') {
          const objName = statement.match(/(?:TABLE|INDEX|FUNCTION)\s+(?:IF NOT EXISTS\s+)?(\S+)/i)?.[1] || 'object';
          console.log(`   ⚠ [${i + 1}/${statements.length}] ${objName} already exists, skipping`);
          continue;
        }

        // Skip if COMMENT not supported
        if (errorMsg.includes('COMMENT') || (errorMsg.includes('syntax error') && statement.includes('COMMENT'))) {
          console.log(`   ⚠ [${i + 1}/${statements.length}] COMMENT statement skipped`);
          continue;
        }

        // Fatal error - log and throw
        console.error(`   ✗ Failed on statement ${i + 1}:`, statement.substring(0, 100));
        console.error(`   Error:`, errorMsg);
        throw error;
      }
    }

    console.log('✅ Migration completed successfully!\n');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

async function main() {
  try {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration files: ${files.join(', ')}\n`);

    for (const file of files) {
      await runMigration(file);
    }

    console.log('🎉 All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Migration process failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { runMigration };
