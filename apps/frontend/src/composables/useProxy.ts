import { ref, onMounted } from 'vue'
import { trpc } from '@/services/trpc'

export function useProxy() {
    // Proxy state
    const proxyLoading = ref(false)
    const proxyMessage = ref('')
    const proxyMessageType = ref<'success' | 'error' | 'info'>('info')
    const proxyRunning = ref(false)

    // Check proxy status
    async function checkProxyStatus() {
        try {
            const response = await trpc.proxy.status.query()
            proxyRunning.value = response.isRunning
        } catch (error) {
            // Silently fail - assume proxy is not running
            proxyRunning.value = false
        }
    }

    // Start proxy
    async function startProxy() {
        proxyLoading.value = true
        proxyMessage.value = ''

        try {
            const response = await trpc.proxy.start.mutate()
            proxyMessage.value = response.message
            proxyMessageType.value = 'success'
            await checkProxyStatus() // Update status after starting
        } catch (error) {
            proxyMessage.value =
                error instanceof Error
                    ? error.message
                    : 'Unknown error occurred'
            proxyMessageType.value = 'error'
        } finally {
            proxyLoading.value = false
        }
    }

    // Stop proxy
    async function stopProxy() {
        proxyLoading.value = true
        proxyMessage.value = ''

        try {
            const response = await trpc.proxy.stop.mutate()
            proxyMessage.value = response.message
            proxyMessageType.value = 'success'
            await checkProxyStatus() // Update status after stopping
        } catch (error) {
            proxyMessage.value =
                error instanceof Error
                    ? error.message
                    : 'Unknown error occurred'
            proxyMessageType.value = 'error'
        } finally {
            proxyLoading.value = false
        }
    }

    // Toggle proxy (start if stopped, stop if running)
    async function toggleProxy() {
        if (proxyRunning.value) {
            await stopProxy()
        } else {
            await startProxy()
        }
    }

    // Initialize proxy status on mount
    onMounted(async () => {
        await checkProxyStatus()
    })

    return {
        // State
        proxyLoading,
        proxyMessage,
        proxyMessageType,
        proxyRunning,

        // Methods
        checkProxyStatus,
        startProxy,
        stopProxy,
        toggleProxy,
    }
}
