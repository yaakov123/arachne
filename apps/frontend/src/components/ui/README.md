# UI Components

This directory contains generic, reusable UI components that follow the Arachne design system. These components are built with Vue 3 and TypeScript, and are designed to be consistent, accessible, and themeable.

## Components

### Form Components

#### Button

A versatile button component with multiple variants, sizes, and states.

```vue
<Button variant="primary" size="md" @click="handleClick">
  Click me
</Button>

<!-- With loading state -->
<Button :loading="isLoading" variant="secondary">
  Save
</Button>

<!-- Icon only button -->
<Button icon-only variant="ghost">
  <template #icon-left>
    <Plus :size="16" />
  </template>
</Button>
```

**Props:**

-   `variant`: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
-   `size`: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
-   `type`: 'button' | 'submit' | 'reset'
-   `disabled`: boolean
-   `loading`: boolean
-   `fullWidth`: boolean
-   `iconOnly`: boolean

#### Input

A flexible input component supporting text, textarea, and various input types.

```vue
<!-- Basic input -->
<Input v-model="value" label="Name" placeholder="Enter your name" required />

<!-- Textarea -->
<Input v-model="description" variant="textarea" label="Description" :rows="4" />

<!-- With icons -->
<Input v-model="search" placeholder="Search...">
  <template #left-icon>
    <Search :size="16" class="input-icon" />
  </template>
</Input>
```

**Props:**

-   `variant`: 'input' | 'textarea' | 'select'
-   `type`: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search'
-   `size`: 'sm' | 'md' | 'lg'
-   `label`: string
-   `placeholder`: string
-   `helpText`: string
-   `error`: string
-   `required`: boolean
-   `disabled`: boolean
-   `readonly`: boolean

#### Select

A styled select component with support for single and multiple selection.

```vue
<!-- Basic select -->
<Select
    v-model="selectedValue"
    :options="options"
    label="Choose option"
    placeholder="Select an option"
/>

<!-- Multiple select -->
<Select
    v-model="selectedValues"
    :options="options"
    multiple
    label="Choose multiple"
/>

<!-- Custom options -->
<Select v-model="value" label="Custom">
  <option value="1">Option 1</option>
  <option value="2">Option 2</option>
</Select>
```

**Props:**

-   `options`: Array of options (string/number or objects with label/value)
-   `multiple`: boolean
-   `size`: 'sm' | 'md' | 'lg'
-   `label`: string
-   `placeholder`: string
-   `helpText`: string
-   `error`: string
-   `required`: boolean
-   `disabled`: boolean

#### TagsInput

A tag input component for managing arrays of strings.

```vue
<TagsInput
    v-model="tags"
    placeholder="Add tags..."
    :max-tags="5"
    variant="primary"
/>
```

**Props:**

-   `size`: 'sm' | 'md' | 'lg'
-   `variant`: 'default' | 'primary' | 'secondary' | 'outline'
-   `maxTags`: number
-   `maxTagLength`: number
-   `separators`: string[]
-   `allowDuplicates`: boolean
-   `trimTags`: boolean
-   `validate`: (tag: string) => boolean | string
-   `transform`: (tag: string) => string

#### Toggle

A toggle/switch component for boolean values.

```vue
<!-- Basic toggle -->
<Toggle
    v-model="enabled"
    label="Enable feature"
    description="This will enable the feature"
/>

<!-- With icons -->
<Toggle
    v-model="darkMode"
    show-icons
    :icon-on="Moon"
    :icon-off="Sun"
    variant="primary"
/>
```

**Props:**

-   `size`: 'sm' | 'md' | 'lg'
-   `variant`: 'default' | 'primary' | 'success' | 'warning' | 'danger'
-   `label`: string
-   `description`: string
-   `showIcons`: boolean
-   `iconOn`: Component
-   `iconOff`: Component
-   `disabled`: boolean
-   `loading`: boolean

### Layout Components

#### Modal

A modal component with header, content, and footer sections.

```vue
<Modal
    v-model:show="showModal"
    title="Confirm Action"
    description="Are you sure you want to continue?"
    size="md"
    :close-on-overlay-click="true"
>
  <p>Modal content goes here...</p>
  
  <template #footer>
    <Button variant="secondary" @click="showModal = false">
      Cancel
    </Button>
    <Button variant="primary" @click="confirm">
      Confirm
    </Button>
  </template>
</Modal>
```

**Props:**

-   `show`: boolean (v-model)
-   `title`: string
-   `description`: string
-   `size`: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
-   `showHeader`: boolean
-   `showCloseButton`: boolean
-   `closeOnOverlayClick`: boolean
-   `closeOnEscape`: boolean
-   `loading`: boolean
-   `preventBodyScroll`: boolean
-   `autoFocus`: boolean
-   `trapFocus`: boolean

### Feedback Components

#### Loading

A loading component with various spinner types and states.

```vue
<!-- Basic loading spinner -->
<Loading text="Loading..." />

<!-- Different variants -->
<Loading variant="dots" size="lg" color="primary" />

<!-- As overlay -->
<Loading overlay backdrop text="Please wait..." />
```

**Props:**

-   `show`: boolean
-   `text`: string
-   `size`: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
-   `variant`: 'spinner' | 'dots' | 'pulse' | 'bars'
-   `color`: 'primary' | 'secondary' | 'white' | 'gray'
-   `center`: boolean
-   `overlay`: boolean
-   `backdrop`: boolean

#### Alert

An alert component for displaying messages and notifications.

```vue
<!-- Basic alert -->
<Alert
    variant="success"
    title="Success!"
    message="Operation completed successfully"
    closeable
/>

<!-- Auto-dismiss alert -->
<Alert
    variant="warning"
    message="This will auto-dismiss in 5 seconds"
    auto-dismiss
    :dismiss-delay="5000"
/>
```

**Props:**

-   `show`: boolean
-   `variant`: 'info' | 'success' | 'warning' | 'error'
-   `size`: 'sm' | 'md' | 'lg'
-   `title`: string
-   `message`: string
-   `showIcon`: boolean
-   `closeable`: boolean
-   `autoDismiss`: boolean
-   `dismissDelay`: number

## Design System Integration

All components are built to work seamlessly with the design system defined in `@/assets/design-system.css`. They use:

-   **CSS Custom Properties**: All colors, spacing, and other design tokens
-   **Consistent Sizing**: Standardized size scales (xs, sm, md, lg, xl)
-   **Theme Support**: Automatic dark/light theme switching
-   **Responsive Design**: Mobile-first responsive behavior
-   **Accessibility**: ARIA labels, keyboard navigation, focus management

## Usage

Import components from the ui directory:

```typescript
import { Button, Input, Modal, Alert } from '@/components/ui'
```

Or import individual components:

```typescript
import Button from '@/components/ui/Button.vue'
import { ButtonProps } from '@/components/ui'
```

## Design Principles

1. **Consistency**: All components follow the same design patterns and conventions
2. **Flexibility**: Components accept various props and slots for customization
3. **Accessibility**: WCAG compliant with proper ARIA attributes and keyboard support
4. **Performance**: Optimized for minimal bundle size and runtime performance
5. **Developer Experience**: TypeScript support with comprehensive prop definitions

## Contributing

When adding new components:

1. Follow the existing patterns and naming conventions
2. Include comprehensive TypeScript types
3. Add proper slots for customization
4. Ensure accessibility compliance
5. Test with both light and dark themes
6. Update this README with usage examples
7. Export the component in `index.ts`
