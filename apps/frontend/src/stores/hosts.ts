import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { trpc, type HostWithTransactionCount } from '@/services/trpc'
import { useProjectStore } from './project'

export const useHostsStore = defineStore('hosts', () => {
    // Dependencies
    const projectStore = useProjectStore()

    watch(
        () => projectStore.currentProject,
        () => {
            fetchHosts()
        }
    )

    // State
    const hosts = ref<HostWithTransactionCount>([])
    const selectedHost = ref<string | null>(null)
    const isLoading = ref(false)
    const error = ref<string | null>(null)

    // Computed
    const sortedHosts = computed(() => {
        return [...hosts.value].sort((a, b) => {
            return (
                new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
            )
        })
    })

    const selectedHostData = computed(() => {
        if (!selectedHost.value) return null
        return (
            hosts.value.find((host) => host.id === selectedHost.value) || null
        )
    })

    // Actions
    const fetchHosts = async () => {
        if (isLoading.value) return
        if (!projectStore.currentProject?.id) {
            error.value = 'No current project selected'
            return
        }

        isLoading.value = true
        error.value = null

        try {
            const result = await trpc.hosts.list.query({
                projectId: projectStore.currentProject.id,
            })
            hosts.value = result
        } catch (err) {
            error.value = err instanceof Error ? err.message : 'Unknown error'
        } finally {
            isLoading.value = false
        }
    }

    const selectHost = (hostId: string | null) => {
        selectedHost.value = hostId
    }

    const getHostCount = (hostId: string): number => {
        const host = hosts.value.find((h) => h.hostname === hostId)
        return host?._count?.transactions || 0
    }

    const getHostEndpointCount = (hostId: string): number => {
        const host = hosts.value.find((h) => h.id === hostId)
        return host?._count?.transactions || 0
    }

    const refreshHosts = async () => {
        await Promise.all([fetchHosts()])
    }

    // Initialize
    const initialize = async () => {
        await refreshHosts()
    }

    return {
        // State
        hosts,
        selectedHost,
        isLoading,
        error,

        // Computed
        sortedHosts,
        selectedHostData,

        // Actions
        fetchHosts,
        selectHost,
        getHostCount,
        getHostEndpointCount,
        refreshHosts,
        initialize,
    }
})
