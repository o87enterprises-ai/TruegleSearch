const pg = require('pg');
const { Pool } = pg;

// Secure PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // SSL with more lenient settings for Neon
  ssl: {
    rejectUnauthorized: false, // Neon uses self-signed certs sometimes
  },

  // Increased timeouts for network issues
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased to 10s
  statement_timeout: 30000, // Increased to 30s
});

// Safe query function
const query = async (text, params = []) => {
  const start = Date.now();

  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (duration > 1000) {
      console.warn('⚠️  Slow query:', {
        duration: `${duration}ms`,
        query: text.substring(0, 100),
      });
    }

    return result;
  } catch (error) {
    console.error('❌ Database query error:', {
      query: text.substring(0, 100),
      error: error.message,
      params: params.length,
    });
    throw error;
  }
};

pool.on('connect', () => {
  console.log('✅ Database connected');
});

pool.on('error', (err) => {
  console.error('❌ Database error:', err.message);
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});

module.exports = {
  pool,
  query
};
