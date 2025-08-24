<template>
    <div class="advanced-filters">
        <div class="filters-header">
            <h3>Filters</h3>
            <div class="filters-actions">
                <button 
                    class="btn btn-secondary btn-sm"
                    @click="clearAllFilters"
                    :disabled="!hasActiveFilters"
                >
                    Clear All
                </button>
                <button 
                    class="btn btn-secondary btn-sm"
                    @click="toggleCollapsed"
                >
                    {{ isCollapsed ? 'Show' : 'Hide' }}
                </button>
            </div>
        </div>
        
        <div v-show="!isCollapsed" class="filters-content">
            <div class="filters-row">
                <!-- URL/Path Filter -->
                <div class="filter-group">
                    <label>URL/Path</label>
                    <input 
                        v-model="filters.url"
                        type="text" 
                        placeholder="Filter by URL or path..."
                        class="filter-input"
                    />
                </div>
                
                <!-- Method Filter -->
                <div class="filter-group">
                    <label>Method</label>
                    <select v-model="filters.method" class="filter-select">
                        <option value="">All Methods</option>
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                        <option value="PATCH">PATCH</option>
                        <option value="HEAD">HEAD</option>
                        <option value="OPTIONS">OPTIONS</option>
                    </select>
                </div>
                
                <!-- Status Code Filter -->
                <div class="filter-group">
                    <label>Status</label>
                    <select v-model="filters.statusCode" class="filter-select">
                        <option value="">All Status</option>
                        <option value="2xx">2xx Success</option>
                        <option value="3xx">3xx Redirect</option>
                        <option value="4xx">4xx Client Error</option>
                        <option value="5xx">5xx Server Error</option>
                        <option value="200">200 OK</option>
                        <option value="404">404 Not Found</option>
                        <option value="500">500 Internal Error</option>
                    </select>
                </div>
                
                <!-- Content Type Filter -->
                <div class="filter-group">
                    <label>Content Type</label>
                    <select v-model="filters.contentType" class="filter-select">
                        <option value="">All Types</option>
                        <option value="json">JSON</option>
                        <option value="html">HTML</option>
                        <option value="xml">XML</option>
                        <option value="css">CSS</option>
                        <option value="javascript">JavaScript</option>
                        <option value="image">Images</option>
                        <option value="text">Text</option>
                        <option value="binary">Binary</option>
                    </select>
                </div>
            </div>
            
            <div class="filters-row">
                <!-- Response Size Filter -->
                <div class="filter-group">
                    <label>Response Size</label>
                    <div class="size-filter">
                        <select v-model="filters.sizeOperator" class="filter-select size-operator">
                            <option value="">Any Size</option>
                            <option value="gt">Greater than</option>
                            <option value="lt">Less than</option>
                            <option value="eq">Equal to</option>
                        </select>
                        <input 
                            v-if="filters.sizeOperator"
                            v-model.number="filters.sizeValue"
                            type="number" 
                            placeholder="Size in KB"
                            class="filter-input size-input"
                            min="0"
                        />
                    </div>
                </div>
                
                <!-- Duration Filter -->
                <div class="filter-group">
                    <label>Duration</label>
                    <div class="duration-filter">
                        <select v-model="filters.durationOperator" class="filter-select duration-operator">
                            <option value="">Any Duration</option>
                            <option value="gt">Slower than</option>
                            <option value="lt">Faster than</option>
                        </select>
                        <input 
                            v-if="filters.durationOperator"
                            v-model.number="filters.durationValue"
                            type="number" 
                            placeholder="Duration in ms"
                            class="filter-input duration-input"
                            min="0"
                        />
                    </div>
                </div>
                
                <!-- Time Range Filter -->
                <div class="filter-group">
                    <label>Time Range</label>
                    <select v-model="filters.timeRange" class="filter-select">
                        <option value="">All Time</option>
                        <option value="1m">Last 1 minute</option>
                        <option value="5m">Last 5 minutes</option>
                        <option value="15m">Last 15 minutes</option>
                        <option value="1h">Last 1 hour</option>
                        <option value="custom">Custom Range</option>
                    </select>
                </div>
                
                <!-- Has Body Filter -->
                <div class="filter-group">
                    <label>Body</label>
                    <select v-model="filters.hasBody" class="filter-select">
                        <option value="">Any</option>
                        <option value="request">Has Request Body</option>
                        <option value="response">Has Response Body</option>
                        <option value="both">Has Both</option>
                        <option value="none">No Body</option>
                    </select>
                </div>
            </div>
            
            <!-- Custom Time Range -->
            <div v-if="filters.timeRange === 'custom'" class="filters-row">
                <div class="filter-group">
                    <label>From</label>
                    <input 
                        v-model="filters.timeFrom"
                        type="datetime-local" 
                        class="filter-input"
                    />
                </div>
                <div class="filter-group">
                    <label>To</label>
                    <input 
                        v-model="filters.timeTo"
                        type="datetime-local" 
                        class="filter-input"
                    />
                </div>
            </div>
        </div>
        
        <!-- Active Filters Summary -->
        <div v-if="hasActiveFilters && !isCollapsed" class="active-filters">
            <div class="active-filters-header">
                <span>Active Filters:</span>
            </div>
            <div class="active-filters-list">
                <span v-if="filters.url" class="filter-tag">
                    URL: {{ filters.url }}
                    <button @click="filters.url = ''" class="filter-tag-remove">×</button>
                </span>
                <span v-if="filters.method" class="filter-tag">
                    Method: {{ filters.method }}
                    <button @click="filters.method = ''" class="filter-tag-remove">×</button>
                </span>
                <span v-if="filters.statusCode" class="filter-tag">
                    Status: {{ filters.statusCode }}
                    <button @click="filters.statusCode = ''" class="filter-tag-remove">×</button>
                </span>
                <span v-if="filters.contentType" class="filter-tag">
                    Type: {{ filters.contentType }}
                    <button @click="filters.contentType = ''" class="filter-tag-remove">×</button>
                </span>
                <span v-if="filters.sizeOperator && filters.sizeValue" class="filter-tag">
                    Size: {{ filters.sizeOperator }} {{ filters.sizeValue }}KB
                    <button @click="clearSizeFilter" class="filter-tag-remove">×</button>
                </span>
                <span v-if="filters.durationOperator && filters.durationValue" class="filter-tag">
                    Duration: {{ filters.durationOperator }} {{ filters.durationValue }}ms
                    <button @click="clearDurationFilter" class="filter-tag-remove">×</button>
                </span>
                <span v-if="filters.timeRange && filters.timeRange !== 'custom'" class="filter-tag">
                    Time: {{ getTimeRangeLabel(filters.timeRange) }}
                    <button @click="filters.timeRange = ''" class="filter-tag-remove">×</button>
                </span>
                <span v-if="filters.timeRange === 'custom' && (filters.timeFrom || filters.timeTo)" class="filter-tag">
                    Custom Time Range
                    <button @click="clearCustomTimeRange" class="filter-tag-remove">×</button>
                </span>
                <span v-if="filters.hasBody" class="filter-tag">
                    Body: {{ getBodyFilterLabel(filters.hasBody) }}
                    <button @click="filters.hasBody = ''" class="filter-tag-remove">×</button>
                </span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

import type { AdvancedFilters as FilterOptions } from '../stores/transactions'

const filters = ref<FilterOptions>({
    url: '',
    method: '',
    statusCode: '',
    contentType: '',
    sizeOperator: '',
    sizeValue: null,
    durationOperator: '',
    durationValue: null,
    timeRange: '',
    timeFrom: '',
    timeTo: '',
    hasBody: ''
})

const isCollapsed = ref(false)

const emit = defineEmits<{
    filtersChanged: [filters: FilterOptions]
}>()

const hasActiveFilters = computed(() => {
    return filters.value.url !== '' ||
           filters.value.method !== '' ||
           filters.value.statusCode !== '' ||
           filters.value.contentType !== '' ||
           (filters.value.sizeOperator !== '' && filters.value.sizeValue !== null) ||
           (filters.value.durationOperator !== '' && filters.value.durationValue !== null) ||
           filters.value.timeRange !== '' ||
           filters.value.hasBody !== ''
})

// Watch for filter changes and emit
watch(filters, (newFilters) => {
    emit('filtersChanged', { ...newFilters })
}, { deep: true })

function clearAllFilters() {
    filters.value = {
        url: '',
        method: '',
        statusCode: '',
        contentType: '',
        sizeOperator: '',
        sizeValue: null,
        durationOperator: '',
        durationValue: null,
        timeRange: '',
        timeFrom: '',
        timeTo: '',
        hasBody: ''
    }
}

function clearSizeFilter() {
    filters.value.sizeOperator = ''
    filters.value.sizeValue = null
}

function clearDurationFilter() {
    filters.value.durationOperator = ''
    filters.value.durationValue = null
}

function clearCustomTimeRange() {
    filters.value.timeRange = ''
    filters.value.timeFrom = ''
    filters.value.timeTo = ''
}

function toggleCollapsed() {
    isCollapsed.value = !isCollapsed.value
}

function getTimeRangeLabel(range: string): string {
    const labels: Record<string, string> = {
        '1m': 'Last 1 minute',
        '5m': 'Last 5 minutes',
        '15m': 'Last 15 minutes',
        '1h': 'Last 1 hour'
    }
    return labels[range] || range
}

function getBodyFilterLabel(bodyFilter: string): string {
    const labels: Record<string, string> = {
        'request': 'Has Request Body',
        'response': 'Has Response Body',
        'both': 'Has Both',
        'none': 'No Body'
    }
    return labels[bodyFilter] || bodyFilter
}
</script>

<style scoped>
.advanced-filters {
    background: var(--surface-card);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    margin: var(--space-sm);
    overflow: hidden;
}

.filters-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md) var(--space-lg);
    background: var(--surface-section);
    border-bottom: 1px solid var(--surface-border);
}

.filters-header h3 {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    color: var(--text-color);
}

.filters-actions {
    display: flex;
    gap: var(--space-sm);
}

.filters-content {
    padding: var(--space-lg);
}

.filters-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-lg);
    margin-bottom: var(--space-lg);
}

.filters-row:last-child {
    margin-bottom: 0;
}

.filter-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
}

.filter-group label {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-color-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.filter-input,
.filter-select {
    padding: var(--space-sm);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-sm);
    background: var(--surface-ground);
    color: var(--text-color);
    font-size: var(--text-sm);
    transition: border-color var(--transition-fast);
}

.filter-input:focus,
.filter-select:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--primary-color) 20%, transparent);
}

.size-filter,
.duration-filter {
    display: flex;
    gap: var(--space-sm);
}

.size-operator,
.duration-operator {
    flex: 1;
}

.size-input,
.duration-input {
    flex: 1;
    min-width: 100px;
}

.active-filters {
    padding: var(--space-md) var(--space-lg);
    background: var(--surface-section);
    border-top: 1px solid var(--surface-border);
}

.active-filters-header {
    margin-bottom: var(--space-sm);
}

.active-filters-header span {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-color-secondary);
}

.active-filters-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
}

.filter-tag {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-sm);
    background: color-mix(in srgb, var(--primary-color) 10%, transparent);
    color: var(--primary-color);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
}

.filter-tag-remove {
    background: none;
    border: none;
    color: var(--primary-color);
    cursor: pointer;
    font-size: var(--text-sm);
    font-weight: bold;
    padding: 0;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color var(--transition-fast);
}

.filter-tag-remove:hover {
    background: var(--primary-color);
    color: white;
}

.btn {
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-sm);
    background: var(--surface-ground);
    color: var(--text-color);
    cursor: pointer;
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    transition: all var(--transition-fast);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.btn:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: var(--primary-color);
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-sm {
    padding: var(--space-xs) var(--space-sm);
    font-size: var(--text-xs);
}

.btn-secondary {
    background: var(--surface-section);
}
</style>
