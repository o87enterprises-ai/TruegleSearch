#!/bin/bash

echo "======================================"
echo "🎨 TRUEGLE LOGO INTEGRATION SETUP"
echo "======================================"
echo ""

# Create directories
echo "Creating directories..."
mkdir -p frontend/src/assets/images
mkdir -p frontend/src/components/ui
mkdir -p .cursor

# Create TruegleLogo component
echo "Creating TruegleLogo component..."
cat > frontend/src/components/ui/TruegleLogo.jsx << 'COMPONENT_EOF'
import { motion } from 'framer-motion';
import logoImage from '../../assets/images/truegle-logo.png';

export default function TruegleLogo({ 
  size = 'large', 
  animated = true,
  className = '' 
}) {
  const sizes = {
    small: 'h-12 w-auto',
    medium: 'h-20 w-auto',
    large: 'h-32 w-auto',
    xlarge: 'h-48 w-auto'
  };

  const logoElement = (
    <img
      src={logoImage}
      alt="Truegle - Unbiased Search"
      className={`${sizes[size]} ${className} object-contain`}
    />
  );

  if (animated) {
    return (
      <motion.div
        animate={{
          filter: [
            'drop-shadow(0 0 20px rgba(0, 229, 255, 0.3))',
            'drop-shadow(0 0 40px rgba(0, 229, 255, 0.6))',
            'drop-shadow(0 0 20px rgba(0, 229, 255, 0.3))'
          ]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        className="inline-block"
      >
        {logoElement}
      </motion.div>
    );
  }

  return logoElement;
}
COMPONENT_EOF

# Create Logo Demo page
echo "Creating LogoDemo test page..."
cat > frontend/src/pages/LogoDemo.jsx << 'DEMO_EOF'
import TruegleLogo from '../components/ui/TruegleLogo';

export default function LogoDemo() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center p-8">
      <div className="space-y-16 text-center">
        <div>
          <h2 className="text-cyan-400 text-xl mb-4">XLarge (Landing Hero)</h2>
          <TruegleLogo size="xlarge" animated={true} />
        </div>

        <div>
          <h2 className="text-cyan-400 text-xl mb-4">Large (Search Portal)</h2>
          <TruegleLogo size="large" animated={true} />
        </div>

        <div>
          <h2 className="text-cyan-400 text-xl mb-4">Medium (Cards)</h2>
          <TruegleLogo size="medium" animated={false} />
        </div>

        <div>
          <h2 className="text-cyan-400 text-xl mb-4">Small (Navbar)</h2>
          <TruegleLogo size="small" animated={false} />
        </div>
      </div>
    </div>
  );
}
DEMO_EOF

# Create Logo Integration Guide
echo "Creating logo integration guide..."
cat > .cursor/LOGO_INTEGRATION.md << 'GUIDE_EOF'
# Logo Integration Guide for Cursor AI

## Logo Component Usage

Import:
```jsx
import TruegleLogo from '../components/ui/TruegleLogo';
```

## Size Guide
- **xlarge**: Landing page hero (h-48)
- **large**: Search portal, results pages (h-32)
- **medium**: Cards, modals (h-20)
- **small**: Navbar, header (h-12)

## Animation
- `animated={true}`: Main pages (landing, search, results)
- `animated={false}`: Auth pages, navigation

## Page-Specific Usage

### Landing Page
```jsx
<TruegleLogo size="xlarge" animated={true} className="mx-auto mb-8" />
```

### Search Portal
```jsx
<TruegleLogo size="large" animated={true} className="mx-auto mt-8 mb-6" />
```

### Navbar
```jsx
<TruegleLogo size="small" animated={false} />
```
GUIDE_EOF

echo ""
echo "✅ Logo integration setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Copy your logo to: frontend/src/assets/images/truegle-logo.png"
echo "   2. Run: cd frontend && npm run dev"
echo "   3. Visit: http://localhost:5173/logo-demo"
echo ""
