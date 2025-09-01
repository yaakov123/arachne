<template>
    <div class="auth-profiles-tab">
        <div class="tab-header">
            <div class="header-content">
                <h2>Authentication Profiles</h2>
                <p>
                    Manage authentication configurations that can be
                    automatically applied to requests
                </p>
            </div>
            <div class="header-actions">
                <button class="btn btn-primary" @click="showCreateModal = true">
                    <svg
                        class="icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="16" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                    New Profile
                </button>
            </div>
        </div>

        <div class="profiles-content">
            <!-- Filters and Search -->
            <div class="filters-section">
                <div class="search-box">
                    <svg
                        class="search-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        v-model="authProfilesStore.searchQuery"
                        type="text"
                        placeholder="Search auth profiles..."
                        class="search-input"
                    />
                </div>
                <div class="filter-controls">
                    <select
                        v-model="authProfilesStore.selectedMethod"
                        class="filter-select"
                    >
                        <option value="">All Methods</option>
                        <option value="bearer">Bearer Token</option>
                        <option value="api-key">API Key</option>
                        <option value="basic">Basic Auth</option>
                        <option value="jwt">JWT</option>
                        <option value="oauth2">OAuth 2.0</option>
                        <option value="custom">Custom</option>
                    </select>
                    <select
                        v-model="authProfilesStore.enabledFilter"
                        class="filter-select"
                    >
                        <option value="">All Profiles</option>
                        <option value="enabled">Enabled Only</option>
                        <option value="disabled">Disabled Only</option>
                    </select>
                </div>
            </div>

            <!-- Auth Profiles List -->
            <div class="profiles-list">
                <div v-if="authProfilesStore.isLoading" class="loading-state">
                    <div class="spinner"></div>
                    <p>Loading auth profiles...</p>
                </div>

                <div
                    v-else-if="authProfilesStore.filteredProfiles.length === 0"
                    class="empty-state"
                >
                    <svg
                        class="empty-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                    >
                        <path d="M9 12l2 2 4-4" />
                        <path
                            d="M21 12c.552 0 1-.448 1-1V8c0-.552-.448-1-1-1h-1V6c0-2.761-2.239-5-5-5H8C5.239 1 3 3.239 3 6v1H2c-.552 0-1 .448-1 1v3c0 .552.448 1 1 1h1v1c0 2.761 2.239 5 5 5h8c2.761 0 5-2.239 5-5v-1h1z"
                        />
                    </svg>
                    <h3>No auth profiles found</h3>
                    <p>
                        Create your first authentication profile to get started
                    </p>
                    <button
                        class="btn btn-primary"
                        @click="showCreateModal = true"
                    >
                        Create Auth Profile
                    </button>
                </div>

                <div v-else class="profiles-grid">
                    <div
                        v-for="profile in authProfilesStore.filteredProfiles"
                        :key="profile.id"
                        class="profile-card"
                        :class="{ disabled: !profile.enabled }"
                    >
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
                                    @click="toggleProfile(profile)"
                                    :title="
                                        profile.enabled ? 'Disable' : 'Enable'
                                    "
                                >
                                    <svg
                                        v-if="profile.enabled"
                                        class="icon"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                    >
                                        <path
                                            d="M12 1v6m0 6v6m6-12a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                    </svg>
                                    <svg
                                        v-else
                                        class="icon"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                    >
                                        <circle cx="12" cy="12" r="3" />
                                        <path d="M12 1v6m0 6v6" />
                                    </svg>
                                </button>
                                <button
                                    class="btn-icon"
                                    @click="editProfile(profile)"
                                    title="Edit"
                                >
                                    <svg
                                        class="icon"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                    >
                                        <path
                                            d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                                        />
                                        <path
                                            d="m18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                                        />
                                    </svg>
                                </button>
                                <button
                                    class="btn-icon delete"
                                    @click="deleteProfile(profile)"
                                    title="Delete"
                                >
                                    <svg
                                        class="icon"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="2"
                                    >
                                        <polyline points="3,6 5,6 21,6" />
                                        <path
                                            d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div
                            v-if="profile.description"
                            class="profile-description"
                        >
                            {{ profile.description }}
                        </div>

                        <div class="profile-details">
                            <div
                                v-if="profile.conditions"
                                class="profile-conditions"
                            >
                                <strong>Conditions:</strong>
                                <div class="condition-tags">
                                    <span
                                        v-if="profile.conditions.urlPattern"
                                        class="condition-tag"
                                    >
                                        URL: {{ profile.conditions.urlPattern }}
                                    </span>
                                    <span
                                        v-if="profile.conditions.hostPattern"
                                        class="condition-tag"
                                    >
                                        Host:
                                        {{ profile.conditions.hostPattern }}
                                    </span>
                                    <span
                                        v-if="
                                            profile.conditions.methods?.length
                                        "
                                        class="condition-tag"
                                    >
                                        Methods:
                                        {{
                                            profile.conditions.methods.join(
                                                ', '
                                            )
                                        }}
                                    </span>
                                </div>
                            </div>

                            <div
                                v-if="profile.tags?.length"
                                class="profile-tags"
                            >
                                <span
                                    v-for="tag in profile.tags"
                                    :key="tag"
                                    class="tag"
                                >
                                    {{ tag }}
                                </span>
                            </div>

                            <div class="profile-meta">
                                <span class="priority"
                                    >Priority: {{ profile.priority || 0 }}</span
                                >
                                <span
                                    v-if="profile.createdAt"
                                    class="created-date"
                                >
                                    Created:
                                    {{
                                        formatDate(
                                            profile.createdAt.toISOString()
                                        )
                                    }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Create/Edit Modal -->
        <div
            v-if="showCreateModal || showEditModal"
            class="modal-overlay"
            @click="closeModals"
        >
            <div class="modal" @click.stop>
                <div class="modal-header">
                    <h3>
                        {{
                            showEditModal
                                ? 'Edit Auth Profile'
                                : 'Create Auth Profile'
                        }}
                    </h3>
                    <button class="btn-close" @click="closeModals">
                        <svg
                            class="icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
                <div class="modal-content">
                    <p>Auth profile form coming soon...</p>
                    <!-- TODO: Implement auth profile form -->
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthProfilesStore } from '@/stores/authProfiles'
import type { AuthProfile } from '@arachne/database'

// Store
const authProfilesStore = useAuthProfilesStore()

// Modal state
const showCreateModal = ref(false)
const showEditModal = ref(false)
const editingProfile = ref<AuthProfile | null>(null)

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

const toggleProfile = async (profile: AuthProfile) => {
    try {
        await authProfilesStore.toggleProfile(profile)
    } catch (error) {
        console.error('Failed to toggle auth profile:', error)
        // TODO: Show error toast
    }
}

const editProfile = (profile: AuthProfile) => {
    editingProfile.value = profile
    showEditModal.value = true
}

const deleteProfile = async (profile: AuthProfile) => {
    if (!confirm(`Are you sure you want to delete "${profile.name}"?`)) {
        return
    }

    try {
        await authProfilesStore.deleteProfile(profile.id)
    } catch (error) {
        console.error('Failed to delete auth profile:', error)
        // TODO: Show error toast
    }
}

const closeModals = () => {
    showCreateModal.value = false
    showEditModal.value = false
    editingProfile.value = null
}

// Lifecycle
onMounted(() => {
    authProfilesStore.loadProfiles()
})
</script>

<style scoped>
.auth-profiles-tab {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-color);
}

.tab-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 2rem 2rem 1.5rem 2rem;
    border-bottom: 1px solid var(--border-color);
}

.header-content h2 {
    font-size: 1.875rem;
    font-weight: 700;
    color: var(--text-color);
    margin: 0 0 0.5rem 0;
}

.header-content p {
    font-size: 1rem;
    color: var(--text-color-secondary);
    margin: 0;
}

.header-actions {
    display: flex;
    gap: 1rem;
}

.profiles-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.filters-section {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
}

.search-box {
    position: relative;
    flex: 1;
    min-width: 300px;
}

.search-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    width: 1.25rem;
    height: 1.25rem;
    color: var(--text-color-tertiary);
}

.search-input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 3rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--input-bg);
    color: var(--text-color);
    font-size: 0.875rem;
}

.search-input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-color-alpha);
}

.filter-controls {
    display: flex;
    gap: 1rem;
}

.filter-select {
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background: var(--input-bg);
    color: var(--text-color);
    font-size: 0.875rem;
    min-width: 120px;
}

.filter-select:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--primary-color-alpha);
}

.profiles-list {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem 2rem;
}

.loading-state,
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
    color: var(--text-color-secondary);
}

.spinner {
    width: 2rem;
    height: 2rem;
    border: 2px solid var(--border-color);
    border-top: 2px solid var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}

.empty-icon {
    width: 4rem;
    height: 4rem;
    color: var(--text-color-tertiary);
    margin-bottom: 1rem;
}

.empty-state h3 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 0.5rem 0;
}

.empty-state p {
    margin: 0 0 2rem 0;
}

.profiles-grid {
    display: grid;
    gap: 1.5rem;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
}

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

.icon {
    width: 1rem;
    height: 1rem;
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
}

.profile-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--text-color-tertiary);
}

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

.btn-primary:hover {
    background: var(--primary-color-hover);
}

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
    background: var(--card-bg);
    border-radius: 0.75rem;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0;
}

.btn-close {
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
}

.btn-close:hover {
    background: var(--hover-bg);
    color: var(--text-color);
}

.modal-content {
    padding: 2rem;
}

@media (max-width: 768px) {
    .tab-header {
        flex-direction: column;
        gap: 1rem;
        align-items: stretch;
    }

    .filters-section {
        flex-direction: column;
        align-items: stretch;
        gap: 1rem;
    }

    .search-box {
        min-width: auto;
    }

    .filter-controls {
        flex-direction: column;
    }

    .profiles-grid {
        grid-template-columns: 1fr;
    }

    .profile-header {
        flex-direction: column;
        gap: 1rem;
    }

    .profile-actions {
        justify-content: flex-end;
    }

    .modal {
        width: 95%;
        margin: 1rem;
    }

    .modal-content {
        padding: 1.5rem;
    }
}
</style>
