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
import { checkResourceThresholds, clearBreachStreaks } from '../../utils/agent-alerts'
import { updateDeviceNetworkInfo } from '../../utils/device-network-info'
import { resolveAgentCommand } from '../../utils/agent-commands'

interface HardwareDisk { model?: string; vendor?: string }
interface HardwareInfo {
    disks?: HardwareDisk[]
    memory?: { slotsTotal?: number; slotsUsed?: number; type?: string }
}

interface HelloMessage {
    type: 'hello'
    agentId: string
    authKey: string
    macAddress?: string
    localIp?: string
    vncPassword?: string
    agentVersion?: string
    hardware?: HardwareInfo
}

interface PartitionUsage { mountpoint: string; percent: number }
interface ProcessInfo { name: string; pid: number; cpuPercent: number; memPercent: number }

interface HeartbeatMessage {
    type: 'heartbeat'
    cpuPercent?: number
    memPercent?: number
    diskPercent?: number
    uptimeSec?: number
    cpuPerCore?: number[]
    swapPercent?: number
    netRxBytesPerSec?: number
    netTxBytesPerSec?: number
    diskReadBytesPerSec?: number
    diskWriteBytesPerSec?: number
    loadAvg1?: number
    loadAvg5?: number
    loadAvg15?: number
    partitions?: PartitionUsage[]
    topProcesses?: ProcessInfo[]
    loggedInUsers?: string[]
}

type AgentMessage = HelloMessage | HeartbeatMessage | { type: string;[key: string]: unknown }

export default defineWebSocketHandler({
    open(peer) {
        console.log(`[AgentConnect] WebSocket opened: ${peer.id}`)
    },

    async message(peer, message) {
        // Tunnel data (SSH/VNC bytes) arrives as binary frames: [4-byte channelId][payload].
        // Everything else (hello, heartbeat, tunnel-open/ready/error/close) is JSON text.
        //
        // crossws's Node adapter discards the WS-protocol binary/text flag (the
        // underlying `ws` lib's `message(data, isBinary)` second argument isn't
        // captured — see node_modules/crossws/dist/adapters/node.mjs), so
        // message.rawData is ALWAYS a Buffer here regardless of original frame
        // type; there is no reliable way to ask "was this frame binary" for this
        // adapter. Content-sniff instead: try JSON first, and only treat it as
        // tunnel binary data on parse failure. Safe in practice — a tunnel frame
        // (random 4-byte channelId header + raw protocol bytes) parsing as valid
        // JSON by coincidence is vanishingly unlikely.
        let data: AgentMessage | undefined
        try {
            data = JSON.parse(message.text())
        } catch {
            // Not JSON — must be tunnel binary data.
        }

        if (!data || typeof data.type !== 'string') {
            handleTunnelBinary(peer, message.uint8Array())
            return
        }

        switch (data.type) {
            case 'hello':
                await handleHello(peer, data as HelloMessage)
                break
            case 'heartbeat':
                await handleHeartbeat(peer, data as HeartbeatMessage)
                break
            case 'kill-process-result':
            case 'power-action-result': {
                const msg = data as { requestId: string; success: boolean; error?: string }
                resolveAgentCommand(msg.requestId, { success: !!msg.success, error: msg.error })
                break
            }
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

function handleTunnelBinary(peer: any, data: Uint8Array) {
    const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength)

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

    // Agent traffic arrives over the Cloudflare Tunnel, so the socket/header
    // IP is always the client's public IP, never its LAN address. Prefer
    // the LAN IP the agent detected and reported itself; fall back to the
    // request-derived IP for agents running an older build that doesn't
    // send localIp yet.
    const remoteIp = msg.localIp
        || peer.request?.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim()
        || peer.remoteAddress
        || null

    agentManager.register(agent.id, peer, { hostname: agent.hostname, platform: agent.platform })

    await prisma.agent.update({
        where: { id: agent.id },
        data: {
            status: 'ONLINE',
            lastSeen: new Date(),
            lastIp: remoteIp || undefined,
            agentVersion: msg.agentVersion || undefined,
            vncPassword: msg.vncPassword || undefined,
            diskInfo: msg.hardware?.disks ?? undefined,
            memorySlotsTotal: msg.hardware?.memory?.slotsTotal ?? undefined,
            memorySlotsUsed: msg.hardware?.memory?.slotsUsed ?? undefined,
            memoryType: msg.hardware?.memory?.type ?? undefined,
        },
    })

    if (agent.deviceId) {
        await prisma.device.update({
            where: { id: agent.deviceId },
            data: { status: 'ONLINE', lastSeen: new Date() },
        }).catch(() => { })
        // Separate from the status/lastSeen update above so a mac unique-
        // collision (handled inside updateDeviceNetworkInfo) can never affect
        // the online-status write.
        await updateDeviceNetworkInfo(agent.deviceId, { ip: remoteIp || undefined, mac: msg.macAddress })
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

    const lastMetrics = {
        cpuPerCore: msg.cpuPerCore,
        swapPercent: msg.swapPercent,
        netRxBytesPerSec: msg.netRxBytesPerSec,
        netTxBytesPerSec: msg.netTxBytesPerSec,
        diskReadBytesPerSec: msg.diskReadBytesPerSec,
        diskWriteBytesPerSec: msg.diskWriteBytesPerSec,
        loadAvg1: msg.loadAvg1,
        loadAvg5: msg.loadAvg5,
        loadAvg15: msg.loadAvg15,
        partitions: msg.partitions,
        topProcesses: msg.topProcesses,
        loggedInUsers: msg.loggedInUsers,
    }

    await prisma.agent.update({
        where: { id: connected.agentId },
        data: {
            lastSeen: new Date(),
            lastCpuPercent: msg.cpuPercent,
            lastMemPercent: msg.memPercent,
            lastDiskPercent: msg.diskPercent,
            lastUptimeSec: msg.uptimeSec,
            lastMetrics,
        },
    }).catch((e) => console.error('[AgentConnect] Failed to record heartbeat:', e))

    if (msg.cpuPercent != null && msg.memPercent != null && msg.diskPercent != null) {
        await prisma.agentMetricSample.create({
            data: {
                agentId: connected.agentId,
                cpuPercent: msg.cpuPercent,
                memPercent: msg.memPercent,
                diskPercent: msg.diskPercent,
                swapPercent: msg.swapPercent,
                netRxBytesPerSec: msg.netRxBytesPerSec,
                netTxBytesPerSec: msg.netTxBytesPerSec,
                diskReadBytesPerSec: msg.diskReadBytesPerSec,
                diskWriteBytesPerSec: msg.diskWriteBytesPerSec,
                loadAvg1: msg.loadAvg1,
            },
        }).catch((e) => console.error('[AgentConnect] Failed to record metric sample:', e))
    }

    await checkResourceThresholds(connected.agentId, connected.hostname, {
        cpuPercent: msg.cpuPercent,
        memPercent: msg.memPercent,
        diskPercent: msg.diskPercent,
    }).catch((e) => console.error('[AgentConnect] Failed to check resource thresholds:', e))
}

async function handleDisconnect(peer: any) {
    const agentId = agentManager.unregisterByPeerId(peer.id)
    if (!agentId) return

    closeAllForAgent(agentId)
    clearBreachStreaks(agentId)

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
