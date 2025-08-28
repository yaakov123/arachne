import type { Host, HostWithEndpoints } from '@arachne/database'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { trpc } from '@/services/trpc'

export const useHostsStore = defineStore('hosts', () => {
    // State
    const hosts = ref<HostWithEndpoints[]>([])
    const selectedHost = ref<string | null>(null)
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    const analyticsSummary = ref<{
        totalHosts: number
        totalEndpoints: number
        totalHits: number
        mostActiveHost?: Host
    } | null>(null)

    // Computed
    const sortedHosts = computed(() => {
        return [...hosts.value].sort((a, b) => {
            // Sort by total hits descending, then by last seen descending
            if (a.totalHits !== b.totalHits) {
                return b.totalHits - a.totalHits
            }
            return (
                new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
            )
        })
    })

    const hostsList = computed(() => {
        return sortedHosts.value.map((host) => host.id)
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

        isLoading.value = true
        error.value = null

        try {
            const result = await trpc.hosts.list.query()
            console.log(result)
            hosts.value = result.hosts
        } catch (err) {
            console.error('Failed to fetch hosts:', err)
            error.value =
                err instanceof Error ? err.message : 'Failed to fetch hosts'
        } finally {
            isLoading.value = false
        }
    }

    const fetchAnalyticsSummary = async () => {
        try {
            const result = await trpc.hosts.getAnalyticsSummary.query()
            analyticsSummary.value = result.summary
        } catch (err) {
            console.error('Failed to fetch analytics summary:', err)
        }
    }

    const fetchHostById = async (hostId: string) => {
        try {
            const result = await trpc.hosts.getById.query({ id: hostId })
            const hostIndex = hosts.value.findIndex((h) => h.id === hostId)
            if (hostIndex >= 0) {
                hosts.value[hostIndex] = result.host
            } else {
                hosts.value.push(result.host)
            }
            return result.host
        } catch (err) {
            console.error(`Failed to fetch host ${hostId}:`, err)
            throw err
        }
    }

    const getTopHosts = async (limit: number = 10) => {
        try {
            const result = await trpc.hosts.getTopHosts.query({ limit })
            return result.hosts
        } catch (err) {
            console.error('Failed to fetch top hosts:', err)
            throw err
        }
    }

    const getTopEndpoints = async (limit: number = 10) => {
        try {
            const result = await trpc.hosts.getTopEndpoints.query({ limit })
            return result.endpoints
        } catch (err) {
            console.error('Failed to fetch top endpoints:', err)
            throw err
        }
    }

    const getEndpointsByHost = async (hostId: string, limit: number = 10) => {
        try {
            const result = await trpc.hosts.getEndpointsByHost.query({
                hostId,
                limit,
            })
            return result.endpoints
        } catch (err) {
            console.error(`Failed to fetch endpoints for host ${hostId}:`, err)
            throw err
        }
    }

    const selectHost = (hostId: string | null) => {
        selectedHost.value = hostId
    }

    const getHostCount = (hostId: string): number => {
        const host = hosts.value.find((h) => h.id === hostId)
        return host?.totalHits || 0
    }

    const getHostEndpointCount = (hostId: string): number => {
        const host = hosts.value.find((h) => h.id === hostId)
        return host?.endpoints?.length || 0
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
        analyticsSummary,

        // Computed
        sortedHosts,
        hostsList,
        selectedHostData,

        // Actions
        fetchHosts,
        fetchAnalyticsSummary,
        fetchHostById,
        getTopHosts,
        getTopEndpoints,
        getEndpointsByHost,
        selectHost,
        getHostCount,
        getHostEndpointCount,
        refreshHosts,
        initialize,
    }
})
