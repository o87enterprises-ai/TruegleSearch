# Truegle - Agentic Development Guidelines

## 🏗 Build Commands

### Single Component Development
```bash
# Test single component
npm run dev src/components/LaserFlow/LaserFlow.test.tsx

# Lint single component  
npm run lint src/components/LaserFlow/LaserFlow.tsx

# Build single component
npm run build src/components/LaserFlow/LaserFlow.tsx

# Type check single component
npm run type-check src/components/LaserFlow/LaserFlow.tsx

# Performance profile component
npm run profile src/components/LaserFlow/LaserFlow.tsx

# Full stack build
npm run build:all

# Run integration tests
npm run test:components

# Test shaders specifically
npm run test:shaders

# Bundle size analysis
npm run analyze:bundle
```

### Package Scripts (package.json additions)
```json
{
  "scripts": {
    "dev": "vite --mode=development",
    "build": "tsc && vite build",
    "build:all": "npm run lint && npm run type-check && npm run build",
    "lint": "eslint src --ext .ts,.tsx --fix",
    "lint:check": "eslint src --ext .ts,.tsx",
    "type-check": "tsc --noEmit",
    "test": "vitest",
    "test:components": "vitest src/components --watch",
    "test:shaders": "vitest src/**/*.glsl",
    "profile": "vite --mode=profile",
    "analyze:bundle": "npx vite-bundle-analyzer dist",
    "clean": "rimraf dist node_modules/.cache",
    "fresh": "npm run clean && npm install",
    "dev:shader": "vite --config=vite.shader.config.js",
    "performance": "npm run profile && npm run analyze:bundle"
  }
}
```

## 📐 Code Style Guidelines

### Import Order (ESLint rule)
1. React imports first
2. Third-party libraries
3. Internal modules (relative imports)
4. Types/interfaces
5. Utils/hook imports last

```typescript
// ✅ CORRECT
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Renderer, Program } from 'ogl';
import type { LaserFlowProps } from './types';
import { useWebGLAnimation } from '../../hooks/useWebGLAnimation';
import { ColorUtils } from '../../utils/colorUtils';
```

### TypeScript Conventions
```typescript
// ✅ Interface definitions
interface LaserFlowProps {
  /** Description of prop */
  color?: string;  // Use optional with defaults
  onReady?: () => void;  // Callback functions
}

// ✅ React component typing
const LaserFlow: React.FC<LaserFlowProps> = memo(({
  color = "#FF79C6",  // Default values in signature
  className = "",
  onReady,
}) => {
  // Component implementation
});

// ✅ Ref usage with typing
const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
```

### Naming Conventions
```typescript
// ✅ Components: PascalCase
const LaserFlow = () => {};

// ✅ Hooks: camelCase with 'use' prefix
const useWebGLAnimation = () => {};

// ✅ Variables: camelCase
const animationFrameId = useRef<number>(0);

// ✅ Constants: UPPER_SNAKE_CASE
const MAX_STEPS = 80;
const DEFAULT_COLOR = "#FF79C6";

// ✅ File names: PascalCase for components
LaserFlow.tsx, Prism.tsx, useWebGLAnimation.ts

// ✅ Shader uniforms: camelCase with 'u' prefix
uniform float uTime;
uniform vec3 uColor;
uniform float uIntensity;
```

### Component Structure Pattern
```typescript
// ✅ Standard component layout
const ComponentName: React.FC<ComponentProps> = memo(({
  prop1 = defaultValue1,
  prop2 = defaultValue2,
  onReady,
  onError
}) => {
  // 1. Refs (top level, grouped by purpose)
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  
  // 2. State (grouped by functionality)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string>('');
  
  // 3. Callbacks (memoized for performance)
  const handleResize = useCallback((entry: ResizeObserverEntry) => {
    // Implementation
  }, []);
  
  // 4. Main effect (lifecycle management)
  useEffect(() => {
    // Initialization and cleanup
    return cleanup;
  }, []);
  
  // 5. Sub-effects (prop updates)
  useEffect(() => {
    // Handle prop changes
  }, [prop1, prop2]);
  
  // 6. Render logic (conditional rendering)
  if (status === 'error') {
    return <ErrorComponent error={error} onRetry={handleRetry} />;
  }
  
  return (
    <ComponentContainer 
      ref={containerRef}
      className={className}
      status={status}
    >
      {/* Content */}
    </ComponentContainer>
  );
});
```

### WebGL/Shader Best Practices
```glsl
// ✅ Precision specification
precision highp float;

// ✅ Const definitions for magic numbers
const MAX_STEPS = 80;
const PI = 3.14159265359;

// ✅ Function documentation
/** 
 * Optimized hash function for noise generation
 * @param p - 2D coordinate vector
 * @returns Pseudo-random value between 0-1
 */
float hash(vec2 p) {
  // Implementation
}

// ✅ Uniform naming convention
uniform float uTime;        // Time uniform
uniform vec3 uColor;       // Color uniform
uniform float uIntensity;   // Intensity multiplier

// ✅ Performance optimizations
// - Use step() instead of smoothstep() where possible
// - Pre-calculate expensive operations
// - Use branches for early exits
// - Minimize texture lookups
```

### Error Handling Patterns
```typescript
// ✅ Try-catch with proper typing
const initWebGL = useCallback(async () => {
  const container = containerRef.current;
  if (!container) {
    throw new Error('Container element not found');
  }
  
  try {
    const renderer = new Renderer(config);
    // Setup logic
    onReady?.();
    return cleanup;
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Initialization failed');
    onError?.(err);
    throw err;
  }
}, [onReady, onError]);

// ✅ Error states with recovery options
const ErrorComponent: React.FC<{ error: string; onRetry: () => void }> = ({ error, onRetry }) => (
  <div className="error-container">
    <span className="error-icon">⚠️</span>
    <p className="error-message">{error}</p>
    <button className="retry-button" onClick={onRetry}>
      Retry
    </button>
  </div>
);
```

### Performance Guidelines
```typescript
// ✅ Memoization
const HeavyComponent = memo(({ data }) => {
  const processedData = useMemo(() => expensiveProcessing(data), [data]);
  return <div>{processedData}</div>;
});

// ✅ useCallback for event handlers
const handleClick = useCallback((event: MouseEvent) => {
  // Handler logic
}, [dependency]);

// ✅ Intersection Observer for offscreen elements
const useOffscreenSuspend = (ref, callback) => {
  useEffect(() => {
    const observer = new IntersectionObserver(callback, { threshold: 0.1 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
};

// ✅ RequestAnimationFrame optimization
const useRAF = () => {
  const frameRef = useRef<number>();
  
  const animate = useCallback((time: number) => {
    // Animation logic
    frameRef.current = requestAnimationFrame(animate);
  }, []);
  
  const start = useCallback(() => {
    frameRef.current = requestAnimationFrame(animate);
  }, []);
  
  const stop = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
  }, []);
  
  return { start, stop };
};
```

### CSS/Style Guidelines
```typescript
// ✅ Tailwind-first approach
const className = "absolute inset-0 w-full h-full bg-gradient-to-br from-purple-900/90 to-black flex items-center justify-center";

// ✅ CSS-in-JS for dynamic values
const style = {
  '--glow-intensity': intensity,
  '--animation-speed': `${speed}s`,
  transform: `translate(${position.x}px, ${position.y}px)`
};

// ✅ Responsive design with container queries
const responsiveStyles = `
  @media (max-width: 768px) {
    .component {
      opacity: 0.8;
    }
  }
  
  @media (prefers-reduced-motion: reduce) {
    .animated-element {
      animation: none !important;
    }
  }
`;
```

## 🔍 Testing Guidelines

### Unit Testing (Vitest)
```typescript
// ✅ Component testing
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LaserFlow from '../LaserFlow';

describe('LaserFlow', () => {
  it('should initialize without errors', () => {
    render(<LaserFlow />);
    expect(screen.getByLabelText('Laser flow animation')).toBeInTheDocument();
  });
  
  it('should handle prop changes', async () => {
    const { rerender } = render(<LaserFlow intensity={1.0} />);
    rerender(<LaserFlow intensity={2.0} />);
    
    // Test prop update logic
  });
});
```

### Performance Testing
```typescript
// ✅ Performance benchmarks
import { performance } from 'perf_hooks';

const benchmarkComponent = () => {
  const start = performance.now();
  
  // Component operations
  
  const end = performance.now();
  console.log(`Component took ${end - start}ms`);
};
```

## 🎯 Cursor/Copilot Rules Integration

### Existing Rules Integration:
```typescript
// ✅ Logo Component Usage (from .cursor/component-templates.md)
import TruegleLogo from '../components/ui/TruegleLogo';

// ✅ NeonButton Component Usage (from .cursor/component-templates.md)
import { NeonButton } from '../components/ui/NeonButton';

// ✅ Size Guidelines (from .cursor/component-templates.md)
// - xlarge: Landing page hero (h-48)
// - large: Search portal, results pages (h-32) 
// - medium: Cards, modals (h-20)
// - small: Navbar, header (h-12)

// ✅ Animation Guidelines (from .cursor/component-templates.md)
// - animated={true}: Main pages (landing, search, results)
// - animated={false}: Auth pages, navigation

// ✅ Component Variants
// Primary: 'bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 hover:shadow-orange-500/50'
// Secondary: 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:shadow-cyan-500/50'
// Ghost: 'bg-transparent border-2 border-cyan-500 hover:bg-cyan-500/10'
```

If `.cursor/rules` exists:
```typescript
// ✅ Adhere to existing project conventions
// ✅ Use established component patterns
// ✅ Follow file naming structure already in place
// ✅ Maintain compatibility with existing utilities
```

## 📋 Development Workflow Commands

### Pre-commit Hooks
```bash
# Run before every commit
npm run lint:check && npm run type-check && npm run test:changed
```

### Continuous Integration
```bash
# Full CI pipeline
npm run build:all && npm run test:coverage && npm run e2e:tests
```

### Development Server with Hot Reload
```bash
# Start development with shader hot reload
npm run dev:shader

# Regular development
npm run dev
```

## 🛡️ Security & Best Practices

```typescript
// ✅ Input validation
const validateProps = (props: ComponentProps) => {
  if (typeof props.intensity !== 'number' || props.intensity < 0) {
    throw new Error('Invalid intensity value');
  }
};

// ✅ XSS prevention
const sanitizedClass = clsx(className, { 'bg-white': isValid });

// ✅ WebGL context security
if (renderer.gl) {
  const gl = renderer.gl;
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}
```

## 📊 Performance Budgets

```typescript
// ✅ Component performance targets
const PERFORMANCE_BUDGETS = {
  // Initial render: < 100ms
  initTime: 100,
  
  // Animation frame: < 16ms (60fps)
  frameTime: 16,
  
  // Memory usage: < 10MB for WebGL contexts
  memoryLimit: 10 * 1024 * 1024,
  
  // Bundle size: < 50KB per component
  bundleSize: 50 * 1024
};
```

This file provides comprehensive guidelines for agentic development, ensuring consistent, performant, and maintainable code across all team members and AI agents.