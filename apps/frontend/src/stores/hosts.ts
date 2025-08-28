import type { Host } from '@arachne/database'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useHostsStore = defineStore('hosts', () => {
    const hosts = ref<Host[]>([])

    return { hosts }
})
