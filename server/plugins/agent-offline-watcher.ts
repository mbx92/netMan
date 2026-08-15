/**
 * Catches agents whose connection died without a clean WebSocket close event
 * (process killed, network partition) — connect.ts's close/error handlers
 * cover the graceful-disconnect case immediately; this plugin is the
 * server-side backstop for everything else. Modeled on
 * hotspot-unbound-watcher.ts's Nitro-plugin-with-setInterval pattern.
 */
import prisma from '../utils/prisma'
import { agentManager } from '../utils/agent-manager'
import { closeAllForAgent } from '../utils/agent-tunnel'
import { clearBreachStreaks } from '../utils/agent-alerts'
import { publishNotification } from '../utils/notification-bus'

const SWEEP_INTERVAL_MS = Number(process.env.AGENT_OFFLINE_SWEEP_MS) || 30_000
const STALE_AFTER_MS = Number(process.env.AGENT_OFFLINE_THRESHOLD_MS) || 90_000 // ~3x expected heartbeat interval

export default defineNitroPlugin((nitroApp) => {
    let running = false
    const timer = setInterval(() => {
        if (running) return
        running = true
        sweepStaleAgents().finally(() => {
            running = false
        })
    }, SWEEP_INTERVAL_MS)

    nitroApp.hooks.hook('close', () => clearInterval(timer))
})

async function sweepStaleAgents() {
    const cutoff = new Date(Date.now() - STALE_AFTER_MS)

    const stale = await prisma.agent.findMany({
        where: { status: 'ONLINE', OR: [{ lastSeen: null }, { lastSeen: { lt: cutoff } }] },
    })

    for (const agent of stale) {
        try {
            agentManager.unregisterByAgentId(agent.id)
            closeAllForAgent(agent.id)
            clearBreachStreaks(agent.id)

            await prisma.agent.update({ where: { id: agent.id }, data: { status: 'OFFLINE' } })

            if (agent.deviceId) {
                await prisma.device.update({ where: { id: agent.deviceId }, data: { status: 'OFFLINE' } }).catch(() => { })
            }

            const dedupeKey = `agent-offline:${agent.id}`
            const existing = await prisma.notification.findFirst({ where: { dedupeKey, resolvedAt: null } })
            if (existing) continue

            const notification = await prisma.notification.create({
                data: {
                    type: 'AGENT_OFFLINE',
                    severity: 'warning',
                    title: `${agent.hostname} went offline`,
                    message: `Agent "${agent.hostname}" (${agent.platform}) stopped sending heartbeats.`,
                    link: `/agents/${agent.id}`,
                    dedupeKey,
                    metadata: { agentId: agent.id, platform: agent.platform, lastSeen: agent.lastSeen },
                },
            })
            publishNotification(notification)
        } catch (error) {
            console.error(`[AgentOfflineWatcher] Failed to process agent ${agent.id}:`, error)
        }
    }
}
