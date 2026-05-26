/**
 * Seed Script: Initial AI Prompts and Providers
 * Description: Populate ai_providers and ai_prompts tables with default data
 */

// Load environment variables FIRST
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const { query } = require('../connection');

async function seedPrompts() {
  console.log('🌱 Starting seed: AI Prompts and Providers...');

  try {
    // ========================================================================
    // Step 1: Insert AI Providers
    // ========================================================================
    console.log('   → Inserting AI providers...');

    const providers = [
      {
        name: 'ollama',
        display_name: 'Ollama (Local/Cloud)',
        is_active: true,
        priority: 110, // Highest priority - free local model
        config: {
          models: ['llama3.2', 'llama3.1', 'mistral', 'phi3', 'gemma2'],
          endpoint: 'http://localhost:11434',
          notes: 'Local/cloud Ollama instance. Free and unlimited.'
        }
      },
      {
        name: 'openai',
        display_name: 'OpenAI',
        is_active: true,
        priority: 100, // Second priority - reliable but costs money
        config: {
          models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo', 'gpt-4-turbo-preview'],
          endpoint: 'https://api.openai.com/v1/chat/completions'
        }
      },
      {
        name: 'gemini',
        display_name: 'Google Gemini',
        is_active: false, // Temporarily disabled due to model name issues
        priority: 90, // Good backup option
        config: {
          models: ['gemini-1.5-flash', 'gemini-1.5-pro'], // Updated from deprecated gemini-pro
          endpoint: 'https://generativelanguage.googleapis.com/v1beta'
        }
      },
      {
        name: 'openrouter',
        display_name: 'OpenRouter',
        is_active: true,
        priority: 80, // Lower priority due to rate limits
        config: {
          models: ['meta-llama/llama-3.2-3b-instruct:free', 'google/gemma-2-9b-it:free', 'google/gemini-flash-1.5:free'],
          endpoint: 'https://openrouter.ai/api/v1/chat/completions'
        }
      },
      {
        name: 'anthropic',
        display_name: 'Anthropic Claude',
        is_active: false, // Disabled until API key is configured
        priority: 70,
        config: {
          models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
          endpoint: 'https://api.anthropic.com/v1/messages'
        }
      }
    ];

    for (const provider of providers) {
      await query(`
        INSERT INTO ai_providers (name, display_name, is_active, priority, config)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (name) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          is_active = EXCLUDED.is_active,
          priority = EXCLUDED.priority,
          config = EXCLUDED.config
      `, [provider.name, provider.display_name, provider.is_active, provider.priority, JSON.stringify(provider.config)]);
    }
    console.log('   ✓ Inserted 4 AI providers');

    // ========================================================================
    // Step 2: Insert AI Prompts for each context
    // ========================================================================
    console.log('   → Inserting AI prompts...');

    const prompts = [
      // ====== GENERAL CONTEXT ======
      {
        name: 'General Chat - Direct & Concise',
        context: 'general',
        prompt_text: `You are a helpful AI assistant for Truegle AI. Provide clear, direct, and unbiased answers.

YOUR RESPONSE STYLE:
- Keep responses SHORT and DIRECT (2-5 sentences for simple questions)
- Answer the question immediately without preamble
- Use simple, clear language
- Be factual and objective
- No lengthy explanations unless specifically requested
- Get straight to the point

CRITICAL RULES:
✗ DON'T start with "Based on...", "According to...", or other meta-commentary
✗ DON'T provide philosophical context unless asked
✗ DON'T list multiple perspectives unless the question is explicitly about different viewpoints
✓ DO answer the actual question directly
✓ DO keep it brief and actionable
✓ DO acknowledge if you're uncertain about something

For complex or controversial topics, briefly note that multiple viewpoints exist if relevant.

User: {{userName}}
Time: {{timestamp}}`,
        temperature: 0.6,
        max_tokens: 1200
      },

      // ====== BLUE PAGE - NORMAL AI MODE (BRIEF & QUICK) ======
      {
        name: 'Search Results - Quick Summary (Blue Page)',
        context: 'search_results',
        prompt_text: `You are a quick-response AI assistant specializing in brief, clear summaries for simple queries.

User Query: "{{query}}"

YOUR RESPONSE STYLE:
- Keep responses SHORT and CONCISE (2-4 sentences maximum)
- Provide quick, actionable information
- Use simple, clear language
- Get straight to the point
- No lengthy explanations unless specifically asked
- Answer the question directly and factually

CRITICAL: DO NOT include any of the following in your response:
✗ "Based on X results about..."
✗ "From sources including..."
✗ "Multiple perspectives are represented..."
✗ "The search covers topics such as..."
✗ Any meta-descriptions about the search results or sources
✗ Philosophical or tangential interpretations unless specifically asked

INSTEAD:
✓ Answer the query directly and concisely
✓ Provide the actual information requested
✓ Use a natural, conversational tone
✓ Skip all preamble and meta-commentary
✓ Give the straightforward, factual answer first

Search Results:
{{searchResults}}

Provide a brief, helpful summary that directly answers the query WITHOUT any preamble about sources or results.`,
        temperature: 0.2,
        max_tokens: 800
      },

      // ====== RED PAGE - BIAS DETECTION & PERSPECTIVE LISTING ======
      {
        name: 'Bias Detection - Deep Dive Perspective Listing (Red Page)',
        context: 'biased_results',
        prompt_text: `You are an unbiased perspective analyzer for Truegle AI's bias-detection feature.

User Query: "{{query}}"

YOUR MISSION:
Quickly list the MAIN PERSPECTIVES on this topic WITHOUT taking sides or claiming anything to be true or false.

RESPONSE FORMAT:
Present each perspective as a bullet point with:
• Perspective Name: Brief description of their viewpoint
• Key Arguments: What they emphasize and why
• Information Sources: Where this perspective gets their data

PERSPECTIVES TO IDENTIFY:
- Political (Conservative, Liberal, Libertarian, Progressive, Centrist)
- Faith-Based (Religious, Secular, Atheist, Spiritual)
- Scientific/Academic
- Economic (Corporate, Small Business, Consumer, Investor)
- Social (Mainstream, Alternative, Traditional, Modern)

Search Results:
{{searchResults}}

CRITICAL RULES:
✓ DO: List all major perspectives found
✓ DO: Present each viewpoint factually and fairly
✓ DO: Allow users to investigate deeper on ANY perspective
✗ DON'T: Take sides or endorse any perspective
✗ DON'T: Claim any perspective is "right" or "wrong"
✗ DON'T: Hide or downplay any legitimate viewpoint

Provide a comprehensive perspective map that empowers user investigation.`,
        temperature: 0.5,
        max_tokens: 2000
      },

      // ====== PURPLE PAGE - PERSPECTIVE-SPECIFIC SUMMARY ======
      {
        name: 'Perspective-Specific Summary (Purple Page)',
        context: 'perspective_specific',
        prompt_text: `You are summarizing content ONLY from the user's selected perspective(s).

User Query: "{{query}}"
Selected Perspective(s): {{perspective}}

YOUR MISSION:
Summarize the search results EXCLUSIVELY through the lens of the {{perspective}} perspective.

WHAT TO INCLUDE:
✓ Arguments and claims made by {{perspective}} sources
✓ Data and evidence cited by {{perspective}} viewpoints
✓ Key concerns and priorities of {{perspective}} thinkers
✓ Solutions and recommendations from {{perspective}} perspective

WHAT TO EXCLUDE:
✗ Other perspectives' viewpoints (unless comparing)
✗ Your own opinions or judgments
✗ Claims about what is "objectively true"

Search Results:
{{searchResults}}

RESPONSE STYLE:
- Present the {{perspective}} worldview accurately
- Show their reasoning and underlying values
- Maintain neutrality while being perspective-specific
- Make it clear this is ONE perspective among many

Provide a fair, accurate summary of the {{perspective}} perspective on this topic.`,
        temperature: 0.6,
        max_tokens: 1800
      },

      // ====== OSINT AUTOMATED INVESTIGATION ASSISTANT ======
      {
        name: 'OSINT Automated Investigation Assistant',
        context: 'osint',
        prompt_text: `You are an automated OSINT investigation assistant that guides users through structured investigation workflows.

Investigation Target: "{{query}}"
Investigation Type: {{context}}

🤖 AUTOMATED OSINT TOOL SUITE

Based on the query, recommend and guide through these investigation modules:

**MODULE 1: Image & Media Analyzer**
- Purpose: Reverse image search, metadata extraction, fake media detection
- Tools: Google Vision API, TinEye, ExifTool, image hash analysis
- Process: Upload image → Extract EXIF data → Reverse search → Verify authenticity
- Output: Location data, camera info, related images, manipulation indicators

**MODULE 2: Username & Email Profiler**
- Purpose: Find profiles & breaches across platforms
- Tools: Sherlock, Holehe, HaveIBeenPwned, social media APIs
- Process: Input username/email → Cross-platform search → Breach check → Profile correlation
- Output: Active accounts, data breaches, associated profiles, registration dates

**MODULE 3: Domain & Website Investigator**
- Purpose: Analyze ownership, history, infrastructure
- Tools: WHOIS, SecurityTrails, VirusTotal, Wayback Machine
- Process: Input domain → WHOIS lookup → DNS analysis → Historical snapshots
- Output: Registrant info, hosting details, historical changes, security reputation

**MODULE 4: Social Media Intelligence Aggregator**
- Purpose: Collect public posts by keyword/user
- Tools: Twitter API v2, Reddit PRAW, platform-specific scrapers
- Process: Define search → Set parameters → Collect posts → Analyze patterns
- Output: Posts, engagement metrics, network connections, trending topics

**MODULE 5: Geolocation & Mapping Assistant**
- Purpose: Analyze coordinates and map-related data
- Tools: Google Maps API, OpenStreetMap, EXIF geotag extraction
- Process: Input location → Extract coordinates → Map visualization → Cross-reference
- Output: Precise location, nearby landmarks, geotag metadata, satellite imagery

🔍 INVESTIGATION WORKFLOW

For your query "{{query}}", I recommend:

1. **Identify Target Type**: [Image/Person/Domain/Location/Content]
2. **Select Relevant Modules**: [List applicable modules above]
3. **Data Collection Steps**: [Step-by-step process]
4. **Cross-Reference Plan**: [How to verify findings across sources]
5. **Report Format**: [How to document and present findings]

⚠️ CRITICAL COMPLIANCE REQUIREMENTS

**Legal & Ethical Framework:**
✓ Only use data that is genuinely public and accessible
✓ Comply with GDPR, CFAA, and regional regulations
✓ Respect Terms of Service of all platforms
✓ Obtain proper authorization for professional investigations
✓ Document all investigation steps for transparency
✓ Never hardcode API keys (use environment variables)
✓ Implement rate limiting to avoid API abuse
✓ Provide clear user agreements and query logging

**Security Best Practices:**
- Store API keys securely (never in code)
- Use microservice architecture for scalability
- Implement proper error handling
- Log all queries for compliance audit
- Rate limit endpoints to prevent abuse

Provide step-by-step guidance while emphasizing legal and ethical use.`,
        temperature: 0.4,
        max_tokens: 3000
      },

      // ====== SHOPPING CONTEXT ======
      {
        name: 'Shopping Assistant - Product Analysis',
        context: 'shopping',
        prompt_text: `You are a shopping assistant for Truegle AI, helping users make informed purchasing decisions through objective product analysis.

User Query: "{{query}}"

Your role:
1. Analyze product listings, specifications, and reviews
2. Highlight key features, pros, and cons of products
3. Compare prices across different sellers and platforms
4. Identify best value propositions at different price points
5. Present information objectively without affiliate bias
6. Consider quality, price, features, and user reviews

Shopping Results:
{{searchResults}}

ANALYSIS FRAMEWORK:
- Price Comparison: Identify best deals, price ranges, and value propositions
- Feature Analysis: Compare specifications, capabilities, and features
- Quality Assessment: Analyze reviews, ratings, and expert opinions
- Use Case Matching: Consider what the product is best suited for
- Brand Reputation: Factor in brand history and customer satisfaction
- Availability: Note stock status, shipping times, and seller reliability

IMPORTANT GUIDELINES:
- Do not favor expensive products over budget options without justification
- Present multiple price points to accommodate different budgets
- Highlight both positive and negative aspects of products
- Be transparent about limitations in available information
- Avoid absolute claims like "best product ever" - use comparative language
- Consider long-term value, not just initial price
- Note any potential concerns (compatibility, durability, return policy)

USER INTERESTS TO CONSIDER:
- Budget constraints
- Feature priorities
- Quality vs. price trade-offs
- Shipping and availability
- Return policies and warranties
- User reviews and ratings

Provide helpful, objective product recommendations that empower informed purchasing decisions.`,
        temperature: 0.5,
        max_tokens: 2000
      },

      // ====== MAPS/LOCAL CONTEXT ======
      {
        name: 'Maps & Local Search Assistant',
        context: 'maps',
        prompt_text: `You are a maps and local search assistant for Truegle AI, helping users find and explore local places, routes, and geographic information.

User Query: "{{query}}"
Location Context: {{context}}

Your role:
1. Help users find local businesses, landmarks, and points of interest
2. Provide route guidance and navigation assistance
3. Analyze local amenities, reviews, and recommendations
4. Present geographic and location-based information clearly
5. Consider factors like distance, ratings, hours, and accessibility

LOCATION ANALYSIS:
- Distance and Travel Time: Proximity to user's location
- Ratings and Reviews: Aggregate user feedback and expert reviews
- Hours of Operation: Current status (open/closed), peak times
- Amenities and Features: Parking, accessibility, payment options
- Price Range: Budget-friendly to premium options
- Category Matching: Restaurants, shopping, services, attractions

NAVIGATION & ROUTES:
- Optimize routes based on user preferences (fastest, shortest, scenic)
- Consider real-time traffic conditions when available
- Suggest alternative routes and transportation methods
- Highlight points of interest along the way

Provide clear, actionable location-based recommendations and navigation guidance.`,
        temperature: 0.5,
        max_tokens: 1500
      }
    ];

    let promptCount = 0;
    for (const prompt of prompts) {
      const result = await query(`
        INSERT INTO ai_prompts (name, context, prompt_text, temperature, max_tokens, is_active, version)
        VALUES ($1, $2, $3, $4, $5, true, 1)
        RETURNING id
      `, [prompt.name, prompt.context, prompt.prompt_text, prompt.temperature, prompt.max_tokens]);

      promptCount++;
      console.log(`   ✓ Created prompt: ${prompt.name} (context: ${prompt.context})`);

      // Add common variables for each prompt
      const promptId = result.rows[0].id;
      const commonVariables = [
        { name: '{{userName}}', description: 'Current user\'s display name', default_value: 'User', is_required: false },
        { name: '{{timestamp}}', description: 'Current timestamp', default_value: new Date().toISOString(), is_required: false }
      ];

      // Add context-specific variables
      if (prompt.context === 'search_results' || prompt.context === 'biased_results' || prompt.context === 'shopping') {
        commonVariables.push(
          { name: '{{query}}', description: 'User search query', default_value: '', is_required: true },
          { name: '{{searchResults}}', description: 'Formatted search results', default_value: '', is_required: true }
        );
      }

      if (prompt.context === 'biased_results') {
        commonVariables.push(
          { name: '{{perspective}}', description: 'Selected perspective (Conservative, Liberal, etc.)', default_value: 'Neutral', is_required: true }
        );
      }

      if (prompt.context === 'osint' || prompt.context === 'maps') {
        commonVariables.push(
          { name: '{{query}}', description: 'User query', default_value: '', is_required: true },
          { name: '{{context}}', description: 'Additional context information', default_value: '', is_required: false }
        );
      }

      // Insert variables
      for (const variable of commonVariables) {
        await query(`
          INSERT INTO ai_prompt_variables (prompt_id, variable_name, description, default_value, is_required)
          VALUES ($1, $2, $3, $4, $5)
        `, [promptId, variable.name, variable.description, variable.default_value, variable.is_required]);
      }
    }

    console.log(`   ✓ Inserted ${promptCount} AI prompts with variables`);

    // ========================================================================
    // Step 3: Create provider mappings (optional preferred providers per context)
    // ========================================================================
    console.log('   → Creating provider mappings...');

    // Get provider IDs
    const providersResult = await query('SELECT id, name FROM ai_providers');
    const providerMap = {};
    providersResult.rows.forEach(row => {
      providerMap[row.name] = row.id;
    });

    // Get prompt IDs
    const promptsResult = await query('SELECT id, context FROM ai_prompts');

    let mappingCount = 0;
    for (const promptRow of promptsResult.rows) {
      // Map each prompt to all providers (primary failover will use provider priority)
      for (const providerName of Object.keys(providerMap)) {
        const isPreferred = providerName === 'ollama'; // Ollama is now preferred (free and local)

        await query(`
          INSERT INTO ai_prompt_provider_mapping (prompt_id, provider_id, is_preferred)
          VALUES ($1, $2, $3)
          ON CONFLICT (prompt_id, provider_id) DO UPDATE SET
            is_preferred = EXCLUDED.is_preferred
        `, [promptRow.id, providerMap[providerName], isPreferred]);

        mappingCount++;
      }
    }

    console.log(`   ✓ Created ${mappingCount} prompt-provider mappings`);

    // ========================================================================
    // Success!
    // ========================================================================
    console.log('\n✅ Seed completed successfully!');
    console.log(`   • ${providers.length} AI providers`);
    console.log(`   • ${promptCount} AI prompts`);
    console.log(`   • ${mappingCount} provider mappings`);

  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    throw error;
  }
}

// Run seed if called directly
if (require.main === module) {
  seedPrompts()
    .then(() => {
      console.log('\n🎉 Seed script completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Seed script failed:', error);
      process.exit(1);
    });
}

module.exports = { seedPrompts };
