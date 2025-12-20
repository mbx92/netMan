/**
 * VNC WebSocket Proxy
 * Proxies WebSocket to VNC TCP connection for noVNC client
 * 
 * noVNC connects via: ws://server/api/remote/vnc?host=x&port=y&deviceId=z
 */
import { Socket } from 'net'
import { remoteManager } from '../../utils/remote-manager'
import prisma from '../../utils/prisma'

export default defineWebSocketHandler({
    async open(peer) {
        console.log(`[VNC] WebSocket opened: ${peer.id}`)

        // Get connection params from URL query
        const url = new URL(peer.request?.url || '', 'http://localhost')
        const host = url.searchParams.get('host')
        const port = parseInt(url.searchParams.get('port') || '5900', 10)
        const deviceId = url.searchParams.get('deviceId')

        if (!host || !deviceId) {
            console.log('[VNC] Missing host or deviceId, waiting for connect message')
            return
        }

        // Start connection immediately if params provided
        await startConnection(peer, { host, port, deviceId })
    },

    async message(peer, message) {
        // noVNC sends binary data directly
        if (message instanceof ArrayBuffer || ArrayBuffer.isView(message)) {
            handleBinaryData(peer, message)
            return
        }

        // Handle JSON control messages (legacy/manual connect)
        try {
            const text = typeof message === 'string' ? message : message.text()
            const data = JSON.parse(text)

            switch (data.type) {
                case 'connect':
                    await startConnection(peer, {
                        host: data.host,
                        port: data.port,
                        deviceId: data.deviceId
                    })
                    break
                case 'disconnect':
                    handleDisconnect(peer)
                    break
                default:
                    // Treat as binary
                    handleBinaryData(peer, message)
            }
        } catch (e) {
            // Not JSON, treat as binary VNC data
            handleBinaryData(peer, message)
        }
    },

    close(peer) {
        console.log(`[VNC] WebSocket closed: ${peer.id}`)
        handleDisconnect(peer)
    },

    error(peer, error) {
        console.error(`[VNC] WebSocket error for ${peer.id}:`, error)
        handleDisconnect(peer)
    }
})

// Store VNC sockets by peer ID
const vncSockets = new Map<string, Socket>()

interface ConnectParams {
    host: string
    port: number
    deviceId: string
}

async function startConnection(peer: any, params: ConnectParams) {
    // Check if already connected
    if (vncSockets.has(peer.id)) {
        console.log('[VNC] Already connected, ignoring duplicate connect')
        return
    }

    // Check connection limit
    if (!remoteManager.canAccept()) {
        console.log('[VNC] Connection limit reached')
        peer.send(JSON.stringify({
            type: 'error',
            message: `Maximum connections reached (${remoteManager.getMaxConnections()}). Please try again later.`
        }))
        return
    }

    // Get device info
    let deviceName = 'Unknown'
    try {
        const device = await prisma.device.findUnique({
            where: { id: params.deviceId },
            select: { name: true }
        })
        if (device) deviceName = device.name
    } catch (e) {
        console.error('[VNC] Failed to get device info:', e)
    }

    const connectionId = `vnc-${peer.id}`
    const socket = new Socket()

    // Store socket immediately to prevent duplicates
    vncSockets.set(peer.id, socket)

    socket.on('connect', async () => {
        console.log(`[VNC] TCP connected to ${params.host}:${params.port}`)

        // Disable timeout after successful connection
        socket.setTimeout(0)

        // Create audit log
        let sessionId: string | undefined
        try {
            const session = await prisma.remoteSession.create({
                data: {
                    user: 'vnc-user',
                    targetId: params.deviceId,
                    protocol: 'VNC',
                }
            })
            sessionId = session.id
                ; (socket as any).sessionId = sessionId
        } catch (e) {
            console.error('[VNC] Failed to create session log:', e)
        }

        // Register connection
        remoteManager.add({
            id: connectionId,
            type: 'vnc',
            deviceId: params.deviceId,
            deviceName,
            targetIp: params.host,
            targetPort: params.port,
            user: 'vnc-user',
            startedAt: new Date(),
            sessionId
        })
    })

    socket.on('data', (data: Buffer) => {
        // Forward VNC data to WebSocket as binary
        try {
            peer.send(data)
        } catch (e) {
            console.error('[VNC] Failed to send data to WebSocket:', e)
        }
    })

    socket.on('error', (err) => {
        console.error(`[VNC] Socket error:`, err.message)
        // Try to notify client
        try {
            peer.send(JSON.stringify({
                type: 'error',
                message: `VNC connection failed: ${err.message}`
            }))
        } catch { }
        cleanup(peer.id, connectionId)
    })

    socket.on('close', () => {
        console.log(`[VNC] Socket closed`)
        const sessionId = (socket as any).sessionId
        cleanup(peer.id, connectionId, sessionId)
    })

    socket.on('timeout', () => {
        console.log(`[VNC] Socket timeout during connection`)
        try {
            peer.send(JSON.stringify({
                type: 'error',
                message: 'VNC connection timeout'
            }))
        } catch { }
        socket.destroy()
        cleanup(peer.id, connectionId)
    })

    // Connect with 30 second timeout
    console.log(`[VNC] Connecting to ${params.host}:${params.port}...`)
    socket.setTimeout(30000)
    socket.connect(params.port, params.host)
}

function handleBinaryData(peer: any, data: any) {
    const socket = vncSockets.get(peer.id)
    if (socket && socket.writable) {
        // Convert to Buffer if needed
        let buffer: Buffer
        if (data instanceof ArrayBuffer) {
            buffer = Buffer.from(data)
        } else if (ArrayBuffer.isView(data)) {
            buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
        } else if (typeof data === 'string') {
            buffer = Buffer.from(data, 'binary')
        } else if (data.text) {
            buffer = Buffer.from(data.text(), 'binary')
        } else {
            buffer = Buffer.from(data)
        }
        socket.write(buffer)
    }
}

function handleDisconnect(peer: any) {
    const connectionId = `vnc-${peer.id}`
    const socket = vncSockets.get(peer.id)
    const sessionId = socket ? (socket as any).sessionId : undefined
    cleanup(peer.id, connectionId, sessionId)
}

async function cleanup(peerId: string, connectionId: string, sessionId?: string) {
    // Close socket
    const socket = vncSockets.get(peerId)
    if (socket) {
        try { socket.destroy() } catch { }
        vncSockets.delete(peerId)
    }

    // Remove from connection manager
    remoteManager.remove(connectionId)

    // Update session end time
    if (sessionId) {
        try {
            await prisma.remoteSession.update({
                where: { id: sessionId },
                data: { endedAt: new Date() }
            })
        } catch (e) {
            console.error('[VNC] Failed to update session:', e)
        }
    }
}
