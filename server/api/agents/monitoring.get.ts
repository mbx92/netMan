import prisma from '../../utils/prisma'
import { agentManager } from '../../utils/agent-manager'
import { serializeAgentBigints } from '../../utils/serialize-agent'

type MonitoringModule = 'zimbra' | 'fail2ban'

function isMonitoringModule(value: unknown): value is MonitoringModule {
    return value === 'zimbra' || value === 'fail2ban'
}

export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const module = isMonitoringModule(query.module) ? query.module : null
    if (!module) {
        throw createError({ statusCode: 400, statusMessage: 'module must be zimbra or fail2ban' })
    }

    const agents = await prisma.agent.findMany({
        where: { platform: 'LINUX' },
        orderBy: [{ status: 'asc' }, { hostname: 'asc' }],
        select: {
            id: true,
            alias: true,
            hostname: true,
            lastIp: true,
            status: true,
            lastSeen: true,
            lastMetrics: true,
        },
    })

    return agents
        .map((agent) => {
            const metrics = agent.lastMetrics && typeof agent.lastMetrics === 'object' && !Array.isArray(agent.lastMetrics)
                ? agent.lastMetrics as Record<string, unknown>
                : null
            const snapshot = metrics?.[module]
            if (!snapshot) return null

            return serializeAgentBigints({
                id: agent.id,
                name: agent.alias,
                alias: agent.alias,
                hostname: agent.hostname,
                lastIp: agent.lastIp,
                status: agent.status,
                lastSeen: agent.lastSeen,
                isConnected: agentManager.isOnline(agent.id),
                lastMetrics: { [module]: snapshot },
            })
        })
        .filter(Boolean)
})
