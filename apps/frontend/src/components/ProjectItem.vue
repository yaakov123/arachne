<template>
    <div
        class="project-item"
        :class="{ active: isActive }"
        @click="$emit('select', project)"
    >
        <div class="project-item-main">
            <div class="project-item-left">
                <div class="project-item-header">
                    <div class="project-item-name">
                        <span class="project-name-text">{{
                            project.metadata.name
                        }}</span>
                        <span v-if="isActive" class="active-badge">
                            ✓ Active
                        </span>
                    </div>
                    <div class="project-item-meta">
                        {{ project.transactionCount }}
                        transactions •
                        {{ formatFileSize(project.sizeBytes) }}
                        • Created
                        {{ formatDate(project.metadata.createdAt) }}
                    </div>
                </div>
                <div
                    v-if="project.metadata.description"
                    class="project-item-description"
                >
                    {{ project.metadata.description }}
                </div>
                <div
                    v-if="
                        project.metadata.tags &&
                        project.metadata.tags.length > 0
                    "
                    class="project-item-tags"
                >
                    <span
                        v-for="tag in project.metadata.tags.slice(0, 5)"
                        :key="tag"
                        class="tag tag-sm"
                    >
                        {{ tag }}
                    </span>
                    <span
                        v-if="project.metadata.tags.length > 5"
                        class="tag tag-sm tag-more"
                    >
                        +{{ project.metadata.tags.length - 5 }}
                    </span>
                </div>
            </div>
            <div class="project-item-actions">
                <button
                    class="btn btn-sm btn-outline"
                    @click.stop="$emit('edit', project)"
                >
                    Edit
                </button>
                <button
                    class="btn btn-sm btn-outline btn-danger"
                    @click.stop="$emit('delete', project)"
                    :disabled="isActive"
                >
                    Delete
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { ProjectInfo } from '@arachne/api-types'

interface Props {
    project: ProjectInfo
    isActive: boolean
}

defineProps<Props>()

defineEmits<{
    select: [project: ProjectInfo]
    edit: [project: ProjectInfo]
    delete: [project: ProjectInfo]
}>()

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString()
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
</script>

<style scoped>
.project-item {
    border: 1px solid var(--surface-border);
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all var(--transition-fast);
    position: relative;
    overflow: hidden;
}

.project-item:hover {
    border-color: var(--primary-color);
    box-shadow: var(--shadow-md);
}

.project-item.active {
    border-color: var(--primary-color);
    background: var(--color-primary-50);
    border-width: 2px;
}

.project-item-main {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: var(--space-lg);
    gap: var(--space-lg);
}

.project-item-left {
    flex: 1;
    min-width: 0; /* Allow text to truncate */
}

.project-item-header {
    margin-bottom: var(--space-sm);
}

.project-item-name {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    margin-bottom: var(--space-xs);
}

.project-name-text {
    font-size: var(--text-lg);
    font-weight: var(--font-medium);
    color: var(--text-color);
}

.active-badge {
    display: inline-flex;
    align-items: center;
    padding: var(--space-xs) var(--space-sm);
    background: var(--color-success-100);
    color: var(--color-success-700);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
    white-space: nowrap;
}

.project-item-meta {
    font-size: var(--text-sm);
    color: var(--text-color-secondary);
    line-height: var(--leading-relaxed);
}

.project-item-description {
    color: var(--text-color-secondary);
    font-size: var(--text-sm);
    line-height: var(--leading-relaxed);
    margin-bottom: var(--space-sm);
}

.project-item-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
}

.tag {
    display: inline-flex;
    align-items: center;
    padding: var(--space-xs) var(--space-md);
    background: var(--color-primary-100);
    color: var(--color-primary-700);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: var(--font-medium);
}

.tag-sm {
    padding: var(--space-xs) var(--space-sm);
    font-size: 0.6rem;
}

.tag-more {
    background: var(--color-neutral-200);
    color: var(--color-neutral-600);
}

.project-item-actions {
    display: flex;
    gap: var(--space-sm);
    flex-shrink: 0;
}

.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    padding: var(--space-md) var(--space-xl);
    border-radius: var(--radius-md);
    font-weight: var(--font-medium);
    font-size: var(--text-sm);
    border: 1px solid transparent;
    cursor: pointer;
    transition: all var(--transition-fast);
    min-width: 120px;
}

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-outline {
    background-color: transparent;
    color: var(--primary-color);
    border-color: var(--primary-color);
}

.btn-outline:hover:not(:disabled) {
    background-color: var(--primary-color);
    color: var(--primary-color-text);
}

.btn-sm {
    padding: var(--space-sm) var(--space-md);
    font-size: var(--text-xs);
    min-width: auto;
}

.btn-danger {
    color: var(--color-error-600);
    border-color: var(--color-error-600);
}

.btn-danger:hover:not(:disabled) {
    background-color: var(--color-error-600);
    color: white;
}

/* Responsive */
@media (max-width: 768px) {
    .project-item-main {
        flex-direction: column;
        gap: var(--space-md);
    }

    .project-item-actions {
        justify-content: stretch;
    }

    .project-item-actions .btn {
        flex: 1;
    }

    .project-item-name {
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-xs);
    }
}
</style>
