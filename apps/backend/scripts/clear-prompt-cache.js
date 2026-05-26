/**
 * Clear Prompt Cache Script
 * Run this after updating prompts to see changes immediately
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const UnifiedAIService = require('../services/UnifiedAIService');
const PromptService = require('../services/PromptService');

async function clearCache() {
  console.log('🧹 Clearing AI service caches...');

  try {
    // Clear prompt cache
    PromptService.clearCache();
    console.log('✓ Prompt cache cleared');

    // Clear response cache
    UnifiedAIService.clearCache();
    console.log('✓ Response cache cleared');

    console.log('\n✅ All caches cleared successfully!');
    console.log('New prompts will be loaded on next AI request.');

  } catch (error) {
    console.error('❌ Error clearing cache:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

clearCache();
