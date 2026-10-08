// Owner, 2026-10-08: "relogin is necessary". Tokens were SIGNED with the
// trimmed secret (config) and VERIFIED with the raw env value — a secret saved
// with a trailing newline rejected every sign-in a moment after it was made.
const jwt = require('jsonwebtoken');

describe('one secret for signing and verifying', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; jest.resetModules(); });

  it('a token signed at sign-in passes the middleware even when the secret has a trailing newline', () => {
    process.env.JWT_SECRET = 'a-very-long-test-secret-value-1234567890\n';
    jest.resetModules();
    const config = require('../config/env');
    const { optionalAuth, authenticate } = require('../middleware/auth');
    const token = jwt.sign({ userId: 7, email: 'a@b.co' }, config.jwtSecret, { expiresIn: '1h' });

    const req1 = { headers: { authorization: `Bearer ${token}` } };
    optionalAuth(req1, {}, () => {});
    expect(req1.user.isAuthenticated).toBe(true);

    const req2 = { headers: { authorization: `Bearer ${token}` } };
    const next = jest.fn();
    authenticate(req2, { status: () => ({ json: () => {} }) }, next);
    expect(next).toHaveBeenCalled();
  });
});
