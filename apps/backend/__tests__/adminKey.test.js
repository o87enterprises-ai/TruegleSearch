const admin = require('../routes/admin');

test('admin key compare: exact match only, constant-time path', () => {
  const { keyMatches } = admin;
  expect(keyMatches('s3cret-key', 's3cret-key')).toBe(true);
  expect(keyMatches('s3cret-kex', 's3cret-key')).toBe(false);
  expect(keyMatches('s3cret', 's3cret-key')).toBe(false);
  expect(keyMatches('', 's3cret-key')).toBe(false);
  expect(keyMatches(undefined, 's3cret-key')).toBe(false);
  expect(keyMatches(['s3cret-key'], 's3cret-key')).toBe(false);
});
