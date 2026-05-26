/**
 * Security Middleware
 * Implements security headers beyond helmet defaults
 * Part of P1 Core Foundation - Privacy Backbone & API Security
 */

/**
 * Enhanced security headers middleware
 * Adds headers beyond what helmet provides
 */
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // XSS Protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer Policy - don't leak referrer to third parties
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy - restrict browser features
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );

  // Cross-Origin policies
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  // Cache control for sensitive endpoints
  if (req.path.includes('/auth') || req.path.includes('/api/user')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
};

/**
 * Content Policy Middleware
 * Implements transparent content policy - no censorship based on viewpoint
 */
const contentPolicyMiddleware = (req, res, next) => {
  // Set header indicating transparent content policy
  res.setHeader('X-Content-Policy', 'transparent');

  // Mark request as having passed content policy check
  req.contentPolicyApplied = true;

  // No content filtering is applied by default
  // Only legal requirements (CSAM, copyright) would trigger filtering
  // and those would be handled at the search result level, not middleware

  next();
};

/**
 * Legal filtering allow-list
 * Only these categories can be filtered, and only when legally required
 */
const LEGAL_FILTER_CATEGORIES = {
  CSAM: 'child_safety', // Required by law in all jurisdictions
  COPYRIGHT_DMCA: 'dmca', // Required by DMCA in US
  COURT_ORDER: 'court_order', // Specific court-ordered removals
};

/**
 * Check if content should be filtered (legal requirements only)
 * This is a stub - actual implementation would check against legal databases
 */
function shouldFilter(url, category) {
  // In production, this would check against:
  // - NCMEC hash database for CSAM
  // - DMCA takedown database
  // - Court order database

  // For now, always return false (no filtering)
  // Actual filtering would require legal review and implementation
  return false;
}

/**
 * Get transparency report for filtered content
 */
function getFilterTransparencyReport() {
  return {
    policy: 'Truegle only filters content when legally required',
    categories: Object.keys(LEGAL_FILTER_CATEGORIES),
    lastUpdated: new Date().toISOString(),
    totalFiltered: 0, // Would be actual count in production
    note: 'No viewpoint-based filtering is applied',
  };
}

module.exports = {
  securityHeaders,
  contentPolicyMiddleware,
  LEGAL_FILTER_CATEGORIES,
  shouldFilter,
  getFilterTransparencyReport,
};
