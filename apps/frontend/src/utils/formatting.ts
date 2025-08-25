export function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp)
    return date.toLocaleTimeString()
}

export function formatDuration(duration: number): string {
    if (duration < 1000) {
        return `${duration}ms`
    } else {
        return `${(duration / 1000).toFixed(2)}s`
    }
}

export function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function formatMessageType(type: string): string {
    switch (type) {
        case 'text': return 'TEXT'
        case 'binary': return 'BIN'
        case 'ping': return 'PING'
        case 'pong': return 'PONG'
        case 'close': return 'CLOSE'
        default: return type.toUpperCase()
    }
}

export function getMessagePreview(message: any): string {
    if (['ping', 'pong', 'close'].includes(message.messageType)) {
        return message.sample
    }

    if (message.messageType === 'binary') {
        return `Binary data (${message.content.size} bytes)`
    }

    const sample = message.sample
    if (sample.length > 50) {
        return sample.substring(0, 50) + '...'
    }
    return sample
}
