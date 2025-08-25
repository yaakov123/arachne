import net from 'node:net'

export interface SocketInfo {
    remoteAddress?: string
    remotePort?: number
    localAddress?: string
    localPort?: number
    destroyed: boolean
    readable: boolean
    writable: boolean
}

export function getSocketInfo(socket: net.Socket): SocketInfo {
    return {
        remoteAddress: socket.remoteAddress,
        remotePort: socket.remotePort,
        localAddress: socket.localAddress,
        localPort: socket.localPort,
        destroyed: socket.destroyed,
        readable: socket.readable,
        writable: socket.writable
    }
}

export function getRemote(s: net.Socket): string | undefined {
    const a = s.remoteAddress
    const p = s.remotePort
    return a ? `${a}${p ? ':' + p : ''}` : undefined
}
