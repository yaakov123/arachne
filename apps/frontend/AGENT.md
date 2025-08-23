# @arachne/frontend - Agent Rules

## Overview
The frontend is a Vue 3 Single Page Application (SPA) that provides a real-time web interface for monitoring and analyzing HTTP/HTTPS traffic captured by the Arachne proxy. It connects to the backend via WebSockets for live updates and HTTP API for historical data.

## Architecture

### Core Technologies
- **Vue 3** with Composition API and `<script setup>` syntax
- **PrimeVue** components with Aura theme for consistent UI
- **Pinia** for state management with composable stores
- **Vue Router** for client-side routing
- **Axios** for HTTP API calls
- **WebSocket API** for real-time event streaming
- **Vite** for development and build tooling

### Component Structure
```
src/
├── components/        # Reusable UI components
├── layouts/           # Layout components (AppShell)
├── views/             # Route components (Logger)
├── stores/            # Pinia stores for state management
├── services/          # API clients and external services
├── router/            # Vue Router configuration
├── assets/            # Static assets and global styles
└── main.ts            # Application entry point
```

## Development Rules

### Vue 3 Composition API Patterns
- **Always use `<script setup>`** for component composition
- **Prefer `ref()` over `reactive()`** for primitive values and arrays
- **Use `computed()` for derived state** instead of methods where possible
- **Implement proper cleanup** with `onUnmounted()` for subscriptions

```typescript
// Good: Composition API with script setup
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTransactionsStore } from '@/stores/transactions'

const store = useTransactionsStore()
const selectedHost = ref<string | null>(null)

const filteredTransactions = computed(() => 
    store.filteredTransactions.filter(t => 
        !selectedHost.value || t.request.url.host === selectedHost.value
    )
)

onMounted(async () => {
    await store.connect()
})

onUnmounted(() => {
    store.disconnect()
})
</script>
```

### State Management with Pinia
- **Use composable stores** with the Composition API pattern
- **Keep stores focused** on single domains (transactions, settings, etc.)
- **Implement proper error handling** in async actions
- **Use computed properties** for derived state instead of getters

```typescript
// Good: Pinia store pattern
export const useTransactionsStore = defineStore('transactions', () => {
    // State
    const transactions = ref<Transaction[]>([])
    const isLoading = ref(false)
    
    // Computed
    const uniqueHosts = computed(() => 
        [...new Set(transactions.value.map(t => t.request.url.host))].sort()
    )
    
    // Actions
    async function connect() {
        try {
            isLoading.value = true
            await wsClient.connect()
        } catch (error) {
            console.error('Connection failed:', error)
            throw error
        } finally {
            isLoading.value = false
        }
    }
    
    return { transactions, isLoading, uniqueHosts, connect }
})
```

### Component Design Patterns
- **Single Responsibility**: Each component should have one clear purpose
- **Props Interface**: Always define props with TypeScript interfaces
- **Event Emission**: Use typed events with `defineEmits()`
- **Slot Usage**: Provide slots for flexible content composition

```typescript
// Good: Component with clear interface
<script setup lang="ts">
interface Props {
    transaction: TransactionWithMeta
    isSelected?: boolean
}

interface Emits {
    select: [transaction: TransactionWithMeta]
    copy: [text: string]
}

const props = withDefaults(defineProps<Props>(), {
    isSelected: false
})

const emit = defineEmits<Emits>()

function handleClick() {
    emit('select', props.transaction)
}
</script>
```

### Real-time Data Handling
- **WebSocket Management**: Use singleton WebSocket client with event handlers
- **Connection State**: Track connection status and handle reconnection
- **Event Processing**: Process events incrementally, not in bulk
- **Memory Management**: Limit stored data to prevent memory leaks

```typescript
// Good: Real-time data processing
function handleWebSocketEvent(event: BackendEvent) {
    switch (event.type) {
        case 'transactionComplete':
            addTransaction(event)
            break
        case 'error':
            handleError(event)
            break
        default:
            console.warn('Unhandled event type:', (event as any).type)
    }
}

function addTransaction(event: TransactionCompleteEvent) {
    const transaction = transformEventToTransaction(event)
    
    // Add to beginning (newest first)
    transactions.value.unshift(transaction)
    
    // Prevent memory issues
    if (transactions.value.length > MAX_TRANSACTIONS) {
        transactions.value = transactions.value.slice(0, MAX_TRANSACTIONS)
    }
}
```

### PrimeVue Integration
- **Auto Import**: Use unplugin-vue-components for automatic component imports
- **Theme Consistency**: Use Aura theme variables in custom styles
- **Component Configuration**: Configure PrimeVue components with sensible defaults
- **Accessibility**: Leverage PrimeVue's built-in accessibility features

```typescript
// Good: PrimeVue configuration
app.use(PrimeVue, {
    theme: {
        preset: Aura,
        options: {
            darkModeSelector: '.app-dark'
        }
    }
})
```

### HTTP API Integration
- **Centralized Client**: Use single Axios instance with shared configuration
- **Type Safety**: Use shared types from `@arachne/api-types`
- **Error Handling**: Implement consistent error handling across all API calls
- **Authentication**: Handle Bearer token authentication transparently

```typescript
// Good: Type-safe API client
export class ApiClient {
    private http: AxiosInstance
    
    constructor(private opts: ApiClientOptions = {}) {
        this.http = axios.create({
            baseURL: opts.basePath ?? '',
            headers: { 'Content-Type': 'application/json' }
        })
    }
    
    async getInventory(): Promise<InventoryTree> {
        const { data } = await this.http.get<InventoryTree>(
            HttpRoutes.inventory, 
            { headers: this.authHeaders() }
        )
        return data
    }
}
```

### Development Server Configuration
- **Proxy Setup**: Configure Vite dev server to proxy backend requests
- **Hot Module Replacement**: Ensure HMR works properly with Vue components
- **Environment Variables**: Use `VITE_` prefix for client-side environment variables

```typescript
// Good: Vite proxy configuration
server: {
    proxy: {
        '/api': {
            target: process.env.VITE_BACKEND_ORIGIN || 'http://127.0.0.1:8080',
            changeOrigin: true
        },
        '/ws': {
            target: process.env.VITE_BACKEND_ORIGIN || 'http://127.0.0.1:8080',
            ws: true,
            changeOrigin: true
        }
    }
}
```

### Error Handling Strategies
- **Global Error Boundary**: Implement error boundary for unhandled errors
- **User Feedback**: Show meaningful error messages to users
- **Logging**: Log errors to console with context for debugging
- **Recovery**: Provide recovery mechanisms where possible

```typescript
// Good: Error handling in components
async function loadData() {
    try {
        loading.value = true
        await store.fetchTransactions()
    } catch (error) {
        errorMessage.value = error instanceof Error 
            ? error.message 
            : 'Failed to load data'
        console.error('Load failed:', error)
    } finally {
        loading.value = false
    }
}
```

### Performance Optimization
- **Virtual Scrolling**: Use for large transaction lists
- **Computed Caching**: Cache expensive computations with computed()
- **Component Lazy Loading**: Lazy load route components
- **Bundle Analysis**: Monitor bundle size and optimize imports

```typescript
// Good: Virtual scrolling for large lists
<VirtualScrollList 
    :items="filteredTransactions" 
    :item-height="60"
    :buffer-size="10"
    v-slot="{ item }"
>
    <TransactionItem :transaction="item" />
</VirtualScrollList>
```

### Styling Guidelines
- **CSS Custom Properties**: Use PrimeVue theme tokens for consistency
- **Component Scoping**: Use `<style scoped>` for component-specific styles
- **Global Styles**: Minimize global styles, prefer component composition
- **Responsive Design**: Design for mobile-first, enhance for desktop

```vue
<style scoped>
.transaction-item {
    padding: var(--content-padding);
    border-bottom: 1px solid var(--surface-border);
    background: var(--surface-card);
}

.transaction-item:hover {
    background: var(--surface-hover);
}

.status-success { color: var(--green-500); }
.status-error { color: var(--red-500); }
</style>
```

### Testing Patterns
- **Component Testing**: Test component behavior with Vue Test Utils
- **Store Testing**: Test Pinia stores in isolation
- **E2E Testing**: Use Playwright for end-to-end user flows
- **Mock Services**: Mock WebSocket and HTTP services for testing

```typescript
// Good: Component test
import { mount } from '@vue/test-utils'
import TransactionItem from '@/components/TransactionItem.vue'

describe('TransactionItem', () => {
    const mockTransaction = createMockTransaction()
    
    it('displays transaction details correctly', () => {
        const wrapper = mount(TransactionItem, {
            props: { transaction: mockTransaction }
        })
        
        expect(wrapper.text()).toContain(mockTransaction.request.method)
        expect(wrapper.text()).toContain(mockTransaction.request.url.host)
    })
})
```

### Security Considerations
- **CSP Headers**: Configure Content Security Policy appropriately
- **Token Storage**: Store authentication tokens securely
- **Input Sanitization**: Sanitize any user input before display
- **HTTPS Enforcement**: Use HTTPS in production environments

## File Organization Patterns

### Component Structure
```vue
<!-- Good: Component file organization -->
<script setup lang="ts">
// Imports first
import { ref, computed } from 'vue'
import type { TransactionData } from '@arachne/api-types'

// Type definitions
interface Props {
    transactions: TransactionData[]
}

// Props and emits
const props = defineProps<Props>()
const emit = defineEmits<{...}>()

// Reactive state
const selectedItem = ref(null)

// Computed properties
const sortedTransactions = computed(() => ...)

// Methods
function handleClick() { ... }
</script>

<template>
    <!-- Template content -->
</template>

<style scoped>
/* Scoped styles */
</style>
```

### Service Structure
```typescript
// Good: Service file organization
export interface ServiceOptions {
    baseUrl?: string
    timeout?: number
}

export class ServiceClient {
    private config: Required<ServiceOptions>
    
    constructor(options: ServiceOptions = {}) {
        this.config = { ...defaults, ...options }
    }
    
    // Public methods
    async connect() { ... }
    
    // Private methods
    private handleError() { ... }
}

// Export singleton instance
export const serviceClient = new ServiceClient()
```

## Common Patterns

### Route-Level Code Splitting
```typescript
// Good: Lazy loading routes
const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            component: () => import('@/views/Logger.vue')
        }
    ]
})
```

### Composable Patterns
```typescript
// Good: Reusable composable
export function useWebSocket(url: string) {
    const isConnected = ref(false)
    const lastMessage = ref(null)
    
    const connect = async () => { ... }
    const disconnect = () => { ... }
    
    onUnmounted(() => {
        disconnect()
    })
    
    return {
        isConnected: readonly(isConnected),
        lastMessage: readonly(lastMessage),
        connect,
        disconnect
    }
}
```

### Event Bus Alternative
```typescript
// Good: Use stores instead of event bus
export const useNotificationStore = defineStore('notifications', () => {
    const notifications = ref([])
    
    const addNotification = (message: string, type: 'info' | 'error' = 'info') => {
        notifications.value.push({ id: Date.now(), message, type })
    }
    
    return { notifications, addNotification }
})
```