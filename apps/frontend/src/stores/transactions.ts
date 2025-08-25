import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { wsClient } from '../services/ws'
import type { 
    TransactionCompleteEvent, 
    TransactionData, 
    TransactionDependency,
    WebSocketUpgradeEvent,
    WebSocketMessageEvent,
    WebSocketCloseEvent,
    BackendEvent,
    RequestURL,
    DisplayHeader,
    ContentInfo
} from '@arachne/api-types'

export type TransactionWithMeta = TransactionData & { 
    id: string
    timestamp: number 
    dependencies?: TransactionDependency[]
}

// WebSocket data models
export interface WebSocketConnectionWithMeta {
    id: string
    connectionId: string
    url: RequestURL
    protocols: string[]
    headers: DisplayHeader[]
    status: 'connected' | 'closed' | 'error'
    timestamp: number
    closeCode?: number
    closeReason?: string
    messageCount: number
    lastActivity: number
}

export interface WebSocketMessageWithMeta {
    id: string
    connectionId: string
    direction: 'client-to-server' | 'server-to-client'
    messageType: 'text' | 'binary' | 'ping' | 'pong' | 'close'
    content: ContentInfo
    sample: string
    timestamp: number
    connection?: WebSocketConnectionWithMeta
}

export type ViewMode = 'http' | 'websocket' | 'mixed'

// Unified traffic entry types
export type TrafficEntryType = 'http-transaction' | 'websocket-connection' | 'websocket-message'

export interface BaseTrafficEntry {
    id: string
    type: TrafficEntryType
    timestamp: number
    host: string
}

export interface HttpTrafficEntry extends BaseTrafficEntry {
    type: 'http-transaction'
    transaction: TransactionWithMeta
}

export interface WebSocketConnectionTrafficEntry extends BaseTrafficEntry {
    type: 'websocket-connection'
    connection: WebSocketConnectionWithMeta
}

export interface WebSocketMessageTrafficEntry extends BaseTrafficEntry {
    type: 'websocket-message'
    message: WebSocketMessageWithMeta
}

export type TrafficEntry = HttpTrafficEntry | WebSocketConnectionTrafficEntry | WebSocketMessageTrafficEntry

export const useTransactionsStore = defineStore('transactions', () => {
    // HTTP Transaction State
    const transactions = ref<TransactionWithMeta[]>([])
    const selectedTransaction = ref<TransactionWithMeta | null>(null)
    const selectedHost = ref<string | null>(null)
    const isConnected = ref(false)
    const connectionError = ref<string | null>(null)
    const searchQuery = ref<string>('')

    // WebSocket State
    const websocketConnections = ref<Map<string, WebSocketConnectionWithMeta>>(new Map())
    const websocketMessages = ref<WebSocketMessageWithMeta[]>([])
    const selectedWebSocketConnection = ref<WebSocketConnectionWithMeta | null>(null)
    const selectedWebSocketMessage = ref<WebSocketMessageWithMeta | null>(null)
    const viewMode = ref<ViewMode>('mixed')
    const websocketSearchQuery = ref<string>('')

    // Unified Traffic State
    const selectedTrafficEntry = ref<TrafficEntry | null>(null)

    // Computed
    const uniqueHosts = computed(() => {
        const hosts = new Set<string>()
        transactions.value.forEach(t => hosts.add(t.request.url.host))
        websocketConnections.value.forEach(conn => hosts.add(conn.url.host))
        return Array.from(hosts).sort()
    })

    const websocketConnectionsList = computed(() => {
        return Array.from(websocketConnections.value.values()).sort((a, b) => b.timestamp - a.timestamp)
    })



    // Unified traffic entries
    const unifiedTrafficEntries = computed(() => {
        const entries: TrafficEntry[] = []

        // Add HTTP transactions
        if (viewMode.value === 'http' || viewMode.value === 'mixed') {
            transactions.value.forEach(transaction => {
                entries.push({
                    id: `http-${transaction.id}`,
                    type: 'http-transaction',
                    timestamp: transaction.timestamp,
                    host: transaction.request.url.host,
                    transaction
                })
            })
        }

        // Add WebSocket connections
        if (viewMode.value === 'websocket' || viewMode.value === 'mixed') {
            websocketConnectionsList.value.forEach(connection => {
                entries.push({
                    id: `ws-conn-${connection.connectionId}`,
                    type: 'websocket-connection',
                    timestamp: connection.timestamp,
                    host: connection.url.host,
                    connection
                })
            })

            // Add WebSocket messages
            websocketMessages.value.forEach(message => {
                entries.push({
                    id: `ws-msg-${message.id}`,
                    type: 'websocket-message',
                    timestamp: message.timestamp,
                    host: message.connection?.url.host || 'unknown',
                    message
                })
            })
        }

        // Sort by timestamp (newest first)
        return entries.sort((a, b) => b.timestamp - a.timestamp)
    })

    const filteredTrafficEntries = computed(() => {
        let filtered = unifiedTrafficEntries.value

        // Host filter
        if (selectedHost.value) {
            filtered = filtered.filter(entry => entry.host === selectedHost.value)
        }

        // Search filter
        const currentQuery = viewMode.value === 'websocket' ? websocketSearchQuery.value : searchQuery.value
        if (currentQuery) {
            const query = currentQuery.toLowerCase()
            filtered = filtered.filter(entry => {
                switch (entry.type) {
                    case 'http-transaction':
                        return entry.transaction.request.url.full.toLowerCase().includes(query) ||
                               entry.transaction.request.url.path.toLowerCase().includes(query)
                    case 'websocket-connection':
                        return entry.connection.url.full.toLowerCase().includes(query) ||
                               entry.connection.url.path.toLowerCase().includes(query)
                    case 'websocket-message':
                        return entry.message.sample.toLowerCase().includes(query) ||
                               (entry.message.connection && entry.message.connection.url.full.toLowerCase().includes(query))
                    default:
                        return false
                }
            })
        }

        return filtered
    })

    const filteredTransactions = computed(() => {
        let filtered = transactions.value

        // Host filter
        if (selectedHost.value) {
            filtered = filtered.filter(t => t.request.url.host === selectedHost.value)
        }

        // URL/Path search filter
        if (searchQuery.value) {
            const query = searchQuery.value.toLowerCase()
            filtered = filtered.filter(t => 
                t.request.url.full.toLowerCase().includes(query) ||
                t.request.url.path.toLowerCase().includes(query)
            )
        }

        return filtered
    })

    const dependencyGraph = computed(() => {
        const graph = new Map<string, string[]>() // transactionId -> [dependent transactionIds]
        
        for (const transaction of transactions.value) {
            if (transaction.dependencies && transaction.dependencies.length > 0) {
                for (const dep of transaction.dependencies) {
                    if (!graph.has(dep.sourceTransactionId)) {
                        graph.set(dep.sourceTransactionId, [])
                    }
                    graph.get(dep.sourceTransactionId)!.push(transaction.id)
                }
            }
        }
        
        return graph
    })

    const transactionDependencies = computed(() => {
        const deps = new Map<string, TransactionDependency[]>() // transactionId -> dependencies
        
        for (const transaction of transactions.value) {
            if (transaction.dependencies && transaction.dependencies.length > 0) {
                deps.set(transaction.id, transaction.dependencies)
            }
        }
        
        return deps
    })

    // Actions
    function addTransaction(transactionEvent: TransactionCompleteEvent) {
        const transactionWithMeta: TransactionWithMeta = {
            ...transactionEvent.transaction,
            id: transactionEvent.id,
            timestamp: new Date(transactionEvent.ts).getTime(),
            dependencies: transactionEvent.dependencies
        }
        
        // Add to beginning of array (newest first)
        transactions.value.unshift(transactionWithMeta)
        
        // Keep only last 1000 transactions to prevent memory issues
        if (transactions.value.length > 1000) {
            transactions.value = transactions.value.slice(0, 1000)
        }
    }



    function selectHost(host: string) {
        selectedHost.value = selectedHost.value === host ? null : host
    }

    function getHostCount(host: string): number {
        const httpCount = transactions.value.filter(t => t.request.url.host === host).length
        const wsCount = Array.from(websocketConnections.value.values()).filter(conn => conn.url.host === host).length
        return httpCount + wsCount
    }

    function getWebSocketHostCount(host: string): number {
        return Array.from(websocketConnections.value.values()).filter(conn => conn.url.host === host).length
    }

    function clearTransactions() {
        transactions.value = []
        clearTrafficSelection()
    }

    function updateSearchQuery(query: string) {
        searchQuery.value = query
    }

    function clearSearch() {
        searchQuery.value = ''
    }

    // WebSocket event handler
    function handleWebSocketEvent(event: BackendEvent) {
        switch (event.type) {
            case 'transactionComplete':
                addTransaction(event as TransactionCompleteEvent)
                break
            case 'webSocketUpgrade':
                handleWebSocketUpgrade(event as WebSocketUpgradeEvent)
                break
            case 'webSocketMessage':
                handleWebSocketMessage(event as WebSocketMessageEvent)
                break
            case 'webSocketClose':
                handleWebSocketClose(event as WebSocketCloseEvent)
                break
        }
    }

    // WebSocket connection management functions
    function handleWebSocketUpgrade(event: WebSocketUpgradeEvent) {
        const connection: WebSocketConnectionWithMeta = {
            id: event.id,
            connectionId: event.connectionId,
            url: event.url,
            protocols: event.protocols,
            headers: event.headers,
            status: 'connected',
            timestamp: new Date(event.ts).getTime(),
            messageCount: 0,
            lastActivity: new Date(event.ts).getTime()
        }
        
        websocketConnections.value.set(event.connectionId, connection)
    }

    function handleWebSocketMessage(event: WebSocketMessageEvent) {
        const connection = websocketConnections.value.get(event.connectionId)
        if (connection) {
            connection.messageCount++
            connection.lastActivity = event.timestamp
        }

        const message: WebSocketMessageWithMeta = {
            id: event.id,
            connectionId: event.connectionId,
            direction: event.direction,
            messageType: event.messageType,
            content: event.content,
            sample: event.sample,
            timestamp: event.timestamp,
            connection: connection
        }

        // Add to beginning of array (newest first)
        websocketMessages.value.unshift(message)

        // Keep only last 1000 messages to prevent memory issues
        if (websocketMessages.value.length > 1000) {
            websocketMessages.value = websocketMessages.value.slice(0, 1000)
        }
    }

    function handleWebSocketClose(event: WebSocketCloseEvent) {
        const connection = websocketConnections.value.get(event.connectionId)
        if (connection) {
            connection.status = 'closed'
            connection.closeCode = event.code
            connection.closeReason = event.reason
            connection.lastActivity = event.timestamp
        }
    }



    function setViewMode(mode: ViewMode) {
        viewMode.value = mode
        // Clear selection when switching modes
        clearTrafficSelection()
    }

    function updateWebSocketSearchQuery(query: string) {
        websocketSearchQuery.value = query
    }

    function clearWebSocketSearch() {
        websocketSearchQuery.value = ''
    }

    function clearWebSocketData() {
        websocketConnections.value.clear()
        websocketMessages.value = []
        clearTrafficSelection()
    }

    // Unified traffic selection functions
    function selectTrafficEntry(entry: TrafficEntry) {
        selectedTrafficEntry.value = entry
        
        // Clear individual selections
        selectedTransaction.value = null
        selectedWebSocketConnection.value = null
        selectedWebSocketMessage.value = null
        
        // Set appropriate individual selection based on entry type
        switch (entry.type) {
            case 'http-transaction':
                selectedTransaction.value = entry.transaction
                break
            case 'websocket-connection':
                selectedWebSocketConnection.value = entry.connection
                break
            case 'websocket-message':
                selectedWebSocketMessage.value = entry.message
                // Also select the connection for context
                if (entry.message.connection) {
                    selectedWebSocketConnection.value = entry.message.connection
                }
                break
        }
    }

    function clearTrafficSelection() {
        selectedTrafficEntry.value = null
        selectedTransaction.value = null
        selectedWebSocketConnection.value = null
        selectedWebSocketMessage.value = null
    }

    // Helper function to get unified selection
    const hasUnifiedSelection = computed(() => {
        return selectedTrafficEntry.value !== null
    })

    // WebSocket connection management
    async function connect() {
        try {
            connectionError.value = null
            await wsClient.connect()
            isConnected.value = wsClient.isConnected()
            wsClient.on(handleWebSocketEvent)
        } catch (error) {
            connectionError.value = error instanceof Error ? error.message : 'Connection failed'
            isConnected.value = false
            throw error
        }
    }

    function disconnect() {
        wsClient.off(handleWebSocketEvent)
        wsClient.disconnect()
        isConnected.value = false
    }

    // Utility functions
    function formatSize(bytes: number): string {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
    }

    // Dependency helper functions
    function getTransactionDependencies(transactionId: string): TransactionDependency[] {
        return transactionDependencies.value.get(transactionId) || []
    }

    function getDependentTransactions(transactionId: string): TransactionWithMeta[] {
        const dependentIds = dependencyGraph.value.get(transactionId) || []
        return dependentIds.map(id => transactions.value.find(t => t.id === id))
                         .filter(Boolean) as TransactionWithMeta[]
    }

    function getSourceTransaction(dependency: TransactionDependency): TransactionWithMeta | undefined {
        return transactions.value.find(t => t.id === dependency.sourceTransactionId)
    }

    function hasAuthDependencies(transactionId: string): boolean {
        const deps = getTransactionDependencies(transactionId)
        return deps.some(dep => dep.type === 'auth_token' || dep.type === 'cookie')
    }

    function getDependencyChain(transactionId: string): TransactionWithMeta[] {
        const chain: TransactionWithMeta[] = []
        const visited = new Set<string>()
        
        function collectChain(id: string) {
            if (visited.has(id)) return
            visited.add(id)
            
            const transaction = transactions.value.find(t => t.id === id)
            if (!transaction) return
            
            chain.push(transaction)
            
            // Follow dependencies backwards
            const deps = getTransactionDependencies(id)
            for (const dep of deps) {
                collectChain(dep.sourceTransactionId)
            }
        }
        
        collectChain(transactionId)
        return chain.reverse() // Order from source to target
    }

    return {
        // HTTP Transaction State
        transactions,
        selectedTransaction,
        selectedHost,
        isConnected,
        connectionError,
        searchQuery,
        
        // WebSocket State
        websocketConnections,
        websocketMessages,
        selectedWebSocketConnection,
        selectedWebSocketMessage,
        viewMode,
        websocketSearchQuery,
        
        // Computed
        uniqueHosts,
        filteredTransactions,
        websocketConnectionsList,
        unifiedTrafficEntries,
        filteredTrafficEntries,
        hasUnifiedSelection,
        dependencyGraph,
        transactionDependencies,
        
        // Actions
        addTransaction,
        selectHost,
        getHostCount,
        getWebSocketHostCount,
        clearTransactions,
        updateSearchQuery,
        clearSearch,
        connect,
        disconnect,
        formatSize,
        setViewMode,
        updateWebSocketSearchQuery,
        clearWebSocketSearch,
        clearWebSocketData,
        
        // Unified Traffic Actions
        selectTrafficEntry,
        clearTrafficSelection,
        selectedTrafficEntry,
        
        // Dependency helpers
        getTransactionDependencies,
        getDependentTransactions,
        getSourceTransaction,
        hasAuthDependencies,
        getDependencyChain
    }
})
