#!/bin/bash

# Agent API Configuration Script
# Sets up Claude, Gemini, and Mgrep APIs as agents

echo "=== Configuring API Agents ==="

# Check if API keys are set
if [ ! -f .env.agent ]; then
    echo "Creating .env.agent file..."
    cp .env.agent.example .env.agent
    echo "Please edit .env.agent and add your API keys:"
    echo "  - ANTHROPIC_API_KEY (Claude)"
    echo "  - GOOGLE_API_KEY (Gemini 2.5)"
    echo "  - MGREP_API_KEY (Mgrep)"
    exit 1
fi

# Load environment variables
source .env.agent

# Test API connections
echo "Testing API connections..."

echo "Testing Claude API..."
curl -s -X POST https://api.anthropic.com/v1/messages \
    -H "Content-Type: application/json" \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -d '{
        "model": "claude-3-5-sonnet-20241022",
        "max_tokens": 10,
        "messages": [{"role": "user", "content": "test"}]
    }' | jq -r '.id' 2>/dev/null || echo "Claude API connection failed"

echo "Testing Gemini API..."
curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=$GOOGLE_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
        "contents": [{"parts": [{"text": "test"}]}],
        "generationConfig": {"maxOutputTokens": 10}
    }' | jq -r '.candidates[0].content' 2>/dev/null || echo "Gemini API connection failed"

echo "Testing Mgrep API..."
curl -s -X GET https://api.mgrep.com/v1/health \
    -H "Authorization: Bearer $MGREP_API_KEY" \
    | jq -r '.status' 2>/dev/null || echo "Mgrep API connection failed"

echo "=== Creating Agent Scripts ==="

# Create agent runner script
cat > .agent/run-agent.sh << 'EOF'
#!/bin/bash
# Agent Runner Script

AGENT_TYPE=${1:-"code_reviewer"}
TASK=${2:-""}
CONFIG_FILE=".agent/api-config.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Agent configuration file not found"
    exit 1
fi

# Load agent configuration
PRIMARY_MODEL=$(jq -r ".agent_configurations.${AGENT_TYPE}.primary_model" $CONFIG_FILE)
TEMPERATURE=$(jq -r ".agent_configurations.${AGENT_TYPE}.temperature" $CONFIG_FILE)
SPECIALIZATION=$(jq -r ".agent_configurations.${AGENT_TYPE}.specialization" $CONFIG_FILE)

echo "Running $AGENT_TYPE agent (Model: $PRIMARY_MODEL, Temp: $TEMPERATURE)"

# Execute task based on agent type
case $AGENT_TYPE in
    "code_reviewer")
        node .agent/scripts/claude-agent.js "$TASK" "$TEMPERATURE"
        ;;
    "search_specialist")
        node .agent/scripts/gemini-agent.js "$TASK" "$TEMPERATURE"
        ;;
    "ui_ux_expert")
        node .agent/scripts/claude-agent.js "$TASK" "$TEMPERATURE"
        ;;
    "legal_compliance")
        node .agent/scripts/claude-agent.js "$TASK" "$TEMPERATURE"
        ;;
    "financial_analyst")
        node .agent/scripts/gemini-agent.js "$TASK" "$TEMPERATURE"
        ;;
    *)
        echo "Unknown agent type: $AGENT_TYPE"
        exit 1
        ;;
esac
EOF

chmod +x .agent/run-agent.sh

echo "=== Creating Agent Integration Scripts ==="

# Create Claude agent script
mkdir -p .agent/scripts
cat > .agent/scripts/claude-agent.js << 'EOF'
const fs = require('fs');
const process = require('process');

async function runClaudeAgent(task, temperature = 0.3) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        console.error('ANTHROPIC_API_KEY not found');
        process.exit(1);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            temperature: parseFloat(temperature),
            messages: [
                {
                    role: 'user',
                    content: task || 'Please analyze the current codebase for potential improvements.'
                }
            ]
        })
    });

    const result = await response.json();
    console.log(result.content[0]?.text || 'No response');
}

runClaudeAgent(process.argv[2], process.argv[3]);
EOF

# Create Gemini agent script
cat > .agent/scripts/gemini-agent.js << 'EOF'
const fs = require('fs');
const process = require('process');

async function runGeminiAgent(task, temperature = 0.2) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.error('GOOGLE_API_KEY not found');
        process.exit(1);
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [
                {
                    parts: [
                        {
                            text: task || 'Please analyze the current project structure and provide optimization suggestions.'
                        }
                    ]
                }
            ],
            generationConfig: {
                maxOutputTokens: 8192,
                temperature: parseFloat(temperature)
            }
        })
    });

    const result = await response.json();
    console.log(result.candidates[0]?.content?.parts[0]?.text || 'No response');
}

runGeminiAgent(process.argv[2], process.argv[3]);
EOF

echo "=== Configuration Complete ==="
echo ""
echo "Usage examples:"
echo "  .agent/run-agent.sh code_reviewer 'Review App.jsx for bugs'"
echo "  .agent/run-agent.sh search_specialist 'Optimize search performance'"
echo "  .agent/run-agent.sh ui_ux_expert 'Improve landing page design'"
echo "  .agent/run-agent.sh legal_compliance 'Review privacy policy'"
echo "  .agent/run-agent.sh financial_analyst 'Analyze cost structure'"
echo ""
echo "Don't forget to:"
echo "1. Add your API keys to .env.agent"
echo "2. Run 'npm install node-fetch' if needed"