const { query } = require('./connection.js');
const bcrypt = require('bcryptjs');

// ✅ EXAMPLE 1: Safe user authentication
const authenticateUser = async (email, password) => {
  // Use $1 placeholder - prevents SQL injection
  const result = await query(
    'SELECT id, email, password_hash, role FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    return { success: false, error: 'Invalid credentials' };
  }

  const user = result.rows[0];

  // Compare hashed password
  const isValid = await bcrypt.compare(password, user.password_hash);

  if (!isValid) {
    return { success: false, error: 'Invalid credentials' };
  }

  return {
    success: true,
    user: { id: user.id, email: user.email, role: user.role },
  };
};

// ✅ EXAMPLE 2: Safe user registration
const createUser = async (email, password, username) => {
  // Hash password before storing (NEVER store plain text!)
  const passwordHash = await bcrypt.hash(password, 12);

  // Parameterized query prevents SQL injection
  const result = await query(
    'INSERT INTO users (email, password_hash, username, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, email, username',
    [email, passwordHash, username]
  );

  return result.rows[0];
};

// No search history tracking — Truegle does not track user searches

// ❌ NEVER DO THIS - SQL Injection vulnerable!
// const BAD_authenticateUser = async (email, password) => {
//   const result = await query(
//     `SELECT * FROM users WHERE email = '${email}' AND password = '${password}'`
//   );
//   // Hacker can input: email = "admin' OR '1'='1"
//   // And bypass authentication!
// };

module.exports = {
  authenticateUser,
  createUser,
};
