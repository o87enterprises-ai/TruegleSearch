#!/bin/bash

# BACKGROUND DESIGN IMPLEMENTATION AGENT
# Usage: ./background-agent.sh [design-name] [page]

DESIGN=${1:-"Laser Prism"}
PAGE=${2:-"landing"}

echo "🎨 Background Design Agent Activated"
echo "Design: $DESIGN"
echo "Page: $PAGE"
echo ""

PROMPT="You are a senior UI/UX designer and React specialist specializing in animated backgrounds and particle effects.

Create a stunning '$DESIGN' background design for the '$PAGE' page of Truegle search engine.

Requirements:
1. Use React with modern hooks (useState, useEffect)
2. Implement smooth, performant animations
3. Responsive design for all devices
4. CPU/GPU optimized (should not impact search performance)
5. Accessibility compliant (WCAG 2.1 AA)
6. Dark theme optimized (Truegle uses dark backgrounds)
7. Interactive elements where appropriate
8. Framework: Tailwind CSS + CSS animations

Context:
- This is a privacy-focused search engine
- Existing components use particles, magnetic fields, antigravity effects
- Landing page needs impressive hero background
- Search page needs subtle, non-distracting background
- Results page needs professional background that enhances readability

Please create:
1. React component file for the background
2. CSS/Tailwind styling
3. Integration instructions for the target page
4. Performance optimization notes
5. Responsive design considerations

Focus on visual impact while maintaining excellent performance."

ollama run codellama:7b "$PROMPT"

echo ""
echo "📁 Created Files:"
echo "   - src/components/backgrounds/${PAGE}-${DESIGN}.jsx"
echo "   - src/styles/${PAGE}-background.css"