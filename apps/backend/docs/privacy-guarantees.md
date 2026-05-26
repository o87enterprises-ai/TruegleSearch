# Truegle Privacy Guarantees

## Overview

Truegle is built on a foundation of privacy-by-design. This document outlines the technical measures we implement to ensure user privacy.

## Core Privacy Principles

### 1. No User Profiling

- Search queries are **never** linked to user accounts
- Same query returns identical results for all users
- No filter bubbles or personalization based on history
- Ranking algorithm uses only query-specific signals

### 2. IP Anonymization

All IP addresses are anonymized before any logging:

```
Original: 192.168.1.100
Anonymized: 192.168.1.0 (last octet zeroed)
```

- Original IP used only for rate limiting (in memory)
- Only anonymized IP is ever written to logs
- No reverse lookup or geolocation tracking

### 3. Ephemeral Session Data

Session data is temporary and can be wiped instantly:

- **Client-side**: localStorage, sessionStorage, IndexedDB
- **Server-side**: Rate limit cache, ephemeral logs
- "Nuclear Option" button provides immediate wipe

### 4. Minimal Data Collection

What we store:
- Account data (email, hashed password) - only if you create an account
- UI preferences (theme) - client-side only
- Rate limit counters - server-side, auto-expiring

What we DON'T store:
- Search history linked to accounts
- Browsing patterns
- Device fingerprints
- Third-party tracking cookies

## Technical Implementation

### Privacy Middleware

```javascript
// IP anonymization
req.anonymizedIP = req.ip.replace(/\.\d+$/, '.0');

// Ephemeral session (not linked to user)
req.ephemeralSession = crypto.randomBytes(16).toString('hex');
```

### Security Headers

All responses include:

| Header | Value | Purpose |
|--------|-------|---------|
| `Tk` | `N` | Indicates not tracking |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HTTPS enforcement |
| `Content-Security-Policy` | Restrictive policy | Prevent XSS |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |

### Content Policy

Truegle does NOT filter content based on:
- Political viewpoint
- Ideology
- Controversial topics
- User preferences

Content is ONLY filtered when legally required (with transparency).

## Session Wipe ("Nuclear Option")

Users can instantly delete all session data:

### Client-Side Clearing
1. localStorage - all search-related keys
2. sessionStorage - all data
3. IndexedDB - all databases

### Server-Side Clearing
1. Ephemeral logs (last 24 hours)
2. Rate limit cache entries
3. Session cache

### API Endpoint

```
POST /api/session/wipe
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Session data wiped successfully",
  "wiped": {
    "ephemeralLogs": true,
    "rateLimitData": true,
    "sessionCache": true
  }
}
```

## Verification

Users can verify our privacy practices:

1. **Browser DevTools**: Check Network tab - no tracking requests
2. **Cookie Inspector**: No third-party cookies set
3. **Privacy Info Endpoint**: `GET /api/session/privacy-info`
4. **Open Source**: All code is auditable under MIT license

## Contact

For privacy concerns or questions, contact: privacy@truegle.com
