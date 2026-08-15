import prisma from '../../utils/prisma'
import { agentManager } from '../../utils/agent-manager'

// GET /api/agents - List all agents
export default defineEventHandler(async () => {
    const agents = await prisma.agent.findMany({
        orderBy: [{ status: 'asc' }, { hostname: 'asc' }],
        include: { device: { select: { id: true, name: true, ip: true, siteId: true } } },
    })

    return agents.map(({ enrollTokenHash, authKeyHash, vncPassword, ...agent }) => ({
        ...agent,
        isConnected: agentManager.isOnline(agent.id),
    }))
})
