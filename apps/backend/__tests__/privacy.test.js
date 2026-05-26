/**
 * Privacy Middleware Tests
 * Tests for IP anonymization and privacy-by-design logging
 */
const {
  privacyMiddleware,
  noTrackMiddleware,
  searchPrivacyMiddleware,
  anonymizeIP,
  stripPII,
} = require('../middleware/privacy');

describe('Privacy Middleware', () => {
  describe('anonymizeIP', () => {
    it('should anonymize IPv4 addresses', () => {
      expect(anonymizeIP('192.168.1.100')).toBe('192.168.1.0');
      expect(anonymizeIP('10.0.0.255')).toBe('10.0.0.0');
      expect(anonymizeIP('172.16.50.123')).toBe('172.16.50.0');
    });

    it('should handle IPv4-mapped IPv6 addresses', () => {
      expect(anonymizeIP('::ffff:192.168.1.100')).toBe('::ffff:192.168.1.0');
    });

    it('should anonymize IPv6 addresses', () => {
      const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      const anonymized = anonymizeIP(ipv6);
      expect(anonymized).toContain('2001:0db8:85a3');
      expect(anonymized).toContain(':0:0:0:0:0');
    });

    it('should handle null/undefined', () => {
      expect(anonymizeIP(null)).toBe('unknown');
      expect(anonymizeIP(undefined)).toBe('unknown');
      expect(anonymizeIP('')).toBe('unknown');
    });
  });

  describe('privacyMiddleware', () => {
    it('should add anonymizedIP to request', () => {
      const req = {
        ip: '192.168.1.100',
        headers: {},
      };
      const res = {};
      const next = jest.fn();

      privacyMiddleware(req, res, next);

      expect(req.anonymizedIP).toBe('192.168.1.0');
      expect(req.ephemeralSession).toBeDefined();
      expect(req.privacyProcessed).toBe(true);
      expect(next).toHaveBeenCalled();
    });

    it('should store original IP separately', () => {
      const req = {
        ip: '192.168.1.100',
        headers: {},
      };
      const res = {};
      const next = jest.fn();

      privacyMiddleware(req, res, next);

      expect(req._originalIP).toBe('192.168.1.100');
      expect(req.anonymizedIP).toBe('192.168.1.0');
    });

    it('should generate unique ephemeral sessions', () => {
      const req1 = { ip: '192.168.1.1', headers: {} };
      const req2 = { ip: '192.168.1.1', headers: {} };
      const next = jest.fn();

      privacyMiddleware(req1, {}, next);
      privacyMiddleware(req2, {}, next);

      expect(req1.ephemeralSession).not.toBe(req2.ephemeralSession);
    });
  });

  describe('noTrackMiddleware', () => {
    it('should set Tk header to N', () => {
      const req = { headers: {} };
      const res = {
        setHeader: jest.fn(),
      };
      const next = jest.fn();

      noTrackMiddleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Tk', 'N');
      expect(next).toHaveBeenCalled();
    });

    it('should respect DNT header', () => {
      const req = { headers: { dnt: '1' } };
      const res = { setHeader: jest.fn() };
      const next = jest.fn();

      noTrackMiddleware(req, res, next);

      expect(req.doNotTrack).toBe(true);
    });
  });

  describe('searchPrivacyMiddleware', () => {
    it('should create searchContext for search paths', () => {
      const req = {
        path: '/api/search',
        anonymizedIP: '192.168.1.0',
        ephemeralSession: 'abc123',
      };
      const res = {};
      const next = jest.fn();

      searchPrivacyMiddleware(req, res, next);

      expect(req.searchContext).toBeDefined();
      expect(req.searchContext.anonymizedIP).toBe('192.168.1.0');
      expect(req.searchContext.ephemeralSession).toBe('abc123');
      expect(req._searchQueryLogged).toBe(false);
      expect(next).toHaveBeenCalled();
    });

    it('should not create searchContext for non-search paths', () => {
      const req = { path: '/api/auth/login' };
      const res = {};
      const next = jest.fn();

      searchPrivacyMiddleware(req, res, next);

      expect(req.searchContext).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('stripPII', () => {
    it('should redact sensitive fields', () => {
      const data = {
        email: 'user@example.com',
        password: 'secret123',
        name: 'John Doe',
        ip: '192.168.1.100',
        message: 'This is safe',
      };

      const safe = stripPII(data);

      expect(safe.email).toBe('[REDACTED]');
      expect(safe.password).toBe('[REDACTED]');
      expect(safe.name).toBe('[REDACTED]');
      expect(safe.ip).toBe('[REDACTED]');
      expect(safe.message).toBe('This is safe');
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          email: 'user@example.com',
          profile: {
            name: 'John',
          },
        },
        status: 'ok',
      };

      const safe = stripPII(data);

      expect(safe.user.email).toBe('[REDACTED]');
      expect(safe.user.profile.name).toBe('[REDACTED]');
      expect(safe.status).toBe('ok');
    });

    it('should handle null/undefined gracefully', () => {
      expect(stripPII(null)).toBeNull();
      expect(stripPII(undefined)).toBeUndefined();
    });
  });
});
