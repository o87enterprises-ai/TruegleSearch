#!/bin/bash

# Interactive API Key Setup Script
# Guides you through setting up your API credentials

echo "=== Truegle Agent API Setup ==="
echo ""

# Create .env.agent if it doesn't exist
if [ ! -f .env.agent ]; then
    echo "Creating .env.agent file..."
    cp .env.agent.example .env.agent 2>/dev/null || cat > .env.agent << 'EOF'
# Google Gemini 2.5 API
GOOGLE_API_KEY=your_gemini_api_key_here

# Claude Code (via auth/login)
CLAUDE_AUTH_METHOD=login
CLAUDE_SESSION_TOKEN=your_claude_session_token_here

# Mgrep (via auth/login)
MGREP_AUTH_METHOD=login
MGREP_SESSION_TOKEN=your_mgrep_session_token_here

# Agent Configuration
AGENT_CONFIG_PATH=.agent/api-config.json
DEFAULT_AGENT_MODEL=claude
AGENT_LOG_LEVEL=info
EOF
fi

echo "Let's configure your API credentials:"
echo ""

# Get Gemini API Key
echo "1. Google Gemini 2.5 API"
echo "   Get your key from: https://makersuite.google.com/app/apikey"
read -p "   Enter your Gemini API key: " gemini_key
if [ ! -z "$gemini_key" ]; then
    sed -i.bak "s/your_gemini_api_key_here/$gemini_key/" .env.agent
    echo "   ✅ Gemini API key set"
fi
echo ""

# Get Claude session token instructions
echo "2. Claude Code (via login)"
echo "   Since you use login auth, you'll need to:"
echo "   a) Go to https://claude.ai and log in"
echo "   b) Open browser dev tools (F12)"
echo "   c) Go to Application/Storage -> Cookies -> https://claude.ai"
echo "   d) Copy the session cookie value"
echo "   e) Paste it below"
read -p "   Enter your Claude session token: " claude_token
if [ ! -z "$claude_token" ]; then
    sed -i.bak "s/your_claude_session_token_here/$claude_token/" .env.agent
    echo "   ✅ Claude session token set"
fi
echo ""

# Get Mgrep session token instructions
echo "3. Mgrep (via login)"
echo "   Since you use login auth, you'll need to:"
echo "   a) Go to https://mgrep.com and log in"
echo "   b) Find your session token in account settings or browser storage"
echo "   c) Paste it below"
read -p "   Enter your Mgrep session token: " mgrep_token
if [ ! -z "$mgrep_token" ]; then
    sed -i.bak "s/your_mgrep_session_token_here/$mgrep_token/" .env.agent
    echo "   ✅ Mgrep session token set"
fi
echo ""

# Test configurations
echo "=== Testing Configurations ==="
source .env.agent

# Test Gemini
if [ ! -z "$GOOGLE_API_KEY" ] && [ "$GOOGLE_API_KEY" != "your_gemini_api_key_here" ]; then
    echo "Testing Gemini API..."
    response=$(curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=$GOOGLE_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"contents": [{"parts": [{"text": "test"}]}],"generationConfig": {"maxOutputTokens": 10}}' 2>/dev/null)
    if echo "$response" | jq -e '.candidates' > /dev/null 2>&1; then
        echo "   ✅ Gemini API working"
    else
        echo "   ❌ Gemini API failed: $response"
    fi
fi

echo ""
echo "=== Quick Usage Examples ==="
echo "Now you can use your agents:"
echo ""
echo "# Run code review with Claude"
echo ".agent/run-agent.sh code_reviewer 'Review src/App.jsx for bugs'"
echo ""
echo "# Optimize search with Gemini" 
echo ".agent/run-agent.sh search_specialist 'Analyze search performance'"
echo ""
echo "# UI/UX review with Claude"
echo ".agent/run-agent.sh ui_ux_expert 'Review landing page design'"
echo ""
echo "# Legal compliance with Claude"
echo ".agent/run-agent.sh legal_compliance 'Check privacy policy compliance'"
echo ""
echo "# Financial analysis with Gemini"
echo ".agent/run-agent.sh financial_analyst 'Analyze API costs'"
echo ""

echo "Setup complete! 🎉"