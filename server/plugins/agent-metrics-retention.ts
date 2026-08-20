/**
 * Prunes AgentMetricSample rows older than AGENT_METRIC_RETENTION_DAYS
 * (default 14) so the history table doesn't grow unbounded — at the default
 * 30s heartbeat interval that's ~40k rows/agent over 14 days, still cheap,
 * but there's no reason to keep it forever. Modeled on
 * agent-offline-watcher.ts's Nitro-plugin-with-setInterval pattern.
 */
import prisma from '../utils/prisma'

const SWEEP_INTERVAL_MS = Number(process.env.AGENT_METRIC_RETENTION_SWEEP_MS) || 6 * 60 * 60 * 1000 // 6h
const RETENTION_DAYS = Number(process.env.AGENT_METRIC_RETENTION_DAYS) || 14

export default defineNitroPlugin((nitroApp) => {
    let running = false
    const prune = () => {
        if (running) return
        running = true
        pruneOldSamples()
            .catch((e) => console.error('[AgentMetricsRetention] Prune failed:', e))
            .finally(() => { running = false })
    }

    prune() // also run once at boot, not just after the first interval elapses
    const timer = setInterval(prune, SWEEP_INTERVAL_MS)
    nitroApp.hooks.hook('close', () => clearInterval(timer))
})

async function pruneOldSamples() {
    if (typeof prisma.agentMetricSample?.deleteMany !== 'function') {
        console.warn(
            '[AgentMetricsRetention] Prisma client has no AgentMetricSample — run npx prisma generate and restart the dev server',
        )
        return
    }
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const result = await prisma.agentMetricSample.deleteMany({ where: { recordedAt: { lt: cutoff } } })
    if (result.count > 0) {
        console.log(`[AgentMetricsRetention] Pruned ${result.count} samples older than ${RETENTION_DAYS}d`)
    }
}
