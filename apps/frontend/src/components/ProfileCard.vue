<template>
    <div class="profile-card" :class="{ disabled: !profile.enabled }">
        <div class="profile-header">
            <div class="profile-info">
                <h3 class="profile-name">{{ profile.name }}</h3>
                <span class="profile-method">{{
                    getMethodLabel(profile.method)
                }}</span>
            </div>
            <div class="profile-actions">
                <button
                    class="btn-icon"
                    @click="toggleProfile"
                    :title="profile.enabled ? 'Disable' : 'Enable'"
                >
                    <Power
                        :size="16"
                        :class="{
                            'text-success': profile.enabled,
                            'text-muted': !profile.enabled,
                        }"
                    />
                </button>
                <button class="btn-icon" @click="editProfile" title="Edit">
                    <Edit :size="16" />
                </button>
                <button
                    class="btn-icon delete"
                    @click="deleteProfile"
                    title="Delete"
                >
                    <Trash2 :size="16" />
                </button>
            </div>
        </div>

        <div v-if="profile.description" class="profile-description">
            {{ profile.description }}
        </div>

        <div class="profile-details">
            <div v-if="profile.conditions" class="profile-conditions">
                <strong>Conditions:</strong>
                <div class="condition-tags">
                    <span
                        v-if="profile.conditions.urlPattern"
                        class="condition-tag"
                    >
                        <Globe :size="12" />
                        URL: {{ profile.conditions.urlPattern }}
                    </span>
                    <span
                        v-if="profile.conditions.hostPattern"
                        class="condition-tag"
                    >
                        <Server :size="12" />
                        Host: {{ profile.conditions.hostPattern }}
                    </span>
                    <span
                        v-if="profile.conditions.methods?.length"
                        class="condition-tag"
                    >
                        <Network :size="12" />
                        Methods: {{ profile.conditions.methods.join(', ') }}
                    </span>
                </div>
            </div>

            <div v-if="profile.tags?.length" class="profile-tags">
                <span v-for="tag in profile.tags" :key="tag" class="tag">
                    <Tag :size="10" />
                    {{ tag }}
                </span>
            </div>

            <div class="profile-meta">
                <span class="priority">
                    <Hash :size="12" />
                    Priority: {{ profile.priority || 0 }}
                </span>
                <span v-if="profile.createdAt" class="created-date">
                    <Calendar :size="12" />
                    Created: {{ formatDate(profile.createdAt.toISOString()) }}
                </span>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import {
    Power,
    Edit,
    Trash2,
    Globe,
    Server,
    Network,
    Tag,
    Hash,
    Calendar,
} from 'lucide-vue-next'
import type { AuthProfile } from '@arachne/database'

// Props
interface Props {
    profile: AuthProfile
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
    toggle: [profile: AuthProfile]
    edit: [profile: AuthProfile]
    delete: [profile: AuthProfile]
}>()

// Methods
const getMethodLabel = (method: string): string => {
    const labels: Record<string, string> = {
        bearer: 'Bearer Token',
        'api-key': 'API Key',
        basic: 'Basic Auth',
        digest: 'Digest Auth',
        oauth1: 'OAuth 1.0',
        oauth2: 'OAuth 2.0',
        jwt: 'JWT',
        'custom-header': 'Custom Header',
        custom: 'Custom',
    }
    return labels[method] || method
}

const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString()
}

const toggleProfile = () => {
    emit('toggle', props.profile)
}

const editProfile = () => {
    emit('edit', props.profile)
}

const deleteProfile = () => {
    emit('delete', props.profile)
}
</script>

<style scoped>
.profile-card {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 0.75rem;
    padding: 1.5rem;
    transition: all 0.2s ease;
}

.profile-card:hover {
    border-color: var(--primary-color);
    box-shadow: 0 4px 12px var(--shadow-color);
}

.profile-card.disabled {
    opacity: 0.6;
}

.profile-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
}

.profile-info {
    flex: 1;
}

.profile-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 0.25rem 0;
}

.profile-method {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    background: var(--primary-color-alpha);
    color: var(--primary-color);
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
}

.profile-actions {
    display: flex;
    gap: 0.5rem;
}

.btn-icon {
    width: 2rem;
    height: 2rem;
    border: none;
    background: transparent;
    color: var(--text-color-secondary);
    cursor: pointer;
    border-radius: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}

.btn-icon:hover {
    background: var(--hover-bg);
    color: var(--text-color);
}

.btn-icon.delete:hover {
    background: var(--danger-color-alpha);
    color: var(--danger-color);
}

.text-success {
    color: var(--success-color, #10b981) !important;
}

.text-muted {
    color: var(--text-color-tertiary) !important;
}

.profile-description {
    color: var(--text-color-secondary);
    font-size: 0.875rem;
    margin-bottom: 1rem;
    line-height: 1.5;
}

.profile-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.profile-conditions {
    font-size: 0.75rem;
}

.condition-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.25rem;
}

.condition-tag {
    background: var(--info-color-alpha);
    color: var(--info-color);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.625rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.profile-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.tag {
    background: var(--secondary-color-alpha);
    color: var(--secondary-color);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.625rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.profile-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--text-color-tertiary);
    flex-wrap: wrap;
    gap: 0.5rem;
}

.priority,
.created-date {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

@media (max-width: 768px) {
    .profile-header {
        flex-direction: column;
        gap: 1rem;
    }

    .profile-actions {
        justify-content: flex-end;
    }

    .profile-meta {
        flex-direction: column;
        gap: 0.25rem;
    }
}
</style>
