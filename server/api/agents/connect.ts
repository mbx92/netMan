/**
 * Agent persistent connection.
 * A single outbound WebSocket an enrolled agent holds open for its entire
 * lifetime: first message is `hello` (auth), followed by periodic
 * `heartbeat` messages carrying live telemetry. SSH/VNC tunnel sessions
 * (see server/utils/agent-tunnel.ts) multiplex over this same connection —
 * `tunnel-*` JSON control frames (text) plus channelId-prefixed binary
 * frames carrying the actual proxied bytes.
 */
import prisma from '../../utils/prisma'
import { verifySecret } from '../../utils/agent-auth'
import { agentManager } from '../../utils/agent-manager'
import { publishNotification } from '../../utils/notification-bus'
import { closeAllForAgent, handleTunnelControl, handleTunnelData } from '../../utils/agent-tunnel'

interface HelloMessage {
    type: 'hello'
    agentId: string
    authKey: string
}

interface HeartbeatMessage {
    type: 'heartbeat'
    cpuPercent?: number
    memPercent?: number
    diskPercent?: number
    uptimeSec?: number
}

type AgentMessage = HelloMessage | HeartbeatMessage | { type: string;[key: string]: unknown }

export default defineWebSocketHandler({
    open(peer) {
        console.log(`[AgentConnect] WebSocket opened: ${peer.id}`)
    },

    async message(peer, message) {
        // Tunnel data (SSH/VNC bytes) arrives as binary frames: [4-byte channelId][payload].
        // Everything else (hello, heartbeat, tunnel-open/ready/error/close) is JSON text.
        if (message instanceof ArrayBuffer || ArrayBuffer.isView(message)) {
            handleTunnelBinary(peer, message)
            return
        }

        let data: AgentMessage
        try {
            data = JSON.parse(typeof message === 'string' ? message : message.text())
        } catch {
            peer.send(JSON.stringify({ type: 'error', message: 'Invalid message' }))
            return
        }

        switch (data.type) {
            case 'hello':
                await handleHello(peer, data as HelloMessage)
                break
            case 'heartbeat':
                await handleHeartbeat(peer, data as HeartbeatMessage)
                break
            case 'tunnel-ready':
            case 'tunnel-error':
            case 'tunnel-close': {
                const connected = agentManager.getByPeerId(peer.id)
                if (connected) handleTunnelControl(connected.agentId, data as { type: string; channelId: number; message?: string })
                break
            }
        }
    },

    close(peer) {
        console.log(`[AgentConnect] WebSocket closed: ${peer.id}`)
        void handleDisconnect(peer)
    },

    error(peer, error) {
        console.error(`[AgentConnect] WebSocket error for ${peer.id}:`, error)
        void handleDisconnect(peer)
    },
})

function handleTunnelBinary(peer: any, message: ArrayBuffer | ArrayBufferView) {
    const buffer = message instanceof ArrayBuffer
        ? Buffer.from(message)
        : Buffer.from(message.buffer, message.byteOffset, message.byteLength)

    if (buffer.length < 4) return

    const connected = agentManager.getByPeerId(peer.id)
    if (!connected) return

    const channelId = buffer.readUInt32BE(0)
    handleTunnelData(connected.agentId, channelId, buffer.subarray(4))
}

async function handleHello(peer: any, msg: HelloMessage) {
    if (!msg.agentId || !msg.authKey) {
        peer.send(JSON.stringify({ type: 'error', message: 'agentId and authKey are required' }))
        peer.close()
        return
    }

    const agent = await prisma.agent.findUnique({ where: { id: msg.agentId } })
    if (!agent || !(await verifySecret(msg.authKey, agent.authKeyHash))) {
        peer.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }))
        peer.close()
        return
    }

    const remoteIp = peer.request?.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim()
        || peer.remoteAddress
        || null

    agentManager.register(agent.id, peer, { hostname: agent.hostname, platform: agent.platform })

    await prisma.agent.update({
        where: { id: agent.id },
        data: { status: 'ONLINE', lastSeen: new Date(), lastIp: remoteIp || undefined },
    })

    if (agent.deviceId) {
        await prisma.device.update({
            where: { id: agent.deviceId },
            data: { status: 'ONLINE', lastSeen: new Date() },
        }).catch(() => { })
    }

    // Resolve any outstanding "agent offline" alert raised by the offline-watcher plugin.
    const resolved = await prisma.notification.updateMany({
        where: { dedupeKey: `agent-offline:${agent.id}`, resolvedAt: null },
        data: { resolvedAt: new Date() },
    })
    if (resolved.count > 0) {
        const note = await prisma.notification.create({
            data: {
                type: 'AGENT_ONLINE',
                severity: 'info',
                title: `${agent.hostname} is back online`,
                message: `Agent "${agent.hostname}" reconnected.`,
                link: `/agents/${agent.id}`,
                dedupeKey: `agent-online:${agent.id}:${Date.now()}`,
                metadata: { agentId: agent.id, platform: agent.platform },
            },
        })
        publishNotification(note)
    }

    peer.send(JSON.stringify({ type: 'hello-ack', agentId: agent.id }))
}

async function handleHeartbeat(peer: any, msg: HeartbeatMessage) {
    const connected = agentManager.getByPeerId(peer.id)
    if (!connected) {
        peer.send(JSON.stringify({ type: 'error', message: 'Not authenticated — send hello first' }))
        return
    }

    await prisma.agent.update({
        where: { id: connected.agentId },
        data: {
            lastSeen: new Date(),
            lastCpuPercent: msg.cpuPercent,
            lastMemPercent: msg.memPercent,
            lastDiskPercent: msg.diskPercent,
            lastUptimeSec: msg.uptimeSec,
        },
    }).catch((e) => console.error('[AgentConnect] Failed to record heartbeat:', e))
}

async function handleDisconnect(peer: any) {
    const agentId = agentManager.unregisterByPeerId(peer.id)
    if (!agentId) return

    closeAllForAgent(agentId)

    const agent = await prisma.agent.update({
        where: { id: agentId },
        data: { status: 'OFFLINE' },
    }).catch(() => null)

    if (agent?.deviceId) {
        await prisma.device.update({
            where: { id: agent.deviceId },
            data: { status: 'OFFLINE' },
        }).catch(() => { })
    }
}
