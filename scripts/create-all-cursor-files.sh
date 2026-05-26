#!/bin/bash

echo "======================================"
echo "📝 CREATING CURSOR DOCUMENTATION"
echo "======================================"

# Ensure directory exists
mkdir -p .cursor

# Create Master Prompts (this is the big one)
cat > .cursor/MASTER_PROMPTS.md << 'PROMPTS_END'
# Truegle Redesign - Master Cursor Prompts

## 🚀 QUICK START

1. Open Cursor: `cursor .`
2. Press `Cmd + I` 
3. Copy/paste the INITIAL CONTEXT below
4. Then work through prompts ONE AT A TIME

---

## 📚 INITIAL CONTEXT (Give Cursor this first)
```
I'm redesigning Truegle, an unbiased search engine with neon/futuristic aesthetic.

Please read these files:
- .cursor/REDESIGN_BRIEF.md
- .eigent/design-system/truegle-design-system.json
- .cursor/LOGO_INTEGRATION.md
- .cursorrules

Key requirements:
- Neon rainbow gradient (red→orange→yellow→green→cyan→blue)
- Dark backgrounds (#000000 to #1a1a2e)
- Glassmorphism effects
- framer-motion for ALL animations
- TruegleLogo component already created
- Modern 2025 UI best practices

Let's build amazing components!
```

---

## PHASE 1: COMPONENTS

### Prompt 1.1: CategoryBar
```
Create: frontend/src/components/ui/CategoryBar.jsx

Horizontal scrollable category bar with icons.

Categories: pics, vids, soc, shop, news, sports, finance, audio, ai, entertainment, environment, politics, education, recreation, health

Requirements:
- lucide-react icons
- Glassmorphism: bg-gray-900/50 backdrop-blur-md border border-cyan-500/20 rounded-2xl
- Hide scrollbar
- Active state: cyan glow (shadow-lg shadow-cyan-500/50)
- Hover: scale-105
- framer-motion animations
- Props: activeCategory, onSelectCategory
```

### Prompt 1.2: PerspectiveCard
```
Create: frontend/src/components/ui/PerspectiveCard.jsx

Card for bias perspectives.

Props: perspective, isActive, onClick, resultCount

Color-coded borders:
- left: red
- center: yellow  
- right: blue
- neutral: cyan

Active state: enhanced glow
Size: ~200px wide × 120px tall
framer-motion hover effects
```

### Prompt 1.3: SearchBar
```
Create: frontend/src/components/ui/SearchBar.jsx

Translucent search bar.

Props: value, onChange, onSearch, placeholder, size

Glassmorphism + cyan border
Focus: ring-4 ring-cyan-500/20
Search icon left, button right
framer-motion focus animations
```

---

## PHASE 2: PAGES

### Prompt 2.1: Landing Page
```
Redesign: frontend/src/pages/LandingPage.jsx

Hero section:
1. TruegleLogo (xlarge, animated)
2. "Search Without Bias" headline
3. Two CTAs (Start Searching, Learn More)
4. Animated gradient background

Features section with cards
Smooth scroll, framer-motion animations
```

### Prompt 2.2: Search Portal
```
Create: frontend/src/pages/SearchPortal.jsx

Layout:
1. TruegleLogo (large, animated, centered)
2. OSINT/SEO toggle switch
3. SearchBar component
4. CategoryBar component
5. AI Summary Card (expandable)
6. Results with perspective badges
7. Ad placements (top, middle, sidebar, bottom)

Use all components we created
```

---

## Quick Reference

**Adjust components:**
```
The [ComponentName] needs adjustment:
- Change [element] to [desired state]
- Maintain design system colors
```

**Add animations:**
```
Add framer-motion animation to [component]:
- Entrance: fade + slide up
- Duration: 0.3s
```

**Fix errors:**
```
Error: [paste error message]
Please fix while maintaining neon aesthetic
```

PROMPTS_END

# Create Progress Tracker
cat > .cursor/PROGRESS.md << 'PROGRESS_END'
# Progress Tracker

## Phase 1: Components
- [ ] CategoryBar
- [ ] PerspectiveCard  
- [ ] SearchBar
- [ ] AdCard
- [ ] ToolCard

## Phase 2: Pages
- [ ] Landing Page
- [ ] Search Portal
- [ ] OSINT Tools
- [ ] Biased Results
- [ ] Onboarding

## Notes:


PROGRESS_END

echo "✅ All Cursor documentation created!"
echo ""
echo "📁 Files created:"
echo "   - .cursor/MASTER_PROMPTS.md"
echo "   - .cursor/PROGRESS.md"
echo ""
echo "🚀 Next step: cursor ."
