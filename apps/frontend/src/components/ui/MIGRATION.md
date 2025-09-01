# Migration Guide

This guide shows how to replace repeated patterns in existing components with the new reusable UI components.

## Button Migration

### Before (AuthProfilesTab.vue)

```vue
<button class="btn btn-primary" @click="showCreateModal = true">
    <Plus :size="16" />
    New Profile
</button>

<style scoped>
.btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
}

.btn-primary {
    background: var(--primary-color);
    color: white;
}
</style>
```

### After

```vue
<Button variant="primary" @click="showCreateModal = true">
    <template #icon-left>
        <Plus :size="16" />
    </template>
    New Profile
</Button>
```

## Input Migration

### Before (ProjectForm.vue)

```vue
<div class="form-group">
    <label for="project-name">Project Name *</label>
    <input
        id="project-name"
        v-model="formData.name"
        type="text"
        class="form-input"
        placeholder="Enter project name"
        required
    />
</div>

<style scoped>
.form-group {
    margin-bottom: var(--space-lg);
}

.form-group label {
    display: block;
    font-weight: var(--font-medium);
    color: var(--text-color);
    margin-bottom: var(--space-sm);
}

.form-input {
    width: 100%;
    padding: var(--space-md);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    font-size: var(--text-base);
    color: var(--text-color);
    background: var(--surface-card);
    transition: border-color var(--transition-fast);
}
</style>
```

### After

```vue
<Input
    v-model="formData.name"
    label="Project Name"
    placeholder="Enter project name"
    required
/>
```

## Modal Migration

### Before (AuthProfilesTab.vue)

```vue
<div
    v-if="showCreateModal || showEditModal"
    class="modal-overlay"
    @click="closeModals"
>
    <div class="modal" @click.stop>
        <div class="modal-header">
            <h3>Create Auth Profile</h3>
            <button class="btn-close" @click="closeModals">
                <X :size="16" />
            </button>
        </div>
        <div class="modal-content">
            <!-- Content -->
        </div>
    </div>
</div>

<style scoped>
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal {
    background: var(--surface-card);
    border-radius: 0.75rem;
    max-width: 800px;
    width: 95%;
    max-height: 90vh;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}
/* ... more styles */
</style>
```

### After

```vue
<Modal
    v-model:show="showCreateModal"
    title="Create Auth Profile"
    size="lg"
    @close="closeModals"
>
    <!-- Content -->
</Modal>
```

## TagsInput Migration

### Before (ProjectForm.vue)

```vue
<div class="form-group">
    <label for="project-tags">Tags</label>
    <div class="tags-input-container">
        <div class="tags-display">
            <div
                v-for="(tag, index) in tags"
                :key="index"
                class="tag-chip"
            >
                <span class="tag-text">{{ tag }}</span>
                <button
                    type="button"
                    class="tag-remove"
                    @click="removeTag(index)"
                >
                    ×
                </button>
            </div>
            <input
                v-model="currentTagInput"
                @keydown="handleTagKeydown"
                type="text"
                class="tag-input"
                placeholder="Add a tag and press Enter"
            />
        </div>
    </div>
</div>

<style scoped>
/* 100+ lines of tag styling */
</style>
```

### After

```vue
<TagsInput
    v-model="formData.tags"
    label="Tags"
    placeholder="Add a tag and press Enter"
    variant="primary"
/>
```

## Toggle Migration

### Before (AuthProfileForm.vue)

```vue
<div class="form-toggle">
    <input
        id="enabled"
        v-model="formData.enabled"
        type="checkbox"
        class="toggle-input"
    />
    <label for="enabled" class="toggle-label">
        <span class="toggle-switch"></span>
        <span class="toggle-text">
            {{ formData.enabled ? 'Enabled' : 'Disabled' }}
        </span>
    </label>
</div>

<style scoped>
.toggle-input {
    display: none;
}

.toggle-label {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    cursor: pointer;
}

.toggle-switch {
    position: relative;
    width: 44px;
    height: 24px;
    background: var(--color-neutral-300);
    border-radius: var(--radius-full);
    transition: background-color var(--transition-fast);
}
/* ... more toggle styles */
</style>
```

### After

```vue
<Toggle
    v-model="formData.enabled"
    label="Status"
    :description="formData.enabled ? 'Enabled' : 'Disabled'"
    variant="primary"
/>
```

## Loading Migration

### Before (AuthProfilesTab.vue)

```vue
<div v-if="authProfilesStore.isLoading" class="loading-state">
    <Loader2 class="spinner" :size="32" />
    <p>Loading auth profiles...</p>
</div>

<style scoped>
.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--text-color-secondary);
}

.spinner {
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
    color: var(--primary-color);
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}
</style>
```

### After

```vue
<Loading
    :show="authProfilesStore.isLoading"
    text="Loading auth profiles..."
    size="lg"
    center
/>
```

## Select Migration

### Before (AuthProfilesTab.vue)

```vue
<select v-model="authProfilesStore.selectedMethod" class="filter-select">
    <option value="">All Methods</option>
    <option value="bearer">Bearer Token</option>
    <option value="api-key">API Key</option>
</select>

<style scoped>
.filter-select {
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--input-bg);
    color: var(--text-color);
    font-size: 0.875rem;
    min-width: 120px;
}
</style>
```

### After

```vue
<Select
    v-model="authProfilesStore.selectedMethod"
    :options="[
        { label: 'All Methods', value: '' },
        { label: 'Bearer Token', value: 'bearer' },
        { label: 'API Key', value: 'api-key' },
    ]"
    placeholder="All Methods"
    size="sm"
/>
```

## Benefits of Migration

1. **Reduced Code**: Eliminate 100s of lines of repeated CSS
2. **Consistency**: Uniform styling across the application
3. **Accessibility**: Built-in ARIA support and keyboard navigation
4. **Maintainability**: Single source of truth for component styles
5. **Type Safety**: Full TypeScript support with IntelliSense
6. **Theme Support**: Automatic dark/light theme switching
7. **Performance**: Smaller bundle size, better tree-shaking
8. **Developer Experience**: Faster development with pre-built components

## Migration Strategy

1. **Gradual Migration**: Replace components incrementally
2. **Test Coverage**: Ensure existing functionality is preserved
3. **Design Review**: Verify visual consistency with design system
4. **Accessibility Testing**: Confirm WCAG compliance
5. **Performance Monitoring**: Check for any regressions

## Next Steps

-   [ ] Replace button patterns in AuthProfilesTab.vue
-   [ ] Replace input patterns in ProjectForm.vue and AuthProfileForm.vue
-   [ ] Replace modal patterns in ProjectModal.vue
-   [ ] Replace toggle patterns throughout the app
-   [ ] Replace loading states with Loading component
-   [ ] Update form validation to work with new components
-   [ ] Remove legacy CSS classes once migration is complete
