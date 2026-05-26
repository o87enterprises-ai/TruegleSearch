# Modal Component Documentation

Responsive, accessible modal component system following the design system.

## Components

### Modal
Base modal component with responsive sizing and positioning.

### Sub-components
- `ModalHeader` - Modal title and optional close button
- `ModalBody` - Scrollable content area
- `ModalFooter` - Action buttons area

## Features

- **6 Size Variants**: xs, sm, md, lg, xl, full
- **5 Position Options**: center, top, bottom, left, right
- **Responsive Design**: Mobile-first with breakpoints
- **Accessibility**: ARIA attributes, keyboard navigation, focus trap
- **Smooth Animations**: Framer Motion transitions
- **Customizable**: Extensive styling options

## Usage

### Basic Modal
```jsx
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui';

function App() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open Modal</button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} size="md">
        <ModalHeader>Modal Title</ModalHeader>
        <ModalBody>
          <p>Modal content goes here...</p>
        </ModalBody>
        <ModalFooter>
          <button onClick={() => setIsOpen(false)}>Cancel</button>
          <button>Confirm</button>
        </ModalFooter>
      </Modal>
    </>
  );
}
```

### Size Variants
```jsx
// Extra Small (400px)
<Modal size="xs">...</Modal>

// Small (480px)
<Modal size="sm">...</Modal>

// Medium (640px) - Default
<Modal size="md">...</Modal>

// Large (768px)
<Modal size="lg">...</Modal>

// Extra Large (1024px)
<Modal size="xl">...</Modal>

// Full Screen
<Modal size="full">...</Modal>
```

### Position Variants
```jsx
// Centered - Default
<Modal position="center">...</Modal>

// Top with padding
<Modal position="top">...</Modal>

// Bottom sheet style
<Modal position="bottom">...</Modal>

// Left aligned
<Modal position="left">...</Modal>

// Right aligned
<Modal position="right">...</Modal>
```

### Custom Header
```jsx
<Modal isOpen={isOpen} onClose={onClose}>
  <ModalHeader showClose={true} onClose={onClose}>
    <h2 className="text-xl font-bold">Custom Header</h2>
  </ModalHeader>
  <ModalBody>Content...</ModalBody>
</Modal>
```

### Scrollable Content
```jsx
<Modal isOpen={isOpen} onClose={onClose}>
  <ModalHeader>Long Content</ModalHeader>
  <ModalBody scrollable={true}>
    {/* Content will scroll if it overflows */}
    <p>Lorem ipsum dolor sit amet...</p>
  </ModalBody>
  <ModalFooter>
    <button>Close</button>
  </ModalFooter>
</Modal>
```

### Footer Alignment
```jsx
// Left aligned
<ModalFooter align="left">
  <button>Cancel</button>
  <button>Confirm</button>
</ModalFooter>

// Centered
<ModalFooter align="center">
  <button>OK</button>
</ModalFooter>

// Right aligned - Default
<ModalFooter align="right">
  <button>Cancel</button>
  <button>Confirm</button>
</ModalFooter>

// Spaced
<ModalFooter align="between">
  <button>Back</button>
  <button>Next</button>
</ModalFooter>
```

## Props

### Modal

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | boolean | required | Controls modal visibility |
| `onClose` | function | required | Close callback |
| `children` | node | required | Modal content |
| `size` | 'xs'\|'sm'\|'md'\|'lg'\|'xl'\|'full' | 'md' | Modal size variant |
| `position` | 'center'\|'top'\|'bottom'\|'left'\|'right' | 'center' | Modal position |
| `closeOnOverlayClick` | boolean | true | Close when clicking backdrop |
| `closeOnEscape` | boolean | true | Close on Escape key |
| `showCloseButton` | boolean | true | Show top-right close button |
| `className` | string | '' | Additional CSS classes |
| `style` | object | {} | Additional inline styles |

### ModalHeader

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | node | required | Header content (string or element) |
| `showClose` | boolean | false | Show close button in header |
| `onClose` | function | - | Close button callback |
| `className` | string | '' | Additional CSS classes |

### ModalBody

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | node | required | Body content |
| `scrollable` | boolean | true | Enable overflow scrolling |
| `className` | string | '' | Additional CSS classes |

### ModalFooter

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | node | required | Footer content |
| `align` | 'left'\|'center'\|'right'\|'between' | 'right' | Button alignment |
| `className` | string | '' | Additional CSS classes |

## Responsive Behavior

Mobile (sm: 640px):
- Reduced padding: `p-4`
- Smaller sizes: scaled down
- Touch-optimized close button

Tablet (md: 768px):
- Medium padding: `p-5`
- Standard sizes
- Balanced spacing

Desktop (lg: 1024px+):
- Increased padding: `p-6`
- Full size implementation
- Keyboard-optimized navigation

## Accessibility

- **Focus Trap**: Tab cycles within modal
- **Focus Management**: Auto-focuses first focusable element
- **ARIA Attributes**: `role="dialog"`, `aria-modal="true"`
- **Keyboard Support**: Escape to close, Tab/Shift-Tab navigation
- **Screen Reader**: Proper labeling with `aria-labelledby`
- **Body Scroll Lock**: Prevents background scrolling

## Design System Alignment

- **Spacing**: 8px grid system for all padding/gaps
- **Colors**: Neutral palette with design system tokens
- **Typography**: MD3 typography scales
- **Border Radius**: 16px (rounded-2xl) for glassmorphism
- **Shadows**: Design system shadow tokens
- **Motion**: 200ms ease-out transitions

## Examples

See `ModalDemo.jsx` for comprehensive examples including:
- All size variants
- All position variants
- Scrollable content
- Custom headers
- Footer alignment options
