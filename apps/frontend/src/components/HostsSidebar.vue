<template>
    <Sidebar class="hosts-sidebar" :class="{ collapsed: isCollapsed }">
        <div class="sidebar-content">
            <div class="sidebar-header">
                <h2 v-if="!isCollapsed">Hosts</h2>
                <button
                    class="toggle-button"
                    @click="toggleCollapsed"
                    :aria-label="
                        isCollapsed
                            ? 'Expand hosts sidebar'
                            : 'Collapse hosts sidebar'
                    "
                >
                    <svg
                        class="toggle-icon"
                        :class="{ rotated: isCollapsed }"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                </button>
            </div>
            <!-- Expanded state content -->
            <div v-if="!isCollapsed" class="sidebar-body">
                <div class="search-container">
                    <input
                        v-model="searchQuery"
                        type="text"
                        placeholder="Search hosts..."
                        class="search-input"
                    />
                </div>
                <div class="hosts-list">
                    <div
                        v-for="host in filteredHosts"
                        :key="host.id"
                        class="host-item"
                        :class="{ active: hostsStore.selectedHost === host.id }"
                        @click="hostsStore.selectHost(host.id)"
                    >
                        <div class="host-info">
                            <span class="host-name">{{ host.hostname }}</span>
                        </div>
                        <span class="host-count">{{
                            hostsStore.getHostCount(host.hostname)
                        }}</span>
                    </div>
                </div>
                <div v-if="hostsStore.error" class="error-message">
                    {{ hostsStore.error }}
                </div>
                <div v-if="hostsStore.isLoading" class="loading-message">
                    Loading hosts...
                </div>
            </div>

            <!-- Collapsed state content -->
            <div v-else class="collapsed-content">
                <!-- Total hosts count -->
                <div class="total-count">
                    <span class="count-number">{{
                        hostsStore.hosts.length
                    }}</span>
                    <span class="count-label">hosts</span>
                </div>

                <!-- Mini host indicators for top hosts -->
                <div class="mini-hosts">
                    <div
                        v-for="host in topHosts"
                        :key="host.id"
                        class="mini-host"
                        :class="{ active: hostsStore.selectedHost === host.id }"
                        @click="hostsStore.selectHost(host.id)"
                        :title="`${host.hostname} (${hostsStore.getHostCount(
                            host.hostname
                        )} requests)`"
                    >
                        <div class="mini-host-dot"></div>
                        <div class="mini-host-count">
                            {{ hostsStore.getHostCount(host.hostname) }}
                        </div>
                    </div>
                </div>

                <!-- Active host indicator -->
                <div
                    v-if="hostsStore.selectedHostData"
                    class="active-host-indicator"
                >
                    <div class="active-dot"></div>
                    <div class="active-count">
                        {{
                            hostsStore.getHostCount(
                                hostsStore.selectedHostData.hostname
                            )
                        }}
                    </div>
                </div>
            </div>
        </div>
    </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import Sidebar from './Sidebar.vue'
import { useHostsStore } from '../stores/hosts'
import type { Host } from '@arachne/database'

const hostsStore = useHostsStore()
const searchQuery = ref('')
const isCollapsed = ref(false)

// Toggle collapsed state
const toggleCollapsed = () => {
    isCollapsed.value = !isCollapsed.value
}

// Computed property to filter hosts based on search query
const filteredHosts = computed(() => {
    if (!searchQuery.value.trim()) {
        return hostsStore.hosts
    }

    const query = searchQuery.value.toLowerCase().trim()
    return hostsStore.hosts.filter((host: Host) =>
        host.hostname.toLowerCase().includes(query)
    )
})

// Computed property for top hosts to show in collapsed state
const topHosts = computed(() => {
    return [...hostsStore.hosts]
        .sort((a, b) => {
            const countA = hostsStore.getHostCount(a.hostname)
            const countB = hostsStore.getHostCount(b.hostname)
            return countB - countA
        })
        .slice(0, 5) // Show top 5 hosts
})

// Initialize hosts data when component mounts
onMounted(() => {
    hostsStore.initialize()
})
</script>

<style scoped>
.hosts-sidebar {
    width: 280px;
    min-width: 250px;
    max-width: 400px;
    flex-shrink: 0;
    transition: width var(--transition-medium) ease-in-out;
}

.hosts-sidebar.collapsed {
    width: 60px;
    min-width: 60px;
    max-width: 60px;
}

.sidebar-content {
    height: 100%;
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
}

.collapsed .sidebar-content {
    padding: var(--space-md) var(--space-sm);
}

.sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-lg);
}

.collapsed .sidebar-header {
    justify-content: center;
    margin-bottom: var(--space-md);
}

.sidebar-content h2 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-color);
}

.toggle-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--space-sm);
    border-radius: var(--radius-md);
    color: var(--text-color-secondary);
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
}

.toggle-button:hover {
    background: var(--surface-hover);
    color: var(--text-color);
}

.toggle-icon {
    width: 20px;
    height: 20px;
    transition: transform var(--transition-medium) ease-in-out;
}

.toggle-icon.rotated {
    transform: rotate(180deg);
}

.sidebar-body {
    flex: 1;
    display: flex;
    flex-direction: column;
}

.collapsed-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-lg);
    padding-top: var(--space-md);
}

.total-count {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
}

.count-number {
    font-size: var(--text-xl);
    font-weight: var(--font-bold);
    color: var(--primary-color);
    line-height: 1;
}

.count-label {
    font-size: var(--text-xs);
    color: var(--text-color-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: var(--space-xs);
}

.mini-hosts {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    align-items: center;
    width: 100%;
}

.mini-host {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    padding: var(--space-xs);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
    position: relative;
    width: 100%;
}

.mini-host:hover {
    background: var(--surface-hover);
}

.mini-host.active {
    background: var(--color-primary-50);
}

[data-theme='dark'] .mini-host.active {
    background: var(--color-primary-200);
}

.mini-host-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-neutral-400);
    margin-bottom: var(--space-xs);
    transition: all var(--transition-fast);
}

.mini-host.active .mini-host-dot {
    background: var(--primary-color);
    transform: scale(1.2);
}

.mini-host-count {
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    color: var(--text-color-secondary);
    min-width: 20px;
    text-align: center;
}

.mini-host.active .mini-host-count {
    color: var(--primary-color);
    font-weight: var(--font-semibold);
}

.active-host-indicator {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-sm);
    border-top: 1px solid var(--surface-border);
    width: 100%;
}

.active-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-success-500);
    margin-bottom: var(--space-xs);
    animation: pulse 2s infinite;
}

.active-count {
    font-size: var(--text-xs);
    font-weight: var(--font-semibold);
    color: var(--color-success-600);
}

@keyframes pulse {
    0%,
    100% {
        opacity: 1;
        transform: scale(1);
    }
    50% {
        opacity: 0.7;
        transform: scale(1.2);
    }
}

.search-container {
    margin-bottom: var(--space-lg);
}

.search-input {
    width: 100%;
    padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-md);
    background: var(--surface-subtle);
    color: var(--text-color);
    font-size: var(--text-sm);
    transition: all var(--transition-fast);
}

.search-input:focus {
    outline: none;
    border-color: var(--primary-color);
    background: var(--surface-base);
    box-shadow: 0 0 0 3px var(--color-primary-100);
}

[data-theme='dark'] .search-input:focus {
    box-shadow: 0 0 0 3px var(--color-primary-900);
}

.search-input::placeholder {
    color: var(--text-color-secondary);
}

.hosts-list {
    flex: 1;
    overflow-y: auto;
}

.host-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    margin-bottom: var(--space-xs);
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: all var(--transition-fast);
    font-size: var(--text-sm);
    color: var(--text-color);
}

.host-info {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    flex: 1;
    min-width: 0; /* Allow text truncation */
}

.host-favicon {
    width: 16px;
    height: 16px;
    border-radius: var(--radius-sm);
    flex-shrink: 0;
    object-fit: cover;
    background: var(--surface-subtle);
}

.host-item:hover {
    background: var(--surface-hover);
}

.host-item.active {
    background: var(--color-primary-50);
    color: var(--primary-color);
}

[data-theme='dark'] .host-item.active {
    background: var(--color-primary-200);
    color: var(--color-primary-950);
}

.host-name {
    font-weight: var(--font-medium);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.host-count {
    background: var(--color-neutral-200);
    color: var(--text-color);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    min-width: 20px;
    text-align: center;
}

[data-theme='dark'] .host-count {
    background: var(--color-neutral-700);
    color: var(--color-neutral-200);
}

.host-item.active .host-count {
    background: var(--color-primary-200);
    color: var(--color-primary-800);
}

[data-theme='dark'] .host-item.active .host-count {
    background: var(--color-primary-800);
    color: var(--color-primary-200);
}

.error-message {
    margin-top: auto;
    padding-top: var(--space-lg);
    border-top: 1px solid var(--surface-border);
    font-size: var(--text-sm);
    color: var(--color-error-500);
    font-style: italic;
}

.loading-message {
    margin-top: auto;
    padding-top: var(--space-lg);
    border-top: 1px solid var(--surface-border);
    font-size: var(--text-sm);
    color: var(--text-color-secondary);
    font-style: italic;
}
</style>
