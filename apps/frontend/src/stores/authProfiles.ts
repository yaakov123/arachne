import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
    trpc,
    type AuthProfileCreateInput,
    type AuthProfileUpdateInput,
} from '@/services/trpc'
import type { AuthProfile } from '@arachne/database'

export const useAuthProfilesStore = defineStore('authProfiles', () => {
    // State
    const profiles = ref<AuthProfile[]>([])
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    const searchQuery = ref('')
    const selectedMethod = ref('')
    const enabledFilter = ref('')

    // Computed
    const filteredProfiles = computed(() => {
        let filtered = profiles.value

        // Filter by search query
        if (searchQuery.value) {
            const query = searchQuery.value.toLowerCase()
            filtered = filtered.filter(
                (profile) =>
                    profile.name.toLowerCase().includes(query) ||
                    profile.description?.toLowerCase().includes(query) ||
                    profile.method.toLowerCase().includes(query)
            )
        }

        // Filter by method
        if (selectedMethod.value) {
            filtered = filtered.filter(
                (profile) => profile.method === selectedMethod.value
            )
        }

        // Filter by enabled status
        if (enabledFilter.value === 'enabled') {
            filtered = filtered.filter((profile) => profile.enabled !== false)
        } else if (enabledFilter.value === 'disabled') {
            filtered = filtered.filter((profile) => profile.enabled === false)
        }

        return filtered
    })

    // Actions
    const loadProfiles = async () => {
        try {
            isLoading.value = true
            error.value = null
            const result = await trpc.authProfiles.list.query({})
            profiles.value = result.profiles || []
        } catch (err) {
            error.value =
                err instanceof Error
                    ? err.message
                    : 'Failed to load auth profiles'
            console.error('Failed to load auth profiles:', err)
            throw err
        } finally {
            isLoading.value = false
        }
    }

    const createProfile = async (profileData: AuthProfileCreateInput) => {
        try {
            isLoading.value = true
            error.value = null
            const result = await trpc.authProfiles.create.mutate(profileData)
            profiles.value.push(result.profile)
            return result.profile
        } catch (err) {
            error.value =
                err instanceof Error
                    ? err.message
                    : 'Failed to create auth profile'
            console.error('Failed to create auth profile:', err)
            throw err
        } finally {
            isLoading.value = false
        }
    }

    const updateProfile = async (
        id: string,
        updateData: AuthProfileUpdateInput
    ) => {
        try {
            isLoading.value = true
            error.value = null
            const result = await trpc.authProfiles.update.mutate({
                id,
                data: updateData,
            })

            // Update local profile
            const index = profiles.value.findIndex((p) => p.id === id)
            if (index !== -1) {
                profiles.value[index] = result.profile
            }

            return result.profile
        } catch (err) {
            error.value =
                err instanceof Error
                    ? err.message
                    : 'Failed to update auth profile'
            console.error('Failed to update auth profile:', err)
            throw err
        } finally {
            isLoading.value = false
        }
    }

    const toggleProfile = async (profile: AuthProfile) => {
        return updateProfile(profile.id, {
            enabled: !profile.enabled,
        })
    }

    const deleteProfile = async (id: string) => {
        try {
            isLoading.value = true
            error.value = null
            await trpc.authProfiles.delete.mutate({ id })
            profiles.value = profiles.value.filter((p) => p.id !== id)
        } catch (err) {
            error.value =
                err instanceof Error
                    ? err.message
                    : 'Failed to delete auth profile'
            console.error('Failed to delete auth profile:', err)
            throw err
        } finally {
            isLoading.value = false
        }
    }

    // Filter actions
    const setSearchQuery = (query: string) => {
        searchQuery.value = query
    }

    const setMethodFilter = (method: string) => {
        selectedMethod.value = method
    }

    const setEnabledFilter = (filter: string) => {
        enabledFilter.value = filter
    }

    const clearFilters = () => {
        searchQuery.value = ''
        selectedMethod.value = ''
        enabledFilter.value = ''
    }

    const clearError = () => {
        error.value = null
    }

    // Utility functions
    const getProfileById = (id: string) => {
        return profiles.value.find((profile) => profile.id === id)
    }

    const getEnabledProfiles = () => {
        return profiles.value.filter((profile) => profile.enabled !== false)
    }

    const getProfilesByMethod = (method: string) => {
        return profiles.value.filter((profile) => profile.method === method)
    }

    return {
        // State
        profiles,
        isLoading,
        error,
        searchQuery,
        selectedMethod,
        enabledFilter,

        // Computed
        filteredProfiles,

        // Actions
        loadProfiles,
        createProfile,
        updateProfile,
        toggleProfile,
        deleteProfile,

        // Filter actions
        setSearchQuery,
        setMethodFilter,
        setEnabledFilter,
        clearFilters,
        clearError,

        // Utility functions
        getProfileById,
        getEnabledProfiles,
        getProfilesByMethod,
    }
})
