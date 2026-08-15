/**
 * Threshold-based resource alerts, evaluated on every heartbeat.
 * Requires AGENT_ALERT_CONSECUTIVE_BREACHES (default 3, ~90s at the default
 * 30s heartbeat interval) consecutive over-threshold samples before firing,
 * so a brief spike doesn't page anyone — mirrors agent-offline-watcher's
 * ~3x-interval philosophy for the same reason. Streak state is in-memory
 * only (per Nitro process): a server restart just means alerts need a fresh
 * run of consecutive breaches, which is fine for a warning-level signal.
 */
import prisma from './prisma'
import { publishNotification } from './notification-bus'

const CONSECUTIVE_BREACHES_REQUIRED = Number(process.env.AGENT_ALERT_CONSECUTIVE_BREACHES) || 3

const THRESHOLDS: Record<Metric, number> = {
    cpu: Number(process.env.AGENT_CPU_ALERT_THRESHOLD) || 90,
    mem: Number(process.env.AGENT_MEM_ALERT_THRESHOLD) || 90,
    disk: Number(process.env.AGENT_DISK_ALERT_THRESHOLD) || 90,
}

const LABELS: Record<Metric, string> = { cpu: 'CPU', mem: 'Memory', disk: 'Disk' }

type Metric = 'cpu' | 'mem' | 'disk'

const breachStreak = new Map<string, number>() // `${agentId}:${metric}` -> consecutive breach count

export async function checkResourceThresholds(
    agentId: string,
    hostname: string,
    metrics: { cpuPercent?: number; memPercent?: number; diskPercent?: number },
): Promise<void> {
    await checkOne(agentId, hostname, 'cpu', metrics.cpuPercent)
    await checkOne(agentId, hostname, 'mem', metrics.memPercent)
    await checkOne(agentId, hostname, 'disk', metrics.diskPercent)
}

/** Called when an agent goes offline/disconnects — a fresh streak should start on reconnect. */
export function clearBreachStreaks(agentId: string): void {
    for (const key of breachStreak.keys()) {
        if (key.startsWith(`${agentId}:`)) breachStreak.delete(key)
    }
}

async function checkOne(agentId: string, hostname: string, metric: Metric, value: number | undefined): Promise<void> {
    if (value == null) return

    const threshold = THRESHOLDS[metric]
    const label = LABELS[metric]
    const key = `${agentId}:${metric}`
    const dedupeKey = `agent-${metric}-high:${agentId}`

    if (value >= threshold) {
        const streak = (breachStreak.get(key) || 0) + 1
        breachStreak.set(key, streak)
        if (streak < CONSECUTIVE_BREACHES_REQUIRED) return

        const existing = await prisma.notification.findFirst({ where: { dedupeKey, resolvedAt: null } })
        if (existing) return

        const notification = await prisma.notification.create({
            data: {
                type: 'AGENT_RESOURCE_HIGH',
                severity: 'warning',
                title: `${hostname}: ${label} at ${Math.round(value)}%`,
                message: `${label} usage on "${hostname}" has been at or above ${threshold}% for ${CONSECUTIVE_BREACHES_REQUIRED} consecutive heartbeats.`,
                link: `/agents/${agentId}`,
                dedupeKey,
                metadata: { agentId, metric, value, threshold },
            },
        })
        publishNotification(notification)
        return
    }

    breachStreak.delete(key)
    const resolved = await prisma.notification.updateMany({
        where: { dedupeKey, resolvedAt: null },
        data: { resolvedAt: new Date() },
    })
    if (resolved.count === 0) return

    const note = await prisma.notification.create({
        data: {
            type: 'AGENT_RESOURCE_NORMAL',
            severity: 'info',
            title: `${hostname}: ${label} back to normal`,
            message: `${label} usage on "${hostname}" dropped back below ${threshold}%.`,
            link: `/agents/${agentId}`,
            dedupeKey: `agent-${metric}-normal:${agentId}:${Date.now()}`,
            metadata: { agentId, metric, value, threshold },
        },
    })
    publishNotification(note)
}
