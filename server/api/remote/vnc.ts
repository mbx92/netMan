/**
 * VNC WebSocket Proxy
 * Proxies WebSocket to VNC TCP connection for noVNC client
 * 
 * noVNC connects via: ws://server/api/remote/vnc?host=x&port=y&deviceId=z
 */
import { Socket } from 'net'
import { remoteManager } from '../../utils/remote-manager'
import { agentManager } from '../../utils/agent-manager'
import { openTunnel, type OpenTunnelResult } from '../../utils/agent-tunnel'
import prisma from '../../utils/prisma'

export default defineWebSocketHandler({
    async open(peer) {
        console.log(`[VNC] WebSocket opened: ${peer.id}`)

        // Get connection params from URL query
        const url = new URL(peer.request?.url || '', 'http://localhost')
        console.log(`[VNC] Request URL:`, peer.request?.url)
        console.log(`[VNC] Parsed URL searchParams:`, Array.from(url.searchParams.entries()))

        const host = url.searchParams.get('host')
        const port = parseInt(url.searchParams.get('port') || '5900', 10)
        const deviceId = url.searchParams.get('deviceId')

        if (!host || !deviceId) {
            console.log('[VNC] Missing host or deviceId, waiting for connect message')
            peer.send(JSON.stringify({
                type: 'error',
                message: 'Missing connection parameters. Please close and try again.'
            }))
            return
        }

        // Start connection immediately if params provided
        await startConnection(peer, { host, port, deviceId })
    },

    async message(peer, message) {
        // noVNC sends binary data directly
        if (message instanceof ArrayBuffer || ArrayBuffer.isView(message)) {
            console.log(`[VNC] Received binary message from client: ${message.byteLength || message.length} bytes`)
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
const vncTunnels = new Map<string, OpenTunnelResult>()

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

    // Get device info, and — if it's backed by an online Windows agent rather
    // than being directly reachable on the LAN — relay through its tunnel
    // (dialing its own VNC server on 127.0.0.1:5900) instead of params.host/port.
    let deviceName = 'Unknown'
    let connectHost = params.host
    let connectPort = params.port
    let viaAgentId: string | undefined

    try {
        const device = await prisma.device.findUnique({
            where: { id: params.deviceId },
            select: { name: true, agent: { select: { id: true, platform: true } } },
        })
        if (device) deviceName = device.name

        const agent = device?.agent
        if (agent && agent.platform === 'WINDOWS' && agentManager.isOnline(agent.id)) {
            const tunnel = await openTunnel(agent.id, 'vnc')
            vncTunnels.set(peer.id, tunnel)
            connectHost = '127.0.0.1'
            connectPort = tunnel.localPort
            viaAgentId = agent.id
        }
    } catch (e) {
        console.error('[VNC] Failed to get device info:', e)
        peer.send(JSON.stringify({ type: 'error', message: 'Failed to prepare connection' }))
        return
    }

    const connectionId = `vnc-${peer.id}`
    const socket = new Socket()

    // Store socket immediately to prevent duplicates
    vncSockets.set(peer.id, socket)

    socket.on('connect', async () => {
        console.log(`[VNC] TCP connected to ${connectHost}:${connectPort}${viaAgentId ? ' (via agent tunnel)' : ''}`)

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
                    viaAgentId,
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
            targetIp: connectHost,
            targetPort: connectPort,
            user: 'vnc-user',
            startedAt: new Date(),
            sessionId
        })
    })

    let firstPacket = true
    let packetCount = 0
    socket.on('data', (data: Buffer) => {
        // Forward VNC data to WebSocket as binary
        packetCount++
        try {
            // Log first few packets for debugging
            if (packetCount <= 5) {
                console.log(`[VNC] Packet #${packetCount} from server (${data.length} bytes)${packetCount === 1 ? ': ' + data.toString('utf8').substring(0, 20) : ''}`)
            }
            if (packetCount === 10) {
                console.log(`[VNC] Data flowing, stopping detailed packet logs...`)
            }

            // Send to WebSocket as binary
            peer.send(data)
        } catch (e) {
            console.error('[VNC] Failed to send data to WebSocket:', e)
            console.error('[VNC] Error details:', (e as Error).message, (e as Error).stack)
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
    console.log(`[VNC] Connecting to ${connectHost}:${connectPort}...`)
    socket.setTimeout(30000)
    socket.connect(connectPort, connectHost)
}

// Track client packets per connection
const clientPacketCounts = new Map<string, number>()

function handleBinaryData(peer: any, data: any) {
    const socket = vncSockets.get(peer.id)
    if (!socket || !socket.writable) {
        // Only log once per connection if socket not ready
        const count = clientPacketCounts.get(peer.id) || 0
        if (count === 0) {
            console.log(`[VNC] Cannot send client data - socket not available (will retry silently)`)
        }
        return
    }

    // Increment counter
    const count = (clientPacketCounts.get(peer.id) || 0) + 1
    clientPacketCounts.set(peer.id, count)

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

    // Log first few client packets
    if (count <= 5) {
        console.log(`[VNC] Client packet #${count} (${buffer.length} bytes)`)
    } else if (count === 10) {
        console.log(`[VNC] Client data flowing...`)
    }

    socket.write(buffer)
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

    // Clean up packet counter
    clientPacketCounts.delete(peerId)

    // Remove from connection manager
    remoteManager.remove(connectionId)

    // Tear down the agent tunnel relay, if this session used one
    const tunnel = vncTunnels.get(peerId)
    if (tunnel) {
        tunnel.close()
        vncTunnels.delete(peerId)
    }

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
