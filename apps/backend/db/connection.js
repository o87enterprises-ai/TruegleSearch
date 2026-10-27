const pg = require('pg');
const { Pool } = pg;

// Secure PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // SSL with more lenient settings for Neon
  ssl: {
    rejectUnauthorized: false, // Neon uses self-signed certs sometimes
  },

  // Serverless: every warm instance owns its own pool, so a big pool x many instances exhausts
  // Neon's connection limit and produces "Connection terminated due to connection timeout"
  // (~2,900 in 7 days). Keep each instance small and let it release idle sockets fast.
  // Override with PG_POOL_MAX if this ever runs on a long-lived server.
  max: Number(process.env.PG_POOL_MAX || 3),
  min: 0,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 8000,
  statement_timeout: 30000,
  allowExitOnIdle: true,
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
