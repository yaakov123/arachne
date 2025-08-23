# Arachne Design System

A modern, elegant design system built for PrimeVue in unstyled mode with comprehensive light/dark theme support.

## Features

- 🎨 **Modern Design**: Clean, elegant interface with carefully crafted spacing and typography
- 🌓 **Light/Dark Theme**: Automatic system preference detection with manual toggle
- 🎯 **PrimeVue Ready**: Comprehensive styling for all PrimeVue components in unstyled mode
- 📱 **Responsive**: Mobile-first design with responsive utilities
- ♿ **Accessible**: WCAG compliant with proper focus states and semantic colors
- 🚀 **Performance**: CSS custom properties for efficient theme switching

## Usage

### Theme Management

```vue
<script setup>
import { useTheme } from '@/composables/useTheme'

const { theme, toggleTheme, setTheme, isDark, isLight } = useTheme()
</script>

<template>
  <button @click="toggleTheme">
    Toggle Theme ({{ theme }})
  </button>
</template>
```

### Theme Toggle Component

```vue
<template>
  <ThemeToggle />
</template>

<script setup>
import ThemeToggle from '@/components/ThemeToggle.vue'
</script>
```

## Design Tokens

### Color System

#### Primary Colors
- `--color-primary-50` to `--color-primary-950`: Blue color scale
- `--primary-color`: Main brand color
- `--primary-color-text`: Text color for primary backgrounds

#### Semantic Colors
- **Success**: `--color-success-50` to `--color-success-700`
- **Warning**: `--color-warning-50` to `--color-warning-700`
- **Error**: `--color-error-50` to `--color-error-700`
- **Info**: `--color-info-50` to `--color-info-700`

#### Neutral Colors
- `--color-neutral-0` to `--color-neutral-950`: Grayscale palette
- `--text-color`: Primary text color
- `--text-color-secondary`: Secondary text color
- `--text-color-muted`: Muted text color

#### Surface Colors
- `--surface-ground`: Main background
- `--surface-section`: Section backgrounds
- `--surface-card`: Card backgrounds
- `--surface-overlay`: Modal/dropdown backgrounds
- `--surface-border`: Border color
- `--surface-hover`: Hover state background

### Spacing Scale

```css
--space-xs: 0.25rem;    /* 4px */
--space-sm: 0.5rem;     /* 8px */
--space-md: 0.75rem;    /* 12px */
--space-lg: 1rem;       /* 16px */
--space-xl: 1.5rem;     /* 24px */
--space-2xl: 2rem;      /* 32px */
--space-3xl: 3rem;      /* 48px */
--space-4xl: 4rem;      /* 64px */
```

### Typography Scale

```css
--text-xs: 0.75rem;     /* 12px */
--text-sm: 0.875rem;    /* 14px */
--text-base: 1rem;      /* 16px */
--text-lg: 1.125rem;    /* 18px */
--text-xl: 1.25rem;     /* 20px */
--text-2xl: 1.5rem;     /* 24px */
--text-3xl: 1.875rem;   /* 30px */
--text-4xl: 2.25rem;    /* 36px */
```

### Border Radius

```css
--radius-xs: 0.125rem;  /* 2px */
--radius-sm: 0.25rem;   /* 4px */
--radius-md: 0.375rem;  /* 6px */
--radius-lg: 0.5rem;    /* 8px */
--radius-xl: 0.75rem;   /* 12px */
--radius-2xl: 1rem;     /* 16px */
--radius-full: 9999px;
```

### Shadows

```css
--shadow-xs: /* Subtle shadow */
--shadow-sm: /* Small shadow */
--shadow-md: /* Medium shadow */
--shadow-lg: /* Large shadow */
--shadow-xl: /* Extra large shadow */
```



## Utility Classes

### Spacing
- `m-0` to `m-6`: Margin utilities
- `p-0` to `p-6`: Padding utilities

### Typography
- `text-xs` to `text-xl`: Font size utilities
- `font-light`, `font-normal`, `font-medium`, `font-semibold`, `font-bold`: Font weight utilities
- `text-primary`, `text-secondary`, `text-muted`: Text color utilities

### Layout
- `flex`, `inline-flex`, `grid`, `block`, `inline-block`, `hidden`: Display utilities
- `items-center`, `items-start`, `items-end`: Align items utilities
- `justify-center`, `justify-between`, `justify-start`, `justify-end`: Justify content utilities
- `gap-1` to `gap-5`: Gap utilities

### Borders and Backgrounds
- `border`, `border-t`, `border-b`, `border-l`, `border-r`: Border utilities
- `rounded`, `rounded-sm`, `rounded-lg`, `rounded-xl`, `rounded-full`: Border radius utilities
- `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`: Shadow utilities
- `bg-primary`, `bg-surface`, `bg-section`: Background utilities

## Dark Theme

The design system automatically detects system preference and applies the appropriate theme. Users can manually toggle between light and dark themes, and their preference is persisted in localStorage.

### Dark Theme Customization

Dark theme colors are automatically inverted and adjusted for optimal contrast and readability. The system uses the same design tokens but with different values for dark mode.

## Responsive Design

The design system includes responsive breakpoints and mobile-optimized spacing:

- Mobile-first approach
- Responsive spacing adjustments
- Touch-friendly interactive elements
- Optimized dialog and toast positioning


## Browser Support

- Modern browsers with CSS custom properties support
- Graceful fallbacks for older browsers
- Optimized for performance and accessibility
