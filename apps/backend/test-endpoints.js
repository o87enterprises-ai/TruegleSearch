// Simple test script to verify our new API endpoints
const axios = require('axios');

// Base URL for the backend
const BASE_URL = 'http://localhost:3001/api';

// Test all new endpoints
async function testEndpoints() {
  console.log('Testing new API endpoints...\n');

  // Test 1: Social media search endpoint
  console.log('1. Testing Social Media Search Endpoint...');
  try {
    const socialResponse = await axios.post(`${BASE_URL}/social/search`, 
      { query: 'test' },
      { validateStatus: () => true } // Don't throw on error status
    );
    console.log(`   Status: ${socialResponse.status}`);
    console.log(`   Success: ${socialResponse.data.success || socialResponse.data.error ? false : true}\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }

  // Test 2: OSINT endpoint
  console.log('2. Testing OSINT Endpoint...');
  try {
    const osintResponse = await axios.get(`${BASE_URL}/osint/email-finder?domain=example.com`, 
      { validateStatus: () => true }
    );
    console.log(`   Status: ${osintResponse.status}`);
    console.log(`   Success: ${osintResponse.data.success || osintResponse.data.error ? false : true}\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }

  // Test 3: Shodan endpoint
  console.log('3. Testing Shodan Endpoint...');
  try {
    const shodanResponse = await axios.get(`${BASE_URL}/shodan/info`, 
      { validateStatus: () => true }
    );
    console.log(`   Status: ${shodanResponse.status}`);
    console.log(`   Success: ${shodanResponse.data.success || shodanResponse.data.error ? false : true}\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }

  // Test 4: PayPal endpoint
  console.log('4. Testing PayPal Endpoint...');
  try {
    const paypalResponse = await axios.post(`${BASE_URL}/paypal/create-payment`, 
      {},
      { validateStatus: () => true }
    );
    console.log(`   Status: ${paypalResponse.status}`);
    console.log(`   Success: ${paypalResponse.data.success || paypalResponse.data.error ? false : true}\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }

  // Test 5: Voice endpoint
  console.log('5. Testing Voice Endpoint...');
  try {
    const voiceResponse = await axios.get(`${BASE_URL}/voice/account`, 
      { validateStatus: () => true }
    );
    console.log(`   Status: ${voiceResponse.status}`);
    console.log(`   Success: ${voiceResponse.data.success || voiceResponse.data.error ? false : true}\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }

  // Test 6: Unsplash endpoint
  console.log('6. Testing Unsplash Endpoint...');
  try {
    const unsplashResponse = await axios.get(`${BASE_URL}/unsplash/search`, 
      { validateStatus: () => true }
    );
    console.log(`   Status: ${unsplashResponse.status}`);
    console.log(`   Success: ${unsplashResponse.data.success || unsplashResponse.data.error ? false : true}\n`);
  } catch (error) {
    console.log(`   Error: ${error.message}\n`);
  }

  console.log('Endpoint testing completed!');
}

// Run the tests
testEndpoints().catch(console.error);