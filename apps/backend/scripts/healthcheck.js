#!/usr/bin/env node

/**
 * API Health Check Script
 * Tests all backend endpoints and reports status.
 * Usage: node scripts/healthcheck.js [baseUrl]
 */

const BASE_URL = process.argv[2] || 'http://localhost:3001';

const endpoints = [
  // Public endpoints
  { method: 'GET', path: '/api/health', auth: false, label: 'Health' },
  { method: 'GET', path: '/api/search/health', auth: false, label: 'Search Health' },
  { method: 'POST', path: '/api/search', auth: false, label: 'Search', body: { query: 'test', filters: {} } },
  { method: 'GET', path: '/api/weather/current?lat=40.7128&lon=-74.006', auth: false, label: 'Weather Current' },
  { method: 'GET', path: '/api/weather/forecast?lat=40.7128&lon=-74.006', auth: false, label: 'Weather Forecast' },
  { method: 'GET', path: '/api/radar/geocode?query=New+York', auth: false, label: 'Radar Geocode' },
  { method: 'GET', path: '/api/maps/geocode?query=New+York', auth: false, label: 'Maps Geocode' },
  { method: 'GET', path: '/api/unsplash/search?query=nature', auth: false, label: 'Unsplash Search' },
  { method: 'GET', path: '/api/shopping/search?query=laptop', auth: false, label: 'Shopping Search' },
  { method: 'GET', path: '/api/social/search?query=test&platform=reddit', auth: false, label: 'Social Search' },
  { method: 'GET', path: '/api/tokens/config', auth: false, label: 'Tokens Config' },

  // Auth endpoints (expect 400/401, not 500)
  { method: 'POST', path: '/api/auth/login', auth: false, label: 'Auth Login', body: {}, expectStatus: [400, 401] },
  { method: 'GET', path: '/api/auth/validate', auth: false, label: 'Auth Validate (no token)', expectStatus: [401] },

  // Authenticated endpoints (expect 401 without token)
  { method: 'GET', path: '/api/osint/email-finder?domain=example.com', auth: false, label: 'OSINT (no auth)', expectStatus: [401] },
  { method: 'GET', path: '/api/shodan/info', auth: false, label: 'Shodan (no auth)', expectStatus: [401] },
  { method: 'POST', path: '/api/paypal/create-payment', auth: false, label: 'PayPal (no auth)', body: {}, expectStatus: [401] },

  // 404 handler
  { method: 'GET', path: '/api/nonexistent', auth: false, label: '404 Handler', expectStatus: [404] },
];

const colors = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

async function checkEndpoint(endpoint) {
  const url = `${BASE_URL}${endpoint.path}`;
  const start = Date.now();

  try {
    const options = {
      method: endpoint.method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (endpoint.body) {
      options.body = JSON.stringify(endpoint.body);
    }

    const response = await fetch(url, options);
    const duration = Date.now() - start;
    const expectedStatuses = endpoint.expectStatus || [200, 201];
    const isExpected = expectedStatuses.includes(response.status);

    return {
      label: endpoint.label,
      path: endpoint.path,
      status: response.status,
      duration,
      ok: isExpected,
      error: null,
    };
  } catch (error) {
    return {
      label: endpoint.label,
      path: endpoint.path,
      status: 0,
      duration: Date.now() - start,
      ok: false,
      error: error.code || error.message,
    };
  }
}

async function run() {
  console.log(`\n${colors.cyan('API Health Check')} — ${BASE_URL}\n`);

  const results = [];
  for (const endpoint of endpoints) {
    const result = await checkEndpoint(endpoint);
    results.push(result);

    const icon = result.ok ? colors.green('PASS') : colors.red('FAIL');
    const status = result.error ? colors.red(result.error) : `${result.status}`;
    const time = colors.dim(`${result.duration}ms`);
    console.log(`  ${icon}  ${result.label.padEnd(28)} ${status.padEnd(6)} ${time}`);
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  console.log(`\n${colors.cyan('Summary:')} ${colors.green(`${passed} passed`)}, ${failed > 0 ? colors.red(`${failed} failed`) : '0 failed'} / ${results.length} total\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run();
