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
                <Button variant="primary" @click="showCreateModal = true">
                    <template #icon-left>
                        <Plus :size="16" />
                    </template>
                    New Profile
                </Button>
            </div>
        </div>

        <div class="profiles-content">
            <!-- Filters and Search -->
            <div class="filters-section">
                <div class="search-box">
                    <Search class="search-icon" :size="18" />
                    <Input
                        v-model="authProfilesStore.searchQuery"
                        placeholder="Search auth profiles..."
                    />
                </div>
                <div class="filter-controls">
                    <Select
                        v-model="authProfilesStore.selectedMethod"
                        class="filter-select"
                        :options="[
                            { label: 'All Methods', value: '' },
                            { label: 'Bearer Token', value: 'bearer' },
                            { label: 'API Key', value: 'api-key' },
                            { label: 'Basic Auth', value: 'basic' },
                            { label: 'JWT', value: 'jwt' },
                            { label: 'OAuth 2.0', value: 'oauth2' },
                            { label: 'Custom', value: 'custom' },
                        ]"
                        placeholder="All Methods"
                    />
                    <Select
                        v-model="authProfilesStore.enabledFilter"
                        class="filter-select"
                        :options="[
                            { label: 'All Profiles', value: '' },
                            { label: 'Enabled Only', value: 'enabled' },
                            { label: 'Disabled Only', value: 'disabled' },
                        ]"
                        placeholder="All Profiles"
                    />
                </div>
            </div>

            <!-- Auth Profiles List -->
            <div class="profiles-list">
                <div v-if="authProfilesStore.isLoading" class="loading-state">
                    <Loader2 class="spinner" :size="32" />
                    <p>Loading auth profiles...</p>
                </div>

                <div
                    v-else-if="authProfilesStore.filteredProfiles.length === 0"
                    class="empty-state"
                >
                    <Shield class="empty-icon" :size="64" />
                    <h3>No auth profiles found</h3>
                    <p>
                        Create your first authentication profile to get started
                    </p>
                    <Button variant="primary" @click="showCreateModal = true">
                        <Plus :size="16" />
                        Create Auth Profile
                    </Button>
                </div>

                <div v-else class="profiles-grid">
                    <ProfileCard
                        v-for="profile in authProfilesStore.filteredProfiles"
                        :key="profile.id"
                        :profile="profile"
                        @toggle="toggleProfile"
                        @edit="editProfile"
                        @delete="deleteProfile"
                    />
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
                    <Button class="btn-close" @click="closeModals">
                        <template #icon-left>
                            <X :size="16" />
                        </template>
                    </Button>
                </div>
                <div class="modal-content">
                    <AuthProfileForm
                        :profile="editingProfile"
                        :is-submitting="authProfilesStore.isLoading"
                        @submit="handleFormSubmit"
                        @cancel="closeModals"
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus, Search, Shield, X, Loader2 } from 'lucide-vue-next'
import { useAuthProfilesStore } from '@/stores/authProfiles'
import { useProjectStore } from '@/stores/project'
import type { AuthProfile } from '@arachne/database'
import ProfileCard from './ProfileCard.vue'
import AuthProfileForm from './AuthProfileForm.vue'
import { Button, Input, Select } from './ui'

// Stores
const projectStore = useProjectStore()
const authProfilesStore = useAuthProfilesStore()

// Modal state
const showCreateModal = ref(false)
const showEditModal = ref(false)
const editingProfile = ref<AuthProfile | null>(null)

// Methods

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

const handleFormSubmit = async (formData: any) => {
    try {
        if (editingProfile.value) {
            // Update existing profile
            await authProfilesStore.updateProfile(
                editingProfile.value.id,
                formData
            )
        } else {
            // Create new profile - add projectId
            const createData = {
                ...formData,
                projectId: projectStore.currentProject?.id,
            }

            if (!createData.projectId) {
                throw new Error('No current project selected')
            }

            await authProfilesStore.createProfile(createData)
        }
        closeModals()
        // TODO: Show success toast
    } catch (error) {
        console.error('Failed to save auth profile:', error)
        // TODO: Show error toast
    }
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

.empty-icon {
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
    display: flex;
    flex-direction: column;
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
    flex: 1;
    overflow-y: auto;
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

    .modal {
        width: 95%;
        margin: 1rem;
    }

    .modal-content {
        padding: 1.5rem;
    }
}
</style>
