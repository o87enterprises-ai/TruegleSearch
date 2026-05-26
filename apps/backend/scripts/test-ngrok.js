/**
 * Test script for ngrok tunnel connectivity
 * Run this to verify CORS and ngrok configuration
 */

const axios = require('axios');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, symbol, message) {
  console.log(`${color}${symbol}${COLORS.reset} ${message}`);
}

async function testEndpoint(url, description) {
  console.log(`\n${COLORS.cyan}Testing: ${description}${COLORS.reset}`);
  console.log(`URL: ${url}`);

  try {
    const response = await axios.get(url, {
      headers: {
        'ngrok-skip-browser-warning': 'true',
        'Origin': 'https://test.ngrok.io'
      },
      timeout: 10000
    });

    log(COLORS.green, '✓', `Success! Status: ${response.status}`);
    console.log('Response:', JSON.stringify(response.data, null, 2).substring(0, 200) + '...');
    return true;
  } catch (error) {
    log(COLORS.red, '✗', `Failed: ${error.message}`);
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log('Error:', error.response.data);
    }
    return false;
  }
}

async function testSearch(url) {
  console.log(`\n${COLORS.cyan}Testing: Search Endpoint (POST)${COLORS.reset}`);
  console.log(`URL: ${url}/api/search`);

  try {
    const response = await axios.post(
      `${url}/api/search`,
      {
        query: 'test search',
        filters: {
          category: 'all',
          sortBy: 'relevance',
          order: 'desc'
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'Origin': 'https://test.ngrok.io'
        },
        timeout: 30000
      }
    );

    log(COLORS.green, '✓', `Success! Status: ${response.status}`);
    console.log(`Results: ${response.data.results?.length || 0} items`);
    return true;
  } catch (error) {
    log(COLORS.red, '✗', `Failed: ${error.message}`);
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log('Error:', error.response.data);
    }
    return false;
  }
}

async function runTests() {
  console.log(`\n${COLORS.blue}╔════════════════════════════════════════════╗${COLORS.reset}`);
  console.log(`${COLORS.blue}║  Ngrok Tunnel Connectivity Test Suite     ║${COLORS.reset}`);
  console.log(`${COLORS.blue}╚════════════════════════════════════════════╝${COLORS.reset}\n`);

  // Get backend URL from command line or environment
  const backendUrl = process.argv[2] || process.env.BACKEND_URL || 'http://localhost:3001';

  console.log(`Backend URL: ${COLORS.cyan}${backendUrl}${COLORS.reset}\n`);

  const results = [];

  // Test 1: Health endpoint
  results.push(await testEndpoint(`${backendUrl}/api/health`, 'Health Check'));

  // Test 2: Search endpoint
  results.push(await testSearch(backendUrl));

  // Test 3: AI health endpoint
  results.push(await testEndpoint(`${backendUrl}/api/ai/health`, 'AI Service Health'));

  // Summary
  console.log(`\n${COLORS.blue}╔════════════════════════════════════════════╗${COLORS.reset}`);
  console.log(`${COLORS.blue}║  Test Summary                              ║${COLORS.reset}`);
  console.log(`${COLORS.blue}╚════════════════════════════════════════════╝${COLORS.reset}\n`);

  const passed = results.filter(r => r).length;
  const total = results.length;

  if (passed === total) {
    log(COLORS.green, '✓', `All tests passed (${passed}/${total})`);
    console.log('\n✅ Your ngrok tunnel is working correctly!');
    console.log('\nYou can now access the backend from external devices using:');
    console.log(`${COLORS.cyan}${backendUrl}${COLORS.reset}\n`);
  } else {
    log(COLORS.yellow, '⚠', `Some tests failed (${passed}/${total} passed)`);
    console.log('\n⚠️  There may be issues with your ngrok configuration.');
    console.log('\nTroubleshooting steps:');
    console.log('1. Ensure your backend server is running');
    console.log('2. Verify ngrok tunnel is active: ngrok http 3001');
    console.log('3. Check CORS configuration in server.js');
    console.log('4. Verify firewall settings\n');
  }
}

// Run tests
runTests().catch(error => {
  console.error(`\n${COLORS.red}Fatal error:${COLORS.reset}`, error.message);
  process.exit(1);
});
