import prisma from '../../utils/prisma'
import { agentManager } from '../../utils/agent-manager'
import { serializeAgentBigints } from '../../utils/serialize-agent'

// GET /api/agents - List all agents
export default defineEventHandler(async () => {
    const agents = await prisma.agent.findMany({
        orderBy: [{ status: 'asc' }, { hostname: 'asc' }],
        include: { device: { select: { id: true, name: true, ip: true, siteId: true } } },
    })

    return agents.map(({ enrollTokenHash, authKeyHash, vncPassword, ...agent }) => ({
        ...serializeAgentBigints(agent),
        isConnected: agentManager.isOnline(agent.id),
    }))
})
