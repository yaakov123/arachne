<template>
    <div class="p-4 space-y-4">
        <div class="flex items-center gap-3">
            <span class="font-semibold">WS:</span>
            <span :class="connected ? 'text-green-600' : 'text-red-600'">
                {{ connected ? 'connected' : 'disconnected' }}
            </span>
            <button
                class="px-3 py-1 rounded bg-blue-600 text-white"
                @click="doConnect"
                v-if="!connected"
            >
                Connect
            </button>
            <button
                class="px-3 py-1 rounded bg-gray-600 text-white"
                @click="doDisconnect"
                v-else
            >
                Disconnect
            </button>

            <input
                v-model="token"
                class="ml-4 px-2 py-1 border rounded min-w-64"
                placeholder="Optional backend token"
                @change="applyToken"
            />
        </div>

        <div class="flex items-center gap-2">
            <button
                class="px-3 py-1 rounded bg-emerald-600 text-white"
                @click="checkHealth"
            >
                GET /health
            </button>
            <button
                class="px-3 py-1 rounded bg-emerald-600 text-white"
                @click="loadHosts"
            >
                GET /api/hosts
            </button>
            <span v-if="health !== null"
                >Health: <b>{{ health ? 'OK' : 'FAIL' }}</b></span
            >
        </div>

        <div>
            <h2 class="font-semibold mb-2">Events ({{ events.length }})</h2>
            <div
                class="border rounded divide-y max-h-[60vh] overflow-auto bg-white"
            >
                <div
                    v-for="(e, i) in events"
                    :key="i"
                    class="px-3 py-2 text-sm font-mono"
                >
                    <div class="flex gap-2">
                        <span class="text-gray-500">{{ e.ts }}</span>
                        <span class="font-semibold">{{ e.type }}</span>
                        <span
                            class="truncate"
                            v-if="'method' in e && 'url' in e"
                            >{{ (e as any).method }} {{ (e as any).url }}</span
                        >
                        <span v-if="'statusCode' in e">{{
                            (e as any).statusCode
                        }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { api } from '@/services/http'
import { wsClient } from '@/services/ws'
import type { BackendEvent } from '@arachne/api-types'

const connected = ref(false)
const token = ref<string | undefined>(undefined)
const health = ref<boolean | null>(null)
const events = ref<BackendEvent[]>([])

function attachHandler() {
    return wsClient.on((ev) => {
        events.value.unshift(ev)
        if (events.value.length > 200) events.value.pop()
    })
}

let off: (() => void) | null = null

async function doConnect() {
    await wsClient.connect({ token: token.value })
    off = attachHandler()
    connected.value = wsClient.isConnected()
}

function doDisconnect() {
    wsClient.disconnect()
    if (off) off()
    off = null
    connected.value = false
}

function applyToken() {
    api.setToken(token.value)
    if (connected.value) doConnect()
}

async function checkHealth() {
    try {
        const r = await api.health()
        health.value = !!r.ok
    } catch {
        health.value = false
    }
}

async function loadHosts() {
    try {
        await api.getHosts()
    } catch {}
}

onMounted(() => {
    // Lazy connect; avoid auto connect to let user set token first
})

onBeforeUnmount(() => {
    doDisconnect()
})
</script>

<style scoped>
.min-w-64 {
    min-width: 16rem;
}
</style>
