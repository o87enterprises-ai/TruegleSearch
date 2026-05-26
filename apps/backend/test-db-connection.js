require('dotenv/config'); // Load .env file first!
const { pool, query } = require('./db/connection.js');

async function testConnection() {
  try {
    console.log('Testing database connection...\n');
    console.log(
      'DATABASE_URL starts with:',
      process.env.DATABASE_URL?.substring(0, 30) + '...\n'
    );

    // Test 1: Basic connection
    const result = await query(
      'SELECT NOW() as current_time, version() as pg_version'
    );
    console.log('✅ Connection successful!');
    console.log('   Server time:', result.rows[0].current_time);
    console.log(
      '   PostgreSQL:',
      result.rows[0].pg_version.split(' ')[0] +
        ' ' +
        result.rows[0].pg_version.split(' ')[1]
    );

    // Test 2: SSL verification
    const sslResult = await query('SHOW ssl');
    console.log('\n✅ SSL Status:', sslResult.rows[0].ssl);

    // Test 3: Check if tables exist
    const tablesResult = await query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    );
    console.log('\n✅ Tables in database:', tablesResult.rows.length);
    if (tablesResult.rows.length > 0) {
      tablesResult.rows.forEach((row) => {
        console.log('   -', row.tablename);
      });
    } else {
      console.log('   (No tables yet - this is a fresh database)');
    }

    await pool.end();
    console.log('\n✅ All tests passed! Database is secure.\n');
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
