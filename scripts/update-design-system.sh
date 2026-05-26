#!/bin/bash

# Backup original
cp .eigent/design-system/truegle-design-system.json .eigent/design-system/truegle-design-system.json.backup

# Update with purple
cat > .eigent/design-system/truegle-design-system.json << 'DESIGN_EOF'
{
  "colors": {
    "primary": { 
      "neon-red": "#FF0000", 
      "neon-orange": "#FF6B00",
      "neon-yellow": "#FFD700",
      "neon-green": "#00FF00",
      "neon-cyan": "#00E5FF",
      "neon-blue": "#0080FF",
      "truegle-purple": "#8B5CF6"
    },
    "background": { 
      "dark": "#000000", 
      "dark-secondary": "#0a0a0a",
      "dark-tertiary": "#1a1a2e"
    },
    "text": { 
      "primary": "#FFFFFF", 
      "secondary": "#CCCCCC",
      "muted": "#888888"
    }
  },
  "typography": {
    "fonts": { 
      "primary": "system-ui, -apple-system, sans-serif", 
      "logo": "cursive"
    },
    "sizes": { 
      "xs": "12px", 
      "sm": "14px", 
      "base": "16px",
      "lg": "20px",
      "xl": "24px",
      "2xl": "32px"
    },
    "weights": { 
      "normal": "400", 
      "medium": "500", 
      "semibold": "600",
      "bold": "700"
    }
  },
  "spacing": {
    "scale": ["0px", "4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px"]
  },
  "effects": {
    "shadows": [
      { "name": "glow-cyan", "value": "0 0 20px rgba(0, 229, 255, 0.5)" },
      { "name": "glow-orange", "value": "0 0 20px rgba(255, 107, 0, 0.5)" },
      { "name": "glow-rainbow", "value": "0 0 30px rgba(255, 107, 0, 0.4)" },
      { "name": "glow-purple", "value": "0 0 25px rgba(139, 92, 246, 0.5)" }
    ],
    "gradients": [
      { "name": "neon-rainbow", "value": "linear-gradient(to right, #FF0000, #FF6B00, #FFD700, #00FF00, #00E5FF, #0080FF)" },
      { "name": "truegle-rainbow", "value": "linear-gradient(to right, #FF0000, #FF6B00, #FFD700, #00FF00, #00E5FF, #8B5CF6)" }
    ]
  },
  "components": [
    {
      "name": "NeonButton",
      "description": "Primary action button with neon glow",
      "variants": ["primary", "secondary", "ghost"],
      "props": ["children", "onClick", "variant", "size"],
      "styling": {
        "base": "rounded-xl font-semibold transition-all duration-200",
        "primary": "bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500",
        "hover": "scale-105 shadow-lg shadow-orange-500/50"
      }
    }
  ]
}
DESIGN_EOF

echo "✅ Design system updated with Truegle purple!"
