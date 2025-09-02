<template>
    <div class="pagination-container">
        <div class="pagination-info">
            <span class="pagination-text">
                Showing {{ paginationInfo.start }} to
                {{ paginationInfo.end }} of {{ paginationInfo.total }} results
            </span>
        </div>

        <div class="pagination-controls">
            <!-- Page size selector -->
            <div class="page-size-selector">
                <label for="page-size" class="page-size-label">Show:</label>
                <select
                    id="page-size"
                    :value="paginationInfo.pageSize"
                    @change="updatePageSize"
                    class="page-size-select"
                >
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                </select>
            </div>

            <!-- Navigation buttons -->
            <div class="pagination-buttons">
                <button
                    @click="$emit('goToPage', 1)"
                    :disabled="
                        !canGoToPrevious ||
                        paginationInfo.currentPage === 1 ||
                        isLoading
                    "
                    class="pagination-button"
                    title="First page"
                >
                    <ChevronsLeft :size="16" />
                </button>

                <button
                    @click="$emit('previousPage')"
                    :disabled="!canGoToPrevious || isLoading"
                    class="pagination-button"
                    title="Previous page"
                >
                    <ChevronLeft :size="16" />
                </button>

                <!-- Page numbers -->
                <div class="page-numbers">
                    <template v-for="page in visiblePages" :key="page">
                        <button
                            v-if="typeof page === 'number'"
                            @click="$emit('goToPage', page)"
                            :disabled="isLoading"
                            :class="[
                                'page-number',
                                { active: page === paginationInfo.currentPage },
                            ]"
                        >
                            {{ page }}
                        </button>
                        <span v-else class="page-ellipsis">...</span>
                    </template>
                </div>

                <button
                    @click="$emit('nextPage')"
                    :disabled="!canGoToNext || isLoading"
                    class="pagination-button"
                    title="Next page"
                >
                    <ChevronRight :size="16" />
                </button>

                <button
                    @click="$emit('goToPage', paginationInfo.totalPages)"
                    :disabled="
                        !canGoToNext ||
                        paginationInfo.currentPage ===
                            paginationInfo.totalPages ||
                        isLoading
                    "
                    class="pagination-button"
                    title="Last page"
                >
                    <ChevronsRight :size="16" />
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
} from 'lucide-vue-next'

interface PaginationInfo {
    start: number
    end: number
    total: number
    currentPage: number
    totalPages: number
    pageSize: number
}

interface Props {
    paginationInfo: PaginationInfo
    canGoToPrevious: boolean
    canGoToNext: boolean
    isLoading?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
    goToPage: [page: number]
    nextPage: []
    previousPage: []
    updatePageSize: [pageSize: number]
}>()

// Calculate visible page numbers with ellipsis
const visiblePages = computed(() => {
    const { currentPage, totalPages } = props.paginationInfo
    const delta = 2 // Number of pages to show on each side of current page
    const pages: (number | string)[] = []

    if (totalPages <= 7) {
        // Show all pages if there are 7 or fewer
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i)
        }
    } else {
        // Always show first page
        pages.push(1)

        if (currentPage > delta + 2) {
            pages.push('...')
        }

        // Show pages around current page
        const startPage = Math.max(2, currentPage - delta)
        const endPage = Math.min(totalPages - 1, currentPage + delta)

        for (let i = startPage; i <= endPage; i++) {
            pages.push(i)
        }

        if (currentPage < totalPages - delta - 1) {
            pages.push('...')
        }

        // Always show last page (if there are more than 1 pages)
        if (totalPages > 1) {
            pages.push(totalPages)
        }
    }

    return pages
})

const updatePageSize = (event: Event) => {
    const target = event.target as HTMLSelectElement
    emit('updatePageSize', parseInt(target.value))
}
</script>

<style scoped>
.pagination-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md);
    background: var(--surface-card);
    border-top: 1px solid var(--surface-border);
    gap: var(--space-md);
}

.pagination-info {
    color: var(--text-color-secondary);
    font-size: var(--text-sm);
}

.pagination-controls {
    display: flex;
    align-items: center;
    gap: var(--space-md);
}

.page-size-selector {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--text-sm);
}

.page-size-label {
    color: var(--text-color-secondary);
}

.page-size-select {
    padding: var(--space-xs) var(--space-sm);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-sm);
    background: var(--surface-ground);
    color: var(--text-color);
    font-size: var(--text-sm);
    cursor: pointer;
}

.page-size-select:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px
        color-mix(in srgb, var(--primary-color) 20%, transparent);
}

.pagination-buttons {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
}

.pagination-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-sm);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-sm);
    background: var(--surface-ground);
    color: var(--text-color);
    cursor: pointer;
    transition: all var(--transition-fast);
    min-width: 36px;
    height: 36px;
}

.pagination-button:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: var(--primary-color);
}

.pagination-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.page-numbers {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
}

.page-number {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-sm);
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-sm);
    background: var(--surface-ground);
    color: var(--text-color);
    cursor: pointer;
    transition: all var(--transition-fast);
    min-width: 36px;
    height: 36px;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
}

.page-number:hover {
    background: var(--surface-hover);
    border-color: var(--primary-color);
}

.page-number.active {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
}

.page-ellipsis {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-sm);
    color: var(--text-color-secondary);
    font-size: var(--text-sm);
    min-width: 36px;
    height: 36px;
}

@media (max-width: 768px) {
    .pagination-container {
        flex-direction: column;
        gap: var(--space-sm);
    }

    .pagination-controls {
        flex-direction: column;
        gap: var(--space-sm);
    }

    .page-numbers {
        gap: var(--space-2xs);
    }

    .pagination-button,
    .page-number {
        min-width: 32px;
        height: 32px;
        padding: var(--space-xs);
    }
}
</style>
