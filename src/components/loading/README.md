# Logo Loading Animation System

A comprehensive, performant loading animation system using your logo with multiple animation variants and smooth transitions.

## Features

- **6 Animation Variants**: Pulse, Rotate, Morph, Breathe, Orbit, Wave
- **Performance Optimized**: Uses `will-change`, `contain`, `transform3d`, hardware acceleration
- **Accessible**: Respects `prefers-reduced-motion`, proper ARIA attributes
- **Smooth Transitions**: 600ms cubic-bezier exit animations
- **Configurable**: Size, colors, minimum display time, custom logos
- **React Hooks**: `useLoadingScreen`, `useAsyncLoadingScreen`, `useRouteLoadingScreen`
- **Global Manager**: `loadingScreenManager` for cross-component control

## Installation

The system is already integrated into `main.jsx`. Components are located at:

```
frontend/src/components/loading/
├── LoadingScreen.jsx      # Main component
├── LoadingScreen.css      # All animations
└── index.js              # Exports

frontend/src/hooks/
└── useLoadingScreen.js    # Hooks for programmatic control
```

## Quick Start

### Basic Usage (Already Configured)

The loading screen shows automatically on app initialization:

```jsx
// main.jsx - Already configured
<LoadingScreenProvider
  variant="pulse"
  minDisplayTime={1000}
  logoSrc="/sukuupay-logo.png"
  logoAlt="SukuuPay"
  size={120}
  backgroundColor="#ffffff"
>
  <App />
</LoadingScreenProvider>
```

### Programmatic Control with Hooks

```jsx
import { useLoadingScreen } from '@/hooks/useLoadingScreen';

function MyComponent() {
  const { isLoading, show, hide, variant } = useLoadingScreen({
    variant: 'morph',
    minDisplayTime: 800,
  });

  const handleAction = async () => {
    show({ variant: 'rotate' });
    try {
      await apiCall();
    } finally {
      hide();
    }
  };

  return <button onClick={handleAction} disabled={isLoading}>Action</button>;
}
```

### Async Operations

```jsx
import { useAsyncLoadingScreen } from '@/hooks/useLoadingScreen';

function DataComponent() {
  const { execute, isLoading } = useAsyncLoadingScreen(
    async (id) => {
      const response = await fetch(`/api/data/${id}`);
      return response.json();
    },
    { variant: 'breathe', minDisplayTime: 500 }
  );

  const loadData = () => execute(123);

  return (
    <div>
      <button onClick={loadData} disabled={isLoading}>Load</button>
      {isLoading && <span>Loading...</span>}
    </div>
  );
}
```

### Route-Based Loading

```jsx
import { useRouteLoadingScreen } from '@/hooks/useLoadingScreen';
import { useNavigate } from 'react-router-dom';

function Navigation() {
  const navigate = useNavigate();
  const loading = useRouteLoadingScreen(navigate, { variant: 'orbit' });

  return <nav>...</nav>;
}
```

### Global Manager (Cross-Component)

```jsx
import { loadingScreenManager } from '@/hooks/useLoadingScreen';

// Anywhere in your app
loadingScreenManager.show({ variant: 'wave', minDisplayTime: 1000 });

// Later
loadingScreenManager.hide();
```

## Animation Variants

| Variant | Class | Description | Best For |
|---------|-------|-------------|----------|
| `pulse` | `.loading-pulse` | Scale in/out with opacity | General purpose, brand identity |
| `rotate` | `.loading-rotate` | Continuous 360° rotation | Tech/loading feel |
| `morph` | `.loading-morph` | Shape morphing with border-radius | Playful, modern brands |
| `breathe` | `.loading-breathe` | Scale + glow/shadow pulse | Calm, trustworthy feel |
| `orbit` | `.loading-orbit` | Logo + orbiting dots | Dynamic, orbital motion |
| `wave` | `.loading-wave` | Logo bounce + wave bars | Energetic, progress indication |

## Configuration Options

### LoadingScreen Props

```jsx
<LoadingScreen
  variant="pulse"           // 'pulse' | 'rotate' | 'morph' | 'breathe' | 'orbit' | 'wave'
  logoSrc="/logo.png"       // Logo image path
  logoAlt="Brand"           // Alt text for accessibility
  size={120}                // Logo size in pixels
  backgroundColor="#fff"    // Background color (CSS variable supported)
  minDisplayTime={800}      // Minimum time before transition (ms)
  onComplete={() => {}}     // Callback when transition completes
  className=""              // Additional CSS classes
/>
```

### Hook Options

```jsx
useLoadingScreen({
  variant: 'pulse',
  minDisplayTime: 800,
  logoSrc: '/sukuupay-logo.png',
  logoAlt: 'SukuuPay',
  size: 120,
  backgroundColor: '#ffffff',
  onComplete: () => console.log('Loading complete'),
});
```

## Customization

### CSS Variables

```css
:root {
  --brand-color: #2563eb;        /* Primary brand color for glows/dots */
  --loading-bg: #ffffff;         /* Background color */
  --loading-text-color: #6b7280; /* Loading text color */
  --transition-duration: 600ms;  /* Exit transition duration */
}

[data-theme="dark"] {
  --loading-bg: #111827;
  --loading-text-color: #9ca3af;
}
```

### Custom Variant

Add a new variant by extending the CSS:

```css
.loading-custom .loading-logo {
  animation: custom-animation 2s ease-in-out infinite;
}

.loading-custom.loading-exit .loading-logo {
  animation: custom-exit 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

@keyframes custom-animation {
  /* Your keyframes */
}

@keyframes custom-exit {
  /* Your exit keyframes */
}
```

Then register it in `LoadingScreen.jsx`:

```javascript
const ANIMATION_VARIANTS = {
  // ... existing
  custom: 'loading-custom',
};
```

## Performance Best Practices

### 1. Hardware Acceleration
All animations use `transform` and `opacity` only - no layout thrashing.

### 2. Containment
```css
.loading-screen {
  contain: layout style paint;  /* Isolates rendering */
}
```

### 3. Will-Change
```css
.loading-logo {
  will-change: transform, opacity;  /* Promotes to compositor layer */
}
```

### 4. Reduced Motion
Automatically respects `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  .loading-screen .loading-logo { animation: none !important; }
}
```

### 5. Preload Logo
```jsx
// In your HTML or App.jsx
<link rel="preload" as="image" href="/sukuupay-logo.png" fetchpriority="high" />
```

### 6. Lazy Load Non-Critical Assets
```jsx
// Only load heavy assets after loading screen exits
useEffect(() => {
  if (!isLoading) {
    import('./heavy-component').then(...);
  }
}, [isLoading]);
```

## Accessibility

- **ARIA**: `role="status"`, `aria-label`, `aria-busy="true"`
- **Reduced Motion**: Full support via media query
- **Color Contrast**: Ensure logo works on background
- **Screen Readers**: "Loading..." text hidden visually but announced

## Integration Patterns

### 1. App Initialization (Current)
Shows during React hydration and initial data fetch.

### 2. Route Transitions
```jsx
// Wrap routes with loading
<Routes>
  <Route
    element={
      <Suspense fallback={<LoadingScreen variant="orbit" />}>
        <DashboardLayout />
      </Suspense>
    }
  >
    <Route path="dashboard" element={<Dashboard />} />
  </Route>
</Routes>
```

### 3. Data Fetching
```jsx
function useData() {
  const { execute, isLoading } = useAsyncLoadingScreen(fetchData);
  return { data, execute, isLoading };
}
```

### 4. Form Submission
```jsx
function Form() {
  const { show, hide, isLoading } = useLoadingScreen({ variant: 'breathe' });

  const onSubmit = async (data) => {
    show({ minDisplayTime: 500 });
    try {
      await submitForm(data);
      toast.success('Saved!');
    } catch (e) {
      toast.error('Failed');
    } finally {
      hide();
    }
  };
}
```

## Troubleshooting

### Logo Not Showing
- Check `logoSrc` path (use absolute from public: `/sukuupay-logo.png`)
- Verify file exists in `frontend/public/`
- Check network tab for 404

### Animation Jitter
- Ensure `will-change` is set on animated elements
- Avoid animating `width`/`height`/`top`/`left` - use `transform`
- Check for conflicting CSS transitions

### Flash of Unstyled Content
- Loading screen renders synchronously in `main.jsx`
- Ensure `LoadingScreenProvider` wraps `App` at root level

### Transition Not Smooth
- Verify `TRANSITION_DURATION` matches CSS (600ms default)
- Check for `!important` overrides on opacity/transform
- Ensure no layout shifts during exit

## Browser Support

- Chrome 60+, Firefox 55+, Safari 13+, Edge 79+
- `prefers-reduced-motion`: All modern browsers
- `contain`: Chrome 52+, Firefox 69+, Safari 15.4+
- Falls back gracefully without containment

## Migration Guide

### From Spinner to Logo Loading

```jsx
// Before: Generic spinner
<div className="spinner" />

// After: Brand logo animation
<LoadingScreen variant="pulse" logoSrc="/logo.png" />
```

### From Manual State to Hook

```jsx
// Before: Manual useState
const [loading, setLoading] = useState(false);

// After: Hook with built-in transitions
const { isLoading, show, hide } = useLoadingScreen();
```

## API Reference

### Exports

```javascript
// Components
import { LoadingScreen, LoadingScreenProvider } from '@/components/loading';

// Hooks
import {
  useLoadingScreen,
  useAsyncLoadingScreen,
  useRouteLoadingScreen,
  createLoadingScreenManager,
  loadingScreenManager,
} from '@/hooks/useLoadingScreen';

// Constants
import { ANIMATION_VARIANTS } from '@/components/loading';
```

### TypeScript Types (if using TS)

```typescript
type AnimationVariant = 'pulse' | 'rotate' | 'morph' | 'breathe' | 'orbit' | 'wave';

interface LoadingScreenProps {
  variant?: AnimationVariant;
  logoSrc?: string;
  logoAlt?: string;
  size?: number;
  backgroundColor?: string;
  minDisplayTime?: number;
  onComplete?: () => void;
  className?: string;
}

interface UseLoadingScreenOptions extends LoadingScreenProps {}
interface UseLoadingScreenReturn extends UseLoadingScreenOptions {
  isLoading: boolean;
  isTransitioning: boolean;
  show: (options?: Partial<UseLoadingScreenOptions>) => void;
  hide: (immediate?: boolean) => void;
  toggle: () => void;
}
```

## Examples

See `frontend/src/components/loading/examples/` for complete examples (create this folder for demos).