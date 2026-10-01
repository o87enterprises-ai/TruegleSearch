/**
 * A key pasted with a trailing newline must still work as an HTTP header.
 * The Radar key on production did not, so the map failed on every lookup.
 */
describe('config trims environment values', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; jest.resetModules(); });

  it('strips surrounding whitespace and newlines from secrets', () => {
    process.env.RADAR_LIVE_SECRET_KEY = 'prj_live_sk_abc123\n';
    process.env.RADAR_LIVE_PUBLISHABLE_KEY = '  prj_live_pk_abc123 \r\n';
    jest.resetModules();
    const config = require('../config/env');
    expect(config.maps.radar.live.secretKey).toBe('prj_live_sk_abc123');
    expect(config.maps.radar.live.publishableKey).toBe('prj_live_pk_abc123');
  });

  it('the trimmed key is a valid header value', () => {
    process.env.RADAR_LIVE_SECRET_KEY = 'prj_live_sk_abc123\n';
    jest.resetModules();
    const config = require('../config/env');
    const http = require('http');
    expect(() => http.validateHeaderValue('Authorization', config.maps.radar.live.secretKey)).not.toThrow();
    expect(() => http.validateHeaderValue('Authorization', 'prj_live_sk_abc123\n')).toThrow(/Invalid character/);
  });
});
