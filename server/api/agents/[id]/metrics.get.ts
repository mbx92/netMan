import prisma from '../../../utils/prisma'

const MAX_HOURS = 24 * 30 // matches the outer bound of AGENT_METRIC_RETENTION_DAYS's default range

// GET /api/agents/[id]/metrics?hours=24 - Time-series history for the agent detail page's charts.
export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Agent ID is required' })

    const query = getQuery(event)
    const hours = Math.min(Math.max(Number(query.hours) || 24, 1), MAX_HOURS)
    const since = new Date(Date.now() - hours * 60 * 60 * 1000)

    const samples = await prisma.agentMetricSample.findMany({
        where: { agentId: id, recordedAt: { gte: since } },
        orderBy: { recordedAt: 'asc' },
        select: {
            recordedAt: true,
            cpuPercent: true,
            memPercent: true,
            diskPercent: true,
            swapPercent: true,
            netRxBytesPerSec: true,
            netTxBytesPerSec: true,
            diskReadBytesPerSec: true,
            diskWriteBytesPerSec: true,
            loadAvg1: true,
        },
    })

    return { samples, hours }
})
