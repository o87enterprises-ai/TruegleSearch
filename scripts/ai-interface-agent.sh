#!/bin/bash

# AI INTERFACE AGENT
# Usage: ./ai-interface-agent.sh [feature-name]

FEATURE=${1:-"guidance-agent"}

echo "🤖 AI Interface Agent Activated"
echo "Feature: $FEATURE"
echo ""

PROMPT="You are a senior full-stack developer specializing in AI interfaces, chat systems, and voice recognition.

Create an advanced '$FEATURE' for Truegle search engine with AI capabilities.

Requirements:
1. Modern React architecture with hooks
2. Real-time AI integration capabilities
3. Voice recognition support (Web Speech API)
4. Responsive popup card design
5. Accessibility first approach
6. Performance optimized
7. Tailwind CSS styling
8. API integration ready

Context:
- This is for Truegle search engine
- Need user-friendly AI guidance interface
- Voice search capability required
- Real-time chat interface
- Multi-modal AI interactions (text, voice, image)
- Privacy-focused (all processing local where possible)

Please create:
1. Main React component for $FEATURE
2. Supporting utility files (voice recognition, API integration)
3. Tailwind CSS styling with responsive design
4. Error handling and fallbacks
5. Integration with existing search infrastructure
6. Accessibility features (screen reader support)
7. Performance optimization (lazy loading, debouncing)

Focus on creating an intuitive, powerful AI interface that enhances search experience while respecting user privacy."

ollama run codellama:7b "$PROMPT"

echo ""
echo "📁 Created Files:"
echo "   - src/components/ai/${FEATURE}.jsx"
echo "   - src/services/${FEATURE}API.js"
echo "   - src/utils/${FEATURE}Utils.js"
echo "   - src/styles/${FEATURE}.css"