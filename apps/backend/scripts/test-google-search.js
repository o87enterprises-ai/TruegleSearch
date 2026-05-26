#!/usr/bin/env node
/**
 * Test Google Custom Search API
 * Run: node apps/backend/scripts/test-google-search.js "your search query"
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const axios = require('axios');

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

async function testGoogleSearch(query) {
  console.log('\n🔍 Testing Google Custom Search API\n');
  console.log('─'.repeat(50));

  // Check credentials
  if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'your-google-api-key-here') {
    console.log('❌ GOOGLE_API_KEY not configured in .env');
    return;
  }

  if (!GOOGLE_SEARCH_ENGINE_ID || GOOGLE_SEARCH_ENGINE_ID === 'your-google-search-engine-id-here') {
    console.log('❌ GOOGLE_SEARCH_ENGINE_ID not configured in .env');
    return;
  }

  console.log('✅ API Key configured:', GOOGLE_API_KEY.slice(0, 10) + '...');
  console.log('✅ Search Engine ID:', GOOGLE_SEARCH_ENGINE_ID.slice(0, 10) + '...');
  console.log('─'.repeat(50));
  console.log(`\n📝 Searching for: "${query}"\n`);

  try {
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: GOOGLE_API_KEY,
        cx: GOOGLE_SEARCH_ENGINE_ID,
        q: query,
        num: 5
      }
    });

    const results = response.data;

    console.log(`✅ Search successful! Found ${results.searchInformation?.totalResults || 0} total results\n`);
    console.log('─'.repeat(50));
    console.log('Top 5 Results:\n');

    if (results.items) {
      results.items.forEach((item, index) => {
        console.log(`${index + 1}. ${item.title}`);
        console.log(`   ${item.link}`);
        console.log(`   ${item.snippet?.slice(0, 100)}...`);
        console.log('');
      });
    } else {
      console.log('No results found.');
    }

    console.log('─'.repeat(50));
    console.log('✅ Google Search API is working correctly!\n');

  } catch (error) {
    console.log('─'.repeat(50));
    console.log('❌ Error:', error.response?.data?.error?.message || error.message);

    if (error.response?.status === 403) {
      console.log('\n⚠️  Possible issues:');
      console.log('   - API key is invalid');
      console.log('   - Custom Search API not enabled in Google Cloud Console');
      console.log('   - Daily quota exceeded (100 free queries/day)');
    }

    if (error.response?.status === 400) {
      console.log('\n⚠️  Possible issues:');
      console.log('   - Search Engine ID (cx) is invalid');
      console.log('   - Go to https://programmablesearchengine.google.com/ to verify');
    }
  }
}

// Run test
const query = process.argv[2] || 'Truegle search engine';
testGoogleSearch(query);
