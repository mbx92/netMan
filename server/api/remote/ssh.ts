/**
 * SSH WebSocket Handler
 * Provides SSH terminal access via WebSocket
 */
import { Client } from 'ssh2'
import { remoteManager } from '../../utils/remote-manager'
import { agentManager } from '../../utils/agent-manager'
import { openTunnel, type OpenTunnelResult } from '../../utils/agent-tunnel'
import prisma from '../../utils/prisma'

interface SSHConnectParams {
    deviceId: string
    host: string
    port: number
    username: string
    password: string
}

export default defineWebSocketHandler({
    open(peer) {
        console.log(`[SSH] WebSocket opened: ${peer.id}`)
    },

    async message(peer, message) {
        const data = JSON.parse(message.text())

        // Handle different message types
        switch (data.type) {
            case 'connect':
                await handleConnect(peer, data)
                break
            case 'data':
                handleData(peer, data.data)
                break
            case 'resize':
                handleResize(peer, data.cols, data.rows)
                break
            case 'disconnect':
                handleDisconnect(peer)
                break
        }
    },

    close(peer) {
        console.log(`[SSH] WebSocket closed: ${peer.id}`)
        handleDisconnect(peer)
    },

    error(peer, error) {
        console.error(`[SSH] WebSocket error for ${peer.id}:`, error)
        handleDisconnect(peer)
    }
})

// Store SSH clients and streams by peer ID
const sshClients = new Map<string, Client>()
const sshStreams = new Map<string, any>()
const sshTunnels = new Map<string, OpenTunnelResult>()

async function handleConnect(peer: any, params: SSHConnectParams) {
    // Check connection limit
    if (!remoteManager.canAccept()) {
        peer.send(JSON.stringify({
            type: 'error',
            message: `Maximum connections reached (${remoteManager.getMaxConnections()}). Please try again later.`
        }))
        return
    }

    // Get device info, and — if it's backed by an online Linux agent rather than
    // being directly reachable on the LAN — relay through its tunnel instead of
    // dialing params.host/params.port directly.
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
        if (agent && agent.platform !== 'WINDOWS' && agentManager.isOnline(agent.id)) {
            const tunnel = await openTunnel(agent.id, 'ssh')
            sshTunnels.set(peer.id, tunnel)
            connectHost = '127.0.0.1'
            connectPort = tunnel.localPort
            viaAgentId = agent.id
        }
    } catch (e) {
        console.error('[SSH] Failed to get device info:', e)
        peer.send(JSON.stringify({ type: 'error', message: 'Failed to prepare connection' }))
        return
    }

    const client = new Client()
    const connectionId = `ssh-${peer.id}`

    client.on('ready', async () => {
        console.log(`[SSH] Connected to ${connectHost}:${connectPort} as ${params.username}${viaAgentId ? ' (via agent tunnel)' : ''}`)

        // Create audit log
        let sessionId: string | undefined
        try {
            const session = await prisma.remoteSession.create({
                data: {
                    user: params.username,
                    targetId: params.deviceId,
                    protocol: 'SSH',
                    viaAgentId,
                }
            })
            sessionId = session.id
        } catch (e) {
            console.error('[SSH] Failed to create session log:', e)
        }

        // Register connection
        remoteManager.add({
            id: connectionId,
            type: 'ssh',
            deviceId: params.deviceId,
            deviceName,
            targetIp: connectHost,
            targetPort: connectPort,
            user: params.username,
            startedAt: new Date(),
            sessionId
        })

        // Open shell
        client.shell({ term: 'xterm-256color' }, (err, stream) => {
            if (err) {
                peer.send(JSON.stringify({
                    type: 'error',
                    message: `Failed to open shell: ${err.message}`
                }))
                return
            }

            sshStreams.set(peer.id, stream)

            // Notify client of successful connection
            peer.send(JSON.stringify({ type: 'connected' }))

            // Pipe SSH output to WebSocket
            stream.on('data', (data: Buffer) => {
                peer.send(JSON.stringify({
                    type: 'data',
                    data: data.toString('utf8')
                }))
            })

            stream.on('close', () => {
                console.log(`[SSH] Stream closed for ${peer.id}`)
                peer.send(JSON.stringify({ type: 'disconnected' }))
                cleanup(peer.id, connectionId, sessionId)
            })
        })
    })

    client.on('error', (err) => {
        console.error(`[SSH] Connection error:`, err.message)
        peer.send(JSON.stringify({
            type: 'error',
            message: `SSH connection failed: ${err.message}`
        }))
        cleanup(peer.id, connectionId)
    })

    client.on('close', () => {
        console.log(`[SSH] Connection closed`)
        cleanup(peer.id, connectionId)
    })

    // Store client
    sshClients.set(peer.id, client)

    // Connect
    try {
        client.connect({
            host: connectHost,
            port: connectPort,
            username: params.username,
            password: params.password,
            readyTimeout: 15000,
            keepaliveInterval: 10000,
        })
    } catch (err: any) {
        peer.send(JSON.stringify({
            type: 'error',
            message: `Failed to connect: ${err.message}`
        }))
    }
}

function handleData(peer: any, data: string) {
    const stream = sshStreams.get(peer.id)
    if (stream) {
        stream.write(data)
    }
}

function handleResize(peer: any, cols: number, rows: number) {
    const stream = sshStreams.get(peer.id)
    if (stream) {
        stream.setWindow(rows, cols, 0, 0)
    }
}

function handleDisconnect(peer: any) {
    const connectionId = `ssh-${peer.id}`
    const connection = remoteManager.get(connectionId)
    cleanup(peer.id, connectionId, connection?.sessionId)
}

async function cleanup(peerId: string, connectionId: string, sessionId?: string) {
    // Close stream
    const stream = sshStreams.get(peerId)
    if (stream) {
        try { stream.close() } catch { }
        sshStreams.delete(peerId)
    }

    // Close client
    const client = sshClients.get(peerId)
    if (client) {
        try { client.end() } catch { }
        sshClients.delete(peerId)
    }

    // Remove from connection manager
    remoteManager.remove(connectionId)

    // Tear down the agent tunnel relay, if this session used one
    const tunnel = sshTunnels.get(peerId)
    if (tunnel) {
        tunnel.close()
        sshTunnels.delete(peerId)
    }

    // Update session end time
    if (sessionId) {
        try {
            await prisma.remoteSession.update({
                where: { id: sessionId },
                data: { endedAt: new Date() }
            })
        } catch (e) {
            console.error('[SSH] Failed to update session:', e)
        }
    }
}
